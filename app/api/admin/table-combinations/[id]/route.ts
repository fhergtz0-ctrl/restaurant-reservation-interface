import { NextResponse } from "next/server"

import { resolveSettingsContext } from "@/lib/settings/server"
import {
  validateCombinationInput,
  dedupeTableIds,
  COMBINATION_NAME_MAX,
} from "@/lib/table-combinations"
import {
  loadTableMap,
  duplicateName,
  COMBINATION_SELECT,
} from "@/lib/table-combinations-server"

/**
 * Single table combination endpoint (Phase 12D).
 *   PATCH  /api/admin/table-combinations/:id
 *          body: { restaurant, restaurantId?, combination: {...} }
 *   DELETE /api/admin/table-combinations/:id?restaurant=<slug>&restaurantId=<uuid>
 *
 * PATCH supports a lightweight toggle (just `active`) as well as a full edit.
 * When `tableIds` is present the member set is replaced (delete-all + insert),
 * mirroring the Special Days period pattern. Deleting a combination cascades
 * to its member rows via FK; physical tables are NEVER touched.
 */

const MIGRATION_HINT =
  "Table combination storage isn't set up yet. Run scripts/011_table_combinations.sql, then try again."

type ComboPatch = {
  name?: unknown
  active?: unknown
  capacityOverride?: unknown
  internalNotes?: unknown
  tableIds?: unknown
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!id) {
    return NextResponse.json(
      { error: "A combination id is required." },
      { status: 400 },
    )
  }

  let body: {
    restaurant?: string
    restaurantId?: string
    name?: string
    combination?: ComboPatch
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const c = body.combination
  if (!c || typeof c !== "object") {
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
  const ctx = guard.ctx

  // Load the current row to merge partial updates and confirm ownership.
  const { data: currentRow, error: loadErr } = await ctx.supabase
    .from("restaurant_table_combinations")
    .select(COMBINATION_SELECT)
    .eq("id", id)
    .eq("restaurant_id", ctx.restaurantId)
    .maybeSingle()

  if (loadErr) {
    if (loadErr.code === "42P01") {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    console.log("[v0] Combination PATCH load error:", loadErr.message)
    return NextResponse.json(
      { error: "We couldn't update the combination. Please try again." },
      { status: 500 },
    )
  }
  if (!currentRow) {
    return NextResponse.json(
      { error: "Combination not found." },
      { status: 404 },
    )
  }
  const current = currentRow as {
    id: string
    name: string
    active: boolean
    capacity_override: number | null
    internal_notes: string | null
  }

  const isFullEdit = c.tableIds !== undefined
  const nextName =
    typeof c.name === "string" && c.name.trim() ? c.name.trim() : current.name

  // Validate only what's changing. A bare toggle skips member/name rules.
  if (c.name !== undefined || isFullEdit || c.capacityOverride !== undefined) {
    const check = validateCombinationInput({
      name: nextName,
      // When members aren't being edited, satisfy the >=2 rule using the
      // stored set (validated by re-loading below only for full edits).
      tableIds: isFullEdit ? c.tableIds : ["__a", "__b"],
      capacityOverride:
        c.capacityOverride === undefined
          ? current.capacity_override
          : c.capacityOverride,
    })
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 422 })
    }
  }
  if (nextName.length > COMBINATION_NAME_MAX) {
    return NextResponse.json(
      {
        error: `Combination name must be ${COMBINATION_NAME_MAX} characters or fewer.`,
      },
      { status: 422 },
    )
  }

  // Enforce case-insensitive name uniqueness when the name changes.
  if (nextName.trim().toLowerCase() !== current.name.trim().toLowerCase()) {
    const dup = await duplicateName(ctx, nextName, id)
    if (dup.error) {
      if (dup.missingSchema) {
        return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
      }
      return NextResponse.json(
        { error: "We couldn't update the combination. Please try again." },
        { status: 500 },
      )
    }
    if (dup.exists) {
      return NextResponse.json(
        { error: `A combination named "${nextName}" already exists.` },
        { status: 409 },
      )
    }
  }

  // Validate the replacement member set against this restaurant's tables.
  let tableIds: string[] | null = null
  if (isFullEdit) {
    tableIds = dedupeTableIds(c.tableIds)
    const tableMap = await loadTableMap(ctx)
    const invalid = tableIds.filter((tid) => !tableMap.has(tid))
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          error: "One or more selected tables don't belong to this restaurant.",
        },
        { status: 422 },
      )
    }
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (c.name !== undefined) updates.name = nextName
  if (c.active !== undefined) updates.active = Boolean(c.active)
  if (c.capacityOverride !== undefined) {
    updates.capacity_override =
      c.capacityOverride === null ? null : Number(c.capacityOverride)
  }
  if (c.internalNotes !== undefined) {
    updates.internal_notes =
      typeof c.internalNotes === "string"
        ? c.internalNotes.trim() || null
        : null
  }

  const { error: updateErr } = await ctx.supabase
    .from("restaurant_table_combinations")
    .update(updates)
    .eq("id", id)
    .eq("restaurant_id", ctx.restaurantId)

  if (updateErr) {
    if (updateErr.code === "42P01") {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    if (updateErr.code === "23505") {
      return NextResponse.json(
        { error: `A combination named "${nextName}" already exists.` },
        { status: 409 },
      )
    }
    console.log("[v0] Combination PATCH update error:", updateErr.message)
    return NextResponse.json(
      { error: "We couldn't update the combination. Please try again." },
      { status: 500 },
    )
  }

  // Replace members when a new set was supplied.
  if (tableIds) {
    const { error: delErr } = await ctx.supabase
      .from("restaurant_table_combination_members")
      .delete()
      .eq("combination_id", id)
    if (delErr) {
      console.log("[v0] Combination PATCH member delete error:", delErr.message)
      return NextResponse.json(
        { error: "We couldn't update the combination's tables. Please try again." },
        { status: 500 },
      )
    }
    const memberRows = tableIds.map((table_id, i) => ({
      combination_id: id,
      table_id,
      display_order: i,
    }))
    const { error: insErr } = await ctx.supabase
      .from("restaurant_table_combination_members")
      .insert(memberRows)
    if (insErr) {
      console.log("[v0] Combination PATCH member insert error:", insErr.message)
      return NextResponse.json(
        { error: "We couldn't update the combination's tables. Please try again." },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ ok: true })
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

  // Member rows cascade-delete via FK; physical tables are never affected.
  const { error } = await guard.ctx.supabase
    .from("restaurant_table_combinations")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", guard.ctx.restaurantId)

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    console.log("[v0] Combination DELETE error:", error.message)
    return NextResponse.json(
      { error: "We couldn't delete the combination. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
