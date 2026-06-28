import type { Metadata } from "next"

import { ReservationsView } from "@/components/reservations-view"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "K'áanche · Reservations",
  description: "Browse and manage reservations on the go.",
}

export default function ReservationsPage() {
  return <ReservationsView />
}
