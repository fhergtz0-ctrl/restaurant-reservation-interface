import type { Metadata } from "next"

import { ProfileSection } from "@/components/settings/sections/profile-section"

export const metadata: Metadata = {
  title: "Restaurant Profile · K'áanche",
}

export default function ProfileSettingsPage() {
  return <ProfileSection />
}
