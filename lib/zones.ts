/**
 * Shared Spaces / Zones domain model for the K'áanche platform (Phase 12B).
 * Used by both the API routes (validation) and the Spaces view (rendering +
 * client-side validation). Pure and framework-agnostic.
 *
 * Compatibility note: existing tables store their area as a free-text
 * `tables.zone` value (migration 004). Zones are linked to tables by NAME,
 * matched case-insensitively via `normalizeZoneName`. Nothing here rewrites
 * table rows.
 */

export type Zone = {
  id: string
  restaurant_id: string
  name: string
  description: string | null
  active: boolean
  reservable: boolean
  display_order: number
  /** Explicit capacity override. When null, capacity is derived from tables. */
  capacity_override: number | null
  color_tag: string | null
  internal_notes: string | null
}

/** Table-derived statistics for a zone (never persisted onto the zone). */
export type ZoneStats = {
  table_count: number
  total_seats: number
  active_tables: number
  blocked_tables: number
}

/** A managed zone plus its derived table stats and effective capacity. */
export type ZoneWithStats = Zone & {
  stats: ZoneStats
  /** capacity_override when set, otherwise the derived total seats. */
  effective_capacity: number
}

/**
 * A zone name found on existing tables that has no matching managed zone row
 * yet. Surfaced so the UI can offer a one-click import without rewriting
 * table data.
 */
export type UnregisteredZone = {
  name: string
  stats: ZoneStats
}

/** A minimal table shape (subset of AdminTable) used for stat derivation. */
export type ZoneTableInput = {
  capacity: number
  zone?: string | null
  blocked?: boolean | null
  active?: boolean | null
}

/* ------------------------------------------------------------------ */
/* Color tags                                                          */
/* ------------------------------------------------------------------ */

export type ZoneColor = {
  value: string
  label: string
  /** Swatch / dot classes (accent hues are allowed for zone identity). */
  dot: string
  /** Badge classes tuned for the dark premium theme. */
  badge: string
}

export const ZONE_COLORS: ZoneColor[] = [
  {
    value: "emerald",
    label: "Emerald",
    dot: "bg-emerald-500",
    badge:
      "bg-emerald-500/15 text-emerald-600 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400",
  },
  {
    value: "sky",
    label: "Sky",
    dot: "bg-sky-500",
    badge:
      "bg-sky-500/15 text-sky-600 ring-1 ring-inset ring-sky-500/30 dark:text-sky-400",
  },
  {
    value: "amber",
    label: "Amber",
    dot: "bg-amber-500",
    badge:
      "bg-amber-500/15 text-amber-600 ring-1 ring-inset ring-amber-500/30 dark:text-amber-400",
  },
  {
    value: "violet",
    label: "Violet",
    dot: "bg-violet-500",
    badge:
      "bg-violet-500/15 text-violet-600 ring-1 ring-inset ring-violet-500/30 dark:text-violet-400",
  },
  {
    value: "rose",
    label: "Rose",
    dot: "bg-rose-500",
    badge:
      "bg-rose-500/15 text-rose-600 ring-1 ring-inset ring-rose-500/30 dark:text-rose-400",
  },
  {
    value: "slate",
    label: "Slate",
    dot: "bg-slate-500",
    badge:
      "bg-slate-500/15 text-slate-600 ring-1 ring-inset ring-slate-500/30 dark:text-slate-300",
  },
]

export function zoneColor(value: string | null | undefined): ZoneColor {
  return ZONE_COLORS.find((c) => c.value === value) ?? ZONE_COLORS[0]
}

/** Suggested zone names (display only — no rules attached). */
export const ZONE_NAME_SUGGESTIONS = [
  "Main Dining",
  "Terrace",
  "Patio",
  "Bar",
  "VIP",
  "Private Room",
  "Lounge",
  "Garden",
] as const

/* ------------------------------------------------------------------ */
/* Name matching (bridge to existing tables.zone text)                 */
/* ------------------------------------------------------------------ */

