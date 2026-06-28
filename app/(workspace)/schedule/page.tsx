import type { Metadata } from "next"
import { ClockIcon } from "lucide-react"

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder"

export const metadata: Metadata = {
  title: "Schedule · K'áanche",
}

export default function SchedulePage() {
  return (
    <ModulePlaceholder
      badge="Planning"
      icon={ClockIcon}
      title="Schedule"
      subtitle="Set service hours and booking availability windows."
      bullets={[
        "Weekly opening hours per service",
        "Booking slot intervals and durations",
        "Last-seating cutoffs",
        "Capacity caps per time slot",
        "Lead-time and same-day rules",
        "Seasonal schedule variations",
      ]}
    />
  )
}
