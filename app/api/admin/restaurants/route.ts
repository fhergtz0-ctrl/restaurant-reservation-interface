import { NextResponse } from "next/server"

import { getActiveRestaurants } from "@/lib/restaurants"

export const dynamic = "force-dynamic"

export async function GET() {
  // Always returns at least the default restaurant (graceful fallback when
  // Supabase isn't configured), so the admin selector is never empty.
  const restaurants = await getActiveRestaurants()
  return NextResponse.json({ restaurants })
}
