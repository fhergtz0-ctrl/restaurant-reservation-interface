import { NextResponse } from "next/server"

import {
  resolveSettingsContext,
  isMissingSchema,
} from "@/lib/settings/server"
import {
  validateSpecialDay,
  validatePeriodSet,
  isValidType,
  normalizeDate,
  type SpecialDay,
  type SpecialDayPeriod,
  type SpecialDayType,
} from "@/lib/special-days"

/**
 * Special Days collection endpoint (Phase 12C).
 *   GET  /api/admin/special-days?restaurant=<slug>[&restaurantId=<uuid>]
 *   POST /api/admin/special-days
 *        body: { restaurant, restaurantId?, name?, day: { special_date, name,
 *                type, is_open, description?, internal_notes?, periods[] } }
 *
 * Child service periods are managed inside the Special Day payload (option A):
 * the client sends the full periods array and the server replaces the set.
 * Restaurant scope is resolved with the same find-or-create helper the
 * Settings/Schedule routes use.
 */

const MIGRATION_HINT =
  "Special Days storage isn't set up yet. Run scripts/010_special_days.sql, then try again."

const DAY_SELECT =
  "id, restaurant_id, special_date, name, type, is_open, description, internal_notes"

const PERIOD_SELECT =
  "id, special_day_id, name, start_time, end_time, booking_interval_minutes, default_duration_minutes, min_party_size, max_party_size, display_order"

function normalizeTime(value: unknown): string {
  if (typeof value !== "string") return "00:00"
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!match) return "00:00"
  return `${match[1].padStart(2, "0")}:${match[2]}`
}

type DayRow = {
  id: string
  restaurant_id: string
  special_date: string
  name: string
  type: string
  is_open: boolean
  description: string | null
  internal_notes: string | null
}

type PeriodRow = {
  id: string
  special_day_id: string
  name: string
  start_time: string
  end_time: string
  booking_interval_minutes: number
  default_duration_minutes: number
  min_party_size: number
  max_party_size: number
  display_order: number
}

function periodRowTo(row: PeriodRow): SpecialDayPeriod {
  return {
    id: row.id,
    special_day_id: row.special_day_id,
    name: row.name,
    start_time: normalizeTime(row.start_time),
    end_time: normalizeTime(row.end_time),
    booking_interval_minutes: row.booking_interval_minutes,
    default_duration_minutes: row.default_duration_minutes,
    min_party_size: row.min_party_size,
    max_party_size: row.max_party_size,
    display_order: row.display_order,
  }
}

function dayRowTo(row: DayRow, periods: SpecialDayPeriod[]): SpecialDay {
  return {
    id: row.id,
    restaurant_id: row.restaurant_id,
    special_date: normalizeDate(row.special_date),
    name: row.name,
    type: (isValidType(row.type) ? row.type : "other") as SpecialDayType,
    is_open: row.is_open,
    description: row.description,
    internal_notes: row.internal_notes,
    periods: periods
      .filter((p) => p.special_day_id === row.id)
      .sort(
        (a, b) =>
          a.display_order - b.display_order ||
          a.start_time.localeCompare(b.start_time),
      ),
  }
}

