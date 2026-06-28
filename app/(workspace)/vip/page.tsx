import type { Metadata } from "next"
import { CrownIcon } from "lucide-react"

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder"

export const metadata: Metadata = {
  title: "VIP · K'áanche",
}

export default function VipPage() {
  return (
    <ModulePlaceholder
      badge="Guests"
      icon={CrownIcon}
      title="VIP"
      subtitle="Recognize and prioritize your most valued guests."
      bullets={[
        "VIP tiers and recognition",
        "Preferred tables and seating",
        "Automatic priority on booking",
        "Special-occasion reminders",
        "Concierge notes for staff",
        "VIP-only availability windows",
      ]}
    />
  )
}
