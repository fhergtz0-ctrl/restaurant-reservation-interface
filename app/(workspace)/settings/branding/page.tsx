import type { Metadata } from "next"

import { BrandingSection } from "@/components/settings/sections/branding-section"

export const metadata: Metadata = {
  title: "Branding · K'áanche",
}

export default function BrandingSettingsPage() {
  return <BrandingSection />
}
