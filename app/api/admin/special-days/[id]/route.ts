import { NextResponse } from "next/server"

import {
  resolveSettingsContext,
  isMissingSchema,
} from "@/lib/settings/server"
import {
  validateSpecialDay,
  validatePeriodSet,
  normalizeDate,
} from "@/lib/special-days"

/**
 * Single Special Day endpoint (Phase 12C).
 *   PATCH  /api/admin/special-days/:id
 *          body: { restaurant, restaurantId?, name?, day: {...full definition} }
 *   DELETE /api/admin/special-days/:id?restaurant=<slug>[&restaurantId=<uuid>]
 *
 * PATCH replaces the whole definition, including the child service-period set
 * (delete-all + re-insert). Child periods cascade-delete with the parent.
 */

const DAY_SELECT =
  "id, restaurant_id, special_date, name, type, is_open, description, internal_notes"

const MIGRATION_HINT =
  "Special Days storage isn't set up yet. Run scripts/010_special_days.sql, then try again."

function normalizeTime(value: unknown): string {
  if (typeof value !== "string") return "00:00"
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!match) return "00:00"
  return `${match[1].padStart(2, "0")}:${match[2]}`
}

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

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
      { error: "Updated fields are required." },
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
  const periods = isOpen ? rawPeriods.map((p, i) => coercePeriod(p, i)) : []

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

  // Confirm the row belongs to this restaurant before mutating.
  const { data: currentRow, error: loadErr } = await guard.ctx.supabase
    .from("restaurant_special_days")
    .select("id")
    .eq("id", id)
    .eq("restaurant_id", guard.ctx.restaurantId)
    .maybeSingle()

  if (loadErr) {
    if (isMissingSchema(loadErr)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    console.log("[v0] Special Days PATCH load error:", loadErr.message)
    return NextResponse.json(
      { error: "We couldn't update the special day. Please try again." },
      { status: 500 },
    )
  }
  if (!currentRow) {
    return NextResponse.json(
      { error: "Special day not found." },
      { status: 404 },
    )
  }

  const { error: updateErr } = await guard.ctx.supabase
    .from("restaurant_special_days")
    .update({
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("restaurant_id", guard.ctx.restaurantId)

  if (updateErr) {
    // 23505 = unique_violation: another special day already uses this date.
    if (updateErr.code === "23505") {
      return NextResponse.json(
        { error: "A special day already exists for that date." },
        { status: 409 },
      )
    }
    console.log("[v0] Special Days PATCH update error:", updateErr.message)
    return NextResponse.json(
      { error: "We couldn't update the special day. Please try again." },
      { status: 500 },
    )
  }

  // Replace the child period set: delete all, then re-insert the current set.
  const { error: delErr } = await guard.ctx.supabase
    .from("restaurant_special_day_periods")
    .delete()
    .eq("special_day_id", id)

  if (delErr && !isMissingSchema(delErr)) {
    console.log("[v0] Special Days PATCH period-clear error:", delErr.message)
    return NextResponse.json(
      { error: "We couldn't update the service periods. Please try again." },
      { status: 500 },
    )
  }

  if (periods.length > 0) {
    const { error: insErr } = await guard.ctx.supabase
      .from("restaurant_special_day_periods")
      .insert(
        periods.map((p) => ({
          special_day_id: id,
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
    if (insErr) {
      console.log("[v0] Special Days PATCH period-insert error:", insErr.message)
      return NextResponse.json(
        { error: "We couldn't update the service periods. Please try again." },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ ok: true })
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

  // Child periods cascade-delete via the FK (migration 010).
  const { error } = await guard.ctx.supabase
    .from("restaurant_special_days")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", guard.ctx.restaurantId)

  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
    }
    console.log("[v0] Special Days DELETE error:", error.message)
    return NextResponse.json(
      { error: "We couldn't delete the special day. Please try again." },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
