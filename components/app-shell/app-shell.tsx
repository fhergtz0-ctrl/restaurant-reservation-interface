"use client"

import * as React from "react"

import type { SessionProfile } from "@/lib/auth"
import { RestaurantProvider } from "./restaurant-context"
import { Sidebar } from "./sidebar"
import { TopHeader } from "./top-header"
import { MobileDrawer } from "./mobile-drawer"
import { BottomNav } from "./bottom-nav"

const SIDEBAR_STORAGE_KEY = "kaanche.sidebar.collapsed"

/**
 * Unified workspace shell for every authenticated page: a collapsible desktop
 * sidebar, a sticky global header, and a mobile drawer + bottom nav. Page
 * content renders inside the scrollable main area.
 */
export function AppShell({
  profile,
  children,
}: {
  profile: SessionProfile | null
  children: React.ReactNode
}) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [drawerOpen, setDrawerOpen] = React.useState(false)

  // Restore the desktop sidebar preference.
  React.useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1")
    } catch {
      /* ignore */
    }
  }, [])

  const toggleSidebar = React.useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0")
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  return (
    <RestaurantProvider>
      <div className="min-h-dvh bg-background text-foreground">
        <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />

        <div
          className={`flex min-h-dvh flex-col transition-[padding] duration-200 ${
            collapsed ? "lg:pl-[76px]" : "lg:pl-64"
          }`}
        >
          <TopHeader profile={profile} onOpenDrawer={() => setDrawerOpen(true)} />
          <main className="flex-1 pb-20 lg:pb-0">{children}</main>
        </div>

        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          profile={profile}
        />
        <BottomNav onOpenMenu={() => setDrawerOpen(true)} />
      </div>
    </RestaurantProvider>
  )
}
