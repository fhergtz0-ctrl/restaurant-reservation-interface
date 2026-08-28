/**
 * Server-side data loader for the Availability Engine (Phase 12E).
 *
 * Bridges the two scoping models the platform uses: the Schedule, Special
 * Days, Zones, and Table Combinations are scoped by restaurant_id (uuid),
 * while physical tables and reservations are scoped by restaurant_name (the
 * legacy text model). We resolve the restaurant once (reusing the SAME
 * find-or-create helper every other module uses — the frozen shared context
 * path is intentionally NOT modified here) and then batch every query so the
 * pure engine can compute availability in memory.
 *
 * Nothing is persisted: availability is always derived from live data.
 */

import {
  resolveSettingsContext,
  type SettingsContext,
} from "@/lib/settings/server"
import {
  loadTableMap,
  loadCombinations,
} from "@/lib/table-combinations-server"
import {
  computeAvailability,
  parseClockToMinutes,
  weekdayIndex,
  type AvailabilityData,
  type AvailabilityResult,
  type EngineCombination,
  type EnginePeriod,
  type EngineReservation,
  type EngineTable,
  type EngineZone,
} from "@/lib/availability-engine"
import { isReservationStatus } from "@/lib/admin-data"

/* ------------------------------------------------------------------ */
/* Row shapes                                                          */
/* ------------------------------------------------------------------ */

type PeriodRow = {
  id: string
  name: string
  start_time: string
  end_time: string
  booking_interval_minutes: number
  default_duration_minutes: number
  min_party_size: number
  max_party_size: number
  active: boolean
}

type SpecialDayPeriodRow = Omit<PeriodRow, "active">

type ReservationRow = {
  id: string
  reservation_time: string
  status: string
  table_id: string | null
}

/** Normalize a Postgres time ("HH:MM:SS") to "HH:MM". */
function normalizeTime(value: unknown): string {
  if (typeof value !== "string") return "00:00"
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!match) return "00:00"
  return `${match[1].padStart(2, "0")}:${match[2]}`
}

function periodRowToEngine(row: PeriodRow | SpecialDayPeriodRow): EnginePeriod {
  return {
    id: row.id,
    name: row.name,
    startTime: normalizeTime(row.start_time),
    endTime: normalizeTime(row.end_time),
    bookingIntervalMinutes: Number(row.booking_interval_minutes) || 0,
    defaultDurationMinutes: Number(row.default_duration_minutes) || 0,
    minPartySize: Number(row.min_party_size) || 1,
    maxPartySize: Number(row.max_party_size) || 9999,
  }
}

/* ------------------------------------------------------------------ */
/* Loader result                                                       */
/* ------------------------------------------------------------------ */

export type AvailabilityLoad =
  | { ok: true; configured: true; result: AvailabilityResult }
  | { ok: false; configured: false; status: number; error: string }

/* ------------------------------------------------------------------ */
/* Service-window resolution (Special Day overrides weekly Schedule)   */
/* ------------------------------------------------------------------ */

async function resolveServiceWindow(
  ctx: SettingsContext,
  date: string,
): Promise<{
  source: AvailabilityData["source"]
  open: boolean
  specialDay: AvailabilityData["specialDay"]
  periods: EnginePeriod[]
}> {
  // 1. Special Day FIRST — it always overrides the recurring schedule.
  const { data: dayData, error: dayErr } = await ctx.supabase
    .from("restaurant_special_days")
    .select("id, name, type, is_open")
    .eq("restaurant_id", ctx.restaurantId)
    .eq("special_date", date)
    .maybeSingle()

  if (!dayErr && dayData) {
    const specialDay = {
      name: String(dayData.name ?? "Special Day"),
      type: String(dayData.type ?? "other"),
      isOpen: Boolean(dayData.is_open),
    }
    if (!dayData.is_open) {
      return { source: "special_day", open: false, specialDay, periods: [] }
    }
    const { data: periodData } = await ctx.supabase
      .from("restaurant_special_day_periods")
      .select(
        "id, name, start_time, end_time, booking_interval_minutes, default_duration_minutes, min_party_size, max_party_size, display_order",
      )
      .eq("special_day_id", dayData.id)
      .order("display_order", { ascending: true })

    const periods = ((periodData ?? []) as SpecialDayPeriodRow[]).map(
      periodRowToEngine,
    )
    return { source: "special_day", open: periods.length > 0, specialDay, periods }
  }

  // 2. No Special Day — use the recurring weekly Schedule for the weekday.
  const dow = weekdayIndex(date)
  if (dow === null) {
    return { source: "none", open: false, specialDay: null, periods: [] }
  }

  const { data: periodData, error: periodErr } = await ctx.supabase
    .from("restaurant_service_periods")
    .select(
      "id, name, start_time, end_time, booking_interval_minutes, default_duration_minutes, min_party_size, max_party_size, active",
    )
    .eq("restaurant_id", ctx.restaurantId)
    .eq("day_of_week", dow)
    .eq("active", true)
    .order("start_time", { ascending: true })

  if (periodErr) {
    // Missing schema (008 not applied) -> treat as closed but structurally ok.
    return { source: "weekly_schedule", open: false, specialDay: null, periods: [] }
  }

  const periods = ((periodData ?? []) as PeriodRow[]).map(periodRowToEngine)
  return {
    source: "weekly_schedule",
    open: periods.length > 0,
    specialDay: null,
    periods,
  }
}

