import { NextResponse } from "next/server"

import { getHold, cancelHold } from "@/lib/booking-holds-server"

/**
 * Public single-hold endpoints (Phase 13B) — guest-facing.
 *
 *   GET    /api/book/holds/:id   -> guest-safe hold (with effective status)
 *   DELETE /api/book/holds/:id   -> cancel (soft: status='cancelled')
 *
 * Both return ONLY guest-safe fields (see PublicHold) — no table ids/names,
 * combination id, allocation type, or internal diagnostics. Cancelling never
 * hard-deletes the row; it releases the table locks and marks it cancelled.
 */
export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f-]{36}$/i

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  const hold = await getHold(id)
  if (!hold) {
    return NextResponse.json({ error: "Hold not found." }, { status: 404 })
  }
  return NextResponse.json(hold)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 })
  }

  const hold = await cancelHold(id)
  if (!hold) {
    return NextResponse.json({ error: "Hold not found." }, { status: 404 })
  }
  return NextResponse.json(hold)
}
