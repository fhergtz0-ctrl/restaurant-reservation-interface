import { NextResponse, type NextRequest } from "next/server"

import { z } from "zod"

import {
  resolveSettingsContext,
  isMissingSchema,
  logAudit,
} from "@/lib/settings/server"
import { TEAM_ROLES } from "@/lib/settings/lists"

export const dynamic = "force-dynamic"

const patchSchema = z.object({ role: z.enum(TEAM_ROLES) })

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

  const parsed = patchSchema.safeParse(body.data)
  if (!parsed.success) {
    return NextResponse.json(
      { fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  // Only pending invitations are editable here; active members are managed
  // through their own profile. Try invitations first.
  const { error } = await guard.ctx.supabase
    .from("invitations")
    .update({ role: parsed.data.role })
    .eq("id", id)
    .eq("restaurant_id", guard.ctx.restaurantId)

  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json(
        { error: "Run scripts/005_settings_center.sql to enable invitations." },
        { status: 409 },
      )
    }
    console.log("[v0] team PATCH error:", error.message)
    return NextResponse.json({ error: "Could not update role." }, { status: 500 })
  }

  await logAudit(guard.ctx, {
    action: "team.role_change",
    section: "team",
    summary: `Changed an invitation role to ${parsed.data.role}`,
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
    .from("invitations")
    .delete()
    .eq("id", id)
    .eq("restaurant_id", guard.ctx.restaurantId)

  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json(
        { error: "Run scripts/005_settings_center.sql to enable invitations." },
        { status: 409 },
      )
    }
    console.log("[v0] team DELETE error:", error.message)
    return NextResponse.json({ error: "Could not revoke invitation." }, { status: 500 })
  }

  await logAudit(guard.ctx, {
    action: "team.revoke",
    section: "team",
    summary: "Revoked a pending invitation",
  })

  return NextResponse.json({ ok: true })
}
