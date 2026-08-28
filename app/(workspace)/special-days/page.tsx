import type { Metadata } from "next"

import { SpecialDaysView } from "@/components/special-days-view"

export const metadata: Metadata = {
  title: "Special Days · K'áanche",
}

export default function SpecialDaysPage() {
  return <SpecialDaysView />
}
