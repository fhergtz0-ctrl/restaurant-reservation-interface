"use client"

import * as React from "react"
import {
  LayoutGridIcon,
  UsersIcon,
  ClockIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  ArmchairIcon,
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
  computeTableStatuses,
  type AdminReservation,
  type AdminTable,
  type TableStatus,
} from "@/lib/admin-data"

type FloorStatus = "available" | "occupied" | "blocked"

const STATUS_STYLES: Record<
  FloorStatus,
  { label: string; card: string; badge: string; dot: string }
> = {
  available: {
    label: "Available",
    card: "border-emerald-500/30 bg-emerald-500/5",
    badge:
      "bg-emerald-500/15 text-emerald-500 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  occupied: {
    label: "Occupied",
    card: "border-amber-500/30 bg-amber-500/5",
    badge:
      "bg-amber-500/15 text-amber-600 ring-1 ring-inset ring-amber-500/30 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  blocked: {
    label: "Blocked",
    card: "border-border bg-muted/40",
    badge:
      "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
    dot: "bg-muted-foreground",
  },
}

/** Derive the floor status from a computed table status. */
function floorStatusOf(t: TableStatus): FloorStatus {
  // `capacity <= 0` is treated as blocked/out-of-service.
  if (t.capacity <= 0) return "blocked"
  return t.occupied ? "occupied" : "available"
}

export function TablesView({ accountSlot }: { accountSlot?: React.ReactNode }) {
  const { restaurants, selectedSlug, setSelectedSlug, selected } =
    useRestaurantSelector()
  const [date, setDate] = React.useState(todayValue)
  const [tables, setTables] = React.useState<AdminTable[]>([])
  const [reservations, setReservations] = React.useState<AdminReservation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!selected) return
    setLoading(true)
    setError(null)
    try {
      const resParams = new URLSearchParams({
        date,
        restaurant: selected.name,
        restaurantSlug: selected.slug,
      })
      const tableParams = new URLSearchParams({ restaurant: selected.name })
      const [tablesResponse, resResponse] = await Promise.all([
        fetch(`/api/admin/tables?${tableParams.toString()}`),
        fetch(`/api/admin/reservations?${resParams.toString()}`),
      ])

      const tablesPayload = (await tablesResponse.json()) as {
        tables?: AdminTable[]
        error?: string
      }
      if (!tablesResponse.ok) {
        throw new Error(tablesPayload.error ?? "Failed to load tables.")
      }
      setTables(tablesPayload.tables ?? [])

      const resPayload = (await resResponse.json()) as {
        reservations?: AdminReservation[]
      }
      setReservations(resResponse.ok ? (resPayload.reservations ?? []) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setTables([])
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [date, selected])

  React.useEffect(() => {
    void load()
  }, [load])

  const statuses = React.useMemo(
    () => computeTableStatuses(tables, reservations),
    [tables, reservations],
  )

  const counts = React.useMemo(() => {
    let available = 0
    let occupied = 0
    let blocked = 0
    for (const t of statuses) {
      const s = floorStatusOf(t)
      if (s === "available") available += 1
      else if (s === "occupied") occupied += 1
      else blocked += 1
    }
    return { available, occupied, blocked }
  }, [statuses])

  return (
    <main className="min-h-dvh bg-background pb-24 text-foreground lg:pb-0">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <PageHeader
          badge="Floor plan"
          icon={LayoutGridIcon}
          title="Tables"
          subtitle={`Live table status for ${selected?.name ?? "your restaurant"}.`}
          restaurants={restaurants}
          selectedSlug={selectedSlug}
          onSelect={setSelectedSlug}
          accountSlot={accountSlot}
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

        {/* Legend / counts */}
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["available", counts.available],
              ["occupied", counts.occupied],
              ["blocked", counts.blocked],
            ] as [FloorStatus, number][]
          ).map(([status, count]) => (
            <div
              key={status}
              className="flex items-center gap-2.5 rounded-2xl border border-border bg-card p-3"
            >
              <span
                className={`flex size-2.5 shrink-0 rounded-full ${STATUS_STYLES[status].dot}`}
              />
              <div className="flex min-w-0 flex-col">
                <span className="font-heading text-lg font-semibold leading-none tracking-tight">
                  {count}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {STATUS_STYLES[status].label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Floor grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
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
        ) : statuses.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <LayoutGridIcon className="size-8 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <p className="font-medium text-foreground">No tables</p>
              <p className="text-sm text-muted-foreground">
                This restaurant has no active tables yet.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {statuses.map((t) => {
              const status = floorStatusOf(t)
              const style = STATUS_STYLES[status]
              const next = t.bookings[0]
              return (
                <div
                  key={t.id}
                  className={`flex flex-col gap-3 rounded-2xl border p-4 ${style.card}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-background/60">
                      <ArmchairIcon className="size-5 text-foreground" />
                    </span>
                    <span
                      className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium ${style.badge}`}
                    >
                      {style.label}
                    </span>
                  </div>

                  <div className="flex flex-col">
                    <span className="font-heading text-base font-semibold tracking-tight">
                      {t.name}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <UsersIcon className="size-3" />
                      Seats {t.capacity}
                    </span>
                  </div>

                  {next ? (
                    <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-xs">
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <ClockIcon className="size-3 text-muted-foreground" />
                        {next.time}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {next.customer}
                      </span>
                    </div>
                  ) : (
                    <div className="border-t border-border/60 pt-2 text-xs text-muted-foreground">
                      No bookings
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
