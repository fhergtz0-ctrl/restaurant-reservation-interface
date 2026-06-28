import { NextResponse } from "next/server"

import { getSupabaseClient } from "@/lib/supabase"
import type { AdminTable } from "@/lib/admin-data"

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
  const restaurant = searchParams.get("restaurant")

  // Try the full select (with floor-plan columns). If the zone/blocked
  // columns don't exist yet (migration 004 not applied), fall back to the
  // base columns so the page keeps working.
  async function runQuery(columns: string) {
    let query = supabase!
      .from("tables")
      .select(columns)
      .eq("active", true)
      .order("capacity", { ascending: true })
      .order("name", { ascending: true })

    if (restaurant && restaurant.trim().length > 0) {
      query = query.eq("restaurant_name", restaurant)
    }
    return query
  }

  let { data, error } = await runQuery("id, name, capacity, zone, blocked")

  // 42703 = undefined_column. Retry without the optional floor-plan columns.
  if (error && error.code === "42703") {
    ;({ data, error } = await runQuery("id, name, capacity"))
  }

  if (error) {
    console.log("[v0] Admin tables fetch error:", error.message)
    return NextResponse.json(
      { error: "We couldn't load tables. Please try again." },
      { status: 500 },
    )
  }

  const tables: AdminTable[] = ((data ?? []) as unknown as AdminTable[]).map(
    (t) => ({
      id: t.id,
      name: t.name,
      capacity: t.capacity,
      zone: t.zone ?? null,
      blocked: t.blocked ?? false,
    }),
  )
  return NextResponse.json({ tables })
}
