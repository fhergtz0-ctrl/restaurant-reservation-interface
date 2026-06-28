"use client"

import * as React from "react"
import {
  CalendarIcon,
  CalendarCheckIcon,
  ClockIcon,
  PhoneIcon,
  MailIcon,
  UsersIcon,
  StickyNoteIcon,
  Table2Icon,
  RefreshCwIcon,
  AlertCircleIcon,
  CalendarX2Icon,
  SearchIcon,
  TrendingUpIcon,
  ArmchairIcon,
  UserXIcon,
  XIcon,
  RotateCcwIcon,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ThemeToggle } from "@/components/theme-toggle"
import { getSlotTimes, restaurant, timePreferences } from "@/lib/reservation-data"
import {
  RESERVATION_STATUSES,
  STATUS_META,
  computeKpis,
  computeTableStatuses,
  type AdminReservation,
  type AdminTable,
  type ReservationStatus,
  type TableStatus,
} from "@/lib/admin-data"

const ALL_TIMES: string[] = Array.from(
  new Set(timePreferences.flatMap((p) => getSlotTimes(p.value))),
)

/** Quick-action transitions available on each reservation. */
const STATUS_ACTIONS: {
  status: ReservationStatus
  label: string
  icon: LucideIcon
}[] = [
  { status: "seated", label: "Seat", icon: ArmchairIcon },
  { status: "no_show", label: "No-show", icon: UserXIcon },
  { status: "cancelled", label: "Cancel", icon: XIcon },
  { status: "confirmed", label: "Confirm", icon: RotateCcwIcon },
]

function todayValue(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split("T")[0]
}

