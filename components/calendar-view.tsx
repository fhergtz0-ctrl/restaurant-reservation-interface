"use client"

import * as React from "react"
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  UsersIcon,
  Table2Icon,
  CalendarX2Icon,
  AlertCircleIcon,
  RefreshCwIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/app-nav/page-header"
import {
  useRestaurantSelector,
  todayValue,
} from "@/hooks/use-restaurant-selector"
import {
  STATUS_META,
  isActiveReservation,
  timeToMinutes,
  type AdminReservation,
  type ReservationStatus,
} from "@/lib/admin-data"

function StatusDot({ status }: { status: ReservationStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  )
}

function shiftDate(value: string, days: number): string {
  const d = new Date(`${value}T00:00:00`)
  d.setDate(d.getDate() + days)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split("T")[0]
}

function formatLongDate(value: string): string {
  const d = new Date(`${value}T00:00:00`)
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

export function CalendarView({
  accountSlot,
}: {
  accountSlot?: React.ReactNode
}) {
  const { restaurants, selectedSlug, setSelectedSlug, selected } =
    useRestaurantSelector()
  const [date, setDate] = React.useState(todayValue)
  const [reservations, setReservations] = React.useState<AdminReservation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!selected) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        date,
        restaurant: selected.name,
        restaurantSlug: selected.slug,
      })
      const response = await fetch(
        `/api/admin/reservations?${params.toString()}`,
      )
      const payload = (await response.json()) as {
        reservations?: AdminReservation[]
        error?: string
      }
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load reservations.")
      }
      setReservations(payload.reservations ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [date, selected])

  React.useEffect(() => {
    void load()
  }, [load])

  // Group reservations into time slots, sorted chronologically.
  const groups = React.useMemo(() => {
    const byTime = new Map<string, AdminReservation[]>()
    for (const r of reservations) {
      if (!byTime.has(r.reservation_time)) byTime.set(r.reservation_time, [])
      byTime.get(r.reservation_time)!.push(r)
    }
    return Array.from(byTime.entries()).sort(
      (a, b) => timeToMinutes(a[0]) - timeToMinutes(b[0]),
    )
  }, [reservations])

  const activeCount = reservations.filter(isActiveReservation).length
  const totalGuests = reservations
    .filter(isActiveReservation)
    .reduce((sum, r) => sum + r.guests, 0)

  return (
    <main className="min-h-dvh bg-background pb-24 text-foreground lg:pb-0">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <PageHeader
          badge="Calendar"
          icon={CalendarIcon}
          title="Day timeline"
          subtitle={`Reservations for ${selected?.name ?? "your restaurant"}.`}
          restaurants={restaurants}
          selectedSlug={selectedSlug}
          onSelect={setSelectedSlug}
          accountSlot={accountSlot}
        >
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous day"
              onClick={() => setDate((d) => shiftDate(d, -1))}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 w-[150px]"
              aria-label="Date"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Next day"
              onClick={() => setDate((d) => shiftDate(d, 1))}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        </PageHeader>

        {/* Day summary */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
              <CalendarIcon className="size-5 text-primary" />
            </span>
            <div className="flex flex-col">
              <span className="font-heading text-base font-semibold tracking-tight">
                {formatLongDate(date)}
              </span>
              <span className="text-xs text-muted-foreground">
                {date === todayValue() ? "Today" : "Scheduled day"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5">
              <ClockIcon className="size-4 text-primary" />
              <span className="font-medium">{activeCount}</span>
              <span className="text-muted-foreground">active</span>
            </span>
            <span className="flex items-center gap-1.5">
              <UsersIcon className="size-4 text-primary" />
              <span className="font-medium">{totalGuests}</span>
              <span className="text-muted-foreground">guests</span>
            </span>
          </div>
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
            <AlertCircleIcon className="size-8 text-destructive" />
            <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              className="gap-1.5"
            >
              <RefreshCwIcon className="size-4" />
              Try again
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <CalendarX2Icon className="size-8 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <p className="font-medium text-foreground">No reservations</p>
              <p className="text-sm text-muted-foreground">
                Nothing booked for this day yet.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-0">
            {groups.map(([time, rows]) => (
              <div key={time} className="flex gap-3 sm:gap-4">
                {/* Time gutter */}
                <div className="flex w-14 shrink-0 flex-col items-end pt-1 sm:w-20">
                  <span className="text-sm font-semibold text-foreground">
                    {time}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {rows.length} {rows.length === 1 ? "booking" : "bookings"}
                  </span>
                </div>

                {/* Rail + cards */}
                <div className="relative flex flex-1 flex-col gap-3 border-l border-border pb-6 pl-4 sm:pl-6">
                  <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-primary ring-4 ring-background" />
                  {rows.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium text-foreground">
                          {r.customer_name}
                        </span>
                        <StatusDot status={r.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <UsersIcon className="size-3.5" />
                          {r.guests} {r.guests === 1 ? "guest" : "guests"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Table2Icon className="size-3.5" />
                          {r.table_name ?? "No table"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
