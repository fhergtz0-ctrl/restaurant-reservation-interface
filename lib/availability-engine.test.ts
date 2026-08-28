/**
 * Unit tests for the pure availability engine.
 *
 * Zero-dependency: uses Node's built-in `node:test` + `node:assert`. No test
 * framework is installed in this project, so run this file directly with a
 * TypeScript loader:
 *
 *   npx tsx --test lib/availability-engine.test.ts
 *
 * The engine is fully pure (no I/O, no Supabase), so every scenario below is
 * driven entirely by hand-supplied fixtures shaped like the loader's output.
 */
import assert from "node:assert/strict"
import { test } from "node:test"

import {
  computeAvailability,
  parseClockToMinutes,
  weekdayIndex,
  makeZoneChecker,
  resolveReservationDuration,
  type AvailabilityData,
  type AvailabilityInput,
  type EngineCombination,
  type EnginePeriod,
  type EngineReservation,
  type EngineTable,
  type SlotAvailability,
} from "./availability-engine"

// ---------------------------------------------------------------------------
// Fixtures / builders
// ---------------------------------------------------------------------------

function table(over: Partial<EngineTable> & { id: string }): EngineTable {
  return {
    id: over.id,
    name: over.name ?? over.id,
    capacity: over.capacity ?? 2,
    zone: over.zone ?? null,
    active: over.active ?? true,
    blocked: over.blocked ?? false,
  }
}

function dinner(over: Partial<EnginePeriod> = {}): EnginePeriod {
  return {
    id: over.id ?? "p-dinner",
    name: over.name ?? "Dinner",
    startTime: over.startTime ?? "18:00",
    endTime: over.endTime ?? "23:00",
    bookingIntervalMinutes: over.bookingIntervalMinutes ?? 30,
    defaultDurationMinutes: over.defaultDurationMinutes ?? 90,
    minPartySize: over.minPartySize ?? 1,
    maxPartySize: over.maxPartySize ?? 8,
  }
}

function data(over: Partial<AvailabilityData> = {}): AvailabilityData {
  return {
    source: over.source ?? "weekly_schedule",
    open: over.open ?? true,
    specialDay: over.specialDay ?? null,
    periods: over.periods ?? [dinner()],
    tables: over.tables ?? [table({ id: "T1", capacity: 2 })],
    zones: over.zones ?? [],
    combinations: over.combinations ?? [],
    reservations: over.reservations ?? [],
  }
}

function input(over: Partial<AvailabilityInput> = {}): AvailabilityInput {
  return {
    date: over.date ?? "2026-03-16", // a Monday
    partySize: over.partySize ?? 2,
    requestedTime: over.requestedTime ?? null,
  }
}

/** Flatten every slot across all service periods. */
function allSlots(periods: { slots: SlotAvailability[] }[]): SlotAvailability[] {
  return periods.flatMap((p) => p.slots)
}

function reservation(
  over: Partial<EngineReservation> & { id: string },
): EngineReservation {
  return {
    id: over.id,
    tableId: over.tableId ?? "T1",
    status: over.status ?? "confirmed",
    startMinutes: over.startMinutes ?? 19 * 60,
  }
}

// ---------------------------------------------------------------------------
// Pure time / helper functions
// ---------------------------------------------------------------------------

test("parseClockToMinutes accepts 12-hour and 24-hour forms", () => {
  assert.equal(parseClockToMinutes("7:30 PM"), 19 * 60 + 30)
  assert.equal(parseClockToMinutes("12:00 AM"), 0)
  assert.equal(parseClockToMinutes("12:00 PM"), 12 * 60)
  assert.equal(parseClockToMinutes("19:30"), 19 * 60 + 30)
  assert.equal(parseClockToMinutes("not a time"), null)
})

test("weekdayIndex maps calendar dates to Mon=0..Sun=6", () => {
  assert.equal(weekdayIndex("2026-03-16"), 0) // Monday
  assert.equal(weekdayIndex("2026-03-17"), 1) // Tuesday
  assert.equal(weekdayIndex("2026-03-22"), 6) // Sunday
  assert.equal(weekdayIndex("garbage"), null)
})

