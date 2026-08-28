import { NextResponse } from "next/server"

import { getSupabaseClient } from "@/lib/supabase"
import { isReservationStatus } from "@/lib/admin-data"
import { reassignReservationTable } from "@/lib/reservations-server"

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
    // NOTE: `table_name` is NOT a real column on public.reservations — it is
    // derived from the tables relation on read. We echo the request's
    // table_name back in the response instead of writing/selecting it.
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

  // Atomic MOVE path: reassigning to a concrete table goes through the
  // unified-inventory RPC so it takes the shared lock and cannot land on a
  // held or otherwise-occupied table. Status-only changes, unassigning
  // (table_id = null), a reservation with no restaurant scope, or a pre-012
  // database all fall through to the legacy update below.
  const movingToTable =
    hasTable && typeof body.table_id === "string" && body.table_id.length > 0

  if (movingToTable) {
    const move = await reassignReservationTable(
      supabase,
      id,
      body.table_id as string,
    )

    if (move.status === "conflict") {
      return NextResponse.json(
        { error: "That table is already booked for this time slot." },
        { status: 409 },
      )
    }
    if (move.status === "error" && move.message === "not_found") {
      return NextResponse.json(
        { error: "Reservation not found." },
        { status: 404 },
      )
    }
    if (move.status === "error") {
      console.log("[v0] reassignReservationTable error:", move.message)
      return NextResponse.json(
        { error: "Reservation update failed" },
        { status: 500 },
      )
    }

    if (move.status === "ok") {
      // The table was moved atomically. Apply any accompanying status change
      // separately (without table_id, which the RPC already handled).
      if (hasStatus) {
        const statusUpdates: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(updates)) {
          if (k !== "table_id") statusUpdates[k] = v
        }
        let { error: sErr } = await supabase
          .from("reservations")
          .update(statusUpdates)
          .eq("id", id)
        if (sErr && sErr.code === "42703" && operationalKeys.length > 0) {
          for (const key of operationalKeys) delete statusUpdates[key]
          ;({ error: sErr } = await supabase
            .from("reservations")
            .update(statusUpdates)
            .eq("id", id))
        }
        if (sErr) {
          console.log("[v0] post-move status update error:", sErr.message)
          return NextResponse.json(
            { error: "Reservation update failed" },
            { status: 500 },
          )
        }
      }

      const { data: fresh } = await supabase
        .from("reservations")
        .select("id, status, table_id")
        .eq("id", id)
        .single()

      return NextResponse.json({
        id: fresh?.id ?? id,
        status: fresh?.status ?? body.status ?? null,
        table_id: fresh?.table_id ?? body.table_id,
        table_name:
          typeof body.table_name === "string" ? body.table_name : null,
      })
    }
    // move.status === "migration_absent" | "no_scope" -> legacy update below.
  }

  let { data, error } = await supabase
    .from("reservations")
    .update(updates)
    .eq("id", id)
    .select("id, status, table_id")
    .single()

  // 42703 = undefined_column: migration 007 not applied. Retry without the
  // operational timestamp columns so the core status change still succeeds.
  if (error && error.code === "42703" && operationalKeys.length > 0) {
    for (const key of operationalKeys) delete updates[key]
    ;({ data, error } = await supabase
      .from("reservations")
      .update(updates)
      .eq("id", id)
      .select("id, status, table_id")
      .single())
  }

  if (error) {
    // TEMP DIAGNOSTIC (Phase 11 debug): log AND surface the raw PostgREST
    // error so it can be read from Chrome Network → Response. Remove once the
    // Finish party 500 is root-caused.
    console.error("[v0] Reservation PATCH failed", {
      id,
      updates,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    })
    // 23505 = unique_violation: another booking already holds that table slot.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "That table is already booked for this time slot." },
        { status: 409 },
      )
    }
    return NextResponse.json(
      {
        error: "Reservation update failed",
        // TEMP: raw Supabase/PostgREST error for diagnosis only.
        supabase: {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        },
        // TEMP: the exact payload we attempted to write.
        attempted: updates,
      },
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
    // `table_name` is not stored on reservations; echo the request's value
    // when a move supplied one, otherwise null.
    table_name:
      typeof body.table_name === "string" ? body.table_name : null,
  })
}
