import type { Metadata } from "next"

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder"

export const metadata: Metadata = {
  title: "Settings · K'áanche",
}

export default function SettingsPage() {
  return (
    <ModulePlaceholder
      badge="Restaurant"
      title="Settings"
      subtitle="Configure your restaurant profile and booking preferences."
      bullets={[
        "Restaurant name, contact, and address",
        "Timezone and locale",
        "Booking policies and cancellations",
        "Confirmation and reminder messaging",
        "Notification preferences",
        "Data and privacy controls",
      ]}
    />
  )
}
