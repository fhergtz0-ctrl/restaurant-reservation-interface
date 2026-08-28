"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CalendarDaysIcon,
  ClockIcon,
  Loader2Icon,
  MapPinIcon,
  MinusIcon,
  PlusIcon,
  SearchIcon,
  UsersIcon,
  CheckIcon,
  UtensilsCrossedIcon,
  CalendarXIcon,
  ArrowRightIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { restaurantInitials, type RestaurantProfile } from "@/lib/restaurants"
import type {
  PublicAvailability,
  PublicService,
} from "@/lib/public-availability"

/* ------------------------------------------------------------------ */
/* Constants (UI-only policy — never passed to the engine)             */
/* ------------------------------------------------------------------ */

const MIN_PARTY = 1
const MAX_PARTY = 20
const QUICK_SIZES = [1, 2, 3, 4, 5, 6, 7, 8]

/** Local, timezone-safe "today" as YYYY-MM-DD. */
function todayValue(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().split("T")[0]
}

/** A friendly long date label, e.g. "Saturday, August 30". */
function longDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number)
  if (!y || !m || !d) return value
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

/* ------------------------------------------------------------------ */
/* Selected booking intent (handed to Phase 13B)                       */
/* ------------------------------------------------------------------ */

export type BookingIntent = {
  restaurant: string
  date: string
  partySize: number
  time: string
  time24: string
  service: string | null
}

/* ------------------------------------------------------------------ */
/* Restaurant header                                                   */
/* ------------------------------------------------------------------ */

