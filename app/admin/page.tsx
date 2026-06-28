import type { Metadata } from "next"

import { AdminDashboard } from "@/components/admin-dashboard"

export const metadata: Metadata = {
  title: "Admin · Reservations",
  description: "Manage reservations across your restaurants.",
}

export default function AdminPage() {
  return <AdminDashboard />
}
