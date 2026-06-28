import type { Metadata } from "next"

import { IntegrationsSection } from "@/components/settings/sections/integrations-section"

export const metadata: Metadata = {
  title: "Integrations · Settings · K'áanche",
}

export default function IntegrationsSettingsPage() {
  return <IntegrationsSection />
}
