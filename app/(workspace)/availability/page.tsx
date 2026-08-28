import type { Metadata } from "next"

import { AvailabilityTester } from "@/components/availability-tester"

export const metadata: Metadata = {
  title: "Availability Engine · K'áanche",
}

export default function AvailabilityPage() {
  return <AvailabilityTester />
}
