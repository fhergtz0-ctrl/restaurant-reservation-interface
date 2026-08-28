import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { BookingHoldDetails } from "@/components/booking-hold-details"
import { getRestaurantBySlug } from "@/lib/restaurants"
import { getHold } from "@/lib/booking-holds-server"

/**
 * Public booking details step (Phase 13B).
 *
 *   /book/[restaurant]/details?hold=<id>
 *
 * Server component: resolves the restaurant by slug and loads the hold created
 * in the search step. The countdown + summary live in a client child. This
 * step never creates a reservation — it only shows the active hold. When the
 * hold is missing/unknown we send the guest back to search; when it exists but
 * has expired/cancelled the client renders the "hold expired" state.
 */

type PageProps = {
  params: Promise<{ restaurant: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export const metadata: Metadata = {
  title: "Confirm your booking",
}

export default async function BookingDetailsPage({
  params,
  searchParams,
}: PageProps) {
  const { restaurant: slug } = await params
  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant) {
    notFound()
  }

  const sp = await searchParams
  const holdId = firstParam(sp.hold)
  if (!holdId) {
    // No hold reference at all — nothing to show; back to search.
    redirect(`/book/${slug}`)
  }

  const hold = await getHold(holdId)

  // Unknown hold id, or a hold that belongs to a different restaurant slug —
  // treat as invalid and send the guest back to this restaurant's search.
  if (!hold || hold.booking.restaurant !== slug) {
    redirect(`/book/${slug}`)
  }

  return <BookingHoldDetails hold={hold} restaurantName={restaurant.name} />
}
