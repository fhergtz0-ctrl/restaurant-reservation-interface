/**
 * K'áanche Availability Engine (Phase 12E) — the pure, deterministic core that
 * answers "can this restaurant accept a party of X on date Y at time Z?".
 *
 * Nothing here touches the network, React, or Supabase. It operates entirely
 * on already-batched source-of-truth data (see lib/availability-data.ts for
 * the server loader) so the same logic is unit-testable with hand-built
 * fixtures. Availability is ALWAYS computed dynamically — it is never stored.
 *
 * Time model
 * ----------
 *   Service periods store 24-hour "HH:MM" times (0=Mon..6=Sun weekdays live in
 *   the schedule). An end <= start means the service crosses midnight and is
 *   evaluated in "effective minutes" where the after-midnight tail is + 1440
 *   (reusing lib/schedule helpers so every module agrees).
 *
 *   Reservations store a 12-hour display string ("7:30 PM") with no duration
 *   column, so occupancy duration falls back to the service period's
 *   default_duration_minutes (see resolveReservationDuration).
 *
 * Conflict model
 * --------------
 *   Half-open intervals [start, end): a reservation ending at 21:30 does NOT
 *   conflict with a slot starting at 21:30. Only inventory-consuming statuses
 *   block (confirmed, seated — the existing ACTIVE_STATUSES helper). Finished /
 *   cancelled / no-show never block.
 */

import {
  timeToMinutes,
  effectiveEndMinutes,
} from "@/lib/schedule"
import { DEFAULT_STAY_MINUTES } from "@/lib/operations"
import { isActiveReservation, type ReservationStatus } from "@/lib/admin-data"

/* ------------------------------------------------------------------ */
/* Reason codes (machine-readable, never UI strings)                   */
/* ------------------------------------------------------------------ */

export const UNAVAILABLE_REASONS = [
  "restaurant_closed",
  "outside_service_hours",
  "party_size_not_supported",
  "no_tables",
  "all_tables_blocked",
  "all_tables_reserved",
  "no_combination_available",
] as const

export type UnavailableReason = (typeof UNAVAILABLE_REASONS)[number]

/** Human labels for the internal tester (the codes remain the contract). */
export const REASON_LABELS: Record<UnavailableReason, string> = {
  restaurant_closed: "Closed",
  outside_service_hours: "Outside service hours",
  party_size_not_supported: "Party size not supported",
  no_tables: "No suitable table",
  all_tables_blocked: "All suitable tables blocked",
  all_tables_reserved: "All suitable tables reserved",
  no_combination_available: "No table combination available",
}

/* ------------------------------------------------------------------ */
/* Engine input shapes (normalized, DB-agnostic)                       */
/* ------------------------------------------------------------------ */

export type EngineTable = {
  id: string
  name: string
  capacity: number
  active: boolean
  blocked: boolean
  /** Free-text zone from tables.zone (legacy), or null. */
  zone: string | null
}

export type EngineZone = {
  name: string
  active: boolean
  reservable: boolean
}

export type EngineReservation = {
  id: string
  tableId: string | null
  status: ReservationStatus
  /** Minutes since midnight (0..1439) parsed from the stored display time. */
  startMinutes: number
}

export type EngineCombinationMember = {
  tableId: string
  /** Resolved physical table, or null when it can no longer be found. */
  table: EngineTable | null
}

export type EngineCombination = {
  id: string
  name: string
  active: boolean
  /** capacity_override when set, otherwise sum of member capacities. */
  effectiveCapacity: number
  members: EngineCombinationMember[]
}

export type EnginePeriod = {
  /** Row id ("HH:MM" schedule/special-day period), or null for synthetic. */
  id: string | null
  name: string
  /** "HH:MM" 24-hour. */
  startTime: string
  /** "HH:MM" 24-hour; may be <= startTime for an overnight service. */
  endTime: string
  bookingIntervalMinutes: number
  defaultDurationMinutes: number
  minPartySize: number
  maxPartySize: number
}

export type AvailabilitySource = "special_day" | "weekly_schedule" | "none"

