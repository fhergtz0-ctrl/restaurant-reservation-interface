import type { Metadata } from "next"

import { ReservationsView } from "@/components/reservations-view"
import { AccountMenu } from "@/components/auth/account-menu"
import { AppChrome } from "@/components/app-nav/app-chrome"
import { getSessionProfile } from "@/lib/auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Reservations",
  description: "Browse and manage reservations on the go.",
}

export default async function ReservationsPage() {
  const profile = await getSessionProfile()

  return (
    <>
      <ReservationsView accountSlot={<AccountMenu profile={profile} />} />
      <AppChrome profile={profile} />
    </>
  )
}
