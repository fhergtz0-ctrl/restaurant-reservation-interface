import { NextResponse, type NextRequest } from "next/server"

import { resolveSettingsContext, isMissingSchema } from "@/lib/settings/server"
import type { AuditEntry } from "@/lib/settings/lists"

export const dynamic = "force-dynamic"

type Row = {
  id: string
  actor_email: string | null
  action: string
  section: string | null
  summary: string | null
  created_at: string
}

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

  const { data, error } = await guard.ctx.supabase
    .from("audit_log")
    .select("id,actor_email,action,section,summary,created_at")
    .eq("restaurant_id", guard.ctx.restaurantId)
    .order("created_at", { ascending: false })
    .limit(100)

  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json({ data: [], configured: true, needsMigration: true })
    }
    console.log("[v0] audit GET error:", error.message)
    return NextResponse.json({ error: "Could not load activity." }, { status: 500 })
  }

  const entries: AuditEntry[] = (data as Row[]).map((r) => ({
    id: r.id,
    actorEmail: r.actor_email,
    action: r.action,
    section: r.section,
    summary: r.summary,
    createdAt: r.created_at,
  }))

  return NextResponse.json({ data: entries, configured: true })
}
