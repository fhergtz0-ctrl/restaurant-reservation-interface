import { NextResponse } from "next/server"

import { getSupabaseClient } from "@/lib/supabase"

type PatchBody = {
  blocked?: unknown
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

  if (typeof body.blocked !== "boolean") {
    return NextResponse.json(
      { error: "A boolean `blocked` value is required." },
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
    .update({ blocked: body.blocked })
    .eq("id", id)
    .select("id, blocked")
    .single()

  if (error) {
    console.log("[v0] Admin table block update error:", error.message)
    // 42703 = undefined_column: the floor-plan migration hasn't been applied.
    if (error.code === "42703") {
      return NextResponse.json(
        {
          error:
            "Run migration 004_floor_plan.sql to enable blocking tables.",
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

  return NextResponse.json({ id: data.id, blocked: data.blocked })
}
