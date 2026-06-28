import { NextResponse, type NextRequest } from "next/server"

import {
  resolveSettingsContext,
  isMissingSchema,
  logAudit,
} from "@/lib/settings/server"
import {
  experienceInputSchema,
  type Experience,
} from "@/lib/settings/lists"

export const dynamic = "force-dynamic"

type Row = {
  id: string
  name: string
  description: string | null
  price_cents: number
  duration_minutes: number
  min_guests: number
  max_guests: number
  active: boolean
  position: number
}

function toExperience(row: Row): Experience {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    priceCents: row.price_cents,
    durationMinutes: row.duration_minutes,
    minGuests: row.min_guests,
    maxGuests: row.max_guests,
    active: row.active,
    position: row.position,
  }
}

function resolveParams(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  return {
    id: sp.get("restaurantId"),
    slug: sp.get("restaurant"),
    name: sp.get("name"),
  }
}

export async function GET(req: NextRequest) {
  const guard = await resolveSettingsContext(resolveParams(req))
  if (!guard.ok) {
    if (guard.status === 503) {
      return NextResponse.json({ data: [], configured: false })
    }
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { data, error } = await guard.ctx.supabase
    .from("experiences")
    .select(
      "id,name,description,price_cents,duration_minutes,min_guests,max_guests,active,position",
    )
    .eq("restaurant_id", guard.ctx.restaurantId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })

  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json({ data: [], configured: true, needsMigration: true })
    }
    console.log("[v0] experiences GET error:", error.message)
    return NextResponse.json({ error: "Could not load experiences." }, { status: 500 })
  }

  return NextResponse.json({
    data: (data as Row[]).map(toExperience),
    configured: true,
  })
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const guard = await resolveSettingsContext({
    id: (body.restaurantId as string) ?? null,
    slug: (body.restaurant as string) ?? null,
    name: (body.name as string) ?? null,
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

  const { data, error } = await guard.ctx.supabase
    .from("experiences")
    .insert({
      restaurant_id: guard.ctx.restaurantId,
      name: parsed.data.name,
      description: parsed.data.description,
      price_cents: parsed.data.priceCents,
      duration_minutes: parsed.data.durationMinutes,
      min_guests: parsed.data.minGuests,
      max_guests: parsed.data.maxGuests,
      active: parsed.data.active,
    })
    .select(
      "id,name,description,price_cents,duration_minutes,min_guests,max_guests,active,position",
    )
    .single()

  if (error) {
    if (isMissingSchema(error)) {
      return NextResponse.json(
        { error: "Run scripts/005_settings_center.sql to enable experiences." },
        { status: 409 },
      )
    }
    console.log("[v0] experiences POST error:", error.message)
    return NextResponse.json({ error: "Could not create experience." }, { status: 500 })
  }

  await logAudit(guard.ctx, {
    action: "experience.create",
    section: "experiences",
    summary: `Created experience “${parsed.data.name}”`,
  })

  return NextResponse.json({ data: toExperience(data as Row) })
}
