import { NextResponse } from "next/server"

import { resolveSettingsContext, isMissingSchema } from "@/lib/settings/server"

/**
 * Zone reorder endpoint (Phase 12B).
 *   POST /api/admin/zones/reorder
 *     body: { restaurant, restaurantId?, order: string[] }  // ordered zone ids
 *
 * Writes a sequential display_order (0..n-1) matching the given id order.
 * Only rows belonging to the resolved restaurant are touched.
 */

const MIGRATION_HINT =
  "Zone storage isn't set up yet. Run scripts/009_spaces_zones.sql, then try again."

export async function POST(request: Request) {
  let body: {
    restaurant?: string
    restaurantId?: string
    name?: string
    order?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  if (!Array.isArray(body.order) || body.order.some((v) => typeof v !== "string")) {
    return NextResponse.json(
      { error: "`order` must be an array of zone ids." },
      { status: 400 },
    )
  }
  const order = body.order as string[]

  const guard = await resolveSettingsContext({
    slug: body.restaurant,
    id: body.restaurantId,
    name: body.name,
  })
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  // Apply sequential order. Each update is scoped by restaurant_id so a
  // client can't reorder another restaurant's zones.
  for (let i = 0; i < order.length; i += 1) {
    const { error } = await guard.ctx.supabase
      .from("restaurant_zones")
      .update({ display_order: i, updated_at: new Date().toISOString() })
      .eq("id", order[i])
      .eq("restaurant_id", guard.ctx.restaurantId)

    if (error) {
      if (isMissingSchema(error)) {
        return NextResponse.json({ error: MIGRATION_HINT }, { status: 409 })
      }
      console.log("[v0] Zone reorder error:", error.message)
      return NextResponse.json(
        { error: "We couldn't reorder the zones. Please try again." },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ ok: true })
}
