export const RESERVATION_STATUSES = [
  "confirmed",
  "seated",
  "cancelled",
  "no_show",
] as const

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]

export function isReservationStatus(
  value: unknown,
): value is ReservationStatus {
  return (
    typeof value === "string" &&
    (RESERVATION_STATUSES as readonly string[]).includes(value)
  )
}

export type StatusMeta = {
  label: string
  /** Badge classes tuned for the dark premium theme. */
  className: string
}

export const STATUS_META: Record<ReservationStatus, StatusMeta> = {
  confirmed: {
    label: "Confirmed",
    className:
      "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30",
  },
  seated: {
    label: "Seated",
    className:
      "bg-emerald-500/15 text-emerald-500 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "bg-destructive/15 text-destructive ring-1 ring-inset ring-destructive/30",
  },
  no_show: {
    label: "No-show",
    className:
      "bg-amber-500/15 text-amber-600 ring-1 ring-inset ring-amber-500/30 dark:text-amber-400",
  },
}

export type AdminReservation = {
  id: string
  restaurant_name: string | null
  guests: number
  reservation_date: string
  reservation_time: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  notes: string | null
  status: ReservationStatus
  table_id: string | null
  table_name: string | null
}

export type AdminTable = {
  id: string
  name: string
  capacity: number
  /** Optional visual grouping (Main Dining, Terrace, VIP, ...). */
  zone?: string | null
  /** Whether the table is taken out of service on the floor plan. */
  blocked?: boolean | null
}

/** Statuses that actively occupy a table for a service. */
export const ACTIVE_STATUSES: readonly ReservationStatus[] = [
  "confirmed",
  "seated",
]

export function isActiveReservation(r: { status: ReservationStatus }): boolean {
  return ACTIVE_STATUSES.includes(r.status)
}

/**
 * Convert a slot string like "7:30 PM" into minutes-since-midnight so
 * reservations can be sorted chronologically (the DB stores display strings).
 */
export function timeToMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time.trim())
  if (!match) return Number.MAX_SAFE_INTEGER
  let hours = Number(match[1]) % 12
  const minutes = Number(match[2])
  if (match[3].toUpperCase() === "PM") hours += 12
  return hours * 60 + minutes
}

export type KpiSummary = {
  reservationCount: number
  totalGuests: number
  occupiedTables: number
  activeTables: number
  busiestTime: string | null
}

/** Compute the day's KPI summary from active reservations + active tables. */
export function computeKpis(
  reservations: AdminReservation[],
  activeTables: number,
): KpiSummary {
  const active = reservations.filter(isActiveReservation)
  const totalGuests = active.reduce((sum, r) => sum + r.guests, 0)

  const occupiedTableIds = new Set(
    active.filter((r) => r.table_id).map((r) => r.table_id as string),
  )

  const byTime = new Map<string, number>()
  for (const r of active) {
    byTime.set(r.reservation_time, (byTime.get(r.reservation_time) ?? 0) + 1)
  }
  let busiestTime: string | null = null
  let busiestCount = 0
  for (const [time, count] of byTime) {
    if (count > busiestCount) {
      busiestCount = count
      busiestTime = time
    }
  }

  return {
    reservationCount: reservations.length,
    totalGuests,
    occupiedTables: occupiedTableIds.size,
    activeTables,
    busiestTime,
  }
}

export type TableBooking = {
  time: string
  customer: string
  status: ReservationStatus
}

export type TableBookingWithId = TableBooking & {
  id: string
  guests: number
  phone: string | null
}

export type TableStatus = {
  id: string
  name: string
  capacity: number
  zone: string
  blocked: boolean
  occupied: boolean
  bookings: TableBookingWithId[]
}

/** The four floor-plan states, in legend order. */
export const FLOOR_STATUSES = [
  "available",
  "reserved",
  "occupied",
  "blocked",
] as const

export type FloorStatus = (typeof FLOOR_STATUSES)[number]

export const DEFAULT_ZONE = "Main Dining"

/** Preferred display order for zones; unknown zones sort alphabetically after. */
export const ZONE_ORDER = [
  "Main Dining",
  "Terrace",
  "VIP",
  "Bar",
  "Private Room",
] as const

/**
 * Derive the floor-plan state for a table:
 * - blocked: explicitly out of service
 * - occupied: a guest is currently seated
 * - reserved: has upcoming active bookings but nobody seated yet
 * - available: no active bookings
 */
export function floorStatusOf(t: TableStatus): FloorStatus {
  if (t.blocked) return "blocked"
  if (t.bookings.some((b) => b.status === "seated")) return "occupied"
  if (t.bookings.length > 0) return "reserved"
  return "available"
}

/**
 * Determine, for the selected date, the floor status of each active table,
 * including its zone, blocked flag, and chronologically-sorted bookings.
 */
export function computeTableStatuses(
  tables: AdminTable[],
  reservations: AdminReservation[],
): TableStatus[] {
  const bookingsByTable = new Map<string, TableBookingWithId[]>()
  for (const r of reservations) {
    if (!r.table_id || !isActiveReservation(r)) continue
    if (!bookingsByTable.has(r.table_id)) bookingsByTable.set(r.table_id, [])
    bookingsByTable.get(r.table_id)!.push({
      id: r.id,
      time: r.reservation_time,
      customer: r.customer_name,
      status: r.status,
      guests: r.guests,
      phone: r.customer_phone,
    })
  }

  return tables.map((t) => {
    const bookings = (bookingsByTable.get(t.id) ?? []).sort(
      (a, b) => timeToMinutes(a.time) - timeToMinutes(b.time),
    )
    return {
      id: t.id,
      name: t.name,
      capacity: t.capacity,
      zone: t.zone?.trim() || DEFAULT_ZONE,
      blocked: Boolean(t.blocked),
      occupied: bookings.length > 0,
      bookings,
    }
  })
}

/** Group table statuses by zone, ordered by ZONE_ORDER then alphabetically. */
export function groupTablesByZone(
  statuses: TableStatus[],
): { zone: string; tables: TableStatus[] }[] {
  const byZone = new Map<string, TableStatus[]>()
  for (const t of statuses) {
    if (!byZone.has(t.zone)) byZone.set(t.zone, [])
    byZone.get(t.zone)!.push(t)
  }

  const orderIndex = (zone: string) => {
    const i = (ZONE_ORDER as readonly string[]).indexOf(zone)
    return i === -1 ? ZONE_ORDER.length : i
  }

  return Array.from(byZone.entries())
    .sort(([a], [b]) => {
      const diff = orderIndex(a) - orderIndex(b)
      return diff !== 0 ? diff : a.localeCompare(b)
    })
    .map(([zone, tables]) => ({ zone, tables }))
}

/** Occupancy summary across the floor. */
export type FloorSummary = {
  total: number
  available: number
  reserved: number
  occupied: number
  blocked: number
  /** Percentage of in-service tables that are reserved or occupied. */
  occupancyPct: number
}

export function computeFloorSummary(statuses: TableStatus[]): FloorSummary {
  let available = 0
  let reserved = 0
  let occupied = 0
  let blocked = 0
  for (const t of statuses) {
    switch (floorStatusOf(t)) {
      case "available":
        available += 1
        break
      case "reserved":
        reserved += 1
        break
      case "occupied":
        occupied += 1
        break
      case "blocked":
        blocked += 1
        break
    }
  }
  const inService = available + reserved + occupied
  const occupancyPct =
    inService > 0 ? Math.round(((reserved + occupied) / inService) * 100) : 0
  return {
    total: statuses.length,
    available,
    reserved,
    occupied,
    blocked,
    occupancyPct,
  }
}
