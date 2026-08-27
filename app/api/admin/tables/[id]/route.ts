import { NextResponse } from "next/server"

import { getSupabaseClient } from "@/lib/supabase"

type PatchBody = {
  blocked?: unknown
  /** Cleaning marker (migration 007). ISO string to start, null to clear. */
  cleaning_since?: unknown
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json(
      { error: "A table id is required." },
      { status: 400 },
    )
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if (body.blocked !== undefined) {
    if (typeof body.blocked !== "boolean") {
      return NextResponse.json(
        { error: "`blocked` must be a boolean." },
        { status: 400 },
      )
    }
    updates.blocked = body.blocked
  }

  if (body.cleaning_since !== undefined) {
    if (body.cleaning_since !== null && typeof body.cleaning_since !== "string") {
      return NextResponse.json(
        { error: "`cleaning_since` must be an ISO string or null." },
        { status: 400 },
      )
    }
    updates.cleaning_since = body.cleaning_since
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "Provide `blocked` or `cleaning_since` to update." },
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
    .from("tables")
    .update(updates)
    .eq("id", id)
    .select("id, blocked, cleaning_since")
    .single()

  if (error) {
    console.log("[v0] Admin table update error:", error.message)
    // 42703 = undefined_column: a required migration hasn't been applied.
    if (error.code === "42703") {
      const needsCleaning = "cleaning_since" in updates
      return NextResponse.json(
        {
          error: needsCleaning
            ? "Run migration 007_operational_core.sql to enable cleaning turnover."
            : "Run migration 004_floor_plan.sql to enable blocking tables.",
        },
        { status: 503 },
      )
    }
    return NextResponse.json(
      { error: "We couldn't update the table. Please try again." },
      { status: 500 },
    )
  }

  if (!data) {
    return NextResponse.json({ error: "Table not found." }, { status: 404 })
  }

  return NextResponse.json({
    id: data.id,
    blocked: data.blocked,
    cleaning_since: data.cleaning_since ?? null,
  })
}
