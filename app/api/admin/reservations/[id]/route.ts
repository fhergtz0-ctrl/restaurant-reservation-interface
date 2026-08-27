import { NextResponse } from "next/server"

import { getSupabaseClient } from "@/lib/supabase"
import { isReservationStatus } from "@/lib/admin-data"

type PatchBody = {
  status?: unknown
  /** Reassign the reservation to another table (floor-plan move). */
  table_id?: unknown
  /** Optional display name to keep table_name in sync after a move. */
  table_name?: unknown
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

  // Build the update from whichever fields were provided. At least one of
  // `status` or `table_id` must be present.
  const updates: Record<string, unknown> = {}

  const hasStatus = body.status !== undefined
  const hasTable = body.table_id !== undefined

  if (!hasStatus && !hasTable) {
    return NextResponse.json(
      { error: "Provide a status or a table_id to update." },
      { status: 400 },
    )
  }

  // Track which keys are operational (migration 007) so we can retry without
  // them if the columns don't exist yet.
  const operationalKeys: string[] = []

  if (hasStatus) {
    if (!isReservationStatus(body.status)) {
      return NextResponse.json(
        {
          error:
            "A valid status is required: confirmed, seated, finished, cancelled, or no_show.",
        },
        { status: 400 },
      )
    }
    updates.status = body.status

    // Stamp the operational lifecycle timestamps on transition.
    if (body.status === "seated") {
      updates.seated_at = new Date().toISOString()
      operationalKeys.push("seated_at")
    } else if (body.status === "finished") {
      updates.finished_at = new Date().toISOString()
      operationalKeys.push("finished_at")
    }
  }

  if (hasTable) {
    if (body.table_id !== null && typeof body.table_id !== "string") {
      return NextResponse.json(
        { error: "table_id must be a string or null." },
        { status: 400 },
      )
    }
    updates.table_id = body.table_id
    if (typeof body.table_name === "string" || body.table_name === null) {
      updates.table_name = body.table_name
    }
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

  let { data, error } = await supabase
    .from("reservations")
    .update(updates)
    .eq("id", id)
    .select("id, status, table_id, table_name")
    .single()

  // 42703 = undefined_column: migration 007 not applied. Retry without the
  // operational timestamp columns so the core status change still succeeds.
  if (error && error.code === "42703" && operationalKeys.length > 0) {
    for (const key of operationalKeys) delete updates[key]
    ;({ data, error } = await supabase
      .from("reservations")
      .update(updates)
      .eq("id", id)
      .select("id, status, table_id, table_name")
      .single())
  }

  if (error) {
    console.log("[v0] Admin reservation update error:", error.message)
    // 23505 = unique_violation: another booking already holds that table slot.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That table is already booked for this time slot." },
        { status: 409 },
      )
    }
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

  return NextResponse.json({
    id: data.id,
    status: data.status,
    table_id: data.table_id,
    table_name: data.table_name,
  })
}
