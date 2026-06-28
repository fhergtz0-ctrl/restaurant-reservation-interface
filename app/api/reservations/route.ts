import { NextResponse } from "next/server"

import { getSupabaseClient } from "@/lib/supabase"

type ReservationRequestBody = {
  restaurant?: unknown
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

function generateConfirmationCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `ML-${code}`
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

  const confirmationCode = generateConfirmationCode()

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      restaurant: isNonEmptyString(body.restaurant)
        ? body.restaurant.trim()
        : null,
      customer_name: body.customerName.trim(),
      phone: body.phone.trim(),
      email: isNonEmptyString(body.email) ? body.email.trim() : null,
      notes: isNonEmptyString(body.notes) ? body.notes.trim() : null,
      guests,
      date: body.date,
      time: body.time,
      confirmation_code: confirmationCode,
      status: "confirmed",
    })
    .select("confirmation_code")
    .single()

  if (error) {
    console.log("[v0] Supabase insert error:", error.message)
    return NextResponse.json(
      { error: "We couldn't save your reservation. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json(
    { confirmationCode: data?.confirmation_code ?? confirmationCode },
    { status: 201 },
  )
}
