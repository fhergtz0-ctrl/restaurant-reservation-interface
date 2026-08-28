"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  CalendarDaysIcon,
  ClockIcon,
  Loader2Icon,
  TimerIcon,
  UsersIcon,
  CalendarXIcon,
  ArrowLeftIcon,
  UtensilsCrossedIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import type { PublicHold } from "@/lib/booking-holds"

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

/** mm:ss from a positive number of seconds. */
function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const mm = Math.floor(s / 60)
  const ss = s % 60
  return `${mm}:${String(ss).padStart(2, "0")}`
}

/** Whole seconds remaining until an ISO timestamp, never negative. */
function secondsUntil(iso: string): number {
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return 0
  return Math.max(0, Math.round((target - Date.now()) / 1000))
}

export function BookingHoldDetails({
  hold,
  restaurantName,
}: {
  hold: PublicHold
  restaurantName: string
}) {
  const router = useRouter()

  // The countdown is ALWAYS derived from expires_at, so a refresh restores the
  // true remaining time rather than resetting to the full window.
  const [remaining, setRemaining] = React.useState(() =>
    hold.status === "active" ? secondsUntil(hold.expiresAt) : 0,
  )
  const [expiredNow, setExpiredNow] = React.useState(false)

  React.useEffect(() => {
    if (hold.status !== "active") return
    // Immediately reconcile on mount, then tick every second.
    const tick = () => {
      const left = secondsUntil(hold.expiresAt)
      setRemaining(left)
      if (left <= 0) setExpiredNow(true)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [hold.status, hold.expiresAt])

  const isExpired =
    hold.status === "expired" ||
    hold.status === "cancelled" ||
    expiredNow ||
    (hold.status === "active" && remaining <= 0)

  const backToSearch = `/book/${hold.booking.restaurant}?date=${hold.booking.date}&partySize=${hold.booking.partySize}`

  // Cancel the hold and return to search (frees inventory immediately).
  const [cancelling, setCancelling] = React.useState(false)
  const onCancel = React.useCallback(async () => {
    setCancelling(true)
    try {
      await fetch(`/api/book/holds/${hold.holdId}`, { method: "DELETE" })
    } catch (err) {
      console.log(
        "[v0] Hold cancel error:",
        err instanceof Error ? err.message : err,
      )
    } finally {
      router.push(backToSearch)
    }
  }, [hold.holdId, router, backToSearch])

  if (isExpired) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center gap-6 px-4 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted">
          <CalendarXIcon className="size-7 text-muted-foreground" aria-hidden />
        </div>
        <div className="flex flex-col gap-2">
          <h1 className="text-balance font-heading text-2xl font-semibold">
            Your hold expired
          </h1>
          <p className="text-pretty text-sm text-muted-foreground">
            Tables are held for a few minutes so everyone gets a fair chance.
            This one has been released — check availability again to grab a new
            time.
          </p>
        </div>
        <Button
          type="button"
          size="lg"
          className="gap-2"
          onClick={() => router.push(backToSearch)}
        >
          <ArrowLeftIcon className="size-4" aria-hidden />
          Check availability again
        </Button>
      </main>
    )
  }

  const low = remaining <= 60

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-6 px-4 py-8 sm:py-12">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-muted-foreground">
          {restaurantName}
        </p>
        <h1 className="text-balance font-heading text-2xl font-semibold">
          Confirm your details
        </h1>
      </div>

      {/* Countdown banner */}
      <div
        aria-live="polite"
        className={[
          "flex items-center justify-between gap-3 rounded-xl border px-4 py-3",
          low
            ? "border-destructive/40 bg-destructive/10 text-destructive-foreground"
            : "border-primary/30 bg-primary/5 text-foreground",
        ].join(" ")}
      >
        <div className="flex items-center gap-2 text-sm">
          <TimerIcon className="size-4" aria-hidden />
          <span>We&apos;re holding this table for you</span>
        </div>
        <span className="font-mono text-lg font-semibold tabular-nums">
          {formatCountdown(remaining)}
        </span>
      </div>

      {/* Booking summary */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <SummaryRow
          icon={<CalendarDaysIcon className="size-4" aria-hidden />}
          label="Date"
          value={longDate(hold.booking.date)}
        />
        <SummaryRow
          icon={<ClockIcon className="size-4" aria-hidden />}
          label="Time"
          value={hold.booking.time}
        />
        <SummaryRow
          icon={<UsersIcon className="size-4" aria-hidden />}
          label="Party"
          value={`${hold.booking.partySize} ${
            hold.booking.partySize === 1 ? "guest" : "guests"
          }`}
        />
        {hold.booking.service ? (
          <SummaryRow
            icon={<UtensilsCrossedIcon className="size-4" aria-hidden />}
            label="Service"
            value={hold.booking.service}
          />
        ) : null}
      </div>

      {/* Placeholder handoff — guest details form arrives in the next step.
          No reservation is created here. */}
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Next: your details</p>
        <p className="mt-1 text-pretty">
          The guest details form and final confirmation arrive in the next
          step. Your table stays held until the timer runs out.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="gap-2"
          disabled={cancelling}
          onClick={() => void onCancel()}
        >
          {cancelling ? (
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
          ) : (
            <ArrowLeftIcon className="size-4" aria-hidden />
          )}
          Release &amp; change
        </Button>
      </div>
    </main>
  )
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}
