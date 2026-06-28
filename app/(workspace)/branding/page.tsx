import type { Metadata } from "next"
import { PaletteIcon } from "lucide-react"

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder"

export const metadata: Metadata = {
  title: "Branding · K'áanche",
}

export default function BrandingPage() {
  return (
    <ModulePlaceholder
      badge="Restaurant"
      icon={PaletteIcon}
      title="Branding"
      subtitle="Customize how your public booking page looks and feels."
      bullets={[
        "Logo and brand colors",
        "Cover imagery and gallery",
        "Booking page copy and tone",
        "Custom domain",
        "Confirmation email styling",
        "Social and SEO previews",
      ]}
    />
  )
}
