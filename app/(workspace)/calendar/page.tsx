import type { Metadata } from "next"

import { CalendarView } from "@/components/calendar-view"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "K'áanche · Calendar",
  description: "View the day's reservations on a timeline.",
}

export default function CalendarPage() {
  return <CalendarView />
}
