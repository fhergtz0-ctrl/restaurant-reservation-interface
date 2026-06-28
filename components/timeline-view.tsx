"use client"

import * as React from "react"
import {
  AlertCircleIcon,
  RefreshCwIcon,
  Rows3Icon,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/app-nav/page-header"
import { useRestaurantSelector } from "@/hooks/use-restaurant-selector"
import {
  STATUS_META,
  isActiveReservation,
  timeToMinutes,
  type AdminReservation,
  type AdminTable,
} from "@/lib/admin-data"

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`
}

// Service window shown on the timeline (11:00–23:00).
const START_MIN = 11 * 60
const END_MIN = 23 * 60
const SPAN = END_MIN - START_MIN
const HOURS = Array.from(
  { length: (END_MIN - START_MIN) / 60 + 1 },
  (_, i) => START_MIN + i * 60,
)

function fmtHour(min: number) {
  const h = Math.floor(min / 60)
  const period = h >= 12 ? "PM" : "AM"
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}${period}`
}

export function TimelineView() {
  const { selected } = useRestaurantSelector()
  const [date, setDate] = React.useState(todayLocal)
  const [tables, setTables] = React.useState<AdminTable[]>([])
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
      const tableParams = new URLSearchParams({ restaurant: selected.name })
      const [resRes, tableRes] = await Promise.all([
        fetch(`/api/admin/reservations?${params.toString()}`),
        fetch(`/api/admin/tables?${tableParams.toString()}`),
      ])
      const resPayload = (await resRes.json()) as {
        reservations?: AdminReservation[]
        error?: string
      }
      if (!resRes.ok) {
        throw new Error(resPayload.error ?? "Failed to load reservations.")
      }
      setReservations(resPayload.reservations ?? [])
      const tablePayload = (await tableRes.json()) as { tables?: AdminTable[] }
      setTables(tableRes.ok ? (tablePayload.tables ?? []) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setReservations([])
      setTables([])
    } finally {
      setLoading(false)
    }
  }, [date, selected])

  React.useEffect(() => {
    void load()
  }, [load])

  // Group active reservations by table.
  const rows = React.useMemo(() => {
    const byTable = new Map<string, AdminReservation[]>()
    const unassigned: AdminReservation[] = []
    for (const r of reservations) {
      if (!isActiveReservation(r)) continue
      if (r.table_id) {
        if (!byTable.has(r.table_id)) byTable.set(r.table_id, [])
        byTable.get(r.table_id)!.push(r)
      } else {
        unassigned.push(r)
      }
    }
    const tableRows = tables.map((t) => ({
      id: t.id,
      name: t.name,
      capacity: t.capacity,
      bookings: (byTable.get(t.id) ?? []).sort(
        (a, b) => timeToMinutes(a.reservation_time) - timeToMinutes(b.reservation_time),
      ),
    }))
    if (unassigned.length > 0) {
      tableRows.push({
        id: "unassigned",
        name: "Unassigned",
        capacity: 0,
        bookings: unassigned.sort(
          (a, b) =>
            timeToMinutes(a.reservation_time) - timeToMinutes(b.reservation_time),
        ),
      })
    }
    return tableRows
  }, [tables, reservations])

  return (
    <div className="text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <PageHeader
          badge="Timeline"
          icon={Rows3Icon}
          title="Service timeline"
          subtitle={`Reservations across tables for ${selected?.name ?? "your restaurant"}.`}
        >
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-[150px]"
            aria-label="Date"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCwIcon className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </PageHeader>

        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircleIcon className="size-4" />
            {error}
          </div>
        ) : loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No tables or reservations for this date.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border bg-card">
            <div className="min-w-[760px]">
              {/* Hour axis */}
              <div className="flex border-b border-border">
                <div className="w-32 shrink-0 px-3 py-2 text-xs font-medium text-muted-foreground">
                  Table
                </div>
                <div className="relative flex-1">
                  <div className="flex">
                    {HOURS.map((h) => (
                      <div
                        key={h}
                        className="flex-1 border-l border-border px-2 py-2 text-xs text-muted-foreground"
                      >
                        {fmtHour(h)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rows */}
              {rows.map((row) => (
                <div
                  key={row.id}
                  className="flex border-b border-border last:border-0"
                >
                  <div className="flex w-32 shrink-0 flex-col justify-center px-3 py-3">
                    <span className="text-sm font-medium">{row.name}</span>
                    {row.capacity > 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Seats {row.capacity}
                      </span>
                    ) : null}
                  </div>
                  <div className="relative flex-1 py-3">
                    {/* hour gridlines */}
                    <div className="absolute inset-0 flex">
                      {HOURS.map((h) => (
                        <div
                          key={h}
                          className="flex-1 border-l border-border/50"
                        />
                      ))}
                    </div>
                    {/* booking chips */}
                    <div className="relative h-8">
                      {row.bookings.map((b) => {
                        const start = timeToMinutes(b.reservation_time)
                        const clamped = Math.max(
                          START_MIN,
                          Math.min(start, END_MIN),
                        )
                        const leftPct = ((clamped - START_MIN) / SPAN) * 100
                        const meta = STATUS_META[b.status]
                        return (
                          <div
                            key={b.id}
                            className={`absolute top-0 flex h-8 items-center gap-1 truncate rounded-md px-2 text-xs font-medium ${meta?.className ?? ""}`}
                            style={{
                              left: `${leftPct}%`,
                              maxWidth: "140px",
                            }}
                            title={`${b.reservation_time} · ${b.customer_name} · ${b.guests} guests · ${meta?.label ?? b.status}`}
                          >
                            <span className="truncate">
                              {b.reservation_time} {b.customer_name}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
