"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import type { SessionProfile } from "@/lib/auth"
import { bottomNavItems, isActivePath } from "./nav-config"
import { MobileDrawer } from "./mobile-drawer"

/**
 * Mobile navigation chrome: a fixed bottom bar plus a slide-in drawer.
 * Rendered only below the `lg` breakpoint; desktop keeps the in-page layout.
 * Pages that include this should add `pb-24 lg:pb-0` to their main content so
 * the bottom bar never overlaps the last row.
 */
export function AppChrome({ profile }: { profile: SessionProfile | null }) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md lg:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {bottomNavItems.map((item, index) => {
            const Icon = item.icon
            const active = isActivePath(pathname, item.href)

            const inner = (
              <>
                <Icon
                  className={`size-5 ${active ? "text-primary" : "text-muted-foreground"}`}
                />
                <span
                  className={`text-[10px] font-medium ${
                    active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </span>
              </>
            )
            const cell =
              "flex h-16 flex-col items-center justify-center gap-1 transition-colors"

            return (
              <li key={`${item.label}-${index}`}>
                {item.href ? (
                  <Link href={item.href} className={cell}>
                    {inner}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpen(true)}
                    className={`${cell} w-full`}
                    aria-label="Open menu"
                    aria-expanded={open}
                  >
                    {inner}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      <MobileDrawer
        open={open}
        onClose={() => setOpen(false)}
        pathname={pathname}
        profile={profile}
      />
    </>
  )
}
