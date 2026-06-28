"use client"

import { useRestaurants } from "@/components/app-shell/restaurant-context"

/**
 * Thin wrapper over the shared restaurant context. Kept for backwards
 * compatibility with the data views (calendar, tables, reservations, admin),
 * which read `{ restaurants, selectedSlug, setSelectedSlug, selected }`.
 */
export function useRestaurantSelector() {
  const { restaurants, selectedSlug, setSelectedSlug, selected } =
    useRestaurants()
  return { restaurants, selectedSlug, setSelectedSlug, selected }
}

export function todayValue(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split("T")[0]
}
