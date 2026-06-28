import type { Metadata } from "next"

import { CalendarView } from "@/components/calendar-view"
import { AccountMenu } from "@/components/auth/account-menu"
import { AppChrome } from "@/components/app-nav/app-chrome"
import { getSessionProfile } from "@/lib/auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Calendar · Reservations",
  description: "View the day's reservations on a timeline.",
}

export default async function CalendarPage() {
  const profile = await getSessionProfile()

  return (
    <>
      <CalendarView accountSlot={<AccountMenu profile={profile} />} />
      <AppChrome profile={profile} />
    </>
  )
}
