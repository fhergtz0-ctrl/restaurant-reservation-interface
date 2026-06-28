import { NextResponse, type NextRequest } from "next/server"

import {
  resolveSettingsContext,
  isMissingSchema,
  logAudit,
} from "@/lib/settings/server"
import { experienceInputSchema } from "@/lib/settings/lists"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const guard = await resolveSettingsContext({
    id: (body.restaurantId as string) ?? null,
    slug: (body.restaurant as string) ?? null,
  })
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const parsed = experienceInputSchema.safeParse(body.data)
  if (!parsed.success) {
    return NextResponse.json(
      { fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { error } = await guard.ctx.supabase
    .from("experiences")
    .update({
      name: parsed.data.name,
      description: parsed.data.description,
      price_cents: parsed.data.priceCents,
      duration_minutes: parsed.data.durationMinutes,
      min_guests: parsed.data.minGuests,
      max_guests: parsed.data.maxGuests,
      active: parsed.data.active,
    })
    .eq("id", id)
    .eq("restaurant_id", guard.ctx.restaurantId)

  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json(
        { error: "Run scripts/005_settings_center.sql to enable experiences." },
        { status: 409 },
      )
    }
    console.log("[v0] experiences PATCH error:", error.message)
    return NextResponse.json({ error: "Could not update experience." }, { status: 500 })
  }

  await logAudit(guard.ctx, {
    action: "experience.update",
    section: "experiences",
    summary: `Updated experience “${parsed.data.name}”`,
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const guard = await resolveSettingsContext({
    id: req.nextUrl.searchParams.get("restaurantId"),
    slug: req.nextUrl.searchParams.get("restaurant"),
  })
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { error } = await guard.ctx.supabase
    .from("experiences")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", guard.ctx.restaurantId)

  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json(
        { error: "Run scripts/005_settings_center.sql to enable experiences." },
        { status: 409 },
      )
    }
    console.log("[v0] experiences DELETE error:", error.message)
    return NextResponse.json({ error: "Could not delete experience." }, { status: 500 })
  }

  await logAudit(guard.ctx, {
    action: "experience.delete",
    section: "experiences",
    summary: "Deleted an experience",
  })

  return NextResponse.json({ ok: true })
}
