import type { Metadata } from "next"

import { TablesView } from "@/components/tables-view"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "K'áanche · Floor Plan",
  description: "Live table status across your dining room.",
}

export default function TablesPage() {
  return <TablesView />
}
