import { NextResponse, type NextRequest } from "next/server"

import {
  resolveSettingsContext,
  isMissingSchema,
  logAudit,
} from "@/lib/settings/server"
import {
  integrationUpdateSchema,
  type IntegrationState,
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

  const { data, error } = await guard.ctx.supabase
    .from("integrations")
    .select("provider,enabled,config")
    .eq("restaurant_id", guard.ctx.restaurantId)

  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json({ data: [], configured: true, needsMigration: true })
    }
    console.log("[v0] integrations GET error:", error.message)
    return NextResponse.json({ error: "Could not load integrations." }, { status: 500 })
  }

  const states: IntegrationState[] = (data as IntegrationState[]).map((s) => ({
    provider: s.provider,
    enabled: s.enabled,
    config: s.config ?? {},
  }))
  return NextResponse.json({ data: states, configured: true })
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const guard = await resolveSettingsContext({
    id: (body.restaurantId as string) ?? null,
    slug: (body.restaurant as string) ?? null,
  })
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const parsed = integrationUpdateSchema.safeParse(body.data)
  if (!parsed.success) {
    return NextResponse.json(
      { fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const { error } = await guard.ctx.supabase
    .from("integrations")
    .upsert(
      {
        restaurant_id: guard.ctx.restaurantId,
        provider: parsed.data.provider,
        enabled: parsed.data.enabled,
        config: parsed.data.config,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "restaurant_id,provider" },
    )

  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json(
        { error: "Run scripts/005_settings_center.sql to enable integrations." },
        { status: 409 },
      )
    }
    console.log("[v0] integrations PUT error:", error.message)
    return NextResponse.json({ error: "Could not update integration." }, { status: 500 })
  }

  await logAudit(guard.ctx, {
    action: parsed.data.enabled ? "integration.enable" : "integration.disable",
    section: "integrations",
    summary: `${parsed.data.enabled ? "Enabled" : "Disabled"} ${parsed.data.provider}`,
  })

  return NextResponse.json({ ok: true })
}