test("makeZoneChecker: blank + legacy-unmatched allowed, managed gated", () => {
  const check = makeZoneChecker([
    { name: "Terrace", active: true, reservable: false },
    { name: "Bar", active: false, reservable: true },
    { name: "Main", active: true, reservable: true },
  ])
  assert.equal(check(null), true) // blank
  assert.equal(check("Patio"), true) // legacy, unmatched
  assert.equal(check("Main"), true) // active + reservable
  assert.equal(check("terrace"), false) // not reservable (case-insensitive)
  assert.equal(check("Bar"), false) // inactive
})

test("resolveReservationDuration uses the containing period's default", () => {
  const periods = [dinner({ defaultDurationMinutes: 120 })]
  assert.equal(resolveReservationDuration(19 * 60, periods), 120)
  // Outside any period -> shared operational fallback (a positive number).
  assert.ok(resolveReservationDuration(9 * 60, periods) > 0)
})

// ---------------------------------------------------------------------------
// 1. Basic availability
// ---------------------------------------------------------------------------

test("returns bookable slots across the service window", () => {
  const res = computeAvailability(input(), data())
  assert.equal(res.open, true)
  const slots = allSlots(res.servicePeriods)
  assert.ok(slots.length > 0)
  // 18:00 -> last start that fits a 90-min booking before 23:00 is 21:30.
  assert.equal(slots[0].time24, "18:00")
  assert.equal(slots[slots.length - 1].time24, "21:30")
  assert.ok(slots.every((s) => s.available))
})

test("slot cadence follows the booking interval", () => {
  const res = computeAvailability(
    input(),
    data({ periods: [dinner({ bookingIntervalMinutes: 60 })] }),
  )
  assert.deepEqual(
    allSlots(res.servicePeriods).map((s) => s.time24),
    ["18:00", "19:00", "20:00", "21:00"],
  )
})

// ---------------------------------------------------------------------------
// 2. Closed date (loader-decided) and special-day closure
// ---------------------------------------------------------------------------

test("a closed date yields no periods and a restaurant_closed reason", () => {
  const res = computeAvailability(input(), data({ open: false, periods: [] }))
  assert.equal(res.open, false)
  assert.equal(res.reason, "restaurant_closed")
  assert.equal(res.servicePeriods.length, 0)
})

test("no service periods at all is treated as closed", () => {
  const res = computeAvailability(input(), data({ open: true, periods: [] }))
  assert.equal(res.open, false)
  assert.equal(res.reason, "restaurant_closed")
})

test("special-day source drives its own periods", () => {
  const res = computeAvailability(
    input(),
    data({
      source: "special_day",
      specialDay: { name: "NYE Lunch", type: "special_service", isOpen: true },
      periods: [
        dinner({
          id: "sp-lunch",
          name: "Lunch",
          startTime: "12:00",
          endTime: "14:00",
          bookingIntervalMinutes: 60,
          defaultDurationMinutes: 60,
        }),
      ],
    }),
  )
  assert.equal(res.open, true)
  assert.equal(res.source, "special_day")
  assert.deepEqual(
    allSlots(res.servicePeriods).map((s) => s.time24),
    ["12:00", "13:00"],
  )
})

// ---------------------------------------------------------------------------
// 3. Party size bounds
// ---------------------------------------------------------------------------

test("party outside the period min/max marks the period ineligible", () => {
  const res = computeAvailability(
    input({ partySize: 9 }),
    data({ periods: [dinner({ maxPartySize: 8 })] }),
  )
  assert.equal(res.servicePeriods[0].eligible, false)
  assert.equal(res.servicePeriods[0].reason, "party_size_not_supported")
  assert.equal(res.servicePeriods[0].slots.length, 0)
})

test("party larger than every table (no combo) is unbookable with no_tables", () => {
  const res = computeAvailability(
    input({ partySize: 6 }),
    data({
      tables: [
        table({ id: "T1", capacity: 2 }),
        table({ id: "T2", capacity: 4 }),
      ],
    }),
  )
  const slots = allSlots(res.servicePeriods)
  assert.ok(slots.every((s) => !s.available))
  assert.ok(slots.every((s) => s.reason === "no_tables"))
})

