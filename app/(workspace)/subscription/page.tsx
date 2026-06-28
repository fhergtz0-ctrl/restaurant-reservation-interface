import type { Metadata } from "next"
import { CreditCardIcon } from "lucide-react"

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder"

export const metadata: Metadata = {
  title: "Subscription · K'áanche",
}

export default function SubscriptionPage() {
  return (
    <ModulePlaceholder
      badge="Business"
      icon={CreditCardIcon}
      title="Subscription"
      subtitle="Manage your K'áanche plan, billing, and invoices."
      bullets={[
        "Current plan and usage",
        "Upgrade and downgrade options",
        "Payment method management",
        "Invoice history and receipts",
        "Per-restaurant billing",
        "Add-on modules",
      ]}
    />
  )
}
