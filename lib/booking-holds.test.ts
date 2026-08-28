import { describe, it } from "node:test"
import assert from "node:assert/strict"

import {
  BOOKING_HOLD_MINUTES,
  isHoldEffectivelyActive,
  holdsToBlockingReservations,
  holdRemainingSeconds,
  formatCountdown,
  computeHoldWindow,
  windowsOverlap,
  type HoldRow,
} from "./booking-holds"

const NOW = Date.parse("2026-08-30T18:00:00.000Z")

function makeRow(overrides: Partial<HoldRow> = {}): HoldRow {
  return {
    id: "h1",
    restaurant_id: "r1",
    restaurant_name: "Maison Laurent",
    booking_date: "2026-08-30",
    booking_time: "7:30 PM",
    start_minutes: 19 * 60 + 30,
    duration_minutes: 90,
    party_size: 2,
    service_name: "Dinner",
    allocation_type: "table",
    combination_id: null,
    table_ids: ["t1"],
    status: "active",
    expires_at: new Date(NOW + 4 * 60_000).toISOString(),
    ...overrides,
  }
}

describe("hold window constant", () => {
  it("is 5 minutes", () => {
    assert.equal(BOOKING_HOLD_MINUTES, 5)
  })
})

describe("isHoldEffectivelyActive", () => {
  it("active and unexpired -> true", () => {
    assert.equal(isHoldEffectivelyActive(makeRow(), NOW), true)
  })

  it("active but expired -> false (lazy expiration)", () => {
    const row = makeRow({ expires_at: new Date(NOW - 1000).toISOString() })
    assert.equal(isHoldEffectivelyActive(row, NOW), false)
  })

  it("non-active statuses -> false regardless of expiry", () => {
    for (const status of ["converted", "expired", "cancelled"] as const) {
      const row = makeRow({
        status,
        expires_at: new Date(NOW + 60_000).toISOString(),
      })
      assert.equal(isHoldEffectivelyActive(row, NOW), false)
    }
  })

  it("malformed expires_at -> false", () => {
    assert.equal(
      isHoldEffectivelyActive(makeRow({ expires_at: "not-a-date" }), NOW),
      false,
    )
  })
})

describe("holdsToBlockingReservations", () => {
  it("emits one blocking reservation per held table", () => {
    const rows = [makeRow({ table_ids: ["t1", "t2"] })]
    const res = holdsToBlockingReservations(rows, NOW)
    assert.equal(res.length, 2)
    assert.deepEqual(
      res.map((r) => r.tableId),
      ["t1", "t2"],
    )
    assert.ok(res.every((r) => r.status === "confirmed"))
    assert.ok(res.every((r) => r.startMinutes === 19 * 60 + 30))
  })

  it("drops expired / cancelled / converted holds", () => {
    const rows = [
      makeRow({ id: "a", expires_at: new Date(NOW - 1).toISOString() }),
      makeRow({ id: "b", status: "cancelled" }),
      makeRow({ id: "c", status: "converted" }),
      makeRow({ id: "d", table_ids: ["keep"] }),
    ]
    const res = holdsToBlockingReservations(rows, NOW)
    assert.equal(res.length, 1)
    assert.equal(res[0].tableId, "keep")
  })

  it("ignores empty table ids", () => {
    const rows = [makeRow({ table_ids: ["", "t9"] })]
    const res = holdsToBlockingReservations(rows, NOW)
    assert.equal(res.length, 1)
    assert.equal(res[0].tableId, "t9")
  })

  it("gives each synthetic reservation a unique id", () => {
    const rows = [makeRow({ id: "x", table_ids: ["t1", "t2"] })]
    const ids = holdsToBlockingReservations(rows, NOW).map((r) => r.id)
    assert.equal(new Set(ids).size, ids.length)
  })
})

describe("holdRemainingSeconds", () => {
  it("derives remaining time from expires_at", () => {
    const iso = new Date(NOW + 3 * 60_000).toISOString()
    assert.equal(holdRemainingSeconds(iso, NOW), 180)
  })

  it("clamps to 0 once expired (never negative, never a restart)", () => {
    const iso = new Date(NOW - 30_000).toISOString()
    assert.equal(holdRemainingSeconds(iso, NOW), 0)
  })

  it("a later 'now' yields less time — refresh cannot reset the timer", () => {
    const iso = new Date(NOW + 5 * 60_000).toISOString()
    const first = holdRemainingSeconds(iso, NOW)
    const later = holdRemainingSeconds(iso, NOW + 60_000)
    assert.equal(first, 300)
    assert.equal(later, 240)
    assert.ok(later < first)
  })

  it("malformed timestamp -> 0", () => {
    assert.equal(holdRemainingSeconds("nope", NOW), 0)
  })
})

describe("formatCountdown", () => {
  it("formats mm:ss with zero padding", () => {
    assert.equal(formatCountdown(300), "5:00")
    assert.equal(formatCountdown(65), "1:05")
    assert.equal(formatCountdown(9), "0:09")
  })
  it("never goes negative", () => {
    assert.equal(formatCountdown(-10), "0:00")
  })
})

describe("computeHoldWindow", () => {
  it("builds a half-open window from date + start + duration", () => {
    const w = computeHoldWindow("2026-08-30", 19 * 60 + 30, 90)
    assert.equal(w.startIso, "2026-08-30T19:30:00.000Z")
    assert.equal(w.endIso, "2026-08-30T21:00:00.000Z")
  })

  it("crosses midnight into the next calendar day", () => {
    const w = computeHoldWindow("2026-08-30", 23 * 60 + 30, 120)
    assert.equal(w.startIso, "2026-08-30T23:30:00.000Z")
    assert.equal(w.endIso, "2026-08-31T01:30:00.000Z")
  })
})

describe("windowsOverlap (half-open)", () => {
  it("overlapping windows intersect", () => {
    assert.equal(windowsOverlap(100, 200, 150, 250), true)
  })
  it("touching endpoints do NOT overlap (a booking ending at 20:30 frees 20:30)", () => {
    assert.equal(windowsOverlap(100, 200, 200, 300), false)
    assert.equal(windowsOverlap(200, 300, 100, 200), false)
  })
  it("disjoint windows do not overlap", () => {
    assert.equal(windowsOverlap(100, 150, 300, 400), false)
  })
  it("fully contained window overlaps", () => {
    assert.equal(windowsOverlap(100, 400, 150, 200), true)
  })
})
