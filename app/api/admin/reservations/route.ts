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
  tables: { name: string | null } | { name: string | null }[] | null
}

function isNonEmptyString(value: string | null): value is string {
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

  let query = supabase
    .from("reservations")
    .select(
      "id, restaurant_name, guests, reservation_date, reservation_time, customer_name, customer_phone, customer_email, notes, status, table_id, tables(name)",
    )

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

  const { data, error } = await query

  if (error) {
    console.log("[v0] Admin reservations fetch error:", error.message)
    return NextResponse.json(
      { error: "We couldn't load reservations. Please try again." },
      { status: 500 },
    )
  }

  const reservations: AdminReservation[] = ((data ?? []) as ReservationRow[])
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
      }
    })
    .sort(
      (a, b) =>
        timeToMinutes(a.reservation_time) - timeToMinutes(b.reservation_time),
    )

  return NextResponse.json({ reservations })
}
