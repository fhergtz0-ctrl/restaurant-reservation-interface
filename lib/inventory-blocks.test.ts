import { describe, it } from "node:test"
import assert from "node:assert/strict"

import { computeHoldWindow } from "./booking-holds"
import {
  type InventoryBlock,
  type InventorySourceType,
  blocksConflict,
  wouldConflict,
  deactivateBySource,
  convertHoldBlocksToReservation,
  tableBlockedDuring,
  rangesOverlap,
} from "./inventory-blocks"

/** Build a block from a date + minutes-of-day + duration (mirrors SQL). */
function block(
  overrides: {
    id?: string
    tableId?: string
    sourceType?: InventorySourceType
    sourceId?: string
    date?: string
    startMinutes?: number
    durationMinutes?: number
    active?: boolean
  } = {},
): InventoryBlock {
  const date = overrides.date ?? "2026-08-30"
  const startMinutes = overrides.startMinutes ?? 19 * 60 // 19:00
  const durationMinutes = overrides.durationMinutes ?? 90
  const w = computeHoldWindow(date, startMinutes, durationMinutes)
  return {
    id: overrides.id ?? "b1",
    tableId: overrides.tableId ?? "t1",
    sourceType: overrides.sourceType ?? "hold",
    sourceId: overrides.sourceId ?? "s1",
    startMs: w.startMs,
    endMs: w.endMs,
    active: overrides.active ?? true,
  }
}

describe("inventory blocks — hold vs hold", () => {
  it("two active hold blocks on the same table overlapping -> conflict", () => {
    const a = block({ id: "a", sourceType: "hold", sourceId: "h1", startMinutes: 19 * 60 })
    const b = block({ id: "b", sourceType: "hold", sourceId: "h2", startMinutes: 19 * 60 + 30 })
    assert.equal(blocksConflict(a, b), true)
  })
})

describe("inventory blocks — reservation vs reservation", () => {
  it("two reservation blocks overlapping on the same table -> conflict", () => {
    const a = block({ sourceType: "reservation", sourceId: "r1", startMinutes: 18 * 60 })
    const b = block({ sourceType: "reservation", sourceId: "r2", startMinutes: 18 * 60 + 60 })
    assert.equal(blocksConflict(a, b), true)
  })
})

describe("inventory blocks — hold vs reservation (both directions)", () => {
  it("a hold conflicts with an overlapping reservation", () => {
    const hold = block({ sourceType: "hold", sourceId: "h1" })
    const res = block({ sourceType: "reservation", sourceId: "r1", startMinutes: 19 * 60 + 15 })
    assert.equal(blocksConflict(hold, res), true)
  })
  it("a reservation conflicts with an overlapping hold (symmetric)", () => {
    const res = block({ sourceType: "reservation", sourceId: "r1" })
    const hold = block({ sourceType: "hold", sourceId: "h1", startMinutes: 19 * 60 + 15 })
    assert.equal(blocksConflict(res, hold), true)
  })
})

describe("inventory blocks — different tables never conflict", () => {
  it("same window, different tables -> no conflict", () => {
    const a = block({ tableId: "t1" })
    const b = block({ tableId: "t2" })
    assert.equal(blocksConflict(a, b), false)
  })
})

describe("inventory blocks — adjacent intervals allowed", () => {
  it("a block ending at 20:30 does not conflict with one starting at 20:30", () => {
    const first = block({ startMinutes: 19 * 60, durationMinutes: 90 }) // 19:00-20:30
    const second = block({ startMinutes: 20 * 60 + 30, durationMinutes: 90 }) // 20:30-22:00
    assert.equal(blocksConflict(first, second), false)
    assert.equal(rangesOverlap(first.startMs, first.endMs, second.startMs, second.endMs), false)
  })
})

