import type { SettingsContext } from "@/lib/settings/server"
import {
  enrichCombination,
  type CombinationMember,
  type CombinationWithSummary,
  type SelectableTable,
  type TableCombination,
} from "@/lib/table-combinations"

/**
 * Server-side helpers shared by the Table Combinations API routes (Phase 12D).
 * Bridges the two scoping models: combinations are scoped by restaurant_id
 * (uuid), while the physical tables they reference are scoped by
 * restaurant_name (legacy text model). We resolve the name once, then load
 * tables so members can be validated and enriched.
 */

export const COMBINATION_SELECT =
  "id, restaurant_id, name, active, capacity_override, internal_notes"

/** Case-insensitive duplicate-name check, optionally excluding one id. */
export async function duplicateName(
  ctx: SettingsContext,
  name: string,
  excludeId: string | null,
): Promise<{ exists: boolean; error: boolean; missingSchema: boolean }> {
  const { data, error } = await ctx.supabase
    .from("restaurant_table_combinations")
    .select("id, name")
    .eq("restaurant_id", ctx.restaurantId)

  if (error) {
    return { exists: false, error: true, missingSchema: error.code === "42P01" }
  }
  const key = name.trim().toLowerCase()
  const exists = ((data ?? []) as { id: string; name: string }[]).some(
    (row) => row.id !== excludeId && row.name.trim().toLowerCase() === key,
  )
  return { exists, error: false, missingSchema: false }
}

export type ComboRow = {
  id: string
  restaurant_id: string
  name: string
  active: boolean
  capacity_override: number | null
  internal_notes: string | null
}

export type MemberRow = {
  id: string
  combination_id: string
  table_id: string
  display_order: number
}

/**
 * Load every physical table for the context's restaurant as a lookup map.
 * Includes inactive/blocked tables so the editor and cards can show their
 * status (a defined combination keeps such tables — they aren't auto-removed).
 * Degrades gracefully when floor-plan columns (migration 004) are absent.
 */
export async function loadTableMap(
  ctx: SettingsContext,
): Promise<Map<string, SelectableTable>> {
  const { data: restaurant } = await ctx.supabase
    .from("restaurants")
    .select("name")
    .eq("id", ctx.restaurantId)
    .maybeSingle()

  const restaurantName = (restaurant as { name?: string } | null)?.name
  const map = new Map<string, SelectableTable>()
  if (!restaurantName) return map

  async function run(columns: string) {
    return ctx.supabase
      .from("tables")
      .select(columns)
      .eq("restaurant_name", restaurantName)
  }

  // Degrade in steps depending on which migrations have been applied.
  let { data, error } = await run("id, name, capacity, zone, blocked, active")
  if (error && error.code === "42703") {
    ;({ data, error } = await run("id, name, capacity, zone, active"))
  }
  if (error && error.code === "42703") {
    ;({ data, error } = await run("id, name, capacity, active"))
  }
  if (error && error.code === "42703") {
    ;({ data, error } = await run("id, name, capacity"))
  }
  if (error || !data) return map

  for (const raw of data as unknown as Array<Record<string, unknown>>) {
    const id = String(raw.id)
    map.set(id, {
      id,
      name: String(raw.name ?? "Table"),
      capacity: Number(raw.capacity) || 0,
      zone: (raw.zone as string | null) ?? null,
      active: raw.active === undefined ? true : Boolean(raw.active),
      blocked: raw.blocked === undefined ? false : Boolean(raw.blocked),
    })
  }
  return map
}

/** Return the restaurant's selectable tables sorted for the editor/selector. */
export function tablesForSelector(
  map: Map<string, SelectableTable>,
): SelectableTable[] {
  return [...map.values()].sort((a, b) => {
    const zoneCmp = (a.zone ?? "").localeCompare(b.zone ?? "")
    if (zoneCmp !== 0) return zoneCmp
    return a.name.localeCompare(b.name, undefined, { numeric: true })
  })
}

/**
 * Load all combinations for the context's restaurant, enriched with member
 * tables, calculated/effective capacity, and zone summary. Returns null when
 * the schema is missing so the caller can surface a migration hint.
 */
export async function loadCombinations(
  ctx: SettingsContext,
  tableMap: Map<string, SelectableTable>,
): Promise<
  | { ok: true; combinations: CombinationWithSummary[] }
  | { ok: false; missingSchema: boolean; message?: string }
> {
  const { data: parents, error: parentErr } = await ctx.supabase
    .from("restaurant_table_combinations")
    .select(COMBINATION_SELECT)
    .eq("restaurant_id", ctx.restaurantId)
    .order("name", { ascending: true })

  if (parentErr) {
    if (parentErr.code === "42P01") {
      return { ok: false, missingSchema: true }
    }
    return { ok: false, missingSchema: false, message: parentErr.message }
  }

  const parentRows = (parents ?? []) as ComboRow[]
  if (parentRows.length === 0) return { ok: true, combinations: [] }

  const ids = parentRows.map((p) => p.id)
  const { data: memberData, error: memberErr } = await ctx.supabase
    .from("restaurant_table_combination_members")
    .select("id, combination_id, table_id, display_order")
    .in("combination_id", ids)
    .order("display_order", { ascending: true })

  if (memberErr && memberErr.code === "42P01") {
    return { ok: false, missingSchema: true }
  }

  const membersByCombo = new Map<string, MemberRow[]>()
  for (const m of (memberData ?? []) as MemberRow[]) {
    const list = membersByCombo.get(m.combination_id) ?? []
    list.push(m)
    membersByCombo.set(m.combination_id, list)
  }

  const combinations: CombinationWithSummary[] = parentRows.map((p) => {
    const memberRows = (membersByCombo.get(p.id) ?? []).sort(
      (a, b) => a.display_order - b.display_order,
    )
    const members: CombinationMember[] = memberRows.map((m) => ({
      table_id: m.table_id,
      display_order: m.display_order,
      table: tableMap.get(m.table_id) ?? null,
    }))
    const combo: TableCombination = {
      id: p.id,
      restaurant_id: p.restaurant_id,
      name: p.name,
      active: p.active,
      capacity_override: p.capacity_override ?? null,
      internal_notes: p.internal_notes ?? null,
      members,
    }
    return enrichCombination(combo)
  })

  return { ok: true, combinations }
}
