import { ReservationSidebar } from "@/components/reservation-sidebar"
import { RestaurantMap } from "@/components/restaurant-map"
import type { RestaurantProfile } from "@/lib/restaurants"

/**
 * The shared public booking layout (sidebar + map). Used by both the default
 * route `/` and the per-restaurant route `/r/[slug]`.
 */
export function BookingExperience({
  restaurant,
}: {
  restaurant: RestaurantProfile
}) {
  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden md:flex-row">
      <ReservationSidebar restaurant={restaurant} />
      <section
        className="relative h-64 w-full shrink-0 md:h-full md:flex-1"
        aria-label="Restaurant location map"
      >
        <RestaurantMap restaurant={restaurant} />
      </section>
    </main>
  )
}
