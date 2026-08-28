import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BookingSearch } from "@/components/booking-search"
import { getRestaurantBySlug } from "@/lib/restaurants"

/**
 * Public, guest-facing booking search (Phase 13A).
 *
 *   /book/[restaurant]   e.g. /book/maison-laurent
 *
 * The [restaurant] segment is the restaurant SLUG. This route is intentionally
 * OUTSIDE the (workspace) group, so it renders with NO admin AppShell/sidebar —
 * only the root layout. It consumes the Availability Engine via the public
 * /api/book/availability endpoint; it never creates reservations (that is a
 * later Phase 13 step).
 */

type PageProps = {
  params: Promise<{ restaurant: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { restaurant: slug } = await params
  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant) {
    return { title: "Restaurant not found" }
  }
  return {
    title: `Book a table · ${restaurant.name}`,
    description: `Find an available table at ${restaurant.name}${
      restaurant.location ? ` — ${restaurant.location}` : ""
    }. Choose your party size and date to see open times.`,
  }
}

export default async function BookPage({ params, searchParams }: PageProps) {
  const { restaurant: slug } = await params
  const restaurant = await getRestaurantBySlug(slug)
  if (!restaurant) {
    notFound()
  }

  const sp = await searchParams
  const dateParam = firstParam(sp.date) ?? ""
  const partyParam = Number(firstParam(sp.partySize))
  const initialPartySize =
    Number.isFinite(partyParam) && partyParam >= 1 ? Math.trunc(partyParam) : 2

  // Auto-run the search only when a shared link already carries both inputs.
  const autoSearch = Boolean(dateParam) && Boolean(firstParam(sp.partySize))

  return (
    <BookingSearch
      restaurant={restaurant}
      initialDate={dateParam}
      initialPartySize={initialPartySize}
      autoSearch={autoSearch}
    />
  )
}
