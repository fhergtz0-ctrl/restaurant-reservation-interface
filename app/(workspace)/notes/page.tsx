import type { Metadata } from "next"
import { StickyNoteIcon } from "lucide-react"

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder"

export const metadata: Metadata = {
  title: "Notes · K'áanche",
}

export default function NotesPage() {
  return (
    <ModulePlaceholder
      badge="Guests"
      icon={StickyNoteIcon}
      title="Notes"
      subtitle="Shared internal notes about guests and reservations."
      bullets={[
        "Per-guest and per-reservation notes",
        "Allergy and accessibility flags",
        "Staff handoff annotations",
        "Pinned high-priority notes",
        "Searchable note history",
        "Visibility controls by role",
      ]}
    />
  )
}
