import { ReservationSidebar } from "@/components/reservation-sidebar"
import { RestaurantMap } from "@/components/restaurant-map"

export default function Page() {
  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden md:flex-row">
      <ReservationSidebar />
      <section
        className="relative h-64 w-full shrink-0 md:h-full md:flex-1"
        aria-label="Restaurant location map"
      >
        <RestaurantMap />
      </section>
    </main>
  )
}
