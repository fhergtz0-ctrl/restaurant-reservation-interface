import { NextResponse } from "next/server"

import {
  resolveSettingsContext,
  isMissingSchema,
} from "@/lib/settings/server"
import {
  validatePeriod,
  findOverlap,
  timeToMinutes,
  type ServicePeriod,
} from "@/lib/schedule"

/**
 * Weekly schedule collection endpoint (Phase 12A).
 *   GET  /api/admin/schedule?restaurant=<slug>
 *   POST /api/admin/schedule   body: { restaurant, restaurantId?, name?, period }
 *
 * Restaurant scope is resolved with the same find-or-create helper the
 * Settings routes use, so schedule rows always attach to a valid restaurant.
 */

const MIGRATION_HINT =
  "Schedule storage isn't set up yet. Run scripts/008_schedule.sql, then try again."

/** Normalize a Postgres `time` ("HH:MM:SS") to "HH:MM". */
function normalizeTime(value: unknown): string {
  if (typeof value !== "string") return "00:00"
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!match) return "00:00"
  return `${match[1].padStart(2, "0")}:${match[2]}`
}

type Row = {
  id: string
  restaurant_id: string
  day_of_week: number
  name: string
  start_time: string
  end_time: string
  booking_interval_minutes: number
  default_duration_minutes: number
  min_party_size: number
  max_party_size: number
  active: boolean
}

function rowToPeriod(row: Row): ServicePeriod {
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    day_of_week: row.day_of_week,
    name: row.name,
    start_time: normalizeTime(row.start_time),
    end_time: normalizeTime(row.end_time),
    booking_interval_minutes: row.booking_interval_minutes,
    default_duration_minutes: row.default_duration_minutes,
    min_party_size: row.min_party_size,
    max_party_size: row.max_party_size,
    active: row.active,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const guard = await resolveSettingsContext({
    slug: searchParams.get("restaurant"),
    id: searchParams.get("restaurantId"),
    name: searchParams.get("name"),
  })

  // When Supabase isn't configured, return an empty week so the UI renders.
  if (!guard.ok) {
    if (guard.status === 503) {
      return NextResponse.json({ periods: [], configured: false })
    }
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { data, error } = await guard.ctx.supabase
    .from("restaurant_service_periods")
    .select(
      "id, restaurant_id, day_of_week, name, start_time, end_time, booking_interval_minutes, default_duration_minutes, min_party_size, max_party_size, active",
    )
    .eq("restaurant_id", guard.ctx.restaurantId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true })

  if (error) {
    if (isMissingSchema(error)) {
      // Table not created yet — empty week, flagged so the UI can prompt.
      return NextResponse.json({
        periods: [],
        configured: true,
        needsMigration: true,
      })
    }
    console.log("[v0] Schedule GET error:", error.message)
    return NextResponse.json(
      { error: "We couldn't load the schedule. Please try again." },
      { status: 500 },
    )
  }

  const periods = ((data ?? []) as Row[]).map(rowToPeriod)
  return NextResponse.json({ periods, configured: true })
}

export async function POST(request: Request) {
  let body: {
    restaurant?: string
    restaurantId?: string
    name?: string
    period?: Record<string, unknown>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const p = body.period
  if (!p || typeof p !== "object") {
    return NextResponse.json(
      { error: "A service period is required." },
      { status: 400 },
    )
  }

  const candidate = {
    day_of_week: Number(p.day_of_week),
    name: typeof p.name === "string" && p.name.trim() ? p.name.trim() : "Service",
    start_time: String(p.start_time ?? ""),
    end_time: String(p.end_time ?? ""),
    booking_interval_minutes: Number(p.booking_interval_minutes),
    default_duration_minutes: Number(p.default_duration_minutes),
    min_party_size: Number(p.min_party_size),
    max_party_size: Number(p.max_party_size),
  }

  const valid = validatePeriod(candidate)
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 422 })
  }

  const guard = await resolveSettingsContext({
    slug: body.restaurant,
    id: body.restaurantId,
    name: body.name,
  })
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  // Overlap check against the day's existing active periods.
  const { data: existing, error: loadErr } = await guard.ctx.supabase
    .from("restaurant_service_periods")
    .select(
      "id, restaurant_id, day_of_week, name, start_time, end_time, booking_interval_minutes, default_duration_minutes, min_party_size, max_party_size, active",
    )
    .eq("restaurant_id", guard.ctx.restaurantId)
    .eq("day_of_week", candidate.day_of_week)

  if (loadErr) {
    if (isMissingSchema(loadErr)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    console.log("[v0] Schedule overlap-load error:", loadErr.message)
    return NextResponse.json(
      { error: "We couldn't save the service period. Please try again." },
      { status: 500 },
    )
  }

  const conflict = findOverlap(
    candidate,
    ((existing ?? []) as Row[]).map(rowToPeriod),
  )
  if (conflict) {
    return NextResponse.json(
      {
        error: `This overlaps with "${conflict.name}" (${conflict.start_time}–${conflict.end_time}) on the same day.`,
      },
      { status: 409 },
    )
  }

  const { data: created, error: insertErr } = await guard.ctx.supabase
    .from("restaurant_service_periods")
    .insert({
      restaurant_id: guard.ctx.restaurantId,
      day_of_week: candidate.day_of_week,
      name: candidate.name,
      start_time: candidate.start_time,
      end_time: candidate.end_time,
      booking_interval_minutes: candidate.booking_interval_minutes,
      default_duration_minutes: candidate.default_duration_minutes,
      min_party_size: candidate.min_party_size,
      max_party_size: candidate.max_party_size,
      active: true,
    })
    .select(
      "id, restaurant_id, day_of_week, name, start_time, end_time, booking_interval_minutes, default_duration_minutes, min_party_size, max_party_size, active",
    )
    .single()

  if (insertErr) {
    if (isMissingSchema(insertErr)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    console.log("[v0] Schedule POST error:", insertErr.message)
    return NextResponse.json(
      { error: "We couldn't save the service period. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({ period: rowToPeriod(created as Row) }, { status: 201 })
}
