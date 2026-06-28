import type { Metadata } from "next"

import { ModulePlaceholder } from "@/components/app-shell/module-placeholder"

export const metadata: Metadata = {
  title: "Team · K'áanche",
}

export default function TeamPage() {
  return (
    <ModulePlaceholder
      badge="Business"
      title="Team"
      subtitle="Manage staff access and roles across your restaurant."
      bullets={[
        "Invite staff by email",
        "Roles: Owner, Manager, Host, Waiter",
        "Per-module permissions",
        "Activity and audit log",
        "Shift-based access",
        "Multi-restaurant team management",
      ]}
    />
  )
}
