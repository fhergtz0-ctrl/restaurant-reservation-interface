import type { Metadata } from "next"
import Link from "next/link"
import {
  CalendarCheckIcon,
  ExternalLinkIcon,
  LayoutDashboardIcon,
  MapPinIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { AccountMenu } from "@/components/auth/account-menu"
import { getSessionProfile } from "@/lib/auth"
import {
  getActiveRestaurants,
  getTodayReservationCounts,
  restaurantInitials,
  type RestaurantProfile,
} from "@/lib/restaurants"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Nabiaa Reservations · Dashboard",
  description: "Manage your restaurants and reservations from one place.",
}

export default async function DashboardPage() {
  const [restaurants, counts, profile] = await Promise.all([
    getActiveRestaurants(),
    getTodayReservationCounts(),
    getSessionProfile(),
  ])

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <Badge variant="secondary" className="w-fit gap-1.5">
              <LayoutDashboardIcon className="size-3.5 text-primary" />
              Platform
            </Badge>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance">
              Nabiaa Reservations
            </h1>
            <p className="max-w-prose text-sm text-muted-foreground">
              Manage every restaurant, its bookings, and its public booking page
              from a single workspace.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <AccountMenu profile={profile} />
            <ThemeToggle />
          </div>
        </header>

        {/* Restaurants */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-semibold tracking-tight">
              Active restaurants
            </h2>
            <span className="text-sm text-muted-foreground">
              {restaurants.length}{" "}
              {restaurants.length === 1 ? "restaurant" : "restaurants"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.slug}
                restaurant={restaurant}
                todayCount={counts[restaurant.name] ?? 0}
              />
            ))}

            {/* Disabled "new restaurant" placeholder. */}
            <div
              aria-disabled
              className="flex min-h-[220px] cursor-not-allowed flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center opacity-70"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-muted">
                <PlusIcon className="size-5 text-muted-foreground" />
              </span>
              <div className="flex flex-col gap-1">
                <p className="font-medium text-foreground">New restaurant</p>
                <p className="text-xs text-muted-foreground">
                  Multi-restaurant onboarding is coming soon.
                </p>
              </div>
              <span
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                  className: "pointer-events-none gap-1.5",
                })}
              >
                <PlusIcon className="size-3.5" />
                New restaurant
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function RestaurantCard({
  restaurant,
  todayCount,
}: {
  restaurant: RestaurantProfile
  todayCount: number
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <Avatar className="size-12 rounded-2xl ring-1 ring-border">
          <AvatarImage
            src={restaurant.logo || "/placeholder.svg"}
            alt={`${restaurant.name} logo`}
          />
          <AvatarFallback className="rounded-2xl">
            {restaurantInitials(restaurant.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h3 className="truncate font-heading text-lg font-semibold tracking-tight">
            {restaurant.name}
          </h3>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <MapPinIcon className="size-3.5 shrink-0 text-primary" />
            {restaurant.location}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
          <CalendarCheckIcon className="size-4 text-primary" />
        </span>
        <div className="flex flex-col">
          <span className="font-heading text-xl font-semibold tracking-tight">
            {todayCount}
          </span>
          <span className="text-xs text-muted-foreground">
            {todayCount === 1 ? "reservation" : "reservations"} today
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          href="/admin"
          className={buttonVariants({
            variant: "default",
            size: "sm",
            className: "flex-1 gap-1.5",
          })}
        >
          <SettingsIcon className="size-3.5" />
          Open admin
        </Link>
        <Link
          href={`/r/${restaurant.slug}`}
          className={buttonVariants({
            variant: "outline",
            size: "sm",
            className: "flex-1 gap-1.5",
          })}
        >
          <ExternalLinkIcon className="size-3.5" />
          Open booking page
        </Link>
      </div>
    </div>
  )
}
