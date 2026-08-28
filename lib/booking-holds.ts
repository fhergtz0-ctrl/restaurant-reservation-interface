/**
 * Phase 13B — temporary slot holds (pure, network-free core).
 *
 * A hold locks the physical table(s) for a guest for BOOKING_HOLD_MINUTES
 * between "picked a time" and "confirmed". Everything here is deterministic and
 * unit-testable: the server loader (lib/availability-data) injects active holds
 * into the engine as synthetic blocking reservations via holdsToBlockingReservations,
 * and the details countdown derives its remaining time from expires_at via
 * holdRemainingSeconds — never a client-side 5-minute restart.
 */

import type { EngineReservation } from "@/lib/availability-engine"

/** Single source of truth for the hold window, in minutes. */
export const BOOKING_HOLD_MINUTES = 5

export type BookingHoldStatus = "active" | "converted" | "expired" | "cancelled"

/** Raw booking_holds row shape (as returned by Supabase). */
export type HoldRow = {
  id: string
  restaurant_id: string
  restaurant_name: string
  booking_date: string
  booking_time: string
  start_minutes: number
  duration_minutes: number
  party_size: number
  service_name: string | null
  allocation_type: "table" | "combination"
  combination_id: string | null
  table_ids: string[]
  status: BookingHoldStatus
  expires_at: string
  created_at?: string
}

/** Guest-safe hold projection — NEVER exposes table ids/names, zones, etc. */
export type PublicHold = {
  holdId: string
  status: BookingHoldStatus
  /** ISO timestamp; the client derives the live countdown from this. */
  expiresAt: string
  booking: {
    restaurant: string
    slug: string
    date: string
    partySize: number
    time: string
    service: string | null
  }
}

/**
 * Effective activity is expiry-aware: a row whose status is still "active" but
 * whose expires_at has passed is treated as inactive (lazy expiration). This is
 * the same rule the SQL loader and RPC apply.
 */
export function isHoldEffectivelyActive(
  row: Pick<HoldRow, "status" | "expires_at">,
  nowMs: number = Date.now(),
): boolean {
  if (row.status !== "active") return false
  const exp = Date.parse(row.expires_at)
  return Number.isFinite(exp) && exp > nowMs
}

/**
 * Convert active, unexpired holds into synthetic blocking reservations for the
 * pure engine — one per held table. The engine resolves each one's occupancy
 * duration from the containing service period (exactly like a real reservation),
 * so overlapping slots on that table become unavailable. Expired, cancelled,
 * and converted holds are dropped (converted holds are represented by the real
 * reservation instead, so they never double-block).
 */
export function holdsToBlockingReservations(
  rows: HoldRow[],
  nowMs: number = Date.now(),
): EngineReservation[] {
  const out: EngineReservation[] = []
  for (const row of rows) {
    if (!isHoldEffectivelyActive(row, nowMs)) continue
    for (const tableId of row.table_ids) {
      if (!tableId) continue
      out.push({
        id: `hold:${row.id}:${tableId}`,
        tableId,
        // Holds consume inventory exactly like a confirmed reservation.
        status: "confirmed",
        startMinutes: row.start_minutes,
      })
    }
  }
  return out
}

/**
 * Seconds remaining on a hold, derived purely from expires_at (clamped at 0).
 * Refreshing the page cannot restart the countdown because it is always
 * expires_at - now, never a fresh 5:00.
 */
export function holdRemainingSeconds(
  expiresAtIso: string,
  nowMs: number = Date.now(),
): number {
  const exp = Date.parse(expiresAtIso)
  if (!Number.isFinite(exp)) return 0
  return Math.max(0, Math.floor((exp - nowMs) / 1000))
}

/** "mm:ss" for a remaining-seconds count. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${String(ss).padStart(2, "0")}`
}

/* ------------------------------------------------------------------ */
/* Time-range helpers (mirror the SQL `during` construction so the      */
/* overnight/cross-day behaviour is unit-testable without Postgres).    */
/* ------------------------------------------------------------------ */

export type HoldWindow = {
  /** Epoch ms of the half-open window start. */
  startMs: number
  /** Epoch ms of the half-open window end (may fall on the next day). */
  endMs: number
  startIso: string
  endIso: string
}

/**
 * Build the occupancy window for a hold the same way migration 012 does:
 * booking_date at midnight + start_minutes, extended by duration_minutes.
 * A booking that starts at 23:30 and lasts 120 minutes ends at 01:30 the NEXT
 * calendar day. Computed in UTC so the math is timezone-stable in tests.
 */
export function computeHoldWindow(
  bookingDate: string,
  startMinutes: number,
  durationMinutes: number,
): HoldWindow {
  const [y, m, d] = bookingDate.split("-").map(Number)
  const base = Date.UTC(y, (m ?? 1) - 1, d ?? 1)
  const startMs = base + startMinutes * 60_000
  const endMs = startMs + durationMinutes * 60_000
  return {
    startMs,
    endMs,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  }
}

/** Half-open overlap: [aStart, aEnd) intersects [bStart, bEnd). */
export function windowsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd
}
