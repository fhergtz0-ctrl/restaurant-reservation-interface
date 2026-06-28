import type { Metadata } from "next"

import { NotificationsSection } from "@/components/settings/sections/notifications-section"

export const metadata: Metadata = {
  title: "Notifications · K'áanche",
}

export default function NotificationsSettingsPage() {
  return <NotificationsSection />
}
