"use client"

import { useActionState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { forgotPasswordAction, type AuthState } from "@/app/actions/auth"
import { SubmitButton } from "@/components/auth/submit-button"

const initialState: AuthState = {}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, initialState)

  if (state.message) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-foreground">{state.message}</p>
        <a
          href="/login"
          className="text-primary underline-offset-4 hover:underline"
        >
          Back to sign in
        </a>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="owner@restaurant.com"
          required
        />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <SubmitButton pendingText="Sending link...">
        Send reset link
      </SubmitButton>
    </form>
  )
}
