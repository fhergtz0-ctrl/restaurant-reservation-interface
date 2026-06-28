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
  getSlotTimes,
  timePreferences,
  type Slot,
} from "@/lib/reservation-data"
import {
  defaultRestaurant,
  restaurantInitials,
  type RestaurantProfile,
} from "@/lib/restaurants"

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

export function ReservationSidebar({
  restaurant = defaultRestaurant,
}: {
  restaurant?: RestaurantProfile
}) {
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

  // Load real availability from the API for the current selection.
  const loadSlots = React.useCallback(async () => {
    setSlotsLoading(true)
    setSelectedTime(null)
    try {
      const params = new URLSearchParams({
        restaurant: restaurant.name,
        restaurantSlug: restaurant.slug,
        date,
        guests: String(guests),
        preference,
      })
      const response = await fetch(`/api/availability?${params.toString()}`)
      const payload = (await response.json()) as { slots?: Slot[] }
      if (!response.ok || !payload.slots) {
        throw new Error("Failed to load availability.")
      }
      setSlots(payload.slots)
    } catch (error) {
      console.log(
        "[v0] Availability fetch error:",
        error instanceof Error ? error.message : error,
      )
      // Fall back to empty availability rather than stale data.
      setSlots(getSlotTimes(preference).map((time) => ({ time, available: false })))
    } finally {
      setSlotsLoading(false)
    }
  }, [date, guests, preference, restaurant.name, restaurant.slug])

  // Refetch availability whenever the selection changes.
  React.useEffect(() => {
    if (pageLoading) return
    void loadSlots()
  }, [loadSlots, pageLoading])

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
              <AvatarFallback className="rounded-2xl">
                {restaurantInitials(restaurant.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                {restaurant.name}
              </h1>
              <p className="truncate text-sm text-muted-foreground">
                {restaurant.description}
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <StarIcon className="size-3.5 fill-primary text-primary" />
                  {restaurant.rating.toFixed(1)}
                </span>
                <span aria-hidden>·</span>
                <span>{restaurant.priceRange}</span>
                <span aria-hidden>·</span>
                <span className="truncate">{restaurant.location}</span>
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
          restaurantSlug={restaurant.slug}
          guests={guests}
          date={date}
          dateLabel={selectedDateLabel ?? date}
          time={selectedTime}
          onReserved={() => {
            void loadSlots()
          }}
        />
      )}
    </aside>
  )
}
