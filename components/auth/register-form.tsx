"use client"

import { useActionState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { registerAction, type AuthState } from "@/app/actions/auth"
import { SubmitButton } from "@/components/auth/submit-button"

const initialState: AuthState = {}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, initialState)

  if (state.message) {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-foreground">{state.message}</p>
        <a
          href="/login"
          className="text-primary underline-offset-4 hover:underline"
        >
          Go to sign in
        </a>
      </div>
    )
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="restaurantName">Restaurant name</Label>
        <Input
          id="restaurantName"
          name="restaurantName"
          type="text"
          placeholder="Maison Laurent"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="ownerName">Your name</Label>
        <Input
          id="ownerName"
          name="ownerName"
          type="text"
          autoComplete="name"
          placeholder="Alex Laurent"
        />
      </div>

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

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirmPassword">Confirm</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <SubmitButton pendingText="Creating account...">
        Create account
      </SubmitButton>
    </form>
  )
}
