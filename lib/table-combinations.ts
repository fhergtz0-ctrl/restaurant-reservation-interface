/**
 * Shared Table Combinations domain model for the K'áanche platform (Phase 12D).
 * Used by both the API routes (validation) and the Combinations view
 * (rendering + client-side validation). Pure and framework-agnostic.
 *
 * Compatibility note: combination members reference existing physical tables
 * by UUID. Nothing here renames, rewrites, or re-scopes `public.tables` — the
 * legacy `restaurant_name` scoping and free-text `tables.zone` are read as-is.
 */

/** A physical table as seen by the combination editor / selector. */
export type SelectableTable = {
  id: string
  name: string
  capacity: number
  zone: string | null
  active: boolean
  blocked: boolean
}

/** A member of a combination, enriched with its resolved table (if it exists). */
export type CombinationMember = {
  table_id: string
  display_order: number
  /** Null when the referenced table can no longer be resolved (e.g. removed). */
  table: SelectableTable | null
}

/** A stored combination. */
export type TableCombination = {
  id: string
  restaurant_id: string
  name: string
  active: boolean
  capacity_override: number | null
  internal_notes: string | null
  members: CombinationMember[]
}

/** A combination enriched with derived capacity + zone summary for display. */
export type CombinationWithSummary = TableCombination & {
  /** Sum of resolved member table capacities. */
  calculated_capacity: number
  /** capacity_override when set, otherwise calculated_capacity. */
  effective_capacity: number
  zone_summary: ZoneSummary
  /** True when any member table_id could not be resolved. */
  has_missing_tables: boolean
}

export type ZoneSummary = {
  /** Distinct, non-empty zone names across resolved member tables. */
  zones: string[]
  /** True when resolved member tables span more than one zone. */
  mixed: boolean
  /** Display label: a zone name, "Mixed zones", or "No zone". */
  label: string
}

/* ------------------------------------------------------------------ */
/* Zone summary                                                        */
/* ------------------------------------------------------------------ */

function normalizeZone(name: string | null | undefined): string {
  return (name ?? "").trim()
}

/** Summarize the zones spanned by a combination's resolved member tables. */
export function buildZoneSummary(members: CombinationMember[]): ZoneSummary {
  const seen = new Map<string, string>() // lowercase -> display
  for (const m of members) {
    if (!m.table) continue
    const raw = normalizeZone(m.table.zone)
    if (!raw) continue
    const key = raw.toLowerCase()
    if (!seen.has(key)) seen.set(key, raw)
  }
  const zones = [...seen.values()].sort((a, b) => a.localeCompare(b))
  if (zones.length === 0) return { zones, mixed: false, label: "No zone" }
  if (zones.length === 1) return { zones, mixed: false, label: zones[0] }
  return { zones, mixed: true, label: "Mixed zones" }
}

/* ------------------------------------------------------------------ */
/* Capacity                                                            */
/* ------------------------------------------------------------------ */

/** Sum of resolved member table capacities (missing tables contribute 0). */
export function calculatedCapacity(members: CombinationMember[]): number {
  return members.reduce(
    (sum, m) => sum + (m.table ? Number(m.table.capacity) || 0 : 0),
    0,
  )
}

/** capacity_override when explicitly set (and positive), else calculated. */
export function effectiveCapacity(
  combo: Pick<TableCombination, "capacity_override">,
  calculated: number,
): number {
  return combo.capacity_override != null && combo.capacity_override > 0
    ? combo.capacity_override
    : calculated
}

/** Enrich a combination with derived capacity + zone summary. */
export function enrichCombination(
  combo: TableCombination,
): CombinationWithSummary {
  const calculated = calculatedCapacity(combo.members)
  return {
    ...combo,
    calculated_capacity: calculated,
    effective_capacity: effectiveCapacity(combo, calculated),
    zone_summary: buildZoneSummary(combo.members),
    has_missing_tables: combo.members.some((m) => !m.table),
  }
}

/* ------------------------------------------------------------------ */
/* Capacity preview (client editor, before save)                      */
/* ------------------------------------------------------------------ */

/** Calculated capacity for a set of selected tables (editor live summary). */
export function previewCalculatedCapacity(
  tables: SelectableTable[],
  selectedIds: Iterable<string>,
): number {
  const ids = new Set(selectedIds)
  return tables.reduce(
    (sum, t) => (ids.has(t.id) ? sum + (Number(t.capacity) || 0) : sum),
    0,
  )
}

/** Zone label for a set of selected tables (editor live summary). */
export function previewZoneSummary(
  tables: SelectableTable[],
  selectedIds: Iterable<string>,
): ZoneSummary {
  const ids = new Set(selectedIds)
  const members: CombinationMember[] = tables
    .filter((t) => ids.has(t.id))
    .map((t) => ({ table_id: t.id, display_order: 0, table: t }))
  return buildZoneSummary(members)
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export type ValidationResult = { ok: true } | { ok: false; error: string }

export const COMBINATION_NAME_MAX = 80
export const MIN_MEMBER_TABLES = 2

/** De-duplicate table ids while preserving order. */
export function dedupeTableIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids) {
    if (typeof raw !== "string") continue
    const id = raw.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * Field-level validation for a combination. `hadDuplicates` lets the caller
 * detect when the raw input contained duplicate table ids (rejected rather
 * than silently collapsed). Existence / cross-restaurant checks are done
 * server-side against the DB.
 */
export function validateCombinationInput(input: {
  name?: unknown
  tableIds?: unknown
  capacityOverride?: unknown
}): ValidationResult {
  const name = typeof input.name === "string" ? input.name.trim() : ""
  if (!name) return { ok: false, error: "Combination name is required." }
  if (name.length > COMBINATION_NAME_MAX) {
    return {
      ok: false,
      error: `Combination name must be ${COMBINATION_NAME_MAX} characters or fewer.`,
    }
  }

  if (Array.isArray(input.tableIds)) {
    const rawCount = input.tableIds.filter(
      (v) => typeof v === "string" && v.trim(),
    ).length
    const deduped = dedupeTableIds(input.tableIds)
    if (deduped.length !== rawCount) {
      return {
        ok: false,
        error: "A table can only be added to a combination once.",
      }
    }
    if (deduped.length < MIN_MEMBER_TABLES) {
      return {
        ok: false,
        error: `Select at least ${MIN_MEMBER_TABLES} tables for a combination.`,
      }
    }
  } else {
    return {
      ok: false,
      error: `Select at least ${MIN_MEMBER_TABLES} tables for a combination.`,
    }
  }

  if (
    input.capacityOverride !== undefined &&
    input.capacityOverride !== null
  ) {
    const cap = Number(input.capacityOverride)
    if (!Number.isInteger(cap) || cap <= 0) {
      return {
        ok: false,
        error: "Capacity override must be a whole number greater than 0.",
      }
    }
  }

  return { ok: true }
}
