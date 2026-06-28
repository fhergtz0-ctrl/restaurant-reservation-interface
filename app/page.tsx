import { BookingExperience } from "@/components/booking-experience"
import {
  DEFAULT_RESTAURANT_SLUG,
  defaultRestaurant,
  getRestaurantBySlug,
} from "@/lib/restaurants"

export default async function Page() {
  // The default route always shows Maison Laurent.
  const restaurant =
    (await getRestaurantBySlug(DEFAULT_RESTAURANT_SLUG)) ?? defaultRestaurant
  return <BookingExperience restaurant={restaurant} />
}