/** Coerce a raw client period into the normalized shape used for validation. */
function coercePeriod(p: Record<string, unknown>, order: number) {
  return {
    name:
      typeof p.name === "string" && p.name.trim() ? p.name.trim() : "Service",
    start_time: normalizeTime(p.start_time),
    end_time: normalizeTime(p.end_time),
    booking_interval_minutes: Number(p.booking_interval_minutes),
    default_duration_minutes: Number(p.default_duration_minutes),
    min_party_size: Number(p.min_party_size),
    max_party_size: Number(p.max_party_size),
    display_order: order,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const guard = await resolveSettingsContext({
    slug: searchParams.get("restaurant"),
    id: searchParams.get("restaurantId"),
    name: searchParams.get("name"),
  })

  if (!guard.ok) {
    if (guard.status === 503) {
      return NextResponse.json({ days: [], configured: false })
    }
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { data: dayData, error: dayErr } = await guard.ctx.supabase
    .from("restaurant_special_days")
    .select(DAY_SELECT)
    .eq("restaurant_id", guard.ctx.restaurantId)
    .order("special_date", { ascending: true })

  if (dayErr) {
    if (isMissingSchema(dayErr)) {
      return NextResponse.json({
        days: [],
        configured: true,
        needsMigration: true,
      })
    }
    console.log("[v0] Special Days GET error:", dayErr.message)
    return NextResponse.json(
      { error: "We couldn't load special days. Please try again." },
      { status: 500 },
    )
  }

  const dayRows = (dayData ?? []) as DayRow[]
  const dayIds = dayRows.map((d) => d.id)

  let periods: SpecialDayPeriod[] = []
  if (dayIds.length > 0) {
    const { data: periodData, error: periodErr } = await guard.ctx.supabase
      .from("restaurant_special_day_periods")
      .select(PERIOD_SELECT)
      .in("special_day_id", dayIds)
      .order("display_order", { ascending: true })

    if (periodErr && !isMissingSchema(periodErr)) {
      console.log("[v0] Special Days periods GET error:", periodErr.message)
      return NextResponse.json(
        { error: "We couldn't load special days. Please try again." },
        { status: 500 },
      )
    }
    periods = ((periodData ?? []) as PeriodRow[]).map(periodRowTo)
  }

  const days = dayRows.map((row) => dayRowTo(row, periods))
  return NextResponse.json({ days, configured: true })
}

export async function POST(request: Request) {
  let body: {
    restaurant?: string
    restaurantId?: string
    name?: string
    day?: Record<string, unknown>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const day = body.day
  if (!day || typeof day !== "object") {
    return NextResponse.json(
      { error: "Special day details are required." },
      { status: 400 },
    )
  }

  const topValid = validateSpecialDay({
    special_date: day.special_date,
    name: day.name,
    type: day.type,
  })
  if (!topValid.ok) {
    return NextResponse.json({ error: topValid.error }, { status: 422 })
  }

  const isOpen = Boolean(day.is_open)
  const rawPeriods = Array.isArray(day.periods)
    ? (day.periods as Record<string, unknown>[])
    : []
  const periods = isOpen
    ? rawPeriods.map((p, i) => coercePeriod(p, i))
    : []

  if (isOpen && periods.length > 0) {
    const setValid = validatePeriodSet(periods)
    if (!setValid.ok) {
      return NextResponse.json({ error: setValid.error }, { status: 422 })
    }
  }

  const guard = await resolveSettingsContext({
    slug: body.restaurant,
    id: body.restaurantId,
    name: body.name,
  })
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { data: created, error: insertErr } = await guard.ctx.supabase
    .from("restaurant_special_days")
    .insert({
      restaurant_id: guard.ctx.restaurantId,
      special_date: normalizeDate(day.special_date),
      name: String(day.name).trim(),
      type: day.type,
      is_open: isOpen,
      description:
        typeof day.description === "string" && day.description.trim()
          ? day.description.trim()
          : null,
      internal_notes:
        typeof day.internal_notes === "string" && day.internal_notes.trim()
          ? day.internal_notes.trim()
          : null,
    })
    .select(DAY_SELECT)
    .single()

  if (insertErr) {
    if (isMissingSchema(insertErr)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    // 23505 = unique_violation: a special day already exists for this date.
    if (insertErr.code === "23505") {
      return NextResponse.json(
        { error: "A special day already exists for that date." },
        { status: 409 },
      )
    }
    console.log("[v0] Special Days POST error:", insertErr.message)
    return NextResponse.json(
      { error: "We couldn't save the special day. Please try again." },
      { status: 500 },
    )
  }

  const dayRow = created as DayRow

  if (periods.length > 0) {
    const { error: periodErr } = await guard.ctx.supabase
      .from("restaurant_special_day_periods")
      .insert(
        periods.map((p) => ({
          special_day_id: dayRow.id,
          name: p.name,
          start_time: p.start_time,
          end_time: p.end_time,
          booking_interval_minutes: p.booking_interval_minutes,
          default_duration_minutes: p.default_duration_minutes,
          min_party_size: p.min_party_size,
          max_party_size: p.max_party_size,
          display_order: p.display_order,
        })),
      )
    if (periodErr) {
      // Roll back the parent so we never persist an open day with no hours.
      await guard.ctx.supabase
        .from("restaurant_special_days")
        .delete()
        .eq("id", dayRow.id)
      console.log("[v0] Special Days POST periods error:", periodErr.message)
      return NextResponse.json(
        { error: "We couldn't save the service periods. Please try again." },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ id: dayRow.id }, { status: 201 })
}
