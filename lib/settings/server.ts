import type { SupabaseClient } from "@supabase/supabase-js"

import { getSupabaseClient } from "@/lib/supabase"
import {
  KV_SECTIONS,
  parseSection,
  type KvSectionKey,
} from "@/lib/settings/schemas"

/**
 * Server-side helpers shared by every Settings API route. All functions are
 * defensive: when Supabase isn't configured they signal so the route can
 * return a graceful 503, and "missing table/column" errors are reported as a
 * dedicated state so the UI can prompt the user to run migration 005.
 */

export type SettingsContext = {
  supabase: SupabaseClient
  restaurantId: string
}

export type SettingsGuard =
  | { ok: true; ctx: SettingsContext }
  | { ok: false; status: number; error: string }

/** Postgres error code for "relation/column does not exist". */
const UNDEFINED = new Set(["42P01", "42703"])

export function isMissingSchema(err: { code?: string } | null): boolean {
  return Boolean(err?.code && UNDEFINED.has(err.code))
}

/**
 * Resolve the restaurant id from a slug, name, or explicit id passed by the
 * client, returning a ready-to-use context or an error status.
 */
export async function resolveSettingsContext(params: {
  id?: string | null
  slug?: string | null
  name?: string | null
}): Promise<SettingsGuard> {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return {
      ok: false,
      status: 503,
      error:
        "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to persist settings.",
    }
  }

  // Prefer an explicit uuid.
  if (params.id && /^[0-9a-f-]{36}$/i.test(params.id)) {
    return { ok: true, ctx: { supabase, restaurantId: params.id } }
  }

  const column = params.slug ? "slug" : "name"
  const value = params.slug ?? params.name
  if (!value) {
    return { ok: false, status: 400, error: "A restaurant is required." }
  }

  const { data, error } = await supabase
    .from("restaurants")
    .select("id")
    .eq(column, value)
    .maybeSingle()

  if (error) {
    console.log("[v0] resolveSettingsContext error:", error.message)
    return { ok: false, status: 500, error: "Could not resolve the restaurant." }
  }
  if (!data) {
    return { ok: false, status: 404, error: "Restaurant not found." }
  }
  return { ok: true, ctx: { supabase, restaurantId: data.id as string } }
}

/** Load and validate one KV section, applying defaults for missing fields. */
export async function loadKvSection<K extends KvSectionKey>(
  ctx: SettingsContext,
  section: K,
): Promise<
  | { ok: true; data: (typeof KV_SECTIONS)[K]["default"] }
  | { ok: false; status: number; error: string; needsMigration?: boolean }
> {
  const { data, error } = await ctx.supabase
    .from("restaurant_settings_kv")
    .select("data")
    .eq("restaurant_id", ctx.restaurantId)
    .eq("section", section)
    .maybeSingle()

  if (error) {
    if (isMissingSchema(error)) {
      // Table not created yet — return defaults so the form still renders.
      return { ok: true, data: KV_SECTIONS[section].default }
    }
    console.log("[v0] loadKvSection error:", error.message)
    return { ok: false, status: 500, error: "Could not load settings." }
  }

  return { ok: true, data: parseSection(section, data?.data ?? null) }
}

/** Upsert one KV section row. */
export async function saveKvSection<K extends KvSectionKey>(
  ctx: SettingsContext,
  section: K,
  value: (typeof KV_SECTIONS)[K]["default"],
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { error } = await ctx.supabase
    .from("restaurant_settings_kv")
    .upsert(
      {
        restaurant_id: ctx.restaurantId,
        section,
        data: value as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "restaurant_id,section" },
    )

  if (error) {
    if (isMissingSchema(error)) {
      return {
        ok: false,
        status: 409,
        error:
          "Settings storage isn't set up yet. Run scripts/005_settings_center.sql, then try again.",
      }
    }
    console.log("[v0] saveKvSection error:", error.message)
    return { ok: false, status: 500, error: "Could not save settings." }
  }
  return { ok: true }
}

/**
 * Best-effort audit log write. Never throws and never blocks the main action;
 * silently no-ops when the table is absent.
 */
export async function logAudit(
  ctx: SettingsContext,
  entry: {
    actorEmail?: string | null
    action: string
    section?: string | null
    summary?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  try {
    const { error } = await ctx.supabase.from("audit_log").insert({
      restaurant_id: ctx.restaurantId,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      section: entry.section ?? null,
      summary: entry.summary ?? null,
      metadata: entry.metadata ?? {},
    })
    if (error && !isMissingSchema(error)) {
      console.log("[v0] logAudit error:", error.message)
    }
  } catch (err) {
    console.log(
      "[v0] logAudit threw:",
      err instanceof Error ? err.message : err,
    )
  }
}
