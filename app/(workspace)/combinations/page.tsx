import type { Metadata } from "next"

import { CombinationsView } from "@/components/combinations-view"

export const metadata: Metadata = {
  title: "Table Combinations · K'áanche",
}

export default function CombinationsPage() {
  return <CombinationsView />
}
