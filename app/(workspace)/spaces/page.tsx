import type { Metadata } from "next"

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder"

export const metadata: Metadata = {
  title: "Spaces / Zones · K'áanche",
}

export default function SpacesPage() {
  return (
    <ModulePlaceholder
      badge="Planning"
      title="Spaces / Zones"
      subtitle="Organize your venue into dining zones and areas."
      bullets={[
        "Define zones (Main Dining, Terrace, VIP, Bar)",
        "Per-zone capacity and ambiance",
        "Bookable vs. walk-in only areas",
        "Zone-based pricing and minimums",
        "Weather-dependent outdoor spaces",
        "Floor-plan layout per zone",
      ]}
    />
  )
}
