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

  let query = supabase
    .from("tables")
    .select("id, name, capacity")
    .eq("active", true)
    .order("capacity", { ascending: true })
    .order("name", { ascending: true })

  if (restaurant && restaurant.trim().length > 0) {
    query = query.eq("restaurant_name", restaurant)
  }

  const { data, error } = await query

  if (error) {
    console.log("[v0] Admin tables fetch error:", error.message)
    return NextResponse.json(
      { error: "We couldn't load tables. Please try again." },
      { status: 500 },
    )
  }

  const tables: AdminTable[] = (data ?? []) as AdminTable[]
  return NextResponse.json({ tables })
}
