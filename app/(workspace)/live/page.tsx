import type { Metadata } from "next"

import { LiveView } from "@/components/live-view"

export const metadata: Metadata = {
  title: "K'áanche Live · K'áanche",
}

export default function LivePage() {
  return <LiveView />
}
