import { NextResponse } from "next/server"

import { getSupabaseClient } from "@/lib/supabase"
import { isReservationStatus } from "@/lib/admin-data"

type PatchBody = {
  status?: unknown
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { error: "A reservation id is required." },
      { status: 400 },
    )
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  if (!isReservationStatus(body.status)) {
    return NextResponse.json(
      {
        error:
          "A valid status is required: confirmed, seated, cancelled, or no_show.",
      },
      { status: 400 },
    )
  }

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

  const { data, error } = await supabase
    .from("reservations")
    .update({ status: body.status })
    .eq("id", id)
    .select("id, status")
    .single()

  if (error) {
    console.log("[v0] Admin status update error:", error.message)
    return NextResponse.json(
      { error: "We couldn't update the reservation. Please try again." },
      { status: 500 },
    )
  }

  if (!data) {
    return NextResponse.json(
      { error: "Reservation not found." },
      { status: 404 },
    )
  }

  return NextResponse.json({ id: data.id, status: data.status })
}
