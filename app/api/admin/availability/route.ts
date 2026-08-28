import { NextResponse } from "next/server"

import { loadAvailability } from "@/lib/availability-data"
import { isValidDate } from "@/lib/special-days"

/**
 * Availability Engine endpoint (Phase 12E) — internal admin use only.
 *
 *   GET /api/admin/availability
 *     ?restaurant=<slug>      (or &restaurantId=<uuid> / &name=<name>)
 *     &date=YYYY-MM-DD
 *     &partySize=<int>
 *     &time=HH:MM             (optional; also accepts "7:00 PM")
 *
 * Availability is computed dynamically from the live Schedule, Special Days,
 * Zones, Tables, Table Combinations, and Reservations. Nothing is persisted.
 * No Supabase credentials or configuration are ever exposed in the response.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const date = searchParams.get("date")?.trim() ?? ""
  const partySizeRaw = searchParams.get("partySize")?.trim() ?? ""
  const time = searchParams.get("time")?.trim() || null

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
      { error: "Party size must be a whole number of 1 or more." },
      { status: 400 },
    )
  }

  try {
    const load = await loadAvailability({
      slug: searchParams.get("restaurant"),
      restaurantId: searchParams.get("restaurantId"),
      name: searchParams.get("name"),
      date,
      partySize,
      requestedTime: time,
    })

    if (!load.ok) {
      // 503 = Supabase not configured: return a structurally-complete, empty
      // result so the internal tester still renders instead of erroring.
      if (load.status === 503) {
        return NextResponse.json({
          configured: false,
          result: {
            date,
            partySize,
            requestedTime: time,
            source: "none",
            open: false,
            reason: "restaurant_closed",
            specialDay: null,
            servicePeriods: [],
          },
        })
      }
      return NextResponse.json({ error: load.error }, { status: load.status })
    }

    return NextResponse.json({ configured: true, result: load.result })
  } catch (err) {
    console.log(
      "[v0] Availability GET error:",
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json(
      { error: "We couldn't compute availability. Please try again." },
      { status: 500 },
    )
  }
}
