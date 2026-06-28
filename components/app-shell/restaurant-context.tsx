"use client"

import * as React from "react"

import {
  DEFAULT_RESTAURANT_SLUG,
  type RestaurantProfile,
} from "@/lib/restaurants"

type RestaurantContextValue = {
  restaurants: RestaurantProfile[]
  selectedSlug: string
  setSelectedSlug: (slug: string) => void
  selected: RestaurantProfile | null
  loading: boolean
}

const RestaurantContext = React.createContext<RestaurantContextValue | null>(
  null,
)

/**
 * Loads the active restaurants once and tracks the selected slug for the whole
 * authenticated workspace. The global header's selector and every data view
 * read from this single source so selection stays in sync across pages.
 */
export function RestaurantProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [restaurants, setRestaurants] = React.useState<RestaurantProfile[]>([])
  const [selectedSlug, setSelectedSlug] = React.useState(
    DEFAULT_RESTAURANT_SLUG,
  )
  const [loading, setLoading] = React.useState(true)

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
        setSelectedSlug((current) =>
          list.length > 0 && !list.some((r) => r.slug === current)
            ? list[0].slug
            : current,
        )
      } catch (err) {
        console.log(
          "[v0] Restaurants fetch error:",
          err instanceof Error ? err.message : err,
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selected = React.useMemo(
    () =>
      restaurants.find((r) => r.slug === selectedSlug) ?? restaurants[0] ?? null,
    [restaurants, selectedSlug],
  )

  const value = React.useMemo<RestaurantContextValue>(
    () => ({ restaurants, selectedSlug, setSelectedSlug, selected, loading }),
    [restaurants, selectedSlug, selected, loading],
  )

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  )
}

/**
 * Access the shared restaurant selection. Returns a safe empty default when
 * used outside a provider so isolated renders don't crash.
 */
export function useRestaurants(): RestaurantContextValue {
  const ctx = React.useContext(RestaurantContext)
  if (!ctx) {
    return {
      restaurants: [],
      selectedSlug: DEFAULT_RESTAURANT_SLUG,
      setSelectedSlug: () => {},
      selected: null,
      loading: false,
    }
  }
  return ctx
}
