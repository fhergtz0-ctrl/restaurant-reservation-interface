import { NextResponse } from "next/server"

import { getSupabaseClient } from "@/lib/supabase"
import {
  getBookedTableIdsByTime,
  getEligibleTables,
  pickAvailableTable,
} from "@/lib/tables"
import { getSlotTimes, getSlots } from "@/lib/reservation-data"
import { getRestaurantBySlug } from "@/lib/restaurants"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const restaurantParam = searchParams.get("restaurant")
  const restaurantSlug = searchParams.get("restaurantSlug")
  const date = searchParams.get("date")
  const preference = searchParams.get("preference") ?? "dinner"
  const guestsParam = Number.parseInt(searchParams.get("guests") ?? "2", 10)
  const guests = Number.isFinite(guestsParam) ? guestsParam : 2

  // Accept either restaurant (display name) or restaurantSlug. The table
  // helpers key off restaurant_name, so resolve a slug to its name.
  let restaurant = restaurantParam
  if (!restaurant && restaurantSlug) {
    const profile = await getRestaurantBySlug(restaurantSlug)
    restaurant = profile?.name ?? null
  }

  if (!restaurant || !date) {
    return NextResponse.json(
      { error: "restaurant (or restaurantSlug) and date are required." },
      { status: 400 },
    )
  }

  const times = getSlotTimes(preference)

  const supabase = getSupabaseClient()

  // Graceful fallback to the deterministic mock when Supabase isn't set up.
  if (!supabase) {
    return NextResponse.json({ slots: getSlots(date, guests, preference) })
  }

  try {
    const [eligibleTables, bookedByTime] = await Promise.all([
      getEligibleTables(supabase, restaurant, guests),
      getBookedTableIdsByTime(supabase, restaurant, date),
    ])

    const slots = times.map((time) => ({
      time,
      available:
        pickAvailableTable(eligibleTables, bookedByTime.get(time)) !== null,
    }))

    return NextResponse.json({ slots })
  } catch (error) {
    console.log(
      "[v0] Availability lookup error:",
      error instanceof Error ? error.message : error,
    )
    return NextResponse.json(
      { error: "Could not load availability." },
      { status: 500 },
    )
  }
}
