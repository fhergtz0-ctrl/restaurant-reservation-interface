"use client"

import { MapPinIcon, MinusIcon, NavigationIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { defaultRestaurant, type RestaurantProfile } from "@/lib/restaurants"

export function RestaurantMap({
  restaurant = defaultRestaurant,
}: {
  restaurant?: RestaurantProfile
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-muted">
      {/* Map imagery (swaps with color scheme) */}
      <img
        src="/map-light.png"
        alt=""
        aria-hidden
        className="absolute inset-0 size-full object-cover dark:hidden"
      />
      <img
        src="/map-dark.png"
        alt=""
        aria-hidden
        className="absolute inset-0 hidden size-full object-cover dark:block"
      />

      {/* Center location pin */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2 rounded-full bg-card/90 px-3 py-1.5 text-sm font-medium text-foreground shadow-lg ring-1 ring-border backdrop-blur">
            <MapPinIcon className="size-4 text-primary" />
            {restaurant.name}
          </div>
          <span className="mt-1 size-2.5 rounded-full bg-primary ring-4 ring-primary/20" />
        </div>
      </div>

      {/* Map controls */}
      <div className="absolute right-4 top-4 flex flex-col gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="Zoom in"
          className="size-9 rounded-full bg-card/90 backdrop-blur"
        >
          <PlusIcon />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Zoom out"
          className="size-9 rounded-full bg-card/90 backdrop-blur"
        >
          <MinusIcon />
        </Button>
        <Button
          variant="outline"
          size="icon"
          aria-label="Recenter map"
          className="size-9 rounded-full bg-card/90 backdrop-blur"
        >
          <NavigationIcon />
        </Button>
      </div>

      {/* Address card */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-2xl bg-card/90 p-4 shadow-lg ring-1 ring-border backdrop-blur md:max-w-sm">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <MapPinIcon className="size-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {restaurant.location}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            127 Prince Street · 0.4 mi away
          </p>
        </div>
      </div>
    </div>
  )
}
