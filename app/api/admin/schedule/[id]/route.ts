import { NextResponse } from "next/server"

import {
  resolveSettingsContext,
  isMissingSchema,
} from "@/lib/settings/server"
import {
  validatePeriod,
  findOverlap,
  type ServicePeriod,
} from "@/lib/schedule"

/**
 * Single service-period endpoint (Phase 12A).
 *   PATCH  /api/admin/schedule/:id   body: { restaurant, restaurantId?, period }
 *   DELETE /api/admin/schedule/:id?restaurant=<slug>
 */

const SELECT =
  "id, restaurant_id, day_of_week, name, start_time, end_time, booking_interval_minutes, default_duration_minutes, min_party_size, max_party_size, active"

const MIGRATION_HINT =
  "Schedule storage isn't set up yet. Run scripts/008_schedule.sql, then try again."

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

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
      { error: "Updated fields are required." },
      { status: 400 },
    )
  }

  const guard = await resolveSettingsContext({
    slug: body.restaurant,
    id: body.restaurantId,
    name: body.name,
  })
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  // Load the current row so we can merge partial updates and re-validate.
  const { data: currentRow, error: loadErr } = await guard.ctx.supabase
    .from("restaurant_service_periods")
    .select(SELECT)
    .eq("id", id)
    .eq("restaurant_id", guard.ctx.restaurantId)
    .maybeSingle()

  if (loadErr) {
    if (isMissingSchema(loadErr)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    console.log("[v0] Schedule PATCH load error:", loadErr.message)
    return NextResponse.json(
      { error: "We couldn't update the service period. Please try again." },
      { status: 500 },
    )
  }
  if (!currentRow) {
    return NextResponse.json(
      { error: "Service period not found." },
      { status: 404 },
    )
  }

  const current = rowToPeriod(currentRow as Row)
  const merged = {
    day_of_week:
      p.day_of_week !== undefined ? Number(p.day_of_week) : current.day_of_week,
    name:
      typeof p.name === "string" && p.name.trim()
        ? p.name.trim()
        : current.name,
    start_time:
      p.start_time !== undefined ? String(p.start_time) : current.start_time,
    end_time:
      p.end_time !== undefined ? String(p.end_time) : current.end_time,
    booking_interval_minutes:
      p.booking_interval_minutes !== undefined
        ? Number(p.booking_interval_minutes)
        : current.booking_interval_minutes,
    default_duration_minutes:
      p.default_duration_minutes !== undefined
        ? Number(p.default_duration_minutes)
        : current.default_duration_minutes,
    min_party_size:
      p.min_party_size !== undefined
        ? Number(p.min_party_size)
        : current.min_party_size,
    max_party_size:
      p.max_party_size !== undefined
        ? Number(p.max_party_size)
        : current.max_party_size,
  }

  const valid = validatePeriod(merged)
  if (!valid.ok) {
    return NextResponse.json({ error: valid.error }, { status: 422 })
  }

  // Overlap check against the target day's periods, ignoring this row.
  const { data: siblings, error: sibErr } = await guard.ctx.supabase
    .from("restaurant_service_periods")
    .select(SELECT)
    .eq("restaurant_id", guard.ctx.restaurantId)
    .eq("day_of_week", merged.day_of_week)

  if (sibErr && !isMissingSchema(sibErr)) {
    console.log("[v0] Schedule PATCH overlap error:", sibErr.message)
    return NextResponse.json(
      { error: "We couldn't update the service period. Please try again." },
      { status: 500 },
    )
  }

  const conflict = findOverlap(
    merged,
    ((siblings ?? []) as Row[]).map(rowToPeriod),
    id,
  )
  if (conflict) {
    return NextResponse.json(
      {
        error: `This overlaps with "${conflict.name}" (${conflict.start_time}–${conflict.end_time}) on the same day.`,
      },
      { status: 409 },
    )
  }

  const { data: updated, error: updateErr } = await guard.ctx.supabase
    .from("restaurant_service_periods")
    .update({
      day_of_week: merged.day_of_week,
      name: merged.name,
      start_time: merged.start_time,
      end_time: merged.end_time,
      booking_interval_minutes: merged.booking_interval_minutes,
      default_duration_minutes: merged.default_duration_minutes,
      min_party_size: merged.min_party_size,
      max_party_size: merged.max_party_size,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("restaurant_id", guard.ctx.restaurantId)
    .select(SELECT)
    .single()

  if (updateErr) {
    console.log("[v0] Schedule PATCH update error:", updateErr.message)
    return NextResponse.json(
      { error: "We couldn't update the service period. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({ period: rowToPeriod(updated as Row) })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { searchParams } = new URL(request.url)

  const guard = await resolveSettingsContext({
    slug: searchParams.get("restaurant"),
    id: searchParams.get("restaurantId"),
    name: searchParams.get("name"),
  })
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { error } = await guard.ctx.supabase
    .from("restaurant_service_periods")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", guard.ctx.restaurantId)

  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    console.log("[v0] Schedule DELETE error:", error.message)
    return NextResponse.json(
      { error: "We couldn't delete the service period. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
