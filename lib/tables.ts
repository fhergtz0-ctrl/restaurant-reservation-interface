import type { SupabaseClient } from "@supabase/supabase-js"

export type RestaurantTable = {
  id: string
  name: string
  capacity: number
}

/**
 * Fetch the active tables for a restaurant that can seat `guests`,
 * ordered by capacity (smallest first) so the smallest suitable table
 * is always preferred.
 */
export async function getEligibleTables(
  supabase: SupabaseClient,
  restaurant: string,
  guests: number,
): Promise<RestaurantTable[]> {
  const { data, error } = await supabase
    .from("tables")
    .select("id, name, capacity")
    .eq("restaurant_name", restaurant)
    .eq("active", true)
    .gte("capacity", guests)
    .order("capacity", { ascending: true })
    .order("name", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as RestaurantTable[]
}

/**
 * Returns the set of table ids already booked for a restaurant on a given
 * date, keyed by reservation time (e.g. "7:00 PM" -> Set<tableId>).
 */
export async function getBookedTableIdsByTime(
  supabase: SupabaseClient,
  restaurant: string,
  date: string,
): Promise<Map<string, Set<string>>> {
  const { data, error } = await supabase
    .from("reservations")
    .select("reservation_time, table_id")
    .eq("restaurant_name", restaurant)
    .eq("reservation_date", date)
    .not("table_id", "is", null)

  if (error) {
    throw new Error(error.message)
  }

  const byTime = new Map<string, Set<string>>()
  for (const row of data ?? []) {
    const time = row.reservation_time as string
    const tableId = row.table_id as string
    if (!byTime.has(time)) byTime.set(time, new Set())
    byTime.get(time)!.add(tableId)
  }
  return byTime
}

/**
 * Pick the smallest eligible table that is not already booked at `time`.
 * Returns null when every suitable table is taken.
 */
export function pickAvailableTable(
  eligibleTables: RestaurantTable[],
  bookedTableIds: Set<string> | undefined,
): RestaurantTable | null {
  for (const table of eligibleTables) {
    if (!bookedTableIds || !bookedTableIds.has(table.id)) {
      return table
    }
  }
  return null
}
