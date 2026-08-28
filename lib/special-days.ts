/**
 * Shared Special Days domain model (Phase 12C). Used by both the API routes
 * (validation) and the Special Days view (rendering + client-side validation).
 * Pure and framework-agnostic.
 *
 * A Special Day overrides the recurring weekly Schedule for one calendar date.
 * Time-of-day helpers (timeToMinutes, formatTime, overnight handling) are
 * reused from lib/schedule.ts so both modules behave identically.
 */

import {
  timeToMinutes,
  effectiveEndMinutes,
  validatePeriod,
  type ValidationResult,
} from "@/lib/schedule"

export {
  timeToMinutes,
  formatTime,
  isOvernight,
  effectiveEndMinutes,
  BOOKING_INTERVALS,
  DURATION_PRESETS,
  SERVICE_TYPE_SUGGESTIONS,
} from "@/lib/schedule"

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type SpecialDayPeriod = {
  id: string
  special_day_id: string
  name: string
  /** "HH:MM" 24-hour. */
  start_time: string
  /** "HH:MM" 24-hour. May be <= start_time to represent an overnight service. */
  end_time: string
  booking_interval_minutes: number
  default_duration_minutes: number
  min_party_size: number
  max_party_size: number
  display_order: number
}

/** A period draft before persistence (no id / parent yet). */
export type SpecialDayPeriodInput = Omit<
  SpecialDayPeriod,
  "id" | "special_day_id" | "display_order"
> & { display_order?: number }

export type SpecialDay = {
  id: string
  restaurant_id: string
  /** "YYYY-MM-DD". */
  special_date: string
  name: string
  type: SpecialDayType
  is_open: boolean
  description: string | null
  internal_notes: string | null
  periods: SpecialDayPeriod[]
}

/* ------------------------------------------------------------------ */
/* Types (special-day categories)                                      */
/* ------------------------------------------------------------------ */

export const SPECIAL_DAY_TYPES = [
  { value: "holiday", label: "Holiday" },
  { value: "private_event", label: "Private Event" },
  { value: "maintenance", label: "Maintenance" },
  { value: "special_service", label: "Special Service" },
  { value: "other", label: "Other" },
] as const

export type SpecialDayType = (typeof SPECIAL_DAY_TYPES)[number]["value"]

const TYPE_VALUES = new Set(SPECIAL_DAY_TYPES.map((t) => t.value))

export function isValidType(value: unknown): value is SpecialDayType {
  return typeof value === "string" && TYPE_VALUES.has(value as SpecialDayType)
}

export function typeLabel(value: string): string {
  return SPECIAL_DAY_TYPES.find((t) => t.value === value)?.label ?? "Other"
}

/* ------------------------------------------------------------------ */
/* Date helpers                                                        */
/* ------------------------------------------------------------------ */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** True when value is a well-formed, real "YYYY-MM-DD" calendar date. */
export function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false
  const [y, m, d] = value.split("-").map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return false
  // Round-trip through Date to reject impossible dates (e.g. 2026-02-31).
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  )
}

/** Normalize a Postgres `date` value ("YYYY-MM-DD" or ISO) to "YYYY-MM-DD". */
export function normalizeDate(value: unknown): string {
  if (typeof value !== "string") return ""
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim())
  return match ? match[1] : ""
}

/** Today's local date as "YYYY-MM-DD". */
export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** True when the given date string is strictly before today (local). */
export function isPast(dateStr: string, now: Date = new Date()): boolean {
  return normalizeDate(dateStr) < todayISO(now)
}

/** "2026-12-24" -> "Dec 24, 2026". Falls back to the input when malformed. */
export function formatSpecialDate(value: string): string {
  const iso = normalizeDate(value)
  if (!iso) return value
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

/** "2026-12-24" -> "Thursday". Falls back to "" when malformed. */
export function weekdayName(value: string): string {
  const iso = normalizeDate(value)
  if (!iso) return ""
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

export type { ValidationResult }

/** Re-export the shared per-period field validator (008). */
export const validateServicePeriod = validatePeriod

/** Validate the top-level Special Day fields (excludes child periods). */
export function validateSpecialDay(input: {
  special_date?: unknown
  name?: unknown
  type?: unknown
}): ValidationResult {
  if (!isValidDate(input.special_date)) {
    return { ok: false, error: "A valid date is required." }
  }
  if (typeof input.name !== "string" || !input.name.trim()) {
    return { ok: false, error: "A name is required." }
  }
  if (input.name.trim().length > 80) {
    return { ok: false, error: "Name must be 80 characters or fewer." }
  }
  if (!isValidType(input.type)) {
    return { ok: false, error: "Invalid special-day type." }
  }
  return { ok: true }
}

/**
 * First period on the same date that overlaps `candidate`, or null. Overnight
 * services are compared in effective minutes. `ignoreIndex` skips the row
 * being edited (client draft arrays are index-keyed).
 */
export function findPeriodOverlap(
  candidate: { start_time: string; end_time: string },
  existing: { start_time: string; end_time: string }[],
  ignoreIndex?: number,
): number | null {
  const cStart = timeToMinutes(candidate.start_time)
  const cEnd = effectiveEndMinutes(candidate.start_time, candidate.end_time)
  if (cStart === null || cEnd === null) return null

  for (let i = 0; i < existing.length; i += 1) {
    if (i === ignoreIndex) continue
    const p = existing[i]
    const pStart = timeToMinutes(p.start_time)
    const pEnd = effectiveEndMinutes(p.start_time, p.end_time)
    if (pStart === null || pEnd === null) continue
    if (cStart < pEnd && pStart < cEnd) return i
  }
  return null
}

/**
 * Validate an entire set of periods for one date: each field-valid AND no two
 * overlapping. Returns the first problem found.
 */
export function validatePeriodSet(
  periods: {
    name?: string
    start_time: string
    end_time: string
    booking_interval_minutes: number
    default_duration_minutes: number
    min_party_size: number
    max_party_size: number
  }[],
): ValidationResult {
  for (const p of periods) {
    const field = validatePeriod(p)
    if (!field.ok) return field
  }
  for (let i = 0; i < periods.length; i += 1) {
    const overlap = findPeriodOverlap(periods[i], periods, i)
    if (overlap !== null && overlap < i) {
      return {
        ok: false,
        error: `"${periods[i].name ?? "Service"}" overlaps with "${periods[overlap].name ?? "Service"}" on the same date.`,
      }
    }
  }
  return { ok: true }
}

/* ------------------------------------------------------------------ */
/* Sorting / filtering                                                 */
/* ------------------------------------------------------------------ */

export type DayFilter = "upcoming" | "past" | "all"

/** Sort special days by date. Upcoming ascending; past descending (recent first). */
export function sortSpecialDays(
  days: SpecialDay[],
  filter: DayFilter,
  now: Date = new Date(),
): SpecialDay[] {
  const list = [...days]
  if (filter === "past") {
    return list.sort((a, b) => b.special_date.localeCompare(a.special_date))
  }
  // upcoming + all: chronological ascending.
  return list.sort((a, b) => a.special_date.localeCompare(b.special_date))
}

/** Apply the Upcoming / Past / All filter. */
export function filterSpecialDays(
  days: SpecialDay[],
  filter: DayFilter,
  now: Date = new Date(),
): SpecialDay[] {
  if (filter === "all") return days
  if (filter === "upcoming") return days.filter((d) => !isPast(d.special_date, now))
  return days.filter((d) => isPast(d.special_date, now))
}
