import type { Metadata } from "next"

import { AuditSection } from "@/components/settings/sections/audit-section"

export const metadata: Metadata = {
  title: "Audit Log · K'áanche",
}

export default function AuditSettingsPage() {
  return <AuditSection />
}
