/**
 * Phase 13B — server-side hold operations (Supabase I/O).
 *
 * Split from the pure lib/booking-holds so the availability loader can import
 * the loader/query helpers WITHOUT pulling in the availability engine (avoids an
 * import cycle: availability-data -> booking-holds-server, never the reverse).
 * The POST route composes loadAvailability + commitHold itself.
 *
 * Concurrency-critical creation goes exclusively through the create_booking_hold
 * RPC (migration 012); this module never does an unguarded SELECT-then-INSERT.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

import { getSupabaseClient } from "@/lib/supabase"
import type { SettingsContext } from "@/lib/settings/server"
import { isMissingSchema } from "@/lib/settings/server"
import {
  BOOKING_HOLD_MINUTES,
  type HoldRow,
  type PublicHold,
} from "@/lib/booking-holds"

/* ------------------------------------------------------------------ */
/* Availability loader support                                         */
/* ------------------------------------------------------------------ */

const HOLD_COLUMNS =
  "id, restaurant_id, restaurant_name, booking_date, booking_time, start_minutes, duration_minutes, party_size, service_name, allocation_type, combination_id, table_ids, status, expires_at, created_at"

/**
 * Load ACTIVE, UNEXPIRED holds for a restaurant/date. Returns [] gracefully
 * when the table is absent (migration 012 not yet applied), so availability
 * keeps working before the migration is run.
 */
export async function loadActiveHoldRows(
  ctx: SettingsContext,
  date: string,
): Promise<HoldRow[]> {
  const nowIso = new Date().toISOString()
  const { data, error } = await ctx.supabase
    .from("booking_holds")
    .select(HOLD_COLUMNS)
    .eq("restaurant_id", ctx.restaurantId)
    .eq("booking_date", date)
    .eq("status", "active")
    .gt("expires_at", nowIso)

  if (error) {
    if (!isMissingSchema(error)) {
      console.log("[v0] loadActiveHoldRows error:", error.message)
    }
    return []
  }
  return (data ?? []) as HoldRow[]
}

/* ------------------------------------------------------------------ */
/* Commit (atomic create via RPC)                                      */
/* ------------------------------------------------------------------ */

export type CommitHoldParams = {
  restaurantId: string
  restaurantName: string
  bookingDate: string
  /** 12-hour display, e.g. "7:00 PM". */
  bookingTime: string
  startMinutes: number
  durationMinutes: number
  partySize: number
  serviceName: string | null
  allocationType: "table" | "combination"
  combinationId: string | null
  tableIds: string[]
}

export type CommitHoldResult =
  | { status: "ok"; holdId: string; expiresAt: string }
  | { status: "conflict" }
  | { status: "unavailable" }

/** SQLSTATEs the RPC raises (or Postgres raises) that mean "someone else won". */
const CONFLICT_CODES = new Set([
  "23P01", // exclusion_violation (gist backstop / explicit conflict)
  "23503", // foreign_key_violation (a candidate table vanished)
  "23505", // unique_violation
  "23514", // check_violation
])

/**
 * Atomically create a hold through the create_booking_hold RPC. The caller MUST
 * have just re-run the Availability Engine and chosen a real allocation; this
 * only performs the race-safe commit and maps failures to guest-safe outcomes.
 */
export async function commitHold(
  params: CommitHoldParams,
): Promise<CommitHoldResult> {
  const supabase = getSupabaseClient()
  if (!supabase) return { status: "unavailable" }

  const { data, error } = await supabase.rpc("create_booking_hold", {
    p_restaurant_id: params.restaurantId,
    p_restaurant_name: params.restaurantName,
    p_booking_date: params.bookingDate,
    p_booking_time: params.bookingTime,
    p_start_minutes: params.startMinutes,
    p_duration_minutes: params.durationMinutes,
    p_party_size: params.partySize,
    p_service_name: params.serviceName,
    p_allocation_type: params.allocationType,
    p_combination_id: params.combinationId,
    p_table_ids: params.tableIds,
    p_hold_minutes: BOOKING_HOLD_MINUTES,
  })

  if (error) {
    const code = (error as { code?: string }).code ?? ""
    if (CONFLICT_CODES.has(code)) return { status: "conflict" }
    // Missing RPC/table -> migration 012 not applied yet. Guest-safe.
    console.log("[v0] commitHold rpc error:", error.message, code)
    return { status: "unavailable" }
  }

  // returns table (hold_id, expires_at) -> array of one row.
  const row = Array.isArray(data) ? data[0] : data
  const holdId = (row as { hold_id?: string } | null)?.hold_id
  const expiresAt = (row as { expires_at?: string } | null)?.expires_at
  if (!holdId || !expiresAt) return { status: "unavailable" }

  return { status: "ok", holdId, expiresAt }
}

/* ------------------------------------------------------------------ */
/* Read / cancel                                                       */
/* ------------------------------------------------------------------ */

/** Resolve a restaurant's public slug from its id (for guest-safe payloads). */
async function slugForRestaurantId(
  supabase: SupabaseClient,
  restaurantId: string,
): Promise<string> {
  const { data } = await supabase
    .from("restaurants")
    .select("slug")
    .eq("id", restaurantId)
    .maybeSingle()
  return (data as { slug?: string } | null)?.slug ?? ""
}

/** Project a raw row into the guest-safe shape (drops all internal fields). */
function toPublicHold(row: HoldRow, slug: string): PublicHold {
  const exp = Date.parse(row.expires_at)
  const effectiveStatus =
    row.status === "active" && Number.isFinite(exp) && exp <= Date.now()
      ? "expired"
      : row.status
  return {
    holdId: row.id,
    status: effectiveStatus,
    expiresAt: row.expires_at,
    booking: {
      restaurant: row.restaurant_name,
      slug,
      date: row.booking_date,
      partySize: row.party_size,
      time: row.booking_time,
      service: row.service_name,
    },
  }
}

/** Fetch a single hold in guest-safe form, or null when not found. */
export async function getHold(holdId: string): Promise<PublicHold | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { data, error } = await supabase
    .from("booking_holds")
    .select(HOLD_COLUMNS)
    .eq("id", holdId)
    .maybeSingle()

  if (error || !data) {
    if (error && !isMissingSchema(error)) {
      console.log("[v0] getHold error:", error.message)
    }
    return null
  }
  const row = data as HoldRow
  const slug = await slugForRestaurantId(supabase, row.restaurant_id)
  return toPublicHold(row, slug)
}

/**
 * Cancel a hold atomically via the cancel_booking_hold RPC: it marks the parent
 * 'cancelled' and deactivates the hold's inventory blocks (under the shared
 * advisory lock) so the exclusion constraint stops blocking. Never hard-deletes.
 *
 * Pre-migration fallback: if the RPC is absent (migration 012 not applied) we
 * fall back to a best-effort status update on booking_holds so the guest flow
 * still behaves. Returns the guest-safe hold (now cancelled) or null.
 */
export async function cancelHold(holdId: string): Promise<PublicHold | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  const { error: rpcErr } = await supabase.rpc("cancel_booking_hold", {
    p_hold_id: holdId,
  })

  if (rpcErr) {
    // Missing function => migration not applied yet. Fall back to a plain
    // status flip on the workflow row (inventory table doesn't exist either).
    const { error: updErr } = await supabase
      .from("booking_holds")
      .update({ status: "cancelled" })
      .eq("id", holdId)
      .eq("status", "active")
    if (updErr && !isMissingSchema(updErr)) {
      console.log("[v0] cancelHold fallback error:", updErr.message)
      return null
    }
  }

  return getHold(holdId)
}
