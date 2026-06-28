import { NextResponse } from "next/server"

import { getSupabaseClient } from "@/lib/supabase"
import {
  getEligibleTables,
  getBookedTableIdsByTime,
  pickAvailableTable,
} from "@/lib/tables"
import { getRestaurantBySlug } from "@/lib/restaurants"

type ReservationRequestBody = {
  restaurant?: unknown
  restaurantSlug?: unknown
  customerName?: unknown
  phone?: unknown
  email?: unknown
  notes?: unknown
  guests?: unknown
  date?: unknown
  time?: unknown
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

export async function POST(request: Request) {
  let body: ReservationRequestBody

  try {
    body = (await request.json()) as ReservationRequestBody
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    )
  }

  // Validate required fields.
  if (!isNonEmptyString(body.customerName)) {
    return NextResponse.json(
      { error: "A name is required to reserve." },
      { status: 400 },
    )
  }
  if (!isNonEmptyString(body.phone)) {
    return NextResponse.json(
      { error: "A phone number is required to reserve." },
      { status: 400 },
    )
  }
  if (!isNonEmptyString(body.date) || !isNonEmptyString(body.time)) {
    return NextResponse.json(
      { error: "A date and time are required to reserve." },
      { status: 400 },
    )
  }

  const guests =
    typeof body.guests === "number" && Number.isFinite(body.guests)
      ? Math.trunc(body.guests)
      : 2

  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json(
      {
        error:
          "Reservations are not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      },
      { status: 503 },
    )
  }

  // Prefer the slug internally (resolves restaurant_id), but stay backward
  // compatible with a restaurant display name.
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

  // Automatically assign the smallest available table for this slot.
  let assignedTableId: string | null = null
  if (restaurantName) {
    try {
      const [eligibleTables, bookedByTime] = await Promise.all([
        getEligibleTables(supabase, restaurantName, guests),
        getBookedTableIdsByTime(supabase, restaurantName, body.date),
      ])

      const table = pickAvailableTable(
        eligibleTables,
        bookedByTime.get(body.time),
      )

      if (!table) {
        return NextResponse.json(
          { error: "No tables available for this time." },
          { status: 409 },
        )
      }

      assignedTableId = table.id
    } catch (lookupError) {
      console.log(
        "[v0] Table assignment error:",
        lookupError instanceof Error ? lookupError.message : lookupError,
      )
      return NextResponse.json(
        { error: "We couldn't save your reservation. Please try again." },
        { status: 500 },
      )
    }
  }

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      restaurant_name: restaurantName,
      // Only set restaurant_id when resolved; the column exists once the
      // multi-restaurant migration has been applied.
      ...(restaurantId ? { restaurant_id: restaurantId } : {}),
      customer_name: body.customerName.trim(),
      customer_phone: body.phone.trim(),
      customer_email: isNonEmptyString(body.email) ? body.email.trim() : null,
      notes: isNonEmptyString(body.notes) ? body.notes.trim() : null,
      guests,
      reservation_date: body.date,
      reservation_time: body.time,
      table_id: assignedTableId,
      status: "confirmed",
    })
    .select("id")
    .single()

  if (error) {
    // 23505 = unique violation: the table was taken by a concurrent booking.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "No tables available for this time." },
        { status: 409 },
      )
    }
    console.log("[v0] Supabase insert error:", error.message)
    return NextResponse.json(
      { error: "We couldn't save your reservation. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json(
    { confirmationCode: String(data.id).slice(0, 8).toUpperCase() },
    { status: 201 },
  )
}