/** All source-of-truth data for ONE date, already scoped to one restaurant. */
export type AvailabilityData = {
  source: AvailabilitySource
  /** False when a Special Day marks the date closed (overrides schedule). */
  open: boolean
  specialDay: { name: string; type: string; isOpen: boolean } | null
  periods: EnginePeriod[]
  tables: EngineTable[]
  zones: EngineZone[]
  combinations: EngineCombination[]
  /** Blocking + non-blocking reservations for the date (engine filters). */
  reservations: EngineReservation[]
}

export type AvailabilityInput = {
  /** "YYYY-MM-DD". */
  date: string
  partySize: number
  /** Optional "HH:MM" or "h:mm AM/PM"; echoed and used to flag slots. */
  requestedTime?: string | null
}

/* ------------------------------------------------------------------ */
/* Result shapes                                                       */
/* ------------------------------------------------------------------ */

export type AllocationOption = {
  type: "table" | "combination"
  /** Combination id (undefined for a single table). */
  id?: string
  /** Combination name (undefined for a single table). */
  name?: string
  tableIds: string[]
  tableNames: string[]
  /** Effective seating capacity of the allocation. */
  capacity: number
  /** capacity - partySize (>= 0). */
  wasted: number
  /** Primary zone label ("Mixed zones" for a cross-zone combination). */
  zone: string | null
  /** Distinct zones spanned (length > 1 means mixed). */
  zones: string[]
}

export type SlotAvailability = {
  /** Display time, e.g. "7:00 PM". */
  time: string
  /** 24-hour "HH:MM" (wraps past midnight, e.g. "00:30"). */
  time24: string
  /** Effective minutes (may exceed 1440 for the after-midnight tail). */
  minutes: number
  available: boolean
  /** Ranked allocation options (best first). Empty when unavailable. */
  options: AllocationOption[]
  /** Set only when the exact requested time matches this slot. */
  requested?: boolean
  /** Machine-readable reason when `available` is false. */
  reason?: UnavailableReason
}

export type ServicePeriodAvailability = {
  id: string | null
  name: string
  startTime: string
  endTime: string
  overnight: boolean
  minPartySize: number
  maxPartySize: number
  bookingIntervalMinutes: number
  defaultDurationMinutes: number
  /** False when the party size is outside this period's min/max. */
  eligible: boolean
  reason?: UnavailableReason
  slots: SlotAvailability[]
}

export type AvailabilityResult = {
  date: string
  partySize: number
  /** Normalized "HH:MM" or null. */
  requestedTime: string | null
  source: AvailabilitySource
  open: boolean
  /** Top-level reason when the whole date is unavailable. */
  reason?: UnavailableReason
  /** Set when a requested time falls in no active service window. */
  requestedTimeReason?: UnavailableReason
  specialDay: { name: string; type: string; isOpen: boolean } | null
  servicePeriods: ServicePeriodAvailability[]
}

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Parse a stored reservation/display time into minutes since midnight,
 * accepting both 12-hour ("7:30 PM", the DB display format) and 24-hour
 * ("19:30") forms. Returns null when unparseable.
 */
export function parseClockToMinutes(value: string): number | null {
  const v = value.trim()
  const ampm = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(v)
  if (ampm) {
    let h = Number(ampm[1]) % 12
    const m = Number(ampm[2])
    if (ampm[3].toUpperCase() === "PM") h += 12
    if (m > 59) return null
    return h * 60 + m
  }
  return timeToMinutes(v)
}

