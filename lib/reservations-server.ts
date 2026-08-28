/**
 * Phase 13B — unified-inventory reservation writes.
 *
 * Every reservation that consumes a physical table now goes through a
 * SECURITY DEFINER RPC (migration 012) that takes the shared advisory lock and
 * is backstopped by the restaurant_inventory_blocks GiST exclusion constraint.
 * This closes the hold-vs-reservation race that a plain SELECT-then-INSERT
 * from Node cannot: a direct reservation can no longer land on a held table (or
 * vice versa), and two racing writers for the same table/time cannot both win.
 *
 * Each helper returns { status: "migration_absent" } when the RPC does not yet
 * exist (migration 012 not applied) so callers can fall back to their legacy
 * direct-insert path and keep working before the migration is run.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import { parseClockToMinutes } from "@/lib/availability-engine"
import { DEFAULT_STAY_MINUTES } from "@/lib/operations"

/** SQLSTATEs that mean "another writer won the table" (guest-safe 409). */
const CONFLICT_CODES = new Set([
  "23P01", // exclusion_violation / explicit 'conflict'
  "23505", // unique_violation
  "23503", // foreign_key_violation (candidate table vanished)
])

/** Postgres codes that indicate the RPC/columns are not present yet. */
function isMissingRpc(code: string, message: string): boolean {
  // 42883 undefined_function, 42P01 undefined_table, 42703 undefined_column,
  // PGRST202 = PostgREST cannot find the function in its schema cache.
  if (code === "42883" || code === "42P01" || code === "42703") return true
  if (code === "PGRST202") return true
  const m = message.toLowerCase()
  return (
    m.includes("could not find the function") ||
    m.includes("does not exist") ||
    m.includes("schema cache")
  )
}

export type ReservationWriteResult =
  | { status: "ok"; reservationId: string }
  | { status: "conflict" }
  | { status: "migration_absent" }
  | { status: "error"; message: string }

export type DirectReservationParams = {
  restaurantId: string | null
  restaurantName: string | null
  date: string
  /** 12-hour display string, e.g. "7:30 PM". */
  time: string
  guests: number
  customerName: string
  customerPhone: string
  customerEmail: string | null
  notes: string | null
  tableId: string
  status: string
  source: string
  seatedAt: string | null
  /** Optional explicit stay; defaults to the centralized operational default. */
  durationMinutes?: number | null
}

/**
 * Create a reservation atomically via create_direct_reservation. Requires a
 * resolved restaurant_id and a parseable time (the RPC keys occupancy on
 * restaurant + calendar day and materializes a range). Returns
 * "migration_absent" so the caller can fall back when 012 isn't applied.
 */
export async function createDirectReservation(
  supabase: SupabaseClient,
  params: DirectReservationParams,
): Promise<ReservationWriteResult> {
  const startMinutes = parseClockToMinutes(params.time)
  // Without a restaurant scope or a parseable time the RPC cannot build its
  // lock key / range — signal fallback rather than guessing.
  if (!params.restaurantId || !params.restaurantName || startMinutes === null) {
    return { status: "migration_absent" }
  }

  const duration =
    typeof params.durationMinutes === "number" && params.durationMinutes > 0
      ? params.durationMinutes
      : DEFAULT_STAY_MINUTES

  const { data, error } = await supabase.rpc("create_direct_reservation", {
    p_restaurant_id: params.restaurantId,
    p_restaurant_name: params.restaurantName,
    p_booking_date: params.date,
    p_reservation_time: params.time,
    p_start_minutes: startMinutes,
    p_duration_minutes: duration,
    p_guests: params.guests,
    p_customer_name: params.customerName,
    p_customer_phone: params.customerPhone,
    p_customer_email: params.customerEmail,
    p_notes: params.notes,
    p_table_id: params.tableId,
    p_status: params.status,
    p_source: params.source,
    p_seated_at: params.seatedAt,
  })

  if (error) {
    const code = (error as { code?: string }).code ?? ""
    if (isMissingRpc(code, error.message)) return { status: "migration_absent" }
    if (CONFLICT_CODES.has(code)) return { status: "conflict" }
    return { status: "error", message: error.message }
  }

  const reservationId = typeof data === "string" ? data : String(data ?? "")
  if (!reservationId) return { status: "error", message: "No id returned." }
  return { status: "ok", reservationId }
}

export type ReassignResult =
  | { status: "ok" }
  | { status: "conflict" }
  | { status: "migration_absent" }
  | { status: "no_scope" }
  | { status: "error"; message: string }

/**
 * Move a reservation to another table atomically via reassign_reservation_table.
 * The RPC frees the reservation's current block and claims the new table under
 * the shared lock, so a move cannot land on a held/occupied table. Returns
 * "no_scope" when the reservation has no restaurant_id (caller does a plain
 * table_id update) and "migration_absent" before 012 is applied.
 */
export async function reassignReservationTable(
  supabase: SupabaseClient,
  reservationId: string,
  newTableId: string,
): Promise<ReassignResult> {
  const { error } = await supabase.rpc("reassign_reservation_table", {
    p_reservation_id: reservationId,
    p_new_table_id: newTableId,
  })

  if (error) {
    const code = (error as { code?: string }).code ?? ""
    const message = error.message ?? ""
    if (isMissingRpc(code, message)) return { status: "migration_absent" }
    if (CONFLICT_CODES.has(code)) return { status: "conflict" }
    // The RPC raises 22023 'no_restaurant_scope' when the row predates
    // multi-restaurant; the caller then falls back to a plain update.
    if (code === "22023" && message.includes("no_restaurant_scope")) {
      return { status: "no_scope" }
    }
    if (code === "P0002") return { status: "error", message: "not_found" }
    return { status: "error", message }
  }

  return { status: "ok" }
}
