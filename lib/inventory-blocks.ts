/**
 * Phase 13B — unified inventory blocks (pure, network-free model).
 *
 * This mirrors the semantics of public.restaurant_inventory_blocks and its GiST
 * exclusion constraint so the concurrency invariants can be unit-tested without
 * Postgres — exactly like lib/booking-holds mirrors the SQL `during`
 * construction. A block is one physical table's occupancy for a hold OR a
 * reservation over a half-open [startMs, endMs) window.
 *
 * The DB is the real guarantee (advisory lock + exclusion constraint); this
 * model exists to prove the rules the migration encodes:
 *   - two ACTIVE blocks on the same table may not overlap (any source type)
 *   - adjacent/touching intervals are allowed (half-open)
 *   - overnight ranges are single continuous windows
 *   - a combination locks every member table independently
 *   - deactivating (expire/cancel/finish) frees the table
 *   - hold -> reservation conversion changes ownership IN PLACE (zero gap)
 */

export type InventorySourceType = "hold" | "reservation"

export type InventoryBlock = {
  id: string
  tableId: string
  sourceType: InventorySourceType
  sourceId: string
  /** Half-open window start (epoch ms). */
  startMs: number
  /** Half-open window end (epoch ms); may fall on the next calendar day. */
  endMs: number
  active: boolean
}

export type BlockCandidate = {
  tableId: string
  startMs: number
  endMs: number
}

/** Half-open overlap: [aStart, aEnd) intersects [bStart, bEnd). */
export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd
}

/**
 * True when two blocks would violate the exclusion constraint: both active,
 * same physical table, and overlapping ranges. Source type is irrelevant — a
 * hold and a reservation conflict exactly like two holds.
 */
export function blocksConflict(a: InventoryBlock, b: InventoryBlock): boolean {
  if (!a.active || !b.active) return false
  if (a.tableId !== b.tableId) return false
  return rangesOverlap(a.startMs, a.endMs, b.startMs, b.endMs)
}

/**
 * Would inserting `candidate` be rejected by the exclusion constraint given the
 * current blocks? (The check every inventory RPC runs before insert.)
 */
export function wouldConflict(
  existing: InventoryBlock[],
  candidate: BlockCandidate,
): boolean {
  return existing.some(
    (b) =>
      b.active &&
      b.tableId === candidate.tableId &&
      rangesOverlap(b.startMs, b.endMs, candidate.startMs, candidate.endMs),
  )
}

/**
 * Deactivate every active block belonging to a source (hold cancel/expire, or a
 * reservation reaching a terminal status). Returns a new array; frees the
 * table for the exclusion constraint.
 */
export function deactivateBySource(
  blocks: InventoryBlock[],
  sourceType: InventorySourceType,
  sourceId: string,
): InventoryBlock[] {
  return blocks.map((b) =>
    b.sourceType === sourceType && b.sourceId === sourceId && b.active
      ? { ...b, active: false }
      : b,
  )
}

/**
 * Convert a hold's blocks into reservation blocks by changing ownership IN
 * PLACE: the same rows stay `active`, only source_type/source_id change. This
 * is the zero-gap conversion — at no point is the table unblocked. Returns a
 * new array.
 */
export function convertHoldBlocksToReservation(
  blocks: InventoryBlock[],
  holdId: string,
  reservationId: string,
): InventoryBlock[] {
  return blocks.map((b) =>
    b.sourceType === "hold" && b.sourceId === holdId && b.active
      ? { ...b, sourceType: "reservation" as const, sourceId: reservationId }
      : b,
  )
}

/** True if some active block covers the table at any instant in [startMs,endMs). */
export function tableBlockedDuring(
  blocks: InventoryBlock[],
  tableId: string,
  startMs: number,
  endMs: number,
): boolean {
  return wouldConflict(blocks, { tableId, startMs, endMs })
}
