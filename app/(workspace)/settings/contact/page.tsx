import type { Metadata } from "next"

import { ContactSection } from "@/components/settings/sections/contact-section"

export const metadata: Metadata = {
  title: "Contact · K'áanche",
}

export default function ContactSettingsPage() {
  return <ContactSection />
}
