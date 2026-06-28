import type { Metadata } from "next"

import { BillingSection } from "@/components/settings/sections/billing-section"

export const metadata: Metadata = {
  title: "Billing & Subscription · Settings · K'áanche",
}

export default function BillingSettingsPage() {
  return <BillingSection />
}
