import type { Metadata } from "next"

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder"

export const metadata: Metadata = {
  title: "Special Days · K'áanche",
}

export default function SpecialDaysPage() {
  return (
    <ModulePlaceholder
      badge="Planning"
      title="Special Days"
      subtitle="Manage holidays, closures, and special-event availability."
      bullets={[
        "One-off closures and holiday hours",
        "Special-event seating plans",
        "Custom menus and prix-fixe days",
        "Deposit and prepayment requirements",
        "Override default schedules",
        "Recurring annual events",
      ]}
    />
  )
}
