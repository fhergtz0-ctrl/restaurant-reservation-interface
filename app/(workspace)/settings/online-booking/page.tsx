import type { Metadata } from "next"

import { OnlineBookingSection } from "@/components/settings/sections/online-booking-section"

export const metadata: Metadata = {
  title: "Online Booking · K'áanche",
}

export default function OnlineBookingSettingsPage() {
  return <OnlineBookingSection />
}