// ---------------------------------------------------------------------------
// 4. Overlap detection against active reservations
// ---------------------------------------------------------------------------

test("an active reservation blocks overlapping slots; adjacent is free", () => {
  const res = computeAvailability(
    input(),
    data({
      tables: [table({ id: "T1", capacity: 2 })],
      reservations: [reservation({ id: "r1", startMinutes: 19 * 60 })], // 19:00-20:30
    }),
  )
  const slots = allSlots(res.servicePeriods)
  const at = (t: string) => slots.find((s) => s.time24 === t)
  assert.equal(at("19:00")?.available, false)
  assert.equal(at("18:30")?.available, false) // 18:30-20:00 overlaps
  // Half-open: a slot starting exactly at the prior booking's end is free.
  assert.equal(at("20:30")?.available, true)
})

test("cancelled / no-show / finished reservations never block", () => {
  const res = computeAvailability(
    input(),
    data({
      reservations: [
        reservation({ id: "r1", startMinutes: 19 * 60, status: "cancelled" }),
        reservation({ id: "r2", startMinutes: 19 * 60, status: "no_show" }),
        reservation({ id: "r3", startMinutes: 19 * 60, status: "finished" }),
      ],
    }),
  )
  const at1900 = allSlots(res.servicePeriods).find((s) => s.time24 === "19:00")
  assert.equal(at1900?.available, true)
})

test("a second free table keeps the slot open and is chosen", () => {
  const res = computeAvailability(
    input(),
    data({
      tables: [
        table({ id: "T1", capacity: 2 }),
        table({ id: "T2", capacity: 2 }),
      ],
      reservations: [
        reservation({ id: "r1", tableId: "T1", startMinutes: 19 * 60 }),
      ],
    }),
  )
  const at1900 = allSlots(res.servicePeriods).find((s) => s.time24 === "19:00")
  assert.equal(at1900?.available, true)
  assert.deepEqual(at1900?.options[0].tableIds, ["T2"])
})

// ---------------------------------------------------------------------------
// 5. Blocked / inactive tables + smallest-fit ranking
// ---------------------------------------------------------------------------

test("blocked and inactive tables are never offered", () => {
  const res = computeAvailability(
    input(),
    data({
      tables: [
        table({ id: "T1", capacity: 2, blocked: true }),
        table({ id: "T2", capacity: 2, active: false }),
      ],
    }),
  )
  const slots = allSlots(res.servicePeriods)
  assert.ok(slots.every((s) => !s.available))
})

test("smallest capacity-fitting table is ranked first (least wasted seats)", () => {
  const res = computeAvailability(
    input({ partySize: 2 }),
    data({
      tables: [
        table({ id: "Big", capacity: 8 }),
        table({ id: "Small", capacity: 2 }),
        table({ id: "Mid", capacity: 4 }),
      ],
    }),
  )
  const at1800 = allSlots(res.servicePeriods).find((s) => s.time24 === "18:00")
  assert.equal(at1800?.options[0].tableIds[0], "Small")
  assert.equal(at1800?.options[0].wasted, 0)
})

// ---------------------------------------------------------------------------
// 6. Zone reservability gating
// ---------------------------------------------------------------------------

test("a non-reservable managed zone excludes its tables", () => {
  const res = computeAvailability(
    input(),
    data({
      tables: [table({ id: "T1", capacity: 2, zone: "Terrace" })],
      zones: [{ name: "Terrace", active: true, reservable: false }],
    }),
  )
  const slots = allSlots(res.servicePeriods)
  assert.ok(slots.every((s) => !s.available))
})

// ---------------------------------------------------------------------------
// 7. Table combinations
// ---------------------------------------------------------------------------

function combo(
  over: Partial<EngineCombination> & { id: string; tables: EngineTable[] },
): EngineCombination {
  return {
    id: over.id,
    name: over.name ?? over.id,
    active: over.active ?? true,
    effectiveCapacity:
      over.effectiveCapacity ??
      over.tables.reduce((s, t) => s + t.capacity, 0),
    members: over.tables.map((t) => ({ tableId: t.id, table: t })),
  }
}

