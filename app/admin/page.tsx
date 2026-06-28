import type { Metadata } from "next"

import { AdminDashboard } from "@/components/admin-dashboard"
import { AccountMenu } from "@/components/auth/account-menu"
import { getSessionProfile } from "@/lib/auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Admin · Reservations",
  description: "Manage reservations across your restaurants.",
}

export default async function AdminPage() {
  const profile = await getSessionProfile()

  return <AdminDashboard accountSlot={<AccountMenu profile={profile} />} />
}
