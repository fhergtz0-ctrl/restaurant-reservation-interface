"use client"

import * as React from "react"

import {
  DEFAULT_RESTAURANT_SLUG,
  type RestaurantProfile,
} from "@/lib/restaurants"

/**
 * Loads the list of active restaurants once and tracks the selected slug.
 * Shared by the admin-adjacent pages (calendar, tables, reservations).
 */
export function useRestaurantSelector() {
  const [restaurants, setRestaurants] = React.useState<RestaurantProfile[]>([])
  const [selectedSlug, setSelectedSlug] = React.useState(
    DEFAULT_RESTAURANT_SLUG,
  )

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch("/api/admin/restaurants")
        const payload = (await response.json()) as {
          restaurants?: RestaurantProfile[]
        }
        if (cancelled) return
        const list = payload.restaurants ?? []
        setRestaurants(list)
        if (list.length > 0 && !list.some((r) => r.slug === selectedSlug)) {
          setSelectedSlug(list[0].slug)
        }
      } catch (err) {
        console.log(
          "[v0] Restaurants fetch error:",
          err instanceof Error ? err.message : err,
        )
      }
    })()
    return () => {
      cancelled = true
    }
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selected = React.useMemo(
    () =>
      restaurants.find((r) => r.slug === selectedSlug) ?? restaurants[0] ?? null,
    [restaurants, selectedSlug],
  )

  return { restaurants, selectedSlug, setSelectedSlug, selected }
}

export function todayValue(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split("T")[0]
}
