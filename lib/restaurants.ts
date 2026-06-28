import { getSupabaseClient } from "@/lib/supabase"

/**
 * A restaurant profile used across the public booking experience, the admin
 * dashboard, and the SaaS dashboard. DB columns `description`/`location` map
 * to the display concepts of "category" and "neighborhood". Presentation-only
 * fields (logo, priceRange, rating) are merged from known defaults since they
 * are not stored in the database yet.
 */
export type RestaurantProfile = {
  id: string | null
  name: string
  slug: string
  description: string
  location: string
  logo: string
  priceRange: string
  rating: number
}

export const DEFAULT_RESTAURANT_SLUG = "maison-laurent"

export const defaultRestaurant: RestaurantProfile = {
  id: null,
  name: "Maison Laurent",
  slug: "maison-laurent",
  description: "Contemporary French · Fine Dining",
  location: "SoHo, New York",
  logo: "/maison-logo.png",
  priceRange: "$$$$",
  rating: 4.8,
}

/**
 * Known presentation defaults keyed by slug. Lets the app render a polished
 * page even before Supabase is configured, and supplies logo/price/rating for
 * restaurants that only have DB text fields.
 */
const KNOWN_PROFILES: Record<string, RestaurantProfile> = {
  [defaultRestaurant.slug]: defaultRestaurant,
}

const FALLBACK_RESTAURANTS: RestaurantProfile[] = [defaultRestaurant]

type RestaurantRow = {
  id: string
  name: string
  slug: string
  description: string | null
  location: string | null
  active: boolean
}

function rowToProfile(row: RestaurantRow): RestaurantProfile {
  const known = KNOWN_PROFILES[row.slug]
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description ?? known?.description ?? "",
    location: row.location ?? known?.location ?? "",
    logo: known?.logo ?? "/diverse-restaurant-logos.png",
    priceRange: known?.priceRange ?? "$$$",
    rating: known?.rating ?? 4.6,
  }
}

/** Initials for a restaurant avatar fallback, e.g. "Maison Laurent" -> "ML". */
export function restaurantInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

/** All active restaurants. Falls back to the default when Supabase is absent. */
export async function getActiveRestaurants(): Promise<RestaurantProfile[]> {
  const supabase = getSupabaseClient()
  if (!supabase) return FALLBACK_RESTAURANTS

  try {
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name, slug, description, location, active")
      .eq("active", true)
      .order("name", { ascending: true })

    if (error) throw new Error(error.message)
    if (!data || data.length === 0) return FALLBACK_RESTAURANTS
    return (data as RestaurantRow[]).map(rowToProfile)
  } catch (err) {
    console.log(
      "[v0] getActiveRestaurants error:",
      err instanceof Error ? err.message : err,
    )
    return FALLBACK_RESTAURANTS
  }
}

/** Resolve a restaurant by slug. Falls back to known defaults when possible. */
export async function getRestaurantBySlug(
  slug: string,
): Promise<RestaurantProfile | null> {
  const supabase = getSupabaseClient()
  if (!supabase) return KNOWN_PROFILES[slug] ?? null

  try {
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name, slug, description, location, active")
      .eq("slug", slug)
      .maybeSingle()

    if (error) throw new Error(error.message)
    if (!data) return KNOWN_PROFILES[slug] ?? null
    return rowToProfile(data as RestaurantRow)
  } catch (err) {
    console.log(
      "[v0] getRestaurantBySlug error:",
      err instanceof Error ? err.message : err,
    )
    return KNOWN_PROFILES[slug] ?? null
  }
}

function todayISO(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split("T")[0]
}

/**
 * Count today's reservations per restaurant_name in a single query.
 * Returns an empty map when Supabase isn't configured.
 */
export async function getTodayReservationCounts(): Promise<
  Record<string, number>
> {
  const supabase = getSupabaseClient()
  if (!supabase) return {}

  try {
    const { data, error } = await supabase
      .from("reservations")
      .select("restaurant_name")
      .eq("reservation_date", todayISO())

    if (error) throw new Error(error.message)

    const counts: Record<string, number> = {}
    for (const row of (data ?? []) as { restaurant_name: string | null }[]) {
      const name = row.restaurant_name
      if (name) counts[name] = (counts[name] ?? 0) + 1
    }
    return counts
  } catch (err) {
    console.log(
      "[v0] getTodayReservationCounts error:",
      err instanceof Error ? err.message : err,
    )
    return {}
  }
}
