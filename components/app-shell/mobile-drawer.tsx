"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LogOutIcon, UtensilsCrossedIcon, XIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { signOutAction } from "@/app/actions/auth"
import { restaurantInitials } from "@/lib/restaurants"
import type { SessionProfile } from "@/lib/auth"
import { useRestaurants } from "./restaurant-context"
import { navSections, isActivePath } from "./nav"

export function MobileDrawer({
  open,
  onClose,
  profile,
}: {
  open: boolean
  onClose: () => void
  profile: SessionProfile | null
}) {
  const pathname = usePathname()
  const { selected } = useRestaurants()

  React.useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  React.useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <div
      className={`fixed inset-0 z-50 lg:hidden ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={`absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`absolute inset-y-0 left-0 flex w-80 max-w-[85vw] flex-col border-r border-border bg-card shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex items-center gap-2.5"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10">
              <UtensilsCrossedIcon className="size-5 text-primary" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-heading text-base font-semibold tracking-tight">
                K&apos;áanche
              </span>
              <span className="text-[10px] text-muted-foreground">
                Operations Platform
              </span>
            </span>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close menu"
          >
            <XIcon className="size-5" />
          </Button>
        </div>

        {profile && (
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <Avatar className="size-10 rounded-xl ring-1 ring-border">
              <AvatarFallback className="rounded-xl text-xs">
                {restaurantInitials(profile.name || profile.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-medium text-foreground">
                {profile.restaurantName ?? profile.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {profile.email}
              </span>
            </div>
            <Badge variant="secondary" className="ml-auto shrink-0">
              {profile.role}
            </Badge>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="flex flex-col gap-3">
            {navSections.map((section) => (
              <div key={section.title} className="flex flex-col gap-1">
                <p className="px-3 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {section.title}
                </p>
                {section.items.map((item) => {
                  const Icon = item.icon
                  const active = isActivePath(pathname, item.href)
                  const content = (
                    <>
                      <Icon className="size-[18px] shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.soon && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Soon
                        </span>
                      )}
                    </>
                  )
                  const cls =
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"

                  if (item.bookingPage) {
                    return (
                      <Link
                        key={item.label}
                        href={selected ? `/r/${selected.slug}` : "/dashboard"}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onClose}
                        className={`${cls} text-foreground hover:bg-muted`}
                      >
                        {content}
                      </Link>
                    )
                  }

                  if (item.soon || !item.href) {
                    return (
                      <span
                        key={item.label}
                        aria-disabled
                        className={`${cls} cursor-not-allowed text-muted-foreground/60`}
                      >
                        {content}
                      </span>
                    )
                  }

                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={onClose}
                      className={`${cls} ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {content}
                    </Link>
                  )
                })}
              </div>
            ))}
          </div>
        </nav>

        {profile && (
          <div className="border-t border-border p-3">
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="outline"
                className="w-full justify-start gap-3"
              >
                <LogOutIcon className="size-4" />
                Sign out
              </Button>
            </form>
          </div>
        )}
        <div className="border-t border-border px-5 py-2.5">
          <p className="text-[11px] text-muted-foreground">
            Powered by K&apos;áanche
          </p>
        </div>
      </aside>
    </div>
  )
}