function RestaurantHeader({ restaurant }: { restaurant: RestaurantProfile }) {
  const [logoOk, setLogoOk] = React.useState(true)
  const initials = restaurantInitials(restaurant.name)

  return (
    <header className="flex items-center gap-4">
      <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent text-accent-foreground">
        {logoOk && restaurant.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.logo || "/placeholder.svg"}
            alt=""
            className="size-full object-cover"
            onError={() => setLogoOk(false)}
          />
        ) : (
          <span className="font-heading text-lg font-semibold">{initials}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h1 className="text-pretty font-heading text-xl font-semibold leading-tight sm:text-2xl">
          {restaurant.name}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted-foreground">
          {restaurant.description && (
            <span className="truncate">{restaurant.description}</span>
          )}
          {restaurant.location && (
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
              {restaurant.location}
            </span>
          )}
        </div>
      </div>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* Party size control                                                  */
/* ------------------------------------------------------------------ */

function PartySizeControl({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  const clamp = (n: number) => Math.min(MAX_PARTY, Math.max(MIN_PARTY, n))
  return (
    <div className="flex flex-col gap-2">
      <span id="party-label" className="text-sm font-medium">
        Party size
      </span>
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-labelledby="party-label"
      >
        {QUICK_SIZES.map((n) => {
          const active = value === n
          return (
            <button
              key={n}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(n)}
              className={cn(
                "flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-sm font-medium tabular-nums transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:bg-accent",
              )}
            >
              {n}
            </button>
          )
        })}
      </div>
      {/* Stepper for larger parties (up to MAX_PARTY). */}
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center rounded-lg border border-border bg-card">
          <button
            type="button"
            aria-label="Decrease party size"
            onClick={() => onChange(clamp(value - 1))}
            disabled={value <= MIN_PARTY}
            className="flex size-10 items-center justify-center rounded-l-lg text-foreground transition-colors hover:bg-accent disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MinusIcon className="size-4" aria-hidden />
          </button>
          <span
            className="flex min-w-12 items-center justify-center px-2 text-sm font-semibold tabular-nums"
            aria-live="polite"
          >
            {value}
          </span>
          <button
            type="button"
            aria-label="Increase party size"
            onClick={() => onChange(clamp(value + 1))}
            disabled={value >= MAX_PARTY}
            className="flex size-10 items-center justify-center rounded-r-lg text-foreground transition-colors hover:bg-accent disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PlusIcon className="size-4" aria-hidden />
          </button>
        </div>
        <span className="text-sm text-muted-foreground">
          {value} {value === 1 ? "guest" : "guests"}
          {value >= MAX_PARTY && " (max)"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        For parties larger than {MAX_PARTY}, please contact the restaurant
        directly.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Service + time chips                                                */
/* ------------------------------------------------------------------ */

function ServiceBlock({
  service,
  showServiceName,
  selectedTime24,
  onSelect,
}: {
  service: PublicService
  showServiceName: boolean
  selectedTime24: string | null
  onSelect: (svc: PublicService, time: PublicService["times"][number]) => void
}) {
  const bookable = service.times.filter((t) => t.available)
  if (bookable.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      {showServiceName && (
        <div className="flex items-center gap-2">
          <UtensilsCrossedIcon
            className="size-4 text-muted-foreground"
            aria-hidden
          />
          <h2 className="font-heading text-base font-semibold">
            {service.name}
          </h2>
        </div>
      )}
      <div
        className="grid grid-cols-3 gap-2 sm:grid-cols-4"
        role="group"
        aria-label={`${service.name} available times`}
      >
        {bookable.map((t) => {
          const active = selectedTime24 === t.time24
          return (
            <button
              key={t.time24}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(service, t)}
              className={cn(
                "flex h-12 items-center justify-center gap-1.5 rounded-lg border text-sm font-semibold tabular-nums transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground hover:border-primary/50 hover:bg-accent",
              )}
            >
              {active && <CheckIcon className="size-3.5" aria-hidden />}
              {t.time}
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

function ResultsPanel({
  data,
  selectedTime24,
  onSelect,
}: {
  data: PublicAvailability
  selectedTime24: string | null
  onSelect: (svc: PublicService, time: PublicService["times"][number]) => void
}) {
  const bookableServices = data.services.filter((s) =>
    s.times.some((t) => t.available),
  )

  if (data.status === "available" && bookableServices.length > 0) {
    const showServiceNames = bookableServices.length > 1
    return (
      <div className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          Available times for{" "}
          <span className="font-medium text-foreground">
            {data.partySize} {data.partySize === 1 ? "guest" : "guests"}
          </span>{" "}
          on{" "}
          <span className="font-medium text-foreground">
            {longDate(data.date)}
          </span>
        </p>
        {bookableServices.map((service) => (
          <ServiceBlock
            key={service.name}
            service={service}
            showServiceName={showServiceNames}
            selectedTime24={selectedTime24}
            onSelect={onSelect}
          />
        ))}
      </div>
    )
  }

  // Closed / no availability / temporarily unavailable — friendly copy only.
  const Icon = data.status === "closed" ? CalendarXIcon : CalendarDaysIcon
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-14 text-center">
      <Icon className="size-8 text-muted-foreground" aria-hidden />
      <p className="font-heading text-lg font-semibold">
        {data.status === "closed" ? "Closed on this date" : "No times available"}
      </p>
      <p className="max-w-xs text-pretty text-sm text-muted-foreground">
        {data.message ?? "Please try a different date or party size."}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main                                                                */
/* ------------------------------------------------------------------ */

export function BookingSearch({
  restaurant,
  initialDate,
  initialPartySize,
  autoSearch,
}: {
  restaurant: RestaurantProfile
  initialDate: string
  initialPartySize: number
  autoSearch: boolean
}) {
  const today = React.useMemo(() => todayValue(), [])
  const [date, setDate] = React.useState(
    initialDate && initialDate >= today ? initialDate : today,
  )
  const [partySize, setPartySize] = React.useState(
    Math.min(MAX_PARTY, Math.max(MIN_PARTY, initialPartySize || 2)),
  )
  const [preferredTime, setPreferredTime] = React.useState("")

  const [loading, setLoading] = React.useState(false)
  const [data, setData] = React.useState<PublicAvailability | null>(null)
  const [errored, setErrored] = React.useState(false)
  const [selected, setSelected] = React.useState<BookingIntent | null>(null)
  const [holding, setHolding] = React.useState(false)
  const [holdError, setHoldError] = React.useState<string | null>(null)

  const router = useRouter()
  const resultsRef = React.useRef<HTMLDivElement | null>(null)

  /** Keep the URL shareable: /book/<slug>?date=&partySize=(&time=). */
  const syncUrl = React.useCallback(
    (d: string, p: number, time24?: string | null) => {
      if (typeof window === "undefined") return
      const params = new URLSearchParams()
      params.set("date", d)
      params.set("partySize", String(p))
      if (time24) params.set("time", time24)
      window.history.replaceState(
        null,
        "",
        `/book/${restaurant.slug}?${params.toString()}`,
      )
    },
    [restaurant.slug],
  )

  const runSearch = React.useCallback(
    async (d: string, p: number) => {
      setLoading(true)
      setErrored(false)
      setSelected(null)
      setHoldError(null)
      syncUrl(d, p)
      try {
        const params = new URLSearchParams({
          restaurant: restaurant.slug,
          date: d,
          partySize: String(p),
        })
        const res = await fetch(`/api/book/availability?${params.toString()}`)
        const payload = (await res.json()) as PublicAvailability & {
          error?: string
        }
        if (!res.ok) {
          // Validation (400) etc. — treat as a soft, guest-safe error.
          setData(null)
          setErrored(true)
          return
        }
        setData(payload)
      } catch (err) {
        console.log(
          "[v0] Booking search error:",
          err instanceof Error ? err.message : err,
        )
        setData(null)
        setErrored(true)
      } finally {
        setLoading(false)
      }
    },
    [restaurant.slug, syncUrl],
  )

  // Auto-search when arriving from a shared link with query params.
  React.useEffect(() => {
    if (autoSearch) void runSearch(date, partySize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll results into view after a successful, non-auto search.
  React.useEffect(() => {
    if (data && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [data])

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void runSearch(date, partySize)
  }

  const onSelectTime = (
    svc: PublicService,
    t: PublicService["times"][number],
  ) => {
    const intent: BookingIntent = {
      restaurant: restaurant.slug,
      date,
      partySize,
      time: t.time,
      time24: t.time24,
      service: svc.name,
    }
    setSelected(intent)
    setHoldError(null)
    syncUrl(date, partySize, t.time24)
  }

  // Continue -> create a temporary hold, then hand off to the details step.
  // The hold is what actually reserves inventory for the guest; no reservation
  // is created here. A 409 means someone else took the slot first.
  const createHold = React.useCallback(async () => {
    if (!selected) return
    setHolding(true)
    setHoldError(null)
    try {
      const res = await fetch("/api/book/holds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          restaurant: selected.restaurant,
          date: selected.date,
          partySize: selected.partySize,
          time: selected.time24,
          service: selected.service ?? undefined,
        }),
      })
      const payload = (await res.json()) as {
        holdId?: string
        status?: string
      }

      if (res.status === 409 || payload.status === "conflict") {
        setHoldError(
          "That time was just taken. Please pick another available time.",
        )
        // Refresh availability so the taken slot disappears.
        void runSearch(selected.date, selected.partySize)
        return
      }
      if (!res.ok || !payload.holdId) {
        setHoldError(
          "We couldn't hold that table right now. Please try again in a moment.",
        )
        return
      }

      router.push(
        `/book/${selected.restaurant}/details?hold=${payload.holdId}`,
      )
    } catch (err) {
      console.log(
        "[v0] Hold creation error:",
        err instanceof Error ? err.message : err,
      )
      setHoldError(
        "We couldn't hold that table right now. Please try again in a moment.",
      )
    } finally {
      setHolding(false)
    }
  }, [selected, router, runSearch])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-4 py-8 pb-28 sm:px-6 sm:py-12">
      <RestaurantHeader restaurant={restaurant} />

      {/* Search form */}
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4 sm:p-6"
      >
        <PartySizeControl value={partySize} onChange={setPartySize} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="book-date">Date</Label>
            <div className="relative">
              <CalendarDaysIcon
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="book-date"
                type="date"
                min={today}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="book-time">Preferred time (optional)</Label>
            <div className="relative">
              <ClockIcon
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="book-time"
                type="time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <Button type="submit" size="lg" disabled={loading} className="gap-2">
          {loading ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          ) : (
            <SearchIcon className="size-4" aria-hidden />
          )}
          Find a table
        </Button>
      </form>

      {/* Results */}
      <div ref={resultsRef} className="flex flex-col gap-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Searching for tables…
          </div>
        ) : errored ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-14 text-center">
            <CalendarDaysIcon
              className="size-8 text-muted-foreground"
              aria-hidden
            />
            <p className="font-heading text-lg font-semibold">
              Availability is temporarily unavailable
            </p>
            <p className="max-w-xs text-pretty text-sm text-muted-foreground">
              We couldn&apos;t load times right now. Please try again in a
              moment.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => void runSearch(date, partySize)}
            >
              Try again
            </Button>
          </div>
        ) : data ? (
          <ResultsPanel
            data={data}
            selectedTime24={selected?.time24 ?? null}
            onSelect={onSelectTime}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <p className="text-pretty text-sm text-muted-foreground">
              Choose your party size and date, then find an available table.
            </p>
          </div>
        )}
      </div>

      {/* Sticky selection / Continue CTA */}
      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">
                {selected.time}
                {selected.service ? ` · ${selected.service}` : ""}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {longDate(selected.date)} · {selected.partySize}{" "}
                {selected.partySize === 1 ? "guest" : "guests"}
              </span>
            </div>
            <Button
              type="button"
              size="lg"
              className="gap-2"
              disabled={holding}
              onClick={() => void createHold()}
            >
              {holding ? (
                <Loader2Icon className="size-4 animate-spin" aria-hidden />
              ) : null}
              {holding ? "Holding…" : "Continue"}
              {!holding && <ArrowRightIcon className="size-4" aria-hidden />}
            </Button>
          </div>
        </div>
      )}

      {/* Inline hold error (e.g. the slot was taken during selection). */}
      {holdError && selected && (
        <div
          role="alert"
          className="fixed inset-x-0 bottom-16 z-20 mx-auto w-full max-w-2xl px-4 sm:px-6"
        >
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive-foreground">
            {holdError}
          </div>
        </div>
      )}
    </main>
  )
}
