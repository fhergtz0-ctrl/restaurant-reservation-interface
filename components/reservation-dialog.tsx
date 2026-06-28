"use client"

import * as React from "react"
import {
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  Loader2Icon,
  MapPinIcon,
  UsersIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"

type ReservationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurant: string
  guests: number
  date: string
  dateLabel: string
  time: string
}

type Status = "idle" | "submitting" | "success" | "error"

export function ReservationDialog({
  open,
  onOpenChange,
  restaurant,
  guests,
  date,
  dateLabel,
  time,
}: ReservationDialogProps) {
  const [name, setName] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [notes, setNotes] = React.useState("")

  const [status, setStatus] = React.useState<Status>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [confirmationCode, setConfirmationCode] = React.useState<string | null>(
    null,
  )

  // Reset transient state when the dialog closes.
  function handleOpenChange(next: boolean) {
    console.log("[v0] handleOpenChange:", next)
    if (!next) {
      // Delay reset until the close animation completes.
      setTimeout(() => {
        setName("")
        setPhone("")
        setEmail("")
        setNotes("")
        setStatus("idle")
        setErrorMessage(null)
        setConfirmationCode(null)
      }, 200)
    }
    onOpenChange(next)
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    console.log("[v0] handleSubmit fired")
    setStatus("submitting")
    setErrorMessage(null)

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant,
          customerName: name,
          phone,
          email,
          notes,
          guests,
          date,
          time,
        }),
      })

      const payload = (await response.json()) as {
        confirmationCode?: string
        error?: string
      }

      if (!response.ok) {
        throw new Error(payload.error ?? "Something went wrong.")
      }

      setConfirmationCode(payload.confirmationCode ?? null)
      setStatus("success")
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't save your reservation. Please try again.",
      )
      setStatus("error")
    }
  }

  const guestLabel = guests === 1 ? "1 guest" : `${guests} guests`
  const isSubmitting = status === "submitting"

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {status === "success" ? (
          <div className="flex flex-col items-center gap-5 py-2 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2Icon className="size-7 text-primary" />
            </span>
            <DialogHeader className="items-center text-center">
              <DialogTitle>Reservation confirmed</DialogTitle>
              <DialogDescription>
                {"We've saved your table at "}
                {restaurant}. A confirmation has been recorded.
              </DialogDescription>
            </DialogHeader>

            <div className="w-full rounded-xl border border-border bg-muted/40 p-4">
              <p className="text-xs text-muted-foreground">Confirmation code</p>
              <p className="font-heading text-2xl font-semibold tracking-widest text-foreground">
                {confirmationCode}
              </p>
            </div>

            <ReservationSummary
              restaurant={restaurant}
              guestLabel={guestLabel}
              dateLabel={dateLabel}
              time={time}
            />

            <DialogClose
              render={
                <Button className="h-11 w-full rounded-xl" type="button">
                  Done
                </Button>
              }
            />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Complete your reservation</DialogTitle>
              <DialogDescription>
                Enter your details to confirm your table.
              </DialogDescription>
            </DialogHeader>

            <ReservationSummary
              restaurant={restaurant}
              guestLabel={guestLabel}
              dateLabel={dateLabel}
              time={time}
            />

            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="res-name">
                  Name<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="res-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  autoComplete="name"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="res-phone">
                  Phone<span className="text-destructive">*</span>
                </Label>
                <Input
                  id="res-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  autoComplete="tel"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="res-email">Email (optional)</Label>
                <Input
                  id="res-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                  autoComplete="email"
                  disabled={isSubmitting}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="res-notes">Notes (optional)</Label>
                <Textarea
                  id="res-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Allergies, special occasions, seating preferences…"
                  disabled={isSubmitting}
                />
              </div>

              {status === "error" && errorMessage && (
                <p
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {errorMessage}
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                className="h-12 w-full rounded-xl text-base"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Confirm reservation"
                )}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function ReservationSummary({
  restaurant,
  guestLabel,
  dateLabel,
  time,
}: {
  restaurant: string
  guestLabel: string
  dateLabel: string
  time: string
}) {
  return (
    <div className="w-full rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MapPinIcon className="size-4 text-primary" />
        {restaurant}
      </div>
      <Separator className="my-3" />
      <dl className="grid grid-cols-3 gap-2 text-center">
        <SummaryItem icon={<UsersIcon className="size-3.5" />} label="Guests" value={guestLabel} />
        <SummaryItem icon={<CalendarIcon className="size-3.5" />} label="Date" value={dateLabel} />
        <SummaryItem icon={<ClockIcon className="size-3.5" />} label="Time" value={time} />
      </dl>
    </div>
  )
}

function SummaryItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="text-sm font-medium text-balance text-foreground">{value}</dd>
    </div>
  )
}
