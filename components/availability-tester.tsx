"use client"

import * as React from "react"
import {
  CalendarSearchIcon,
  Loader2Icon,
  UsersIcon,
  ClockIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ArmchairIcon,
  CombineIcon,
  MapPinIcon,
  TriangleAlertIcon,
  CalendarDaysIcon,
  StarIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/app-nav/page-header"
import { useRestaurantSelector, todayValue } from "@/hooks/use-restaurant-selector"
import { useToast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  REASON_LABELS,
  type AllocationOption,
  type AvailabilityResult,
  type ServicePeriodAvailability,
  type SlotAvailability,
  type UnavailableReason,
} from "@/lib/availability-engine"
import { formatTime } from "@/lib/schedule"

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const SOURCE_META: Record<
  AvailabilityResult["source"],
  { label: string; icon: typeof CalendarDaysIcon }
> = {
  weekly_schedule: { label: "Weekly Schedule", icon: CalendarDaysIcon },
  special_day: { label: "Special Day", icon: StarIcon },
  none: { label: "No service", icon: XCircleIcon },
}

function reasonLabel(reason: UnavailableReason | undefined): string {
  return reason ? REASON_LABELS[reason] : "Unavailable"
}

/** One allocation, e.g. "Table 1 + Table 2 · 4 seats · Main Dining". */
function allocationText(opt: AllocationOption): string {
  const tables = opt.tableNames.join(" + ")
  const seats = `${opt.capacity} ${opt.capacity === 1 ? "seat" : "seats"}`
  const zone = opt.zone ?? "No zone"
  return `${tables} · ${seats} · ${zone}`
}

/* ------------------------------------------------------------------ */
/* Slot row                                                            */
/* ------------------------------------------------------------------ */

function SlotRow({ slot }: { slot: SlotAvailability }) {
  const best = slot.options[0]
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        slot.available
          ? "border-border bg-card"
          : "border-border/60 bg-muted/30",
        slot.requested && "ring-2 ring-primary/50",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm font-semibold tabular-nums">
          {slot.time}
        </span>
        {slot.requested && (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            Requested
          </Badge>
        )}
      </div>

      {slot.available && best ? (
        <div className="flex items-center gap-2 text-sm">
          {best.type === "combination" ? (
            <CombineIcon className="size-4 shrink-0 text-primary" aria-hidden />
          ) : (
            <ArmchairIcon className="size-4 shrink-0 text-primary" aria-hidden />
          )}
          <span className="text-foreground">{allocationText(best)}</span>
          {best.zones.length > 1 && (
            <span title="Spans multiple zones">
              <TriangleAlertIcon
                className="size-3.5 text-amber-500"
                aria-label="Spans multiple zones"
              />
            </span>
          )}
          {slot.options.length > 1 && (
            <span className="text-xs text-muted-foreground">
              +{slot.options.length - 1} more
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <XCircleIcon className="size-4 shrink-0" aria-hidden />
          <span>{reasonLabel(slot.reason)}</span>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Service period block                                                */
/* ------------------------------------------------------------------ */

function PeriodBlock({ period }: { period: ServicePeriodAvailability }) {
  const availableCount = period.slots.filter((s) => s.available).length
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-heading text-lg font-semibold">{period.name}</h3>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3" aria-hidden />
              {formatTime(period.startTime)} – {formatTime(period.endTime)}
            </span>
            {period.overnight && (
              <Badge variant="secondary" className="text-[10px]">
                Overnight
              </Badge>
            )}
            <span>· Party {period.minPartySize}–{period.maxPartySize}</span>
            <span>· Every {period.bookingIntervalMinutes} min</span>
            <span>· {period.defaultDurationMinutes} min stay</span>
          </p>
        </div>
        {period.eligible ? (
          <Badge
            variant="secondary"
            className={cn(
              "gap-1",
              availableCount > 0
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground",
            )}
          >
            {availableCount} / {period.slots.length} open
          </Badge>
        ) : (
          <Badge
            variant="secondary"
            className="gap-1 bg-amber-500/15 text-amber-600 dark:text-amber-400"
          >
            <TriangleAlertIcon className="size-3" aria-hidden />
            {reasonLabel(period.reason)}
          </Badge>
        )}
      </div>

      {period.eligible && period.slots.length > 0 && (
        <div className="grid gap-2">
          {period.slots.map((slot) => (
            <SlotRow key={slot.minutes} slot={slot} />
          ))}
        </div>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

function Results({
  result,
  configured,
}: {
  result: AvailabilityResult
  configured: boolean
}) {
  const source = SOURCE_META[result.source]
  const SourceIcon = source.icon

  return (
    <div className="flex flex-col gap-5">
      {!configured && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
          Supabase isn&apos;t configured, so this is an empty preview. Connect a
          database to compute live availability.
        </div>
      )}

      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="gap-1.5">
          <SourceIcon className="size-3.5 text-primary" aria-hidden />
          {source.label}
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <CalendarDaysIcon className="size-3.5" aria-hidden />
          {result.date}
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <UsersIcon className="size-3.5" aria-hidden />
          Party of {result.partySize}
        </Badge>
        {result.requestedTime && (
          <Badge variant="secondary" className="gap-1.5">
            <ClockIcon className="size-3.5" aria-hidden />
            {formatTime(result.requestedTime)}
          </Badge>
        )}
      </div>

      {result.specialDay && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <StarIcon className="size-4 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="font-medium">{result.specialDay.name}</span> is
            overriding the weekly schedule for this date
            {result.specialDay.isOpen ? "." : " (marked closed)."}
          </span>
        </div>
      )}

      {result.requestedTimeReason && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
          The requested time falls outside every service window on this date.
        </div>
      )}

      {/* Closed / no periods */}
      {(!result.open || result.servicePeriods.length === 0) && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-12 text-center">
          <XCircleIcon className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-heading text-lg font-semibold">Not available</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {result.reason === "restaurant_closed"
              ? "The restaurant is closed on this date — no service periods apply."
              : reasonLabel(result.reason)}
          </p>
        </div>
      )}

      {/* Service periods */}
      {result.open &&
        result.servicePeriods.map((period) => (
          <PeriodBlock key={period.id ?? period.name} period={period} />
        ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main view                                                           */
/* ------------------------------------------------------------------ */

export function AvailabilityTester() {
  const { selected } = useRestaurantSelector()
  const slug = selected?.slug ?? null
  const restaurantId = selected?.id ?? null
  const restaurantName = selected?.name ?? null
  const { error: toastError } = useToast()

  const [date, setDate] = React.useState(todayValue)
  const [partySize, setPartySize] = React.useState("2")
  const [time, setTime] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<AvailabilityResult | null>(null)
  const [configured, setConfigured] = React.useState(true)

  const check = React.useCallback(async () => {
    const size = Number(partySize)
    if (!Number.isInteger(size) || size < 1) {
      toastError("Enter a party size of 1 or more.")
      return
    }
    if (!date) {
      toastError("Pick a date to check.")
      return
    }
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (slug) params.set("restaurant", slug)
      if (restaurantId) params.set("restaurantId", restaurantId)
      if (restaurantName) params.set("name", restaurantName)
      params.set("date", date)
      params.set("partySize", String(size))
      if (time) params.set("time", time)

      const res = await fetch(`/api/admin/availability?${params.toString()}`)
      const payload = (await res.json()) as {
        result?: AvailabilityResult
        configured?: boolean
        error?: string
      }
      if (!res.ok) {
        toastError(payload.error ?? "We couldn't compute availability.")
        return
      }
      setResult(payload.result ?? null)
      setConfigured(payload.configured !== false)
    } catch (err) {
      console.log(
        "[v0] Availability check error:",
        err instanceof Error ? err.message : err,
      )
      toastError("We couldn't compute availability. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [date, partySize, time, slug, restaurantId, restaurantName, toastError])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        badge="Availability Planning"
        icon={CalendarSearchIcon}
        title="Availability Check"
        subtitle="Internal engine tester — evaluates the live Schedule, Special Days, Zones, Tables, Combinations, and Reservations. This is not the public booking flow."
      />

      {/* Query form */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void check()
        }}
        className="grid gap-4 rounded-xl border border-border bg-card/50 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="av-date">Date</Label>
          <Input
            id="av-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="av-party">Party size</Label>
          <Input
            id="av-party"
            type="number"
            min={1}
            inputMode="numeric"
            value={partySize}
            onChange={(e) => setPartySize(e.target.value)}
            className="sm:w-28"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="av-time">Time (optional)</Label>
          <Input
            id="av-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="sm:w-36"
          />
        </div>
        <Button type="submit" disabled={loading} className="gap-2">
          {loading ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          ) : (
            <CalendarSearchIcon className="size-4" aria-hidden />
          )}
          Check availability
        </Button>
      </form>

      {/* Results / empty state */}
      {loading && !result ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
          Computing availability…
        </div>
      ) : result ? (
        <>
          <Separator />
          <Results result={result} configured={configured} />
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
          <CheckCircle2Icon className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-heading text-lg font-semibold">
            Check availability
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Pick a date and party size, then run the engine to see which tables
            and combinations can seat the party.
          </p>
        </div>
      )}
    </div>
  )
}
