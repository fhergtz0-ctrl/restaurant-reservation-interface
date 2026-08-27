import { NextResponse } from "next/server"

import { getSupabaseClient } from "@/lib/supabase"
import {
  isReservationStatus,
  timeToMinutes,
  type AdminReservation,
} from "@/lib/admin-data"
import { getRestaurantBySlug } from "@/lib/restaurants"

type ReservationRow = {
  id: string
  restaurant_name: string | null
  guests: number
  reservation_date: string
  reservation_time: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  notes: string | null
  status: string
  table_id: string | null
  seated_at?: string | null
  finished_at?: string | null
  source?: string | null
  tables: { name: string | null } | { name: string | null }[] | null
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

export async function GET(request: Request) {
  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(request.url)
  const date = searchParams.get("date")
  const status = searchParams.get("status")
  const time = searchParams.get("time")
  const restaurant = searchParams.get("restaurant")
  const restaurantSlug = searchParams.get("restaurantSlug")

  // Resolve a per-restaurant name filter from either the display name or slug.
  let restaurantName: string | null = isNonEmptyString(restaurant)
    ? restaurant
    : null
  if (!restaurantName && isNonEmptyString(restaurantSlug)) {
    const profile = await getRestaurantBySlug(restaurantSlug)
    restaurantName = profile?.name ?? null
  }

  // Try selecting the operational columns (migration 007). Fall back to the
  // base columns when they don't exist yet so the page keeps working.
  const BASE_COLUMNS =
    "id, restaurant_name, guests, reservation_date, reservation_time, customer_name, customer_phone, customer_email, notes, status, table_id, tables(name)"
  const OPERATIONAL_COLUMNS = `${BASE_COLUMNS}, seated_at, finished_at, source`

  function runQuery(columns: string) {
    let query = supabase!.from("reservations").select(columns)
    if (restaurantName) {
      query = query.eq("restaurant_name", restaurantName)
    }
    if (isNonEmptyString(date)) {
      query = query.eq("reservation_date", date)
    }
    if (isNonEmptyString(status) && status !== "all") {
      query = query.eq("status", status)
    }
    if (isNonEmptyString(time) && time !== "all") {
      query = query.eq("reservation_time", time)
    }
    return query
  }

  let { data, error } = await runQuery(OPERATIONAL_COLUMNS)

  // 42703 = undefined_column. Retry without the operational columns.
  if (error && error.code === "42703") {
    ;({ data, error } = await runQuery(BASE_COLUMNS))
  }

  if (error) {
    console.log("[v0] Admin reservations fetch error:", error.message)
    return NextResponse.json(
      { error: "We couldn't load reservations. Please try again." },
      { status: 500 },
    )
  }

  const reservations: AdminReservation[] = (
    (data ?? []) as unknown as ReservationRow[]
  )
    .map((row) => {
      const tableRel = Array.isArray(row.tables) ? row.tables[0] : row.tables
      return {
        id: row.id,
        restaurant_name: row.restaurant_name,
        guests: row.guests,
        reservation_date: row.reservation_date,
        reservation_time: row.reservation_time,
        customer_name: row.customer_name,
        customer_phone: row.customer_phone,
        customer_email: row.customer_email,
        notes: row.notes,
        status: isReservationStatus(row.status) ? row.status : "confirmed",
        table_id: row.table_id,
        table_name: tableRel?.name ?? null,
        seated_at: row.seated_at ?? null,
        finished_at: row.finished_at ?? null,
        source: row.source ?? "reservation",
      }
    })
    .sort(
      (a, b) =>
        timeToMinutes(a.reservation_time) - timeToMinutes(b.reservation_time),
    )

  return NextResponse.json({ reservations })
}

/* ------------------------------------------------------------------ */
/* POST — create a walk-in (Phase 11)                                  */
/* ------------------------------------------------------------------ */

type WalkInBody = {
  customerName?: unknown
  guests?: unknown
  tableId?: unknown
  phone?: unknown
  notes?: unknown
  date?: unknown
  time?: unknown
  restaurant?: unknown
  restaurantSlug?: unknown
}

/** Server-side "h:mm AM/PM" for the current moment (walk-in default time). */
function formatNowTime(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
}

function todayISO(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split("T")[0]
}

export async function POST(request: Request) {
  let body: WalkInBody
  try {
    body = (await request.json()) as WalkInBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  if (!isNonEmptyString(body.customerName)) {
    return NextResponse.json(
      { error: "A guest name is required." },
      { status: 400 },
    )
  }
  if (!isNonEmptyString(body.tableId)) {
    return NextResponse.json(
      { error: "Select a table to seat the walk-in." },
      { status: 400 },
    )
  }

  const guests =
    typeof body.guests === "number" && Number.isFinite(body.guests)
      ? Math.max(1, Math.trunc(body.guests))
      : 2

  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      { status: 503 },
    )
  }

  let restaurantName = isNonEmptyString(body.restaurant)
    ? body.restaurant.trim()
    : null
  let restaurantId: string | null = null
  if (isNonEmptyString(body.restaurantSlug)) {
    const profile = await getRestaurantBySlug(body.restaurantSlug.trim())
    if (profile) {
      restaurantId = profile.id
      if (!restaurantName) restaurantName = profile.name
    }
  }

  const date = isNonEmptyString(body.date) ? body.date.trim() : todayISO()
  const time = isNonEmptyString(body.time) ? body.time.trim() : formatNowTime()

  // Guard: never seat two active parties at the same table.
  const { data: activeAtTable, error: checkError } = await supabase
    .from("reservations")
    .select("id")
    .eq("table_id", body.tableId)
    .eq("reservation_date", date)
    .eq("status", "seated")
    .limit(1)

  if (checkError) {
    console.log("[v0] Walk-in occupancy check error:", checkError.message)
    return NextResponse.json(
      { error: "We couldn't seat the walk-in. Please try again." },
      { status: 500 },
    )
  }
  if (activeAtTable && activeAtTable.length > 0) {
    return NextResponse.json(
      { error: "That table already has a seated party." },
      { status: 409 },
    )
  }

  const nowIso = new Date().toISOString()
  const insertRow: Record<string, unknown> = {
    restaurant_name: restaurantName,
    ...(restaurantId ? { restaurant_id: restaurantId } : {}),
    customer_name: body.customerName.trim(),
    customer_phone: isNonEmptyString(body.phone) ? body.phone.trim() : "",
    customer_email: null,
    notes: isNonEmptyString(body.notes) ? body.notes.trim() : null,
    guests,
    reservation_date: date,
    reservation_time: time,
    table_id: body.tableId,
    status: "seated",
    seated_at: nowIso,
    source: "walk_in",
  }

  let { data, error } = await supabase
    .from("reservations")
    .insert(insertRow)
    .select("id")
    .single()

  // 42703 = operational columns missing (migration 007 not applied). Retry
  // without them so a walk-in can still be created as a seated reservation.
  if (error && error.code === "42703") {
    delete insertRow.seated_at
    delete insertRow.source
    ;({ data, error } = await supabase
      .from("reservations")
      .insert(insertRow)
      .select("id")
      .single())
  }

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That table already has a party at this time." },
        { status: 409 },
      )
    }
    console.log("[v0] Walk-in insert error:", error.message)
    return NextResponse.json(
      { error: "We couldn't seat the walk-in. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({ id: data?.id }, { status: 201 })
}
