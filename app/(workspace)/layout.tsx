import type React from "react"

import { AppShell } from "@/components/app-shell/app-shell"
import { getSessionProfile } from "@/lib/auth"

export const dynamic = "force-dynamic"

/**
 * Shared shell for every authenticated workspace route. Fetches the session
 * profile once and renders the unified AppShell (sidebar + header + mobile
 * navigation) around the page content.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getSessionProfile()

  return <AppShell profile={profile}>{children}</AppShell>
}
