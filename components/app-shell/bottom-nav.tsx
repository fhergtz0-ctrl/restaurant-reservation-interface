"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { MenuIcon } from "lucide-react"

import { bottomNavItems, isActivePath } from "./nav"

/**
 * Mobile bottom navigation (hidden at lg+). The last cell opens the drawer for
 * the full sectioned navigation.
 */
export function BottomNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname()

  const cell =
    "flex h-16 flex-col items-center justify-center gap-1 transition-colors"

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {bottomNavItems.map((item) => {
          const Icon = item.icon
          const active = isActivePath(pathname, item.href)
          return (
            <li key={item.label}>
              <Link href={item.href ?? "/dashboard"} className={cell}>
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
              </Link>
            </li>
          )
        })}
        <li>
          <button
            type="button"
            onClick={onOpenMenu}
            className={`${cell} w-full`}
            aria-label="Open menu"
          >
            <MenuIcon className="size-5 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground">
              Menu
            </span>
          </button>
        </li>
      </ul>
    </nav>
  )
}
