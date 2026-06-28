import type { Metadata } from "next"

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder"

export const metadata: Metadata = {
  title: "Reports · K'áanche",
}

export default function ReportsPage() {
  return (
    <ModulePlaceholder
      badge="Business"
      title="Reports"
      subtitle="Understand performance across covers, revenue, and trends."
      bullets={[
        "Covers and occupancy over time",
        "No-show and cancellation rates",
        "Peak hours and demand heatmaps",
        "Guest acquisition and retention",
        "Revenue per available seat hour",
        "Exportable CSV and PDF reports",
      ]}
    />
  )
}
