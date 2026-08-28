/**
 * Shared schedule domain model for the K'áanche Availability Engine (Phase
 * 12A). Used by both the API routes (validation) and the Schedule view
 * (rendering + client-side validation). Pure and framework-agnostic.
 *
 * day_of_week: 0 = Monday ... 6 = Sunday (matches the Mon–Sun UI order and the
 * check constraint in scripts/008_schedule.sql).
 */

export type ServicePeriod = {
  id: string
  restaurant_id: string
  day_of_week: number
  name: string
  /** "HH:MM" 24-hour. */
  start_time: string
  /** "HH:MM" 24-hour. May be <= start_time to represent an overnight service. */
  end_time: string
  booking_interval_minutes: number
  default_duration_minutes: number
  min_party_size: number
  max_party_size: number
  active: boolean
}

/** A new period before it is persisted (no id / restaurant_id yet). */
export type ServicePeriodInput = Omit<
  ServicePeriod,
  "id" | "restaurant_id" | "active"
> & { active?: boolean }

export const DAYS: { value: number; label: string; short: string }[] = [
  { value: 0, label: "Monday", short: "Mon" },
  { value: 1, label: "Tuesday", short: "Tue" },
  { value: 2, label: "Wednesday", short: "Wed" },
  { value: 3, label: "Thursday", short: "Thu" },
  { value: 4, label: "Friday", short: "Fri" },
  { value: 5, label: "Saturday", short: "Sat" },
  { value: 6, label: "Sunday", short: "Sun" },
]

export function dayLabel(day: number): string {
  return DAYS.find((d) => d.value === day)?.label ?? "—"
}

/** Suggested service labels. NOT tied to any availability rule — display only. */
export const SERVICE_TYPE_SUGGESTIONS = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Brunch",
  "Late Night",
  "Custom",
] as const

export const BOOKING_INTERVALS = [15, 30, 60] as const

export const DURATION_PRESETS = [60, 75, 90, 105, 120] as const

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

/** "HH:MM" -> minutes since midnight, or null when malformed. */
export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (h < 0 || h > 23 || m < 0 || m > 59) return null
  return h * 60 + m
}

/** Format a "HH:MM" 24-hour string as "1:00 PM". Falls back to the input. */
export function formatTime(value: string): string {
  const mins = timeToMinutes(value)
  if (mins === null) return value
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

/**
 * Effective end in minutes, accounting for overnight services. When end <=
 * start the service is treated as crossing midnight, so 24h are added.
 */
export function effectiveEndMinutes(start: string, end: string): number | null {
  const s = timeToMinutes(start)
  const e = timeToMinutes(end)
  if (s === null || e === null) return null
  return e <= s ? e + 1440 : e
}

export function isOvernight(start: string, end: string): boolean {
  const s = timeToMinutes(start)
  const e = timeToMinutes(end)
  if (s === null || e === null) return false
  return e < s || (e === 0 && s > 0)
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export type ValidationResult = { ok: true } | { ok: false; error: string }

/**
 * Validate a single service period in isolation (field-level rules). Overlap
 * with sibling periods is checked separately via `findOverlap`.
 */
export function validatePeriod(p: {
  name?: string
  start_time: string
  end_time: string
  booking_interval_minutes: number
  default_duration_minutes: number
  min_party_size: number
  max_party_size: number
  day_of_week?: number
}): ValidationResult {
  const start = timeToMinutes(p.start_time)
  const end = timeToMinutes(p.end_time)
  if (start === null) return { ok: false, error: "Start time is invalid." }
  if (end === null) return { ok: false, error: "End time is invalid." }

  // start == end is rejected (a zero-length window). Overnight (end < start)
  // is allowed and interpreted as crossing midnight.
  if (start === end) {
    return {
      ok: false,
      error: "Start and end time can't be the same.",
    }
  }

  if (!BOOKING_INTERVALS.includes(p.booking_interval_minutes as 15 | 30 | 60)) {
    return { ok: false, error: "Booking interval must be 15, 30, or 60 minutes." }
  }

  if (
    !Number.isInteger(p.default_duration_minutes) ||
    p.default_duration_minutes < 15 ||
    p.default_duration_minutes > 600
  ) {
    return {
      ok: false,
      error: "Reservation duration must be between 15 and 600 minutes.",
    }
  }

  if (
    !Number.isInteger(p.min_party_size) ||
    !Number.isInteger(p.max_party_size) ||
    p.min_party_size < 1 ||
    p.max_party_size < 1
  ) {
    return { ok: false, error: "Party sizes must be positive whole numbers." }
  }

  if (p.min_party_size > p.max_party_size) {
    return {
      ok: false,
      error: "Minimum party size can't be greater than the maximum.",
    }
  }

  if (p.day_of_week !== undefined && (p.day_of_week < 0 || p.day_of_week > 6)) {
    return { ok: false, error: "Invalid day of week." }
  }

  return { ok: true }
}

/** True when two time ranges (in effective minutes) overlap. */
function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

/**
 * Return the first existing period on the same day that overlaps `candidate`,
 * or null when there's no conflict. `ignoreId` skips a row (used when editing).
 */
export function findOverlap(
  candidate: { start_time: string; end_time: string; day_of_week: number },
  existing: ServicePeriod[],
  ignoreId?: string,
): ServicePeriod | null {
  const cStart = timeToMinutes(candidate.start_time)
  const cEnd = effectiveEndMinutes(candidate.start_time, candidate.end_time)
  if (cStart === null || cEnd === null) return null

  for (const period of existing) {
    if (period.id === ignoreId) continue
    if (period.day_of_week !== candidate.day_of_week) continue
    if (!period.active) continue
    const pStart = timeToMinutes(period.start_time)
    const pEnd = effectiveEndMinutes(period.start_time, period.end_time)
    if (pStart === null || pEnd === null) continue
    if (rangesOverlap(cStart, cEnd, pStart, pEnd)) return period
  }
  return null
}

/** Group periods by weekday (0–6), each list sorted by start time. */
export function groupByDay(
  periods: ServicePeriod[],
): Record<number, ServicePeriod[]> {
  const map: Record<number, ServicePeriod[]> = {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  }
  for (const p of periods) {
    if (map[p.day_of_week]) map[p.day_of_week].push(p)
  }
  for (const day of Object.keys(map)) {
    map[Number(day)].sort((a, b) => {
      const sa = timeToMinutes(a.start_time) ?? 0
      const sb = timeToMinutes(b.start_time) ?? 0
      return sa - sb
    })
  }
  return map
}
