"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { settingsNav } from "@/components/settings/settings-nav"

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SettingsSidebar() {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop: grouped vertical nav */}
      <nav
        aria-label="Settings sections"
        className="hidden lg:block lg:w-64 lg:shrink-0"
      >
        <div className="sticky top-4 flex flex-col gap-6">
          {settingsNav.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.title}
              </p>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-start gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="mt-0.5 size-4 shrink-0" />
                    <span className="flex flex-col">
                      <span className="font-medium leading-tight">
                        {item.label}
                      </span>
                      <span className="text-xs text-muted-foreground/80">
                        {item.description}
                      </span>
                    </span>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>
      </nav>

      {/* Mobile / tablet: horizontal scrollable pills */}
      <nav
        aria-label="Settings sections"
        className="-mx-4 overflow-x-auto px-4 pb-1 lg:hidden"
      >
        <div className="flex w-max gap-2">
          {settingsNav
            .flatMap((g) => g.items)
            .map((item) => {
              const active = isActive(pathname, item.href)
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              )
            })}
        </div>
      </nav>
    </>
  )
}
