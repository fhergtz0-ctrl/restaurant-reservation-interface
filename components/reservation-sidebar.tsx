"use client"

import * as React from "react"
import { CheckCircle2Icon, StarIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { ReservationSelectors } from "@/components/reservation-selectors"
import { ReservationDialog } from "@/components/reservation-dialog"
import { TimeSlotGrid } from "@/components/time-slot-grid"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  dateOptions,
  getSlots,
  restaurant,
  timePreferences,
  type Slot,
} from "@/lib/reservation-data"

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

  // Initial page load.
  React.useEffect(() => {
    const timer = setTimeout(() => setPageLoading(false), 900)
    return () => clearTimeout(timer)
  }, [])

  // Refetch slots whenever the selection changes.
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

  return (
    <aside className="flex h-full w-full flex-col bg-card md:w-[400px] md:shrink-0 md:border-r md:border-border">
      {/* Header */}
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

      {/* Scrollable body */}
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

      {/* Sticky footer */}
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
          onClick={() => setDialogOpen(true)}
        >
          Continue
        </Button>
      </div>

      {selectedTime && (
        <ReservationDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          restaurant={restaurant.name}
          guests={guests}
          date={date}
          dateLabel={selectedDateLabel ?? date}
          time={selectedTime}
        />
      )}
    </aside>
  )
}
