import type { SupabaseClient } from "@supabase/supabase-js"

import { getSupabaseClient } from "@/lib/supabase"
import { defaultRestaurant } from "@/lib/restaurants"
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

/** Postgres error code for "row violates row-level security policy". */
const RLS_VIOLATION = "42501"

export function isMissingSchema(err: { code?: string } | null): boolean {
  return Boolean(err?.code && UNDEFINED.has(err.code))
}

const UUID_RE = /^[0-9a-f-]{36}$/i

/** "maison-laurent" -> "Maison Laurent" (used when seeding a fresh record). */
function titleizeSlug(slug: string): string {
  return (
    slug
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ") || "My Restaurant"
  )
}

/** "My Restaurant" -> "my-restaurant" (used when only a name is provided). */
function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "restaurant"
  )
}

/**
 * Find the restaurant matching the given id/slug/name, creating it on demand
 * when it does not exist yet. This guarantees the first workspace always has a
 * persisted `restaurants` row (the KV/list tables require a valid FK), so
 * Settings never 404s and Save Changes can always succeed.
 */
async function findOrCreateRestaurant(
  supabase: SupabaseClient,
  params: { id?: string | null; slug?: string | null; name?: string | null },
): Promise<{ ok: true; id: string } | { ok: false; status: number; error: string }> {
  // 1. Explicit uuid — trust it only if the row actually exists.
  if (params.id && UUID_RE.test(params.id)) {
    const { data, error } = await supabase
      .from("restaurants")
      .select("id")
      .eq("id", params.id)
      .maybeSingle()
    if (error && !isMissingSchema(error)) {
      console.log("[v0] findOrCreateRestaurant id lookup error:", error.message)
    }
    if (data) return { ok: true, id: data.id as string }
    // Otherwise fall through to resolve/seed by slug or name.
  }

  const slug = params.slug?.trim() || null
  const name = params.name?.trim() || null
  if (!slug && !name) {
    return { ok: false, status: 400, error: "A restaurant is required." }
  }

  // 2. Look up an existing row by slug (preferred) or name.
  const column = slug ? "slug" : "name"
  const value = (slug ?? name) as string
  const { data: found, error: findErr } = await supabase
    .from("restaurants")
    .select("id")
    .eq(column, value)
    .maybeSingle()

  if (findErr) {
    console.log("[v0] findOrCreateRestaurant find error:", findErr.message)
    return { ok: false, status: 500, error: "Could not resolve the restaurant." }
  }
  if (found) return { ok: true, id: found.id as string }

  // 3. Nothing exists yet — auto-seed so onboarding always has a record.
  const seedSlug = slug ?? slugify(name as string)
  const isDefault = seedSlug === defaultRestaurant.slug
  const seed: Record<string, unknown> = {
    name: name ?? (isDefault ? defaultRestaurant.name : titleizeSlug(seedSlug)),
    slug: seedSlug,
    active: true,
  }
  if (isDefault) {
    seed.description = defaultRestaurant.description
    seed.location = defaultRestaurant.location
  }

  const { data: created, error: createErr } = await supabase
    .from("restaurants")
    .upsert(seed, { onConflict: "slug" })
    .select("id")
    .maybeSingle()

  if (created) return { ok: true, id: created.id as string }

  // 4. A concurrent request may have created it first — re-select by slug.
  const { data: retry } = await supabase
    .from("restaurants")
    .select("id")
    .eq("slug", seedSlug)
    .maybeSingle()
  if (retry) return { ok: true, id: retry.id as string }

  console.log(
    "[v0] findOrCreateRestaurant seed error:",
    createErr?.message ?? "unknown",
  )
  return { ok: false, status: 500, error: "Could not create the restaurant." }
}

/**
 * Resolve the restaurant id from a slug, name, or explicit id passed by the
 * client, returning a ready-to-use context or an error status. Auto-creates
 * the restaurant when missing so the first workspace never 404s.
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

  const result = await findOrCreateRestaurant(supabase, params)
  if (!result.ok) return result
  return { ok: true, ctx: { supabase, restaurantId: result.id } }
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
    if (error.code === RLS_VIOLATION) {
      return {
        ok: false,
        status: 409,
        error:
          "Settings storage is blocked by row-level security. Run scripts/006_settings_rls_fix.sql, then try again.",
      }
    }
    console.log("[v0] saveKvSection error:", error.message, error.code)
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
