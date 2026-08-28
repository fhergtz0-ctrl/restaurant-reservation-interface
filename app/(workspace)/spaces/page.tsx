import type { Metadata } from "next"

import { SpacesView } from "@/components/spaces-view"

export const metadata: Metadata = {
  title: "Spaces / Zones · K'áanche",
}

export default function SpacesPage() {
  return <SpacesView />
}