/** Canonical key for case-insensitive zone-name matching / dedupe. */
export function normalizeZoneName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase()
}

/* ------------------------------------------------------------------ */
/* Derivation                                                          */
/* ------------------------------------------------------------------ */

const EMPTY_STATS: ZoneStats = {
  table_count: 0,
  total_seats: 0,
  active_tables: 0,
  blocked_tables: 0,
}

/** Compute stats for the subset of tables whose zone matches `zoneName`. */
export function deriveZoneStats(
  zoneName: string,
  tables: ZoneTableInput[],
): ZoneStats {
  const key = normalizeZoneName(zoneName)
  const stats: ZoneStats = { ...EMPTY_STATS }
  for (const t of tables) {
    if (normalizeZoneName(t.zone) !== key) continue
    stats.table_count += 1
    stats.total_seats += Number(t.capacity) || 0
    if (t.blocked) stats.blocked_tables += 1
    else stats.active_tables += 1
  }
  return stats
}

/** capacity_override when explicitly set, otherwise derived total seats. */
export function effectiveCapacity(
  zone: Pick<Zone, "capacity_override">,
  stats: ZoneStats,
): number {
  return zone.capacity_override != null
    ? zone.capacity_override
    : stats.total_seats
}

/**
 * Given the managed zones and the restaurant's tables, return each zone with
 * derived stats plus any "unregistered" zone names present on tables that
 * don't map to a managed zone yet.
 */
export function buildZoneOverview(
  zones: Zone[],
  tables: ZoneTableInput[],
): { zones: ZoneWithStats[]; unregistered: UnregisteredZone[] } {
  const withStats: ZoneWithStats[] = zones.map((z) => {
    const stats = deriveZoneStats(z.name, tables)
    return { ...z, stats, effective_capacity: effectiveCapacity(z, stats) }
  })

  const managedKeys = new Set(zones.map((z) => normalizeZoneName(z.name)))
  const unregisteredMap = new Map<string, { name: string }>()
  for (const t of tables) {
    const raw = (t.zone ?? "").trim()
    if (!raw) continue
    const key = normalizeZoneName(raw)
    if (managedKeys.has(key)) continue
    if (!unregisteredMap.has(key)) unregisteredMap.set(key, { name: raw })
  }

  const unregistered: UnregisteredZone[] = [...unregisteredMap.values()].map(
    (u) => ({ name: u.name, stats: deriveZoneStats(u.name, tables) }),
  )
  unregistered.sort((a, b) => a.name.localeCompare(b.name))

  return { zones: withStats, unregistered }
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export type ValidationResult = { ok: true } | { ok: false; error: string }

export const ZONE_NAME_MAX = 60

/**
 * Field-level validation for a zone. Duplicate-name detection is done
 * server-side against the database (case-insensitive), not here.
 */
export function validateZoneInput(input: {
  name?: unknown
  capacity_override?: unknown
  display_order?: unknown
}): ValidationResult {
  const name = typeof input.name === "string" ? input.name.trim() : ""
  if (!name) return { ok: false, error: "Zone name is required." }
  if (name.length > ZONE_NAME_MAX) {
    return {
      ok: false,
      error: `Zone name must be ${ZONE_NAME_MAX} characters or fewer.`,
    }
  }

  if (input.capacity_override !== undefined && input.capacity_override !== null) {
    const cap = Number(input.capacity_override)
    if (!Number.isInteger(cap) || cap < 0) {
      return {
        ok: false,
        error: "Capacity override must be a whole number of 0 or more.",
      }
    }
  }

  if (input.display_order !== undefined && input.display_order !== null) {
    const order = Number(input.display_order)
    if (!Number.isInteger(order) || order < 0) {
      return {
        ok: false,
        error: "Display order must be a whole number of 0 or more.",
      }
    }
  }

  return { ok: true }
}