/** Effective minutes (0..2879) -> "h:mm AM/PM", wrapping past midnight. */
export function formatMinutes(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`
}

/** Effective minutes -> 24-hour "HH:MM", wrapping past midnight. */
export function formatMinutes24(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

/** 0=Mon..6=Sun weekday for a "YYYY-MM-DD" date (UTC, avoids TZ drift). */
export function weekdayIndex(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim())
  if (!match) return null
  const [, y, m, d] = match.map(Number)
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0=Sun..6=Sat
  return (js + 6) % 7
}

/* ------------------------------------------------------------------ */
/* Zone reservability                                                  */
/* ------------------------------------------------------------------ */

/**
 * Build a predicate deciding whether a table's zone may be offered online.
 * A blank zone is allowed. A zone matching a managed row must be BOTH active
 * and reservable. A legacy zone with no managed row stays usable (backward
 * compatibility) — it is never auto-rejected.
 */
export function makeZoneChecker(
  zones: EngineZone[],
): (zoneName: string | null | undefined) => boolean {
  const map = new Map<string, { active: boolean; reservable: boolean }>()
  for (const z of zones) {
    map.set(z.name.trim().toLowerCase(), {
      active: z.active,
      reservable: z.reservable,
    })
  }
  return (zoneName) => {
    const raw = (zoneName ?? "").trim()
    if (!raw) return true
    const managed = map.get(raw.toLowerCase())
    if (!managed) return true // legacy, unmatched -> usable
    return managed.active && managed.reservable
  }
}

/* ------------------------------------------------------------------ */
/* Reservation occupancy                                               */
/* ------------------------------------------------------------------ */

type OccupyingReservation = {
  tableId: string
  startMinutes: number
  durationMinutes: number
}

/** True when minute M (0..1439) falls within period p (overnight-aware). */
function minuteInPeriod(minute: number, p: EnginePeriod): boolean {
  const s = timeToMinutes(p.startTime)
  const e = effectiveEndMinutes(p.startTime, p.endTime)
  if (s === null || e === null) return false
  const overnight = e > 1440
  const eff = overnight && minute < s ? minute + 1440 : minute
  return eff >= s && eff < e
}

/**
 * Resolve a reservation's occupancy duration. There is no duration column, so
 * we use the default_duration_minutes of whichever service period contains the
 * reservation's start, falling back to the shared operational default.
 */
export function resolveReservationDuration(
  startMinutes: number,
  periods: EnginePeriod[],
): number {
  for (const p of periods) {
    if (minuteInPeriod(startMinutes, p)) {
      return p.defaultDurationMinutes > 0
        ? p.defaultDurationMinutes
        : DEFAULT_STAY_MINUTES
    }
  }
  return DEFAULT_STAY_MINUTES
}

/**
 * True when a blocking reservation on `tableId` overlaps the half-open slot
 * interval [slotStart, slotEnd) within the given period frame. Overnight
 * reservations (raw minute before the service start) are lifted by 1440 so
 * they share the slot's effective-minute space.
 */
function tableHasConflict(
  tableId: string,
  slotStart: number,
  slotEnd: number,
  occupancy: OccupyingReservation[],
  overnight: boolean,
  periodStart: number,
): boolean {
  for (const r of occupancy) {
    if (r.tableId !== tableId) continue
    const eff =
      overnight && r.startMinutes < periodStart
        ? r.startMinutes + 1440
        : r.startMinutes
    const resEnd = eff + r.durationMinutes
    // Half-open overlap: [slotStart, slotEnd) vs [eff, resEnd).
    if (slotStart < resEnd && eff < slotEnd) return true
  }
  return false
}

/* ------------------------------------------------------------------ */
/* Allocation                                                          */
/* ------------------------------------------------------------------ */

const MAX_OPTIONS = 4

function tableZone(t: EngineTable): string | null {
  const raw = (t.zone ?? "").trim()
  return raw || null
}

function tableOption(t: EngineTable, partySize: number): AllocationOption {
  const zone = tableZone(t)
  return {
    type: "table",
    tableIds: [t.id],
    tableNames: [t.name],
    capacity: t.capacity,
    wasted: t.capacity - partySize,
    zone,
    zones: zone ? [zone] : [],
  }
}

function combinationZones(combo: EngineCombination): string[] {
  const seen = new Map<string, string>()
  for (const m of combo.members) {
    if (!m.table) continue
    const raw = (m.table.zone ?? "").trim()
    if (!raw) continue
    if (!seen.has(raw.toLowerCase())) seen.set(raw.toLowerCase(), raw)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}

function combinationOption(
  combo: EngineCombination,
  partySize: number,
): AllocationOption {
  const zones = combinationZones(combo)
  const zone =
    zones.length === 0 ? null : zones.length === 1 ? zones[0] : "Mixed zones"
  return {
    type: "combination",
    id: combo.id,
    name: combo.name,
    tableIds: combo.members.map((m) => m.tableId),
    tableNames: combo.members.map((m) => m.table?.name ?? "Unknown table"),
    capacity: combo.effectiveCapacity,
    wasted: combo.effectiveCapacity - partySize,
    zone,
    zones,
  }
}

/* ------------------------------------------------------------------ */
/* Core evaluation                                                     */
/* ------------------------------------------------------------------ */

type PreparedTable = EngineTable & { zoneOk: boolean }

function computeSlotReason(
  partySize: number,
  capacityFitTables: PreparedTable[],
  combos: EngineCombination[],
  anyOfferableSingle: boolean,
): UnavailableReason {
  const anyCapacityCombo = combos.some(
    (c) => c.effectiveCapacity >= partySize,
  )
  if (capacityFitTables.length === 0 && !anyCapacityCombo) {
    return "no_tables"
  }
  if (anyOfferableSingle) {
    // Offerable singles existed but every one was reserved at this slot.
    return anyCapacityCombo ? "no_combination_available" : "all_tables_reserved"
  }
  // No offerable single (capacity-fit tables exist but excluded).
  const allBlocked =
    capacityFitTables.length > 0 &&
    capacityFitTables.every((t) => t.blocked)
  if (allBlocked && !anyCapacityCombo) return "all_tables_blocked"
  if (anyCapacityCombo) return "no_combination_available"
  return "no_tables"
}

function evaluatePeriodSlots(
  period: EnginePeriod,
  partySize: number,
  preparedTables: PreparedTable[],
  combos: EngineCombination[],
  occupancy: OccupyingReservation[],
  requestedMinutes: number | null,
): SlotAvailability[] {
  const start = timeToMinutes(period.startTime)
  const end = effectiveEndMinutes(period.startTime, period.endTime)
  if (start === null || end === null) return []
  const overnight = end > 1440
  const interval = period.bookingIntervalMinutes
  const duration = period.defaultDurationMinutes
  if (interval <= 0) return []

  // Capacity-fitting single tables (for reason analysis), and the subset that
  // is actually offerable (active + not blocked + zone reservable).
  const capacityFit = preparedTables.filter((t) => t.capacity >= partySize)
  const offerable = capacityFit.filter(
    (t) => t.active && !t.blocked && t.zoneOk,
  )
  // Eligible combinations (static, slot-independent gates).
  const eligibleCombos = combos.filter((c) => {
    if (!c.active) return false
    if (c.effectiveCapacity < partySize) return false
    if (c.members.length === 0) return false
    return c.members.every(
      (m) =>
        m.table &&
        m.table.active &&
        !m.table.blocked &&
        preparedTables.find((t) => t.id === m.table!.id)?.zoneOk,
    )
  })

  const slots: SlotAvailability[] = []
  // A booking must FINISH by the service close, so the last offered start is
  // `end - duration`. Offering a start whose default booking would overrun
  // closing (e.g. a 22:30 start for a 90-min dinner when the service ends at
  // 23:00) is never bookable in practice. When the window is shorter than one
  // booking, no slot is offered.
  const lastStart = end - duration
  for (let t = start; t <= lastStart; t += interval) {
    const slotEnd = t + duration
    const wrapMin = ((t % 1440) + 1440) % 1440
    const requested =
      requestedMinutes !== null && wrapMin === requestedMinutes

    // 1. Single tables, non-conflicting, ranked smallest-capacity first.
    const freeSingles = offerable
      .filter(
        (tbl) =>
          !tableHasConflict(tbl.id, t, slotEnd, occupancy, overnight, start),
      )
      .sort((a, b) => a.capacity - b.capacity || a.name.localeCompare(b.name))

    let options: AllocationOption[] = []
    if (freeSingles.length > 0) {
      options = freeSingles
        .slice(0, MAX_OPTIONS)
        .map((tbl) => tableOption(tbl, partySize))
    } else {
      // 2. Combinations only when no single table fits.
      const freeCombos = eligibleCombos
        .filter(
          (c) =>
            !c.members.some((m) =>
              tableHasConflict(
                m.tableId,
                t,
                slotEnd,
                occupancy,
                overnight,
                start,
              ),
            ),
        )
        .sort(
          (a, b) =>
            a.effectiveCapacity - b.effectiveCapacity ||
            a.name.localeCompare(b.name),
        )
      options = freeCombos
        .slice(0, MAX_OPTIONS)
        .map((c) => combinationOption(c, partySize))
    }

    const available = options.length > 0
    const slot: SlotAvailability = {
      time: formatMinutes(t),
      time24: formatMinutes24(t),
      minutes: t,
      available,
      options,
    }
    if (requested) slot.requested = true
    if (!available) {
      slot.reason = computeSlotReason(
        partySize,
        capacityFit,
        eligibleCombos,
        offerable.length > 0,
      )
    }
    slots.push(slot)
  }
  return slots
}

/* ------------------------------------------------------------------ */
/* Public entry point                                                  */
/* ------------------------------------------------------------------ */

/**
 * Compute availability for one date from already-batched source-of-truth data.
 * Pure and deterministic: the same inputs always yield the same result.
 */
export function computeAvailability(
  input: AvailabilityInput,
  data: AvailabilityData,
): AvailabilityResult {
  const partySize = Math.trunc(input.partySize)
  const requestedMinutes =
    input.requestedTime != null && input.requestedTime !== ""
      ? parseClockToMinutes(input.requestedTime)
      : null
  const requestedTime =
    requestedMinutes !== null ? formatMinutes24(requestedMinutes) : null

  const base: AvailabilityResult = {
    date: input.date,
    partySize,
    requestedTime,
    source: data.source,
    open: data.open,
    specialDay: data.specialDay,
    servicePeriods: [],
  }

  // Whole date unavailable: special-day closed, or no service periods at all.
  if (!data.open || data.periods.length === 0) {
    return { ...base, open: false, reason: "restaurant_closed" }
  }

  const zoneOk = makeZoneChecker(data.zones)
  const preparedTables: PreparedTable[] = data.tables.map((t) => ({
    ...t,
    zoneOk: zoneOk(t.zone),
  }))

  // Pre-compute blocking occupancy once (confirmed + seated only).
  const occupancy: OccupyingReservation[] = data.reservations
    .filter((r) => r.tableId && isActiveReservation({ status: r.status }))
    .map((r) => ({
      tableId: r.tableId as string,
      startMinutes: r.startMinutes,
      durationMinutes: resolveReservationDuration(
        r.startMinutes,
        data.periods,
      ),
    }))

  let anyRequestedSlot = false

  const servicePeriods: ServicePeriodAvailability[] = data.periods.map(
    (period) => {
      const overnight =
        (effectiveEndMinutes(period.startTime, period.endTime) ?? 0) > 1440
      const eligible =
        partySize >= period.minPartySize && partySize <= period.maxPartySize

      const entry: ServicePeriodAvailability = {
        id: period.id,
        name: period.name,
        startTime: period.startTime,
        endTime: period.endTime,
        overnight,
        minPartySize: period.minPartySize,
        maxPartySize: period.maxPartySize,
        bookingIntervalMinutes: period.bookingIntervalMinutes,
        defaultDurationMinutes: period.defaultDurationMinutes,
        eligible,
        slots: [],
      }

      if (!eligible) {
        entry.reason = "party_size_not_supported"
        return entry
      }

      entry.slots = evaluatePeriodSlots(
        period,
        partySize,
        preparedTables,
        data.combinations,
        occupancy,
        requestedMinutes,
      )
      if (entry.slots.some((s) => s.requested)) anyRequestedSlot = true
      return entry
    },
  )

  const result: AvailabilityResult = { ...base, servicePeriods }

  // A requested time that lands in no eligible service window.
  if (requestedMinutes !== null && !anyRequestedSlot) {
    result.requestedTimeReason = "outside_service_hours"
  }

  return result
}
