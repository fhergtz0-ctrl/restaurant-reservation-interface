"use client"

import * as React from "react"
import {
  CalendarCheckIcon,
  CalendarIcon,
  ClockIcon,
  PhoneIcon,
  MailIcon,
  UsersIcon,
  Table2Icon,
  StickyNoteIcon,
  SearchIcon,
  CalendarX2Icon,
  AlertCircleIcon,
  RefreshCwIcon,
  ArmchairIcon,
  UserXIcon,
  XIcon,
  RotateCcwIcon,
  type LucideIcon,
} from "lucide-react"

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
import { PageHeader } from "@/components/app-nav/page-header"
import {
  useRestaurantSelector,
  todayValue,
} from "@/hooks/use-restaurant-selector"
import {
  RESERVATION_STATUSES,
  STATUS_META,
  type AdminReservation,
  type ReservationStatus,
} from "@/lib/admin-data"

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

export function ReservationsView() {
  const { selected } = useRestaurantSelector()
  const [date, setDate] = React.useState(todayValue)
  const [statusFilter, setStatusFilter] = React.useState<string>("all")
  const [search, setSearch] = React.useState("")
  const [reservations, setReservations] = React.useState<AdminReservation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [updatingId, setUpdatingId] = React.useState<string | null>(null)

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

  async function updateStatus(id: string, next: ReservationStatus) {
    const previous = reservations
    setUpdatingId(id)
    setReservations((rows) =>
      rows.map((r) => (r.id === id ? { ...r, status: next } : r)),
    )
    try {
      const response = await fetch(`/api/admin/reservations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) throw new Error("Update failed.")
    } catch (err) {
      console.log(
        "[v0] Status update failed:",
        err instanceof Error ? err.message : err,
      )
      setReservations(previous)
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return reservations.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false
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
  }, [reservations, statusFilter, search])

  const totalGuests = filtered.reduce((sum, r) => sum + r.guests, 0)
  const hasActiveFilters = statusFilter !== "all" || search.trim() !== ""

  return (
    <div className="text-foreground">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <PageHeader
          badge="Reservations"
          icon={CalendarCheckIcon}
          title="Reservations"
          subtitle={`Bookings for ${selected?.name ?? "your restaurant"}.`}
        >
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

        {/* Filters */}
        <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, phone, or email"
              className="h-10 pl-9"
              aria-label="Search reservations"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="res-date"
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
              >
                <CalendarIcon className="size-3.5" />
                Date
              </Label>
              <Input
                id="res-date"
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
          </div>
        </section>

        {/* Summary */}
        {!loading && !error && filtered.length > 0 && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">
              {filtered.length}{" "}
              {filtered.length === 1 ? "reservation" : "reservations"}
            </span>
            <Separator orientation="vertical" className="h-4" />
            <span className="flex items-center gap-1.5">
              <UsersIcon className="size-4" />
              {totalGuests} {totalGuests === 1 ? "guest" : "guests"}
            </span>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
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
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <CalendarX2Icon className="size-8 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <p className="font-medium text-foreground">
                No reservations found
              </p>
              <p className="text-sm text-muted-foreground">
                {hasActiveFilters
                  ? "Try adjusting your search or filters."
                  : "Try a different date."}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((r) => (
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

                <div className="flex flex-wrap items-center gap-1.5">
                  {STATUS_ACTIONS.filter((a) => a.status !== r.status).map(
                    (action) => {
                      const Icon = action.icon
                      return (
                        <Button
                          key={action.status}
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={updatingId === r.id}
                          onClick={() => updateStatus(r.id, action.status)}
                          className="gap-1.5"
                        >
                          <Icon className="size-3.5" />
                          {action.label}
                        </Button>
                      )
                    },
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
