import { NextResponse } from "next/server"

import { loadAvailability } from "@/lib/availability-data"
import { getRestaurantBySlug } from "@/lib/restaurants"
import { isValidDate } from "@/lib/special-days"
import {
  toPublicAvailability,
  unavailableResponse,
} from "@/lib/public-availability"

/**
 * Public booking availability (Phase 13A) — guest-facing.
 *
 *   GET /api/book/availability?restaurant=<slug>&date=YYYY-MM-DD&partySize=<int>&time=HH:MM
 *
 * This is a THIN proxy over the SAME server-side Availability Engine the admin
 * tester uses (lib/availability-data.loadAvailability → the pure engine). It
 * does NOT recompute availability; it maps the internal result to a lean,
 * guest-safe response (see lib/public-availability.ts) that never exposes
 * tables, zones, reservation diagnostics, internal ids, or reason codes.
 */
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const slug = searchParams.get("restaurant")?.trim() ?? ""
  const date = searchParams.get("date")?.trim() ?? ""
  const partySizeRaw = searchParams.get("partySize")?.trim() ?? ""
  const time = searchParams.get("time")?.trim() || null

  if (!slug) {
    return NextResponse.json(
      { error: "A restaurant is required." },
      { status: 400 },
    )
  }
  if (!isValidDate(date)) {
    return NextResponse.json(
      { error: "A valid date (YYYY-MM-DD) is required." },
      { status: 400 },
    )
  }

  const partySize = Number(partySizeRaw)
  if (
    !Number.isFinite(partySize) ||
    !Number.isInteger(partySize) ||
    partySize < 1 ||
    partySize > 1000
  ) {
    return NextResponse.json(
      { error: "Please choose a valid party size." },
      { status: 400 },
    )
  }

  // Resolve the restaurant for its public identity (name/slug). An unknown
  // slug is a 404 so the page can render notFound()-style copy.
  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant) {
    return NextResponse.json(
      { error: "Restaurant not found." },
      { status: 404 },
    )
  }
  const publicRestaurant = { name: restaurant.name, slug: restaurant.slug }

  try {
    const load = await loadAvailability({
      slug: restaurant.slug,
      restaurantId: restaurant.id,
      name: restaurant.name,
      date,
      partySize,
      requestedTime: time,
    })

    // Engine/loader could not answer (Supabase absent, or the frozen shared
    // restaurant-context path failed). Return guest-safe copy — NEVER the
    // internal error string like "Could not create the restaurant."
    if (!load.ok) {
      return NextResponse.json(
        unavailableResponse(publicRestaurant, date, partySize),
      )
    }

    return NextResponse.json(
      toPublicAvailability(load.result, publicRestaurant),
    )
  } catch (err) {
    console.log(
      "[v0] Public availability error:",
      err instanceof Error ? err.message : err,
    )
    // Any unexpected failure also degrades to the generic guest-safe payload.
    return NextResponse.json(
      unavailableResponse(publicRestaurant, date, partySize),
    )
  }
}
