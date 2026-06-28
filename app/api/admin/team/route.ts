import { NextResponse, type NextRequest } from "next/server"

import {
  resolveSettingsContext,
  isMissingSchema,
  logAudit,
} from "@/lib/settings/server"
import {
  inviteInputSchema,
  type TeamMember,
  type TeamRole,
} from "@/lib/settings/lists"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const guard = await resolveSettingsContext({
    id: req.nextUrl.searchParams.get("restaurantId"),
    slug: req.nextUrl.searchParams.get("restaurant"),
  })
  if (!guard.ok) {
    if (guard.status === 503) {
      return NextResponse.json({ data: [], configured: false })
    }
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const members: TeamMember[] = []

  // Active members live in `profiles`.
  const { data: profiles, error: profilesError } = await guard.ctx.supabase
    .from("profiles")
    .select("id,name,email,role")
    .eq("restaurant_id", guard.ctx.restaurantId)

  if (profilesError && !isMissingSchema(profilesError)) {
    console.log("[v0] team profiles error:", profilesError.message)
  } else if (profiles) {
    for (const p of profiles as {
      id: string
      name: string | null
      email: string | null
      role: string
    }[]) {
      members.push({
        id: p.id,
        email: p.email ?? "",
        name: p.name,
        role: (p.role as TeamRole) ?? "Host",
        status: "active",
      })
    }
  }

  // Pending invitations.
  let needsMigration = false
  const { data: invites, error: invitesError } = await guard.ctx.supabase
    .from("invitations")
    .select("id,email,role,status")
    .eq("restaurant_id", guard.ctx.restaurantId)
    .order("created_at", { ascending: true })

  if (invitesError) {
    if (isMissingSchema(invitesError)) {
      needsMigration = true
    } else {
      console.log("[v0] team invites error:", invitesError.message)
    }
  } else if (invites) {
    for (const i of invites as {
      id: string
      email: string
      role: string
      status: string
    }[]) {
      members.push({
        id: i.id,
        email: i.email,
        name: null,
        role: (i.role as TeamRole) ?? "Host",
        status: "pending",
      })
    }
  }

  return NextResponse.json({ data: members, configured: true, needsMigration })
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const guard = await resolveSettingsContext({
    id: (body.restaurantId as string) ?? null,
    slug: (body.restaurant as string) ?? null,
  })
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const parsed = inviteInputSchema.safeParse(body.data)
  if (!parsed.success) {
    return NextResponse.json(
      { fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { data, error } = await guard.ctx.supabase
    .from("invitations")
    .upsert(
      {
        restaurant_id: guard.ctx.restaurantId,
        email: parsed.data.email,
        role: parsed.data.role,
        status: "pending",
      },
      { onConflict: "restaurant_id,email" },
    )
    .select("id,email,role,status")
    .single()

  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json(
        { error: "Run scripts/005_settings_center.sql to enable invitations." },
        { status: 409 },
      )
    }
    console.log("[v0] team POST error:", error.message)
    return NextResponse.json({ error: "Could not send invitation." }, { status: 500 })
  }

  await logAudit(guard.ctx, {
    action: "team.invite",
    section: "team",
    summary: `Invited ${parsed.data.email} as ${parsed.data.role}`,
  })

  const member: TeamMember = {
    id: (data as { id: string }).id,
    email: parsed.data.email,
    name: null,
    role: parsed.data.role,
    status: "pending",
  }
  return NextResponse.json({ data: member })
}