describe("inventory blocks — overnight overlap", () => {
  it("a 23:30+120m block (into next day) conflicts with a 00:30 block next day-window", () => {
    // 2026-12-31 23:30 -> 2027-01-01 01:30
    const overnight = block({ date: "2026-12-31", startMinutes: 23 * 60 + 30, durationMinutes: 120 })
    // 2027-01-01 00:30 -> 02:00 expressed as minutes-of-day on the next date
    const nextDay = block({ date: "2027-01-01", startMinutes: 30, durationMinutes: 90 })
    assert.equal(blocksConflict(overnight, nextDay), true)
  })
  it("an overnight block does NOT conflict with an early-evening block the next day", () => {
    const overnight = block({ date: "2026-12-31", startMinutes: 23 * 60 + 30, durationMinutes: 120 })
    const nextEvening = block({ date: "2027-01-01", startMinutes: 19 * 60, durationMinutes: 90 })
    assert.equal(blocksConflict(overnight, nextEvening), false)
  })
})

describe("inventory blocks — combination locks every member table", () => {
  it("a combination hold blocks each member table independently", () => {
    const members = ["t1", "t2", "t3"]
    const comboBlocks = members.map((tableId, i) =>
      block({ id: `c${i}`, tableId, sourceType: "hold", sourceId: "combo-hold" }),
    )
    // A new candidate on ANY member overlapping the window conflicts.
    for (const tableId of members) {
      assert.equal(
        wouldConflict(comboBlocks, {
          tableId,
          ...windowOf(19 * 60 + 15, 90),
        }),
        true,
        `expected conflict on member ${tableId}`,
      )
    }
    // A non-member table is free.
    assert.equal(
      wouldConflict(comboBlocks, { tableId: "t4", ...windowOf(19 * 60 + 15, 90) }),
      false,
    )
  })
})

describe("inventory blocks — expired/cancelled hold releases inventory", () => {
  it("deactivating a hold's blocks frees the table", () => {
    let blocks = [block({ sourceType: "hold", sourceId: "h1" })]
    // Occupied first.
    assert.equal(wouldConflict(blocks, { tableId: "t1", ...windowOf(19 * 60, 90) }), true)
    // Expire/cancel -> deactivate.
    blocks = deactivateBySource(blocks, "hold", "h1")
    assert.equal(wouldConflict(blocks, { tableId: "t1", ...windowOf(19 * 60, 90) }), false)
  })
  it("cancelled hold blocks are inactive and never conflict", () => {
    const blocks = deactivateBySource([block({ sourceId: "h1" })], "hold", "h1")
    assert.ok(blocks.every((b) => !b.active))
  })
})

describe("inventory blocks — conversion changes ownership without a gap", () => {
  it("hold -> reservation keeps the same active rows; table stays blocked throughout", () => {
    const holdBlocks = [block({ id: "x", sourceType: "hold", sourceId: "h1" })]
    // Blocked as a hold.
    assert.equal(tableBlockedDuring(holdBlocks, "t1", ...windowTuple(19 * 60, 90)), true)

    const afterConversion = convertHoldBlocksToReservation(holdBlocks, "h1", "r1")

    // Same row id, still active, now owned by the reservation.
    assert.equal(afterConversion.length, 1)
    assert.equal(afterConversion[0].id, "x")
    assert.equal(afterConversion[0].active, true)
    assert.equal(afterConversion[0].sourceType, "reservation")
    assert.equal(afterConversion[0].sourceId, "r1")

    // Still blocked after conversion -> zero inventory gap.
    assert.equal(tableBlockedDuring(afterConversion, "t1", ...windowTuple(19 * 60, 90)), true)
  })
})

describe("inventory blocks — concurrent same-table attempts", () => {
  it("once the first block is committed, the second identical candidate is rejected", () => {
    const committed: InventoryBlock[] = []
    const candidate = { tableId: "t1", ...windowOf(19 * 60, 90) }

    // First caller wins (no existing blocks).
    assert.equal(wouldConflict(committed, candidate), false)
    committed.push(block({ id: "first", sourceId: "h1" }))

    // Second caller for the same table/window is rejected — both cannot succeed.
    assert.equal(wouldConflict(committed, candidate), true)
  })
})

/* Helpers to build candidate windows on the base date "2026-08-30". */
function windowOf(startMinutes: number, durationMinutes: number): {
  startMs: number
  endMs: number
} {
  const w = computeHoldWindow("2026-08-30", startMinutes, durationMinutes)
  return { startMs: w.startMs, endMs: w.endMs }
}
function windowTuple(
  startMinutes: number,
  durationMinutes: number,
): [number, number] {
  const w = windowOf(startMinutes, durationMinutes)
  return [w.startMs, w.endMs]
}
