"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronsLeftIcon,
  PanelLeftIcon,
  UtensilsCrossedIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { useRestaurants } from "./restaurant-context"
import {
  navSections,
  isActivePath,
  type WorkspaceNavItem,
} from "./nav"

export function SidebarItem({
  item,
  collapsed,
}: {
  item: WorkspaceNavItem
  collapsed: boolean
}) {
  const pathname = usePathname()
  const { selected } = useRestaurants()
  const Icon = item.icon
  const active = isActivePath(pathname, item.href)

  const base =
    "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200"
  const inner = (
    <>
      <Icon
        className={`size-[18px] shrink-0 ${
          active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
        }`}
      />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!collapsed && item.soon && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          Soon
        </span>
      )}
    </>
  )

  // Public booking page: external link to the selected restaurant.
  if (item.bookingPage) {
    const href = selected ? `/r/${selected.slug}` : "/dashboard"
    return (
      <Link
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={collapsed ? item.label : undefined}
        className={`${base} text-foreground hover:bg-muted ${collapsed ? "justify-center" : ""}`}
      >
        {inner}
      </Link>
    )
  }

  if (item.soon || !item.href) {
    return (
      <span
        aria-disabled
        title={collapsed ? `${item.label} (soon)` : undefined}
        className={`${base} cursor-not-allowed text-muted-foreground/60 ${collapsed ? "justify-center" : ""}`}
      >
        {inner}
      </span>
    )
  }

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={`${base} ${collapsed ? "justify-center" : ""} ${
        active
          ? "bg-primary/10 text-primary"
          : "text-foreground hover:bg-muted"
      }`}
    >
      {inner}
    </Link>
  )
}

export function SidebarSection({
  title,
  collapsed,
  children,
}: {
  title: string
  collapsed: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      {collapsed ? (
        <div className="mx-3 my-1 border-t border-border/60" />
      ) : (
        <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {title}
        </p>
      )}
      {children}
    </div>
  )
}

/**
 * Desktop collapsible sidebar (hidden below lg). Mobile navigation is handled
 * by the drawer + bottom nav instead.
 */
export function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean
  onToggle: () => void
}) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-card lg:flex ${
        collapsed ? "w-[76px]" : "w-64"
      } transition-[width] duration-200`}
    >
      {/* Brand */}
      <div
        className={`flex h-16 items-center border-b border-border px-4 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 overflow-hidden"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <UtensilsCrossedIcon className="size-5 text-primary" />
          </span>
          {!collapsed && (
            <span className="flex flex-col leading-tight">
              <span className="font-heading text-sm font-semibold tracking-tight">
                K&apos;áanche
              </span>
              <span className="text-[10px] text-muted-foreground">
                Operations Platform
              </span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            aria-label="Collapse sidebar"
          >
            <ChevronsLeftIcon className="size-4" />
          </Button>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center py-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggle}
            aria-label="Expand sidebar"
          >
            <PanelLeftIcon className="size-4" />
          </Button>
        </div>
      )}

      {/* Sections */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        <div className="flex flex-col gap-2">
          {navSections.map((section) => (
            <SidebarSection
              key={section.title}
              title={section.title}
              collapsed={collapsed}
            >
              {section.items.map((item) => (
                <SidebarItem
                  key={item.label}
                  item={item}
                  collapsed={collapsed}
                />
              ))}
            </SidebarSection>
          ))}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3">
        <p
          className={`text-[11px] text-muted-foreground ${collapsed ? "text-center" : ""}`}
        >
          {collapsed ? "N" : "Powered by Nabiaa"}
        </p>
      </div>
    </aside>
  )
}
