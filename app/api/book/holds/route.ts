import { NextResponse } from "next/server"

import { loadAvailability } from "@/lib/availability-data"
import { getRestaurantBySlug } from "@/lib/restaurants"
import { isValidDate } from "@/lib/special-days"
import { parseClockToMinutes } from "@/lib/availability-engine"
import { DEFAULT_STAY_MINUTES } from "@/lib/operations"
import { commitHold } from "@/lib/booking-holds-server"

/**
 * Public slot-hold creation (Phase 13B) — guest-facing.
 *
 *   POST /api/book/holds
 *   body: { restaurant: slug, date: "YYYY-MM-DD", partySize, time: "HH:MM",
 *           service?: string }
 *
 * The guest sends only booking INTENT. The server re-runs the SAME Availability
 * Engine (never trusting the client), locates the requested slot, chooses the
 * allocation itself, and commits an atomic hold via the create_booking_hold RPC.
 * The response exposes ONLY guest-safe fields — never table ids/names, the
 * combination id, allocation type, zones, or any internal diagnostics.
 *
 * Concurrency: if availability existed when the engine ran but another guest
 * claimed it before the RPC committed, the RPC rejects and we return 409 with a
 * friendly message — we never silently pick a different table or time.
 */
export const dynamic = "force-dynamic"

const CONFLICT_MESSAGE =
  "That time was just taken. Please choose another time."
const UNAVAILABLE_MESSAGE =
  "We couldn't hold that time right now. Please try again."

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 })
  }

  const slug = typeof body.restaurant === "string" ? body.restaurant.trim() : ""
  const date = typeof body.date === "string" ? body.date.trim() : ""
  const time = typeof body.time === "string" ? body.time.trim() : ""
  const service =
    typeof body.service === "string" && body.service.trim()
      ? body.service.trim()
      : null
  const partySize = Number(body.partySize)

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
  const requestedMinutes = parseClockToMinutes(time)
  if (requestedMinutes === null) {
    return NextResponse.json(
      { error: "A valid time is required." },
      { status: 400 },
    )
  }

  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant || !restaurant.id) {
    // No persisted restaurant row -> nothing to hold against. Guest-safe.
    return NextResponse.json(
      { status: "unavailable", message: UNAVAILABLE_MESSAGE },
      { status: 200 },
    )
  }

  try {
    // Re-run the engine server-side. requestedTime narrows nothing structurally
    // but keeps parity with the search; we locate the slot by its 24h value.
    const load = await loadAvailability({
      slug: restaurant.slug,
      restaurantId: restaurant.id,
      name: restaurant.name,
      date,
      partySize,
      requestedTime: time,
    })

    if (!load.ok) {
      // Frozen restaurant-context path failed, or Supabase absent. Guest-safe.
      return NextResponse.json(
        { status: "unavailable", message: UNAVAILABLE_MESSAGE },
        { status: 200 },
      )
    }

    // Find the requested slot across eligible periods (compare on 24h time).
    let chosen:
      | {
          slotTime: string
          durationMinutes: number
          serviceName: string
          option: {
            type: "table" | "combination"
            id?: string
            tableIds: string[]
          }
        }
      | null = null

    for (const period of load.result.servicePeriods) {
      if (!period.eligible) continue
      for (const slot of period.slots) {
        if (slot.time24 !== time) continue
        if (!slot.available || slot.options.length === 0) continue
        chosen = {
          slotTime: slot.time,
          durationMinutes:
            period.defaultDurationMinutes > 0
              ? period.defaultDurationMinutes
              : DEFAULT_STAY_MINUTES,
          serviceName: period.name,
          option: {
            type: slot.options[0].type,
            id: slot.options[0].id,
            tableIds: slot.options[0].tableIds,
          },
        }
        break
      }
      if (chosen) break
    }

    // No bookable slot at that time anymore -> treat as a conflict (it may have
    // just been taken). Never fall back to another time.
    if (!chosen) {
      return NextResponse.json(
        { status: "conflict", message: CONFLICT_MESSAGE },
        { status: 409 },
      )
    }

    const result = await commitHold({
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      bookingDate: date,
      bookingTime: chosen.slotTime,
      startMinutes: requestedMinutes,
      durationMinutes: chosen.durationMinutes,
      partySize,
      serviceName: chosen.serviceName,
      allocationType: chosen.option.type,
      combinationId:
        chosen.option.type === "combination"
          ? chosen.option.id ?? null
          : null,
      tableIds: chosen.option.tableIds,
    })

    if (result.status === "conflict") {
      return NextResponse.json(
        { status: "conflict", message: CONFLICT_MESSAGE },
        { status: 409 },
      )
    }
    if (result.status === "unavailable") {
      return NextResponse.json(
        { status: "unavailable", message: UNAVAILABLE_MESSAGE },
        { status: 200 },
      )
    }

    return NextResponse.json(
      {
        holdId: result.holdId,
        expiresAt: result.expiresAt,
        booking: {
          restaurant: restaurant.name,
          slug: restaurant.slug,
          date,
          partySize,
          time: chosen.slotTime,
          service: service ?? chosen.serviceName,
        },
      },
      { status: 201 },
    )
  } catch (err) {
    console.log(
      "[v0] Create hold error:",
      err instanceof Error ? err.message : err,
    )
    return NextResponse.json(
      { status: "unavailable", message: UNAVAILABLE_MESSAGE },
      { status: 200 },
    )
  }
}
