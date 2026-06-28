"use client"

import {
  BellIcon,
  LogOutIcon,
  MenuIcon,
  SearchIcon,
  UtensilsCrossedIcon,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/theme-toggle"
import { signOutAction } from "@/app/actions/auth"
import { restaurantInitials } from "@/lib/restaurants"
import type { SessionProfile } from "@/lib/auth"
import { Breadcrumb } from "./breadcrumb"
import { PopoverMenu } from "./popover-menu"
import { RestaurantSelector } from "./restaurant-selector"

function GlobalSearch() {
  return (
    <div className="relative hidden md:block">
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="search"
        placeholder="Search reservations, guests…"
        aria-label="Global search"
        className="h-9 w-56 rounded-xl border border-border bg-background pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60 focus:ring-2 focus:ring-primary/20 lg:w-64"
      />
    </div>
  )
}

function Notifications() {
  return (
    <PopoverMenu
      label="Notifications"
      trigger={({ toggle, ref, open }) => (
        <Button
          ref={ref}
          variant="outline"
          size="icon"
          className="relative size-9 rounded-full"
          aria-label="Notifications"
          aria-expanded={open}
          onClick={toggle}
        >
          <BellIcon className="size-4" />
          <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
        </Button>
      )}
    >
      {() => (
        <div className="flex flex-col">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
          </div>
          <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
            <BellIcon className="size-6 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">All caught up</p>
            <p className="text-xs text-muted-foreground">
              New reservations and alerts will appear here.
            </p>
          </div>
        </div>
      )}
    </PopoverMenu>
  )
}

function UserMenu({ profile }: { profile: SessionProfile }) {
  return (
    <PopoverMenu
      label="Account menu"
      trigger={({ toggle, ref, open }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label="Account menu"
          className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-muted"
        >
          <Avatar className="size-9 rounded-full ring-1 ring-border">
            <AvatarFallback className="rounded-full text-xs">
              {restaurantInitials(profile.name || profile.email)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[120px] flex-col items-start leading-tight lg:flex">
            <span className="w-full truncate text-sm font-medium text-foreground">
              {profile.name}
            </span>
            <span className="w-full truncate text-[11px] text-muted-foreground">
              {profile.role}
            </span>
          </span>
        </button>
      )}
    >
      {() => (
        <div className="flex flex-col">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Avatar className="size-10 rounded-xl ring-1 ring-border">
              <AvatarFallback className="rounded-xl text-xs">
                {restaurantInitials(profile.name || profile.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium text-foreground">
                {profile.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {profile.email}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs text-muted-foreground">Role</span>
            <Badge variant="secondary">{profile.role}</Badge>
          </div>
          <Separator />
          <form action={signOutAction} className="p-2">
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start gap-2 text-foreground"
            >
              <LogOutIcon className="size-4" />
              Sign out
            </Button>
          </form>
        </div>
      )}
    </PopoverMenu>
  )
}

/**
 * Sticky workspace header. On mobile it shows a hamburger (opens the drawer)
 * and the brand; on desktop it shows the breadcrumb plus global controls.
 */
export function TopHeader({
  profile,
  onOpenDrawer,
}: {
  profile: SessionProfile | null
  onOpenDrawer: () => void
}) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur-md md:px-6">
      {/* Mobile: hamburger + brand */}
      <div className="flex items-center gap-2 lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenDrawer}
          aria-label="Open menu"
        >
          <MenuIcon className="size-5" />
        </Button>
        <span className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <UtensilsCrossedIcon className="size-4 text-primary" />
          </span>
          <span className="font-heading text-sm font-semibold tracking-tight">
            K&apos;áanche
          </span>
        </span>
      </div>

      {/* Desktop: breadcrumb */}
      <div className="hidden min-w-0 flex-1 lg:flex">
        <Breadcrumb />
      </div>

      {/* Right controls */}
      <div className="ml-auto flex items-center gap-2">
        <GlobalSearch />
        <div className="hidden sm:block">
          <RestaurantSelector />
        </div>
        <Notifications />
        <ThemeToggle />
        {profile ? (
          <UserMenu profile={profile} />
        ) : null}
      </div>
    </header>
  )
}
