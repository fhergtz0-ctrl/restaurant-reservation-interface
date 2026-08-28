import { NextResponse } from "next/server"

import { resolveSettingsContext } from "@/lib/settings/server"
import {
  validateCombinationInput,
  dedupeTableIds,
} from "@/lib/table-combinations"
import {
  loadTableMap,
  tablesForSelector,
  loadCombinations,
  duplicateName,
  COMBINATION_SELECT,
} from "@/lib/table-combinations-server"

/**
 * Table Combinations collection endpoint (Phase 12D).
 *   GET  /api/admin/table-combinations?restaurant=<slug>&restaurantId=<uuid>
 *   POST /api/admin/table-combinations
 *        body: { restaurant, restaurantId?, name?, combination: {...} }
 *
 * Restaurant scope is resolved with the same find-or-create helper the
 * Settings / Schedule / Spaces routes use. Member tables reference existing
 * physical tables by UUID; physical tables are never modified.
 */

const MIGRATION_HINT =
  "Table combination storage isn't set up yet. Run scripts/011_table_combinations.sql, then try again."

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const guard = await resolveSettingsContext({
    slug: searchParams.get("restaurant"),
    id: searchParams.get("restaurantId"),
    name: searchParams.get("name"),
  })

  if (!guard.ok) {
    if (guard.status === 503) {
      return NextResponse.json({
        combinations: [],
        tables: [],
        configured: false,
      })
    }
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const tableMap = await loadTableMap(guard.ctx)
  const tables = tablesForSelector(tableMap)
  const result = await loadCombinations(guard.ctx, tableMap)

  if (!result.ok) {
    if (result.missingSchema) {
      // Tables still render so the user can build once the migration is run.
      return NextResponse.json({
        combinations: [],
        tables,
        configured: true,
        needsMigration: true,
      })
    }
    console.log("[v0] Combinations GET error:", result.message)
    return NextResponse.json(
      { error: "We couldn't load table combinations. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({
    combinations: result.combinations,
    tables,
    configured: true,
  })
}

export async function POST(request: Request) {
  let body: {
    restaurant?: string
    restaurantId?: string
    name?: string
    combination?: {
      name?: unknown
      active?: unknown
      capacityOverride?: unknown
      internalNotes?: unknown
      tableIds?: unknown
    }
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const c = body.combination
  if (!c || typeof c !== "object") {
    return NextResponse.json(
      { error: "Combination details are required." },
      { status: 400 },
    )
  }

  const valid = validateCombinationInput({
    name: c.name,
    tableIds: c.tableIds,
    capacityOverride: c.capacityOverride,
  })
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
  const ctx = guard.ctx

  const name = String(c.name).trim()
  const tableIds = dedupeTableIds(c.tableIds)

  // Validate every member table exists AND belongs to this restaurant.
  const tableMap = await loadTableMap(ctx)
  const invalid = tableIds.filter((id) => !tableMap.has(id))
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: "One or more selected tables don't belong to this restaurant." },
      { status: 422 },
    )
  }

  // Case-insensitive duplicate-name guard before hitting the DB constraint.
  const dup = await duplicateName(ctx, name, null)
  if (dup.error) {
    if (dup.missingSchema) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    return NextResponse.json(
      { error: "We couldn't save the combination. Please try again." },
      { status: 500 },
    )
  }
  if (dup.exists) {
    return NextResponse.json(
      { error: `A combination named "${name}" already exists.` },
      { status: 409 },
    )
  }

  const capacityOverride =
    c.capacityOverride === undefined || c.capacityOverride === null
      ? null
      : Number(c.capacityOverride)

  const { data: created, error: insertErr } = await ctx.supabase
    .from("restaurant_table_combinations")
    .insert({
      restaurant_id: ctx.restaurantId,
      name,
      active: c.active === undefined ? true : Boolean(c.active),
      capacity_override: capacityOverride,
      internal_notes:
        typeof c.internalNotes === "string"
          ? c.internalNotes.trim() || null
          : null,
    })
    .select(COMBINATION_SELECT)
    .single()

  if (insertErr) {
    if (insertErr.code === "42P01") {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    if (insertErr.code === "23505") {
      return NextResponse.json(
        { error: `A combination named "${name}" already exists.` },
        { status: 409 },
      )
    }
    console.log("[v0] Combinations POST insert error:", insertErr.message)
    return NextResponse.json(
      { error: "We couldn't save the combination. Please try again." },
      { status: 500 },
    )
  }

  const comboId = (created as { id: string }).id
  const memberRows = tableIds.map((table_id, i) => ({
    combination_id: comboId,
    table_id,
    display_order: i,
  }))

  const { error: memberErr } = await ctx.supabase
    .from("restaurant_table_combination_members")
    .insert(memberRows)

  if (memberErr) {
    // Roll back the parent so we never persist a member-less combination.
    await ctx.supabase
      .from("restaurant_table_combinations")
      .delete()
      .eq("id", comboId)
      .eq("restaurant_id", ctx.restaurantId)

    if (memberErr.code === "42P01") {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    console.log("[v0] Combinations POST members error:", memberErr.message)
    return NextResponse.json(
      { error: "We couldn't save the combination's tables. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({ id: comboId }, { status: 201 })
}
