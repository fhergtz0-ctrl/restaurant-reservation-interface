import type { Metadata } from "next"

import { ReservationsSection } from "@/components/settings/sections/reservations-section"

export const metadata: Metadata = {
  title: "Reservation Rules · K'áanche",
}

export default function ReservationsSettingsPage() {
  return <ReservationsSection />
}