/* ------------------------------------------------------------------ */
/* Zones + reservations                                                */
/* ------------------------------------------------------------------ */

async function loadZones(ctx: SettingsContext): Promise<EngineZone[]> {
  const { data, error } = await ctx.supabase
    .from("restaurant_zones")
    .select("name, active, reservable")
    .eq("restaurant_id", ctx.restaurantId)

  if (error || !data) return []
  return (data as { name: string; active: boolean; reservable: boolean }[]).map(
    (z) => ({
      name: String(z.name ?? ""),
      active: z.active !== false,
      reservable: z.reservable !== false,
    }),
  )
}

async function loadReservations(
  ctx: SettingsContext,
  restaurantName: string,
  date: string,
): Promise<EngineReservation[]> {
  const { data, error } = await ctx.supabase
    .from("reservations")
    .select("id, reservation_time, status, table_id")
    .eq("restaurant_name", restaurantName)
    .eq("reservation_date", date)

  if (error || !data) return []
  return (data as ReservationRow[])
    .map((r) => {
      const startMinutes = parseClockToMinutes(r.reservation_time ?? "")
      if (startMinutes === null) return null
      return {
        id: r.id,
        tableId: r.table_id ?? null,
        status: isReservationStatus(r.status) ? r.status : "confirmed",
        startMinutes,
      } satisfies EngineReservation
    })
    .filter((r): r is EngineReservation => r !== null)
}

/** Resolve the restaurant's display name from its id (for name-scoped tables). */
async function resolveRestaurantName(
  ctx: SettingsContext,
): Promise<string | null> {
  const { data } = await ctx.supabase
    .from("restaurants")
    .select("name")
    .eq("id", ctx.restaurantId)
    .maybeSingle()
  return (data as { name?: string } | null)?.name ?? null
}

/* ------------------------------------------------------------------ */
/* Public loader                                                       */
/* ------------------------------------------------------------------ */

/**
 * Load every source-of-truth input for `date`, then run the pure engine.
 * `params` mirrors the other admin routes: slug (restaurant), explicit id,
 * or name. Availability is computed live and never stored.
 */
export async function loadAvailability(params: {
  slug?: string | null
  restaurantId?: string | null
  name?: string | null
  date: string
  partySize: number
  requestedTime?: string | null
}): Promise<AvailabilityLoad> {
  const guard = await resolveSettingsContext({
    slug: params.slug,
    id: params.restaurantId,
    name: params.name,
  })
  if (!guard.ok) {
    return {
      ok: false,
      configured: false,
      status: guard.status,
      error: guard.error,
    }
  }
  const ctx = guard.ctx

  // Batch every source: service window, zones, tables, combinations,
  // reservations. Tables + combinations reuse the Table Combinations loaders
  // (which resolve the name-scoped tables), so nothing is duplicated.
  const restaurantName = await resolveRestaurantName(ctx)
  const [window, zones, tableMap, reservations] = await Promise.all([
    resolveServiceWindow(ctx, params.date),
    loadZones(ctx),
    loadTableMap(ctx),
    restaurantName
      ? loadReservations(ctx, restaurantName, params.date)
      : Promise.resolve([] as EngineReservation[]),
  ])

  const tables: EngineTable[] = [...tableMap.values()].map((t) => ({
    id: t.id,
    name: t.name,
    capacity: t.capacity,
    active: t.active,
    blocked: t.blocked,
    zone: t.zone,
  }))

  // Combinations, enriched with resolved member tables + effective capacity.
  const comboLoad = await loadCombinations(ctx, tableMap)
  const combinations: EngineCombination[] = comboLoad.ok
    ? comboLoad.combinations.map((c) => ({
        id: c.id,
        name: c.name,
        active: c.active,
        effectiveCapacity: c.effective_capacity,
        members: c.members.map((m) => ({
          tableId: m.table_id,
          table: m.table
            ? {
                id: m.table.id,
                name: m.table.name,
                capacity: m.table.capacity,
                active: m.table.active,
                blocked: m.table.blocked,
                zone: m.table.zone,
              }
            : null,
        })),
      }))
    : []

  const data: AvailabilityData = {
    source: window.source,
    open: window.open,
    specialDay: window.specialDay,
    periods: window.periods,
    tables,
    zones,
    combinations,
    reservations,
  }

  const result = computeAvailability(
    {
      date: params.date,
      partySize: params.partySize,
      requestedTime: params.requestedTime ?? null,
    },
    data,
  )

  return { ok: true, configured: true, result }
}
