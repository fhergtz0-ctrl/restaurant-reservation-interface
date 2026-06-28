"use client"

import * as React from "react"
import { CheckCircle2Icon, StarIcon, XIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ReservationSelectors } from "@/components/reservation-selectors"
import { TimeSlotGrid } from "@/components/time-slot-grid"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  dateOptions,
  getSlots,
  restaurant,
  timePreferences,
  type Slot,
} from "@/lib/reservation-data"

type ReservationFormState = {
  customer_name: string
  customer_phone: string
  customer_email: string
  notes: string
}

type SaveStatus = "idle" | "saving" | "success" | "error"

const initialFormState: ReservationFormState = {
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  notes: "",
}

function SidebarHeaderSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="size-14 rounded-2xl" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3.5 w-52" />
      </div>
    </div>
  )
}

export function ReservationSidebar() {
  const [pageLoading, setPageLoading] = React.useState(true)
  const [slotsLoading, setSlotsLoading] = React.useState(false)

  const [guests, setGuests] = React.useState(2)
  const [date, setDate] = React.useState(dateOptions[0].value)
  const [preference, setPreference] = React.useState(timePreferences[2].value)
  const [selectedTime, setSelectedTime] = React.useState<string | null>(null)
  const [slots, setSlots] = React.useState<Slot[]>([])

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [form, setForm] = React.useState<ReservationFormState>(initialFormState)
  const [status, setStatus] = React.useState<SaveStatus>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [confirmationCode, setConfirmationCode] = React.useState<string | null>(null)

  React.useEffect(() => {
    const timer = setTimeout(() => setPageLoading(false), 900)
    return () => clearTimeout(timer)
  }, [])

  React.useEffect(() => {
    if (pageLoading) return
    setSlotsLoading(true)
    setSelectedTime(null)
    const timer = setTimeout(() => {
      setSlots(getSlots(date, guests, preference))
      setSlotsLoading(false)
    }, 550)
    return () => clearTimeout(timer)
  }, [date, guests, preference, pageLoading])

  const selectedDateLabel = dateOptions.find((d) => d.value === date)?.label

  const resetDialogState = () => {
    setForm(initialFormState)
    setStatus("idle")
    setErrorMessage(null)
    setConfirmationCode(null)
  }

  const handleOpenDialog = () => {
    if (!selectedTime) return
    resetDialogState()
    setDialogOpen(true)
  }

  const handleCloseDialog = () => {
    setDialogOpen(false)
  }

  const handleFormChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!selectedTime) return

    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      setStatus("error")
      setErrorMessage("Name and phone are required.")
      return
    }

    setStatus("saving")
    setErrorMessage(null)

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurant_name: restaurant.name,
          guests,
          reservation_date: date,
          reservation_time: selectedTime,
          customer_name: form.customer_name.trim(),
          customer_phone: form.customer_phone.trim(),
          customer_email: form.customer_email.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(data?.error || "Could not save the reservation.")
      }

      setConfirmationCode(
        data?.reservation?.id?.slice(0, 8)?.toUpperCase() ?? "CONFIRMED",
      )
      setStatus("success")
    } catch (error) {
      setStatus("error")
      setErrorMessage(
        error instanceof Error ? error.message : "Something went wrong.",
      )
    }
  }

  return (
    <aside className="flex h-full w-full flex-col bg-card md:w-[400px] md:shrink-0 md:border-r md:border-border">
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="gap-1.5">
            <CheckCircle2Icon className="size-3.5 text-primary" />
            Instant confirmation
          </Badge>
          <ThemeToggle />
        </div>

        {pageLoading ? (
          <SidebarHeaderSkeleton />
        ) : (
          <div className="flex items-center gap-3">
            <Avatar className="size-14 rounded-2xl ring-1 ring-border">
              <AvatarImage src={restaurant.logo} alt={`${restaurant.name} logo`} />
              <AvatarFallback className="rounded-2xl">ML</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                {restaurant.name}
              </h1>
              <p className="truncate text-sm text-muted-foreground">
                {restaurant.category}
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <StarIcon className="size-3.5 fill-primary text-primary" />
                  4.8
                </span>
                <span aria-hidden>·</span>
                <span>{restaurant.priceRange}</span>
                <span aria-hidden>·</span>
                <span className="truncate">{restaurant.neighborhood}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <Separator />

      <div className="flex-1 overflow-y-auto p-6">
        {pageLoading ? (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-3 gap-2.5">
              <Skeleton className="h-[60px] rounded-lg" />
              <Skeleton className="h-[60px] rounded-lg" />
              <Skeleton className="h-[60px] rounded-lg" />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-11 rounded-xl" />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <ReservationSelectors
              guests={guests}
              date={date}
              preference={preference}
              onGuestsChange={setGuests}
              onDateChange={setDate}
              onPreferenceChange={setPreference}
            />

            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  Available times
                </h2>
                <span className="text-xs text-muted-foreground">
                  {selectedDateLabel}
                </span>
              </div>
              <TimeSlotGrid
                slots={slots}
                selectedTime={selectedTime}
                onSelect={setSelectedTime}
                loading={slotsLoading}
              />
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-border bg-card/95 p-6 backdrop-blur">
        <p className="mb-3 text-center text-xs text-muted-foreground">
          {selectedTime
            ? `${guests === 1 ? "1 guest" : `${guests} guests`} · ${selectedDateLabel} · ${selectedTime}`
            : "Select a time to continue"}
        </p>
        <Button
          size="lg"
          className="h-12 w-full rounded-xl text-base"
          disabled={!selectedTime || pageLoading}
          onClick={handleOpenDialog}
        >
          Continue
        </Button>
      </div>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm md:items-center md:p-6">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card p-6 shadow-2xl md:max-w-md md:rounded-3xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
                  Reservation
                </p>
                <h2 className="mt-1 font-heading text-2xl font-semibold text-foreground">
                  {status === "success" ? "Reservation confirmed" : "Confirm your table"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {restaurant.name} · {guests} {guests === 1 ? "guest" : "guests"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleCloseDialog}>
                <XIcon className="size-4" />
              </Button>
            </div>

            <div className="mb-5 rounded-2xl border border-border bg-muted/40 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium text-foreground">{selectedDateLabel}</span>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium text-foreground">{selectedTime}</span>
              </div>
            </div>

            {status === "success" ? (
              <div className="rounded-2xl border border-primary/25 bg-primary/10 p-5">
                <CheckCircle2Icon className="mb-3 size-8 text-primary" />
                <p className="font-medium text-foreground">
                  Your table is confirmed for {selectedTime}.
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Confirmation code: {confirmationCode}
                </p>
                <Button className="mt-5 w-full" onClick={handleCloseDialog}>
                  Done
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <label className="block text-sm font-medium text-foreground">
                  Customer name
                  <input
                    name="customer_name"
                    value={form.customer_name}
                    onChange={handleFormChange}
                    required
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Luis Fernando"
                  />
                </label>

                <label className="block text-sm font-medium text-foreground">
                  Phone
                  <input
                    name="customer_phone"
                    value={form.customer_phone}
                    onChange={handleFormChange}
                    required
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="+52 624 000 0000"
                  />
                </label>

                <label className="block text-sm font-medium text-foreground">
                  Email <span className="text-muted-foreground">(optional)</span>
                  <input
                    name="customer_email"
                    type="email"
                    value={form.customer_email}
                    onChange={handleFormChange}
                    className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="name@email.com"
                  />
                </label>

                <label className="block text-sm font-medium text-foreground">
                  Notes <span className="text-muted-foreground">(optional)</span>
                  <textarea
                    name="notes"
                    value={form.notes}
                    onChange={handleFormChange}
                    className="mt-2 min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="Allergies, special occasion, preferred area..."
                  />
                </label>

                {errorMessage ? (
                  <p className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                    {errorMessage}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  size="lg"
                  className="h-12 w-full rounded-xl text-base"
                  disabled={status === "saving"}
                >
                  {status === "saving" ? "Confirming..." : "Confirm reservation"}
                </Button>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </aside>
  )
}
