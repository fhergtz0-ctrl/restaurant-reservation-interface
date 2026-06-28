import type { Metadata } from "next"

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder"

export const metadata: Metadata = {
  title: "Subscription · K'áanche",
}

export default function SubscriptionPage() {
  return (
    <ModulePlaceholder
      badge="Business"
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
