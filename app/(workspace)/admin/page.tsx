import type { Metadata } from "next"

import { AdminDashboard } from "@/components/admin-dashboard"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "K'áanche · Admin",
  description: "Manage reservations across your restaurants.",
}

export default function AdminPage() {
  return <AdminDashboard />
}
