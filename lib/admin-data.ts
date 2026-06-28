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

export type TableStatus = {
  id: string
  name: string
  capacity: number
  occupied: boolean
  bookings: TableBooking[]
}

/**
 * Determine, for the selected date, which active tables are occupied.
 * A table is "occupied" when it has at least one active reservation that day.
 */
export function computeTableStatuses(
  tables: AdminTable[],
  reservations: AdminReservation[],
): TableStatus[] {
  const bookingsByTable = new Map<string, TableBooking[]>()
  for (const r of reservations) {
    if (!r.table_id || !isActiveReservation(r)) continue
    if (!bookingsByTable.has(r.table_id)) bookingsByTable.set(r.table_id, [])
    bookingsByTable.get(r.table_id)!.push({
      time: r.reservation_time,
      customer: r.customer_name,
      status: r.status,
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
      occupied: bookings.length > 0,
      bookings,
    }
  })
}