test("a combination seats a party no single table can", () => {
  const T1 = table({ id: "T1", capacity: 2 })
  const T2 = table({ id: "T2", capacity: 4 })
  const res = computeAvailability(
    input({ partySize: 6 }),
    data({
      tables: [T1, T2],
      combinations: [combo({ id: "c1", name: "T1+T2", tables: [T1, T2] })],
    }),
  )
  const at1900 = allSlots(res.servicePeriods).find((s) => s.time24 === "19:00")
  assert.equal(at1900?.available, true)
  assert.equal(at1900?.options[0].type, "combination")
  assert.equal(at1900?.options[0].id, "c1")
})

test("a combination is blocked when a member is booked, then frees up", () => {
  const T1 = table({ id: "T1", capacity: 2 })
  const T2 = table({ id: "T2", capacity: 4 })
  const res = computeAvailability(
    input({ partySize: 6 }),
    data({
      tables: [T1, T2],
      combinations: [combo({ id: "c1", name: "T1+T2", tables: [T1, T2] })],
      // T2 booked 19:00-20:30.
      reservations: [
        reservation({ id: "r1", tableId: "T2", startMinutes: 19 * 60 }),
      ],
    }),
  )
  const slots = allSlots(res.servicePeriods)
  assert.equal(slots.find((s) => s.time24 === "19:00")?.available, false)
  assert.equal(
    slots.find((s) => s.time24 === "21:00")?.available,
    true,
    "combination is usable once the member booking has ended",
  )
})

test("cross-zone combination reports Mixed zones", () => {
  const T1 = table({ id: "T1", capacity: 2, zone: "Main" })
  const T2 = table({ id: "T2", capacity: 4, zone: "Terrace" })
  const res = computeAvailability(
    input({ partySize: 6 }),
    data({
      tables: [T1, T2],
      combinations: [combo({ id: "c1", name: "T1+T2", tables: [T1, T2] })],
    }),
  )
  const at1900 = allSlots(res.servicePeriods).find((s) => s.time24 === "19:00")
  assert.equal(at1900?.options[0].zone, "Mixed zones")
  assert.deepEqual(at1900?.options[0].zones, ["Main", "Terrace"])
})

// ---------------------------------------------------------------------------
// 8. Overnight service window
// ---------------------------------------------------------------------------

test("overnight window (22:00 -> 02:00) produces slots past midnight", () => {
  const res = computeAvailability(
    input(),
    data({
      periods: [
        dinner({
          id: "late",
          name: "Late",
          startTime: "22:00",
          endTime: "02:00", // end <= start => overnight
          bookingIntervalMinutes: 60,
          defaultDurationMinutes: 60,
        }),
      ],
    }),
  )
  assert.equal(res.servicePeriods[0].overnight, true)
  // 22:00, 23:00, 00:00, 01:00 (last 60-min booking must end by 02:00).
  assert.deepEqual(
    allSlots(res.servicePeriods).map((s) => s.time24),
    ["22:00", "23:00", "00:00", "01:00"],
  )
})

// ---------------------------------------------------------------------------
// 9. Requested time echo + out-of-hours flag
// ---------------------------------------------------------------------------

test("a requested time inside a window is flagged on its slot", () => {
  const res = computeAvailability(input({ requestedTime: "7:00 PM" }), data())
  assert.equal(res.requestedTime, "19:00")
  const requested = allSlots(res.servicePeriods).filter((s) => s.requested)
  assert.equal(requested.length, 1)
  assert.equal(requested[0].time24, "19:00")
  assert.equal(res.requestedTimeReason, undefined)
})

test("a requested time outside every window sets requestedTimeReason", () => {
  const res = computeAvailability(input({ requestedTime: "3:00 PM" }), data())
  assert.equal(res.requestedTimeReason, "outside_service_hours")
  assert.ok(allSlots(res.servicePeriods).every((s) => !s.requested))
})
