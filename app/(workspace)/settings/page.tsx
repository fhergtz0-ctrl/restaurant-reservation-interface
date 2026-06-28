import { redirect } from "next/navigation"

/** The Settings hub opens on the Restaurant Profile section. */
export default function SettingsPage() {
  redirect("/settings/profile")
}
