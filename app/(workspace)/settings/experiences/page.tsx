import type { Metadata } from "next"

import { ExperiencesSection } from "@/components/settings/sections/experiences-section"

export const metadata: Metadata = {
  title: "Experiences · K'áanche",
}

export default function ExperiencesSettingsPage() {
  return <ExperiencesSection />
}
