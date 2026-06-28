import type { Metadata } from "next"

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder"

export const metadata: Metadata = {
  title: "Guest List · K'áanche",
}

export default function GuestsPage() {
  return (
    <ModulePlaceholder
      badge="Guests"
      title="Guest List"
      subtitle="A unified profile for every diner who books with you."
      bullets={[
        "Contact details and visit history",
        "Dining preferences and allergies",
        "Lifetime value and frequency",
        "Tags and segments",
        "Linked reservations and notes",
        "Marketing opt-in management",
      ]}
    />
  )
}
