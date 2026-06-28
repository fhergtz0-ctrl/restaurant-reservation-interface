import type React from "react"

import { SettingsSidebar } from "@/components/settings/settings-sidebar"

/**
 * Settings / Admin Center shell. A secondary navigation (grouped to match the
 * primary sidebar) sits alongside the active section's form. Sections are
 * reachable both from here and via deep links in the main sidebar.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row lg:gap-10">
      <SettingsSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
