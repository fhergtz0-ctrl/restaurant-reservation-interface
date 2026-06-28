import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase"

export type SessionProfile = {
  email: string
  name: string
  role: string
  restaurantId: string | null
  restaurantName: string | null
}

/**
 * Returns the current authenticated user's profile (with restaurant), or null
 * when there is no session / Supabase is not configured. Safe in Server
 * Components and route handlers.
 */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  if (!isSupabaseConfigured) return null

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const fallbackName =
    (user.user_metadata?.owner_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "Account"

  try {
    const { data } = await supabase
      .from("profiles")
      .select("name, email, role, restaurant_id, restaurants(name)")
      .eq("auth_user_id", user.id)
      .maybeSingle()

    if (data) {
      // Supabase types embedded relations as an array; normalize to one row.
      const relation = data.restaurants as
        | { name: string }
        | { name: string }[]
        | null
      const restaurant = Array.isArray(relation) ? relation[0] : relation
      return {
        email: data.email ?? user.email ?? "",
        name: data.name ?? fallbackName,
        role: data.role ?? "Owner",
        restaurantId: data.restaurant_id ?? null,
        restaurantName: restaurant?.name ?? null,
      }
    }
  } catch (err) {
    console.log(
      "[v0] getSessionProfile error:",
      err instanceof Error ? err.message : err,
    )
  }

  // Authenticated but no profile row yet (e.g. trigger not applied).
  return {
    email: user.email ?? "",
    name: fallbackName,
    role: "Owner",
    restaurantId: null,
    restaurantName: null,
  }
}
