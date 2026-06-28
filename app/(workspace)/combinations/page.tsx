import type { Metadata } from "next"

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder"

export const metadata: Metadata = {
  title: "Table Combinations · K'áanche",
}

export default function CombinationsPage() {
  return (
    <ModulePlaceholder
      badge="Planning"
      title="Table Combinations"
      subtitle="Define how tables join together for larger parties."
      bullets={[
        "Join rules for adjacent tables",
        "Maximum combined capacity",
        "Auto-suggested combinations by party size",
        "Per-zone combination constraints",
        "Conflict detection with existing bookings",
        "Reusable combination templates",
      ]}
    />
  )
}