function StatusBadge({ status }: { status: ReservationStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${meta.className}`}
    >
      {meta.label}
    </span>
  )
}

function QuickActions({
  status,
  disabled,
  compact,
  onChange,
}: {
  status: ReservationStatus
  disabled: boolean
  compact?: boolean
  onChange: (next: ReservationStatus) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STATUS_ACTIONS.filter((a) => a.status !== status).map((action) => {
        const Icon = action.icon
        return (
          <Button
            key={action.status}
            type="button"
            variant="outline"
            size={compact ? "icon-sm" : "sm"}
            disabled={disabled}
            onClick={() => onChange(action.status)}
            className="gap-1.5"
            aria-label={action.label}
            title={action.label}
          >
            <Icon className="size-3.5" />
            {!compact && action.label}
          </Button>
        )
      })}
    </div>
  )
}

export function AdminDashboard() {
  const [date, setDate] = React.useState(todayValue)
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [timeFilter, setTimeFilter] = React.useState<string>("all")
  const [search, setSearch] = React.useState("")

  const [reservations, setReservations] = React.useState<AdminReservation[]>([])
  const [tables, setTables] = React.useState<AdminTable[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [updatingId, setUpdatingId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch the full day's reservations (date-only); status/time/search
      // are applied client-side so the KPIs reflect the entire day.
      const params = new URLSearchParams({ date })
      const tableParams = new URLSearchParams({ restaurant: restaurant.name })
      const [resResponse, tablesResponse] = await Promise.all([
        fetch(`/api/admin/reservations?${params.toString()}`),
        fetch(`/api/admin/tables?${tableParams.toString()}`),
      ])

      const resPayload = (await resResponse.json()) as {
        reservations?: AdminReservation[]
        error?: string
      }
      if (!resResponse.ok) {
        throw new Error(resPayload.error ?? "Failed to load reservations.")
      }
      setReservations(resPayload.reservations ?? [])

      // Tables are non-critical: degrade gracefully if they fail.
      const tablesPayload = (await tablesResponse.json()) as {
        tables?: AdminTable[]
      }
      setTables(tablesResponse.ok ? (tablesPayload.tables ?? []) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setReservations([])
      setTables([])
    } finally {
      setLoading(false)
    }
  }, [date])

  React.useEffect(() => {
    void load()
  }, [load])

  async function updateStatus(id: string, next: ReservationStatus) {
    const previous = reservations
    setUpdatingId(id)
    // Optimistic update.
    setReservations((rows) =>
      rows.map((r) => (r.id === id ? { ...r, status: next } : r)),
    )
    try {
      const response = await fetch(`/api/admin/reservations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        throw new Error("Update failed.")
      }
    } catch (err) {
      console.log(
        "[v0] Status update failed:",
        err instanceof Error ? err.message : err,
      )
      setReservations(previous) // Roll back.
    } finally {
      setUpdatingId(null)
    }
  }

  const kpis = React.useMemo(
    () => computeKpis(reservations, tables.length),
    [reservations, tables.length],
  )

  const tableStatuses = React.useMemo(
    () => computeTableStatuses(tables, reservations),
    [tables, reservations],
  )

  const filteredReservations = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return reservations.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      if (timeFilter !== "all" && r.reservation_time !== timeFilter) return false
      if (q) {
        const haystack = [
          r.customer_name,
          r.customer_phone,
          r.customer_email ?? "",
        ]
          .join(" ")
          .toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [reservations, statusFilter, timeFilter, search])

  const totalGuests = filteredReservations.reduce((sum, r) => sum + r.guests, 0)
  const hasActiveFilters =
    statusFilter !== "all" || timeFilter !== "all" || search.trim() !== ""

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <Badge variant="secondary" className="w-fit gap-1.5">
              <Table2Icon className="size-3.5 text-primary" />
              Admin
            </Badge>
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              Reservations
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage bookings for {restaurant.name}.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCwIcon
                className={`size-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <ThemeToggle />
          </div>
        </header>

        {/* KPI cards */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            icon={CalendarCheckIcon}
            label="Reservations Today"
            value={loading ? null : String(kpis.reservationCount)}
          />
          <KpiCard
            icon={UsersIcon}
            label="Total Guests"
            value={loading ? null : String(kpis.totalGuests)}
            hint="Confirmed & seated"
          />
          <KpiCard
            icon={Table2Icon}
            label="Occupied Tables"
            value={
              loading ? null : `${kpis.occupiedTables}/${kpis.activeTables}`
            }
          />
          <KpiCard
            icon={TrendingUpIcon}
            label="Peak Hour"
            value={loading ? null : (kpis.busiestTime ?? "—")}
          />
        </section>

        {/* Table status */}
        <TableStatusSection tables={tableStatuses} loading={loading} />

        {/* Filters */}
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="filter-search"
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            >
              <SearchIcon className="size-3.5" />
              Search guest
            </Label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="filter-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, phone, or email"
                className="h-10 pl-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="filter-date"
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
              >
                <CalendarIcon className="size-3.5" />
                Date
              </Label>
              <Input
                id="filter-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <AlertCircleIcon className="size-3.5" />
                Status
              </span>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v ?? "all")}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue>
                    {(value) =>
                      value === "all"
                        ? "All statuses"
                        : (STATUS_META[value as ReservationStatus]?.label ??
                          value)
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All statuses</SelectItem>
                    {RESERVATION_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_META[s].label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <ClockIcon className="size-3.5" />
                Time
              </span>
              <Select
                value={timeFilter}
                onValueChange={(v) => setTimeFilter(v ?? "all")}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue>
                    {(value) => (value === "all" ? "All times" : value)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="all">All times</SelectItem>
                    {ALL_TIMES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* Summary */}
        {!loading && !error && filteredReservations.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {filteredReservations.length}{" "}
              {filteredReservations.length === 1
                ? "reservation"
                : "reservations"}
            </span>
            <Separator orientation="vertical" className="h-4" />
            <span className="flex items-center gap-1.5">
              <UsersIcon className="size-4" />
              {totalGuests} {totalGuests === 1 ? "guest" : "guests"}
            </span>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : filteredReservations.length === 0 ? (
          <EmptyState filtered={hasActiveFilters} />
        ) : (
          <ReservationList
            reservations={filteredReservations}
            updatingId={updatingId}
            onStatusChange={updateStatus}
          />
        )}
      </div>
    </main>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon
  label: string
  value: string | null
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-4 text-primary" />
        </span>
      </div>
      {value === null ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <span className="font-heading text-2xl font-semibold tracking-tight">
          {value}
        </span>
      )}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

function TableStatusSection({
  tables,
  loading,
}: {
  tables: TableStatus[]
  loading: boolean
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Table2Icon className="size-4 text-primary" />
        <h2 className="font-heading text-lg font-semibold tracking-tight">
          Table status
        </h2>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : tables.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center text-sm text-muted-foreground">
          No active tables found.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {tables.map((t) => (
            <div
              key={t.id}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{t.name}</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UsersIcon className="size-3" />
                    Seats {t.capacity}
                  </span>
                </div>
                <span
                  className={`inline-flex h-6 shrink-0 items-center rounded-full px-2.5 text-xs font-medium ${
                    t.occupied
                      ? "bg-amber-500/15 text-amber-600 ring-1 ring-inset ring-amber-500/30 dark:text-amber-400"
                      : "bg-emerald-500/15 text-emerald-500 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400"
                  }`}
                >
                  {t.occupied ? "Occupied" : "Available"}
                </span>
              </div>

              {t.occupied && (
                <div className="flex flex-col gap-1 border-t border-border pt-2">
                  {t.bookings.map((b, i) => (
                    <div
                      key={`${t.id}-${i}`}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <ClockIcon className="size-3 text-muted-foreground" />
                        {b.time}
                      </span>
                      <span className="truncate text-muted-foreground">
                        {b.customer}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function ReservationList({
  reservations,
  updatingId,
  onStatusChange,
}: {
  reservations: AdminReservation[]
  updatingId: string | null
  onStatusChange: (id: string, next: ReservationStatus) => void
}) {
  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-border bg-card lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Guest</th>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Party</th>
              <th className="px-4 py-3 font-medium">Table</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border last:border-0 align-top transition-colors hover:bg-muted/40"
              >
                <td className="px-4 py-3 font-medium whitespace-nowrap">
                  {r.reservation_time}
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-foreground">
                    {r.customer_name}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <PhoneIcon className="size-3.5" />
                      {r.customer_phone}
                    </span>
                    {r.customer_email && (
                      <span className="flex items-center gap-1.5">
                        <MailIcon className="size-3.5" />
                        {r.customer_email}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {r.guests} {r.guests === 1 ? "guest" : "guests"}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {r.table_name ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3">
                  <QuickActions
                    status={r.status}
                    disabled={updatingId === r.id}
                    compact
                    onChange={(next) => onStatusChange(r.id, next)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 lg:hidden">
        {reservations.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <span className="flex items-center gap-1.5 text-base font-semibold">
                  <ClockIcon className="size-4 text-primary" />
                  {r.reservation_time}
                </span>
                <span className="font-medium text-foreground">
                  {r.customer_name}
                </span>
              </div>
              <StatusBadge status={r.status} />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <UsersIcon className="size-3.5" />
                {r.guests} {r.guests === 1 ? "guest" : "guests"}
              </span>
              <span className="flex items-center gap-1.5">
                <Table2Icon className="size-3.5" />
                {r.table_name ?? "No table"}
              </span>
              <span className="flex items-center gap-1.5">
                <PhoneIcon className="size-3.5" />
                {r.customer_phone}
              </span>
              {r.customer_email && (
                <span className="flex items-center gap-1.5 truncate">
                  <MailIcon className="size-3.5 shrink-0" />
                  <span className="truncate">{r.customer_email}</span>
                </span>
              )}
            </div>

            {r.notes && (
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <StickyNoteIcon className="size-3.5 shrink-0 translate-y-0.5" />
                {r.notes}
              </p>
            )}

            <Separator />

            <QuickActions
              status={r.status}
              disabled={updatingId === r.id}
              onChange={(next) => onStatusChange(r.id, next)}
            />
          </div>
        ))}
      </div>
    </>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-2xl" />
      ))}
    </div>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <CalendarX2Icon className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">No reservations found</p>
        <p className="text-sm text-muted-foreground">
          {filtered
            ? "Try adjusting your search or filters."
            : "Try a different date."}
        </p>
      </div>
    </div>
  )
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
      <AlertCircleIcon className="size-8 text-destructive" />
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">
          Couldn&apos;t load reservations
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
        <RefreshCwIcon className="size-4" />
        Try again
      </Button>
    </div>
  )
}
