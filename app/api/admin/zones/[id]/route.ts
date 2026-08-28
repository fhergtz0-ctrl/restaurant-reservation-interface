import { NextResponse } from "next/server"

import {
  resolveSettingsContext,
  isMissingSchema,
  type SettingsContext,
} from "@/lib/settings/server"
import {
  validateZoneInput,
  normalizeZoneName,
  deriveZoneStats,
  type Zone,
  type ZoneTableInput,
} from "@/lib/zones"

/**
 * Single zone endpoint (Phase 12B).
 *   PATCH  /api/admin/zones/:id   body: { restaurant, restaurantId?, zone }
 *   DELETE /api/admin/zones/:id?restaurant=<slug>&restaurantId=<uuid>
 *
 * DELETE is blocked while tables still reference the zone (by name), so it can
 * never silently orphan tables.
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

/** Load active tables for the zone's restaurant (by name), degrading safely. */
async function loadTables(ctx: SettingsContext): Promise<ZoneTableInput[]> {
  const { data: restaurant } = await ctx.supabase
    .from("restaurants")
    .select("name")
    .eq("id", ctx.restaurantId)
    .maybeSingle()

  const restaurantName = (restaurant as { name?: string } | null)?.name
  if (!restaurantName) return []

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: "A zone id is required." }, { status: 400 })
  }

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
      { error: "Updated fields are required." },
      { status: 400 },
    )
  }

  const guard = await resolveSettingsContext({
    slug: body.restaurant,
    id: body.restaurantId,
    name: body.name,
  })
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  // Load the current row so we can merge partial updates and re-validate.
  const { data: currentRow, error: loadErr } = await guard.ctx.supabase
    .from("restaurant_zones")
    .select(SELECT)
    .eq("id", id)
    .eq("restaurant_id", guard.ctx.restaurantId)
    .maybeSingle()

  if (loadErr) {
    if (isMissingSchema(loadErr)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    console.log("[v0] Zone PATCH load error:", loadErr.message)
    return NextResponse.json(
      { error: "We couldn't update the zone. Please try again." },
      { status: 500 },
    )
  }
  if (!currentRow) {
    return NextResponse.json({ error: "Zone not found." }, { status: 404 })
  }
  const current = rowToZone(currentRow as Row)

  const merged = {
    name: typeof z.name === "string" && z.name.trim() ? z.name.trim() : current.name,
    capacity_override:
      z.capacity_override === undefined
        ? current.capacity_override
        : z.capacity_override === null
          ? null
          : Number(z.capacity_override),
    display_order:
      z.display_order === undefined
        ? current.display_order
        : Number(z.display_order),
  }

  const valid = validateZoneInput(merged)
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 422 })
  }

  // If the name changed, enforce the case-insensitive uniqueness rule.
  if (normalizeZoneName(merged.name) !== normalizeZoneName(current.name)) {
    const { data: siblings } = await guard.ctx.supabase
      .from("restaurant_zones")
      .select("id, name")
      .eq("restaurant_id", guard.ctx.restaurantId)
    const key = normalizeZoneName(merged.name)
    if (
      ((siblings ?? []) as { id: string; name: string }[]).some(
        (row) => row.id !== id && normalizeZoneName(row.name) === key,
      )
    ) {
      return NextResponse.json(
        { error: `A zone named "${merged.name}" already exists.` },
        { status: 409 },
      )
    }
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (z.name !== undefined) updates.name = merged.name
  if (z.description !== undefined) {
    updates.description =
      typeof z.description === "string" ? z.description.trim() || null : null
  }
  if (z.active !== undefined) updates.active = Boolean(z.active)
  if (z.reservable !== undefined) updates.reservable = Boolean(z.reservable)
  if (z.display_order !== undefined) updates.display_order = merged.display_order
  if (z.capacity_override !== undefined) {
    updates.capacity_override = merged.capacity_override
  }
  if (z.color_tag !== undefined) {
    updates.color_tag = typeof z.color_tag === "string" ? z.color_tag : null
  }
  if (z.internal_notes !== undefined) {
    updates.internal_notes =
      typeof z.internal_notes === "string" ? z.internal_notes.trim() || null : null
  }

  const { data: updated, error: updateErr } = await guard.ctx.supabase
    .from("restaurant_zones")
    .update(updates)
    .eq("id", id)
    .eq("restaurant_id", guard.ctx.restaurantId)
    .select(SELECT)
    .single()

  if (updateErr) {
    if (isMissingSchema(updateErr)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    if (updateErr.code === "23505") {
      return NextResponse.json(
        { error: `A zone named "${merged.name}" already exists.` },
        { status: 409 },
      )
    }
    console.log("[v0] Zone PATCH update error:", updateErr.message)
    return NextResponse.json(
      { error: "We couldn't update the zone. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({ zone: rowToZone(updated as Row) })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)

  const guard = await resolveSettingsContext({
    slug: searchParams.get("restaurant"),
    id: searchParams.get("restaurantId"),
    name: searchParams.get("name"),
  })
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  // Resolve the zone first so we know its name (needed to check tables).
  const { data: zoneRow, error: loadErr } = await guard.ctx.supabase
    .from("restaurant_zones")
    .select(SELECT)
    .eq("id", id)
    .eq("restaurant_id", guard.ctx.restaurantId)
    .maybeSingle()

  if (loadErr) {
    if (isMissingSchema(loadErr)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    console.log("[v0] Zone DELETE load error:", loadErr.message)
    return NextResponse.json(
      { error: "We couldn't delete the zone. Please try again." },
      { status: 500 },
    )
  }
  if (!zoneRow) {
    return NextResponse.json({ error: "Zone not found." }, { status: 404 })
  }
  const zone = rowToZone(zoneRow as Row)

  // Guard: never orphan tables. Block deletion while any table references it.
  const tables = await loadTables(guard.ctx)
  const stats = deriveZoneStats(zone.name, tables)
  if (stats.table_count > 0) {
    return NextResponse.json(
      {
        error: `This zone still contains ${stats.table_count} table${
          stats.table_count === 1 ? "" : "s"
        }. Reassign the tables before deleting it.`,
      },
      { status: 409 },
    )
  }

  const { error } = await guard.ctx.supabase
    .from("restaurant_zones")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", guard.ctx.restaurantId)

  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    console.log("[v0] Zone DELETE error:", error.message)
    return NextResponse.json(
      { error: "We couldn't delete the zone. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
