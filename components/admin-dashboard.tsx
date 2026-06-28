"use client"

import * as React from "react"
import {
  CalendarIcon,
  ClockIcon,
  PhoneIcon,
  MailIcon,
  UsersIcon,
  StickyNoteIcon,
  Table2Icon,
  RefreshCwIcon,
  AlertCircleIcon,
  CalendarX2Icon,
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
import { getSlotTimes, timePreferences } from "@/lib/reservation-data"
import {
  RESERVATION_STATUSES,
  STATUS_META,
  type AdminReservation,
  type ReservationStatus,
} from "@/lib/admin-data"

const ALL_TIMES: string[] = Array.from(
  new Set(timePreferences.flatMap((p) => getSlotTimes(p.value))),
)

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

function StatusSelect({
  value,
  disabled,
  onChange,
}: {
  value: ReservationStatus
  disabled: boolean
  onChange: (next: ReservationStatus) => void
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as ReservationStatus)}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className="h-8 w-[136px]">
        <SelectValue>
          {(v) => STATUS_META[v as ReservationStatus]?.label ?? v}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {RESERVATION_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_META[s].label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

export function AdminDashboard() {
  const [date, setDate] = React.useState(todayValue)
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [timeFilter, setTimeFilter] = React.useState<string>("all")

  const [reservations, setReservations] = React.useState<AdminReservation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [updatingId, setUpdatingId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        date,
        status: statusFilter,
        time: timeFilter,
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
  }, [date, statusFilter, timeFilter])

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

  const totalGuests = reservations.reduce((sum, r) => sum + r.guests, 0)

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
              Manage bookings for Maison Laurent.
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

        {/* Filters */}
        <section className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
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
                      : (STATUS_META[value as ReservationStatus]?.label ?? value)
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
        </section>

        {/* Summary */}
        {!loading && !error && reservations.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {reservations.length}{" "}
              {reservations.length === 1 ? "reservation" : "reservations"}
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
        ) : reservations.length === 0 ? (
          <EmptyState />
        ) : (
          <ReservationList
            reservations={reservations}
            updatingId={updatingId}
            onStatusChange={updateStatus}
          />
        )}
      </div>
    </main>
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
              <th className="px-4 py-3 font-medium">Notes</th>
              <th className="px-4 py-3 font-medium">Status</th>
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
                  {r.notes ? (
                    <span className="line-clamp-2 max-w-[200px] text-xs text-muted-foreground">
                      {r.notes}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusSelect
                    value={r.status}
                    disabled={updatingId === r.id}
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

            <StatusSelect
              value={r.status}
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

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <CalendarX2Icon className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">No reservations found</p>
        <p className="text-sm text-muted-foreground">
          Try a different date or adjust your filters.
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
        <p className="font-medium text-foreground">Couldn&apos;t load reservations</p>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
        <RefreshCwIcon className="size-4" />
        Try again
      </Button>
    </div>
  )
}
