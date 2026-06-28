"use client"

import * as React from "react"
import Link from "next/link"
import { LogOutIcon, UtensilsCrossedIcon, XIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { signOutAction } from "@/app/actions/auth"
import { restaurantInitials } from "@/lib/restaurants"
import type { SessionProfile } from "@/lib/auth"
import { drawerItems, isActivePath } from "./nav-config"

export function MobileDrawer({
  open,
  onClose,
  pathname,
  profile,
}: {
  open: boolean
  onClose: () => void
  pathname: string
  profile: SessionProfile | null
}) {
  // Lock body scroll while the drawer is open.
  React.useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  // Close on Escape.
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
      {/* Scrim */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={`absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel */}
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
            <span className="font-heading text-base font-semibold tracking-tight">
              Nabiaa
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

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {drawerItems.map((item, index) => {
              const active = isActivePath(pathname, item.href)
              const Icon = item.icon
              const content = (
                <>
                  <Icon className="size-5 shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.soon && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      Soon
                    </span>
                  )}
                </>
              )
              const base =
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"

              return (
                <li key={`${item.label}-${index}`}>
                  {item.soon || !item.href ? (
                    <span
                      aria-disabled
                      className={`${base} cursor-not-allowed text-muted-foreground/70`}
                    >
                      {content}
                    </span>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={`${base} ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {content}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
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
                Cerrar sesión
              </Button>
            </form>
          </div>
        )}
      </aside>
    </div>
  )
}
