import { NextResponse } from "next/server"

import {
  resolveSettingsContext,
  isMissingSchema,
  type SettingsContext,
} from "@/lib/settings/server"
import {
  validateZoneInput,
  normalizeZoneName,
  buildZoneOverview,
  type Zone,
  type ZoneTableInput,
} from "@/lib/zones"

/**
 * Spaces / Zones collection endpoint (Phase 12B).
 *   GET  /api/admin/zones?restaurant=<slug>&restaurantId=<uuid>
 *   POST /api/admin/zones   body: { restaurant, restaurantId?, name?, zone }
 *
 * Restaurant scope is resolved with the same find-or-create helper the
 * Settings and Schedule routes use, so zone rows always attach to a valid
 * restaurant. Table statistics are derived (never stored) by matching the
 * free-text `tables.zone` column by name — no destructive migration needed.
 */

const MIGRATION_HINT =
  "Zone storage isn't set up yet. Run scripts/009_spaces_zones.sql, then try again."

const SELECT =
  "id, restaurant_id, name, description, active, reservable, display_order, capacity_override, color_tag, internal_notes"

type Row = {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  active: boolean
  reservable: boolean
  display_order: number
  capacity_override: number | null
  color_tag: string | null
  internal_notes: string | null
}

function rowToZone(row: Row): Zone {
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    name: row.name,
    description: row.description ?? null,
    active: row.active,
    reservable: row.reservable,
    display_order: row.display_order,
    capacity_override: row.capacity_override ?? null,
    color_tag: row.color_tag ?? null,
    internal_notes: row.internal_notes ?? null,
  }
}

/**
 * Load the restaurant's tables (by restaurant_name) so we can derive per-zone
 * table counts and seats. Tables are scoped by name (legacy model), so we
 * resolve the name from the restaurant_id first. Degrades to [] gracefully.
 */
async function loadTables(
  ctx: SettingsContext,
): Promise<ZoneTableInput[]> {
  const { data: restaurant } = await ctx.supabase
    .from("restaurants")
    .select("name")
    .eq("id", ctx.restaurantId)
    .maybeSingle()

  const restaurantName = (restaurant as { name?: string } | null)?.name
  if (!restaurantName) return []

  // Prefer the full select (zone/blocked from migration 004); degrade if the
  // columns don't exist yet so stats still render (as zero-zone tables).
  async function run(columns: string) {
    return ctx.supabase
      .from("tables")
      .select(columns)
      .eq("restaurant_name", restaurantName)
      .eq("active", true)
  }

  let { data, error } = await run("capacity, zone, blocked")
  if (error && error.code === "42703") {
    ;({ data, error } = await run("capacity, zone"))
  }
  if (error && error.code === "42703") {
    ;({ data, error } = await run("capacity"))
  }
  if (error) return []

  return ((data ?? []) as unknown as ZoneTableInput[]).map((t) => ({
    capacity: Number(t.capacity) || 0,
    zone: t.zone ?? null,
    blocked: t.blocked ?? false,
    active: true,
  }))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const guard = await resolveSettingsContext({
    slug: searchParams.get("restaurant"),
    id: searchParams.get("restaurantId"),
    name: searchParams.get("name"),
  })

  // When Supabase isn't configured, return an empty overview so the UI renders.
  if (!guard.ok) {
    if (guard.status === 503) {
      return NextResponse.json({
        zones: [],
        unregistered: [],
        configured: false,
      })
    }
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { data, error } = await guard.ctx.supabase
    .from("restaurant_zones")
    .select(SELECT)
    .eq("restaurant_id", guard.ctx.restaurantId)
    .order("display_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    if (isMissingSchema(error)) {
      // Table not created yet — still surface any table-derived zones so the
      // user sees their existing areas and can import them after migrating.
      const tables = await loadTables(guard.ctx)
      const { unregistered } = buildZoneOverview([], tables)
      return NextResponse.json({
        zones: [],
        unregistered,
        configured: true,
        needsMigration: true,
      })
    }
    console.log("[v0] Zones GET error:", error.message)
    return NextResponse.json(
      { error: "We couldn't load zones. Please try again." },
      { status: 500 },
    )
  }

  const zones = ((data ?? []) as Row[]).map(rowToZone)
  const tables = await loadTables(guard.ctx)
  const overview = buildZoneOverview(zones, tables)

  return NextResponse.json({
    zones: overview.zones,
    unregistered: overview.unregistered,
    configured: true,
  })
}

export async function POST(request: Request) {
  let body: {
    restaurant?: string
    restaurantId?: string
    name?: string
    zone?: Record<string, unknown>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const z = body.zone
  if (!z || typeof z !== "object") {
    return NextResponse.json(
      { error: "Zone details are required." },
      { status: 400 },
    )
  }

  const valid = validateZoneInput(z)
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 422 })
  }

  const guard = await resolveSettingsContext({
    slug: body.restaurant,
    id: body.restaurantId,
    name: body.name,
  })
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const name = String(z.name).trim()

  // Case-insensitive duplicate guard (mirrors the unique index) with a clear
  // message before we hit the DB constraint.
  const { data: existing, error: dupErr } = await guard.ctx.supabase
    .from("restaurant_zones")
    .select("id, name")
    .eq("restaurant_id", guard.ctx.restaurantId)

  if (dupErr) {
    if (isMissingSchema(dupErr)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    console.log("[v0] Zones POST dup-check error:", dupErr.message)
    return NextResponse.json(
      { error: "We couldn't save the zone. Please try again." },
      { status: 500 },
    )
  }

  const key = normalizeZoneName(name)
  if (
    ((existing ?? []) as { name: string }[]).some(
      (row) => normalizeZoneName(row.name) === key,
    )
  ) {
    return NextResponse.json(
      { error: `A zone named "${name}" already exists.` },
      { status: 409 },
    )
  }

  // New zones append to the end of the current order unless one is provided.
  const nextOrder =
    z.display_order !== undefined && z.display_order !== null
      ? Number(z.display_order)
      : ((existing ?? []) as unknown[]).length

  const insert = {
    restaurant_id: guard.ctx.restaurantId,
    name,
    description: typeof z.description === "string" ? z.description.trim() || null : null,
    active: z.active === undefined ? true : Boolean(z.active),
    reservable: z.reservable === undefined ? true : Boolean(z.reservable),
    display_order: nextOrder,
    capacity_override:
      z.capacity_override === undefined || z.capacity_override === null
        ? null
        : Number(z.capacity_override),
    color_tag: typeof z.color_tag === "string" ? z.color_tag : null,
    internal_notes:
      typeof z.internal_notes === "string" ? z.internal_notes.trim() || null : null,
  }

  const { data: created, error: insertErr } = await guard.ctx.supabase
    .from("restaurant_zones")
    .insert(insert)
    .select(SELECT)
    .single()

  if (insertErr) {
    if (isMissingSchema(insertErr)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    // 23505 = unique_violation (raced past the soft check).
    if (insertErr.code === "23505") {
      return NextResponse.json(
        { error: `A zone named "${name}" already exists.` },
        { status: 409 },
      )
    }
    console.log("[v0] Zones POST error:", insertErr.message)
    return NextResponse.json(
      { error: "We couldn't save the zone. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({ zone: rowToZone(created as Row) }, { status: 201 })
}
