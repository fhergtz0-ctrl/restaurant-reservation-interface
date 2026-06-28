import type { Metadata } from "next"

import { TimelineView } from "@/components/timeline-view"

export const metadata: Metadata = {
  title: "Timeline · K'áanche",
}

export default function TimelinePage() {
  return <TimelineView />
}
