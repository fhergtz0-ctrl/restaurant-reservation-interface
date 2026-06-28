"use client"

import { useActionState } from "react"
import Link from "next/link"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { signInAction, type AuthState } from "@/app/actions/auth"
import { SubmitButton } from "@/components/auth/submit-button"

const initialState: AuthState = {}

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signInAction, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />

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

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <SubmitButton pendingText="Signing in...">Sign in</SubmitButton>
    </form>
  )
}
