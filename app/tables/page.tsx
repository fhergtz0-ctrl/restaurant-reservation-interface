import type { Metadata } from "next"

import { TablesView } from "@/components/tables-view"
import { AccountMenu } from "@/components/auth/account-menu"
import { AppChrome } from "@/components/app-nav/app-chrome"
import { getSessionProfile } from "@/lib/auth"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Tables · Floor plan",
  description: "Live table status across your dining room.",
}

export default async function TablesPage() {
  const profile = await getSessionProfile()

  return (
    <>
      <TablesView accountSlot={<AccountMenu profile={profile} />} />
      <AppChrome profile={profile} />
    </>
  )
}
