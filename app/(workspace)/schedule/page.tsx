import type { Metadata } from "next"

import { ScheduleView } from "@/components/schedule-view"

export const metadata: Metadata = {
  title: "Schedule · K'áanche",
}

export default function SchedulePage() {
  return <ScheduleView />
}
