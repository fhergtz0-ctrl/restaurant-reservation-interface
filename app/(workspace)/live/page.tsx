import type { Metadata } from "next"
import { RadioIcon } from "lucide-react"

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder"

export const metadata: Metadata = {
  title: "K'áanche Live · K'áanche",
}

export default function LivePage() {
  return (
    <ModulePlaceholder
      badge="Live"
      icon={RadioIcon}
      title="K'áanche Live"
      subtitle="Real-time floor and reservation pulse for the current service."
      bullets={[
        "Live occupancy and turn-time tracking",
        "Walk-in and waitlist management",
        "Server section assignments",
        "Kitchen pacing signals",
        "Instant status broadcasts to staff",
        "Service-wide alerts and SLAs",
      ]}
    />
  )
}
