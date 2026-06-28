import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BookingExperience } from "@/components/booking-experience"
import { getRestaurantBySlug } from "@/lib/restaurants"

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params
  const restaurant = await getRestaurantBySlug(slug)

  if (!restaurant) {
    return { title: "Restaurant not found" }
  }

  return {
    title: `${restaurant.name} · Reserve a Table`,
    description: `Book your table at ${restaurant.name} — ${restaurant.description} in ${restaurant.location}. Instant confirmation.`,
  }
}

export default async function RestaurantBookingPage({ params }: PageProps) {
  const { slug } = await params
  const restaurant = await getRestaurantBySlug(slug)

  if (!restaurant) {
    notFound()
  }

  return <BookingExperience restaurant={restaurant} />
}
