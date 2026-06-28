import type { Metadata } from "next"
import Link from "next/link"

import { AuthShell } from "@/components/auth/auth-shell"
import { RegisterForm } from "@/components/auth/register-form"

export const metadata: Metadata = {
  title: "Create your restaurant · K'áanche",
  description: "Set up your restaurant and start taking reservations.",
}

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your restaurant"
      description="Set up your workspace. You'll be the Owner of this restaurant."
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-foreground underline underline-offset-4"
          >
            Sign in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  )
}
