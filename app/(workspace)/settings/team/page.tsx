import type { Metadata } from "next"

import { TeamSection } from "@/components/settings/sections/team-section"

export const metadata: Metadata = {
  title: "Team & Roles · Settings · K'áanche",
}

export default function TeamSettingsPage() {
  return <TeamSection />
}
