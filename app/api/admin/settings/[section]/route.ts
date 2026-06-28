import { NextResponse } from "next/server"

import { KV_SECTIONS, isKvSection } from "@/lib/settings/schemas"
import {
  loadKvSection,
  resolveSettingsContext,
  saveKvSection,
  logAudit,
} from "@/lib/settings/server"

/**
 * Generic per-section settings endpoint.
 *   GET  /api/admin/settings/:section?restaurant=<slug>
 *   PUT  /api/admin/settings/:section   body: { restaurant, restaurantId, data }
 *
 * `:section` must be one of the registered KV sections (profile, contact,
 * branding, reservations, notifications, online_booking, billing).
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ section: string }> },
) {
  const { section } = await params
  if (!isKvSection(section)) {
    return NextResponse.json({ error: "Unknown settings section." }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const guard = await resolveSettingsContext({
    slug: searchParams.get("restaurant"),
    id: searchParams.get("restaurantId"),
    name: searchParams.get("name"),
  })

  // When Supabase isn't configured, still return defaults so the UI renders.
  if (!guard.ok) {
    if (guard.status === 503) {
      return NextResponse.json(
        { data: KV_SECTIONS[section].default, configured: false },
        { status: 200 },
      )
    }
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const result = await loadKvSection(guard.ctx, section)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: result.data, configured: true })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ section: string }> },
) {
  const { section } = await params
  if (!isKvSection(section)) {
    return NextResponse.json({ error: "Unknown settings section." }, { status: 404 })
  }

  let body: {
    restaurant?: string
    restaurantId?: string
    name?: string
    actorEmail?: string
    data?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
  }

  const parsed = KV_SECTIONS[section].schema.safeParse(body.data)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Some fields are invalid.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
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

  const saved = await saveKvSection(
    guard.ctx,
    section,
    parsed.data as never,
  )
  if (!saved.ok) {
    return NextResponse.json({ error: saved.error }, { status: saved.status })
  }

  await logAudit(guard.ctx, {
    actorEmail: body.actorEmail,
    action: "settings.update",
    section,
    summary: `Updated ${section.replace(/_/g, " ")} settings`,
  })

  return NextResponse.json({ data: parsed.data, ok: true })
}
