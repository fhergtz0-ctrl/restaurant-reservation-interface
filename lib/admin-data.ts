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
