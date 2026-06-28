"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase"

export type AuthState = {
  error?: string
  message?: string
}

async function getOrigin(): Promise<string> {
  const h = await headers()
  const origin = h.get("origin")
  if (origin) return origin
  const host = h.get("host") ?? "localhost:3000"
  const protocol = host.startsWith("localhost") ? "http" : "https"
  return `${protocol}://${host}`
}

function callbackUrl(origin: string, next: string): string {
  return (
    process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ??
    `${origin}/auth/callback?next=${encodeURIComponent(next)}`
  )
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured) {
    return { error: "Authentication is not configured yet." }
  }

  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const next = String(formData.get("next") ?? "/dashboard") || "/dashboard"

  if (!email || !password) {
    return { error: "Email and password are required." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  redirect(next)
}

export async function registerAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured) {
    return { error: "Authentication is not configured yet." }
  }

  const restaurantName = String(formData.get("restaurantName") ?? "").trim()
  const ownerName = String(formData.get("ownerName") ?? "").trim()
  const email = String(formData.get("email") ?? "").trim()
  const password = String(formData.get("password") ?? "")
  const confirmPassword = String(formData.get("confirmPassword") ?? "")

  if (!restaurantName || !email || !password) {
    return { error: "Restaurant name, email, and password are required." }
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." }
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." }
  }

  const origin = await getOrigin()
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: callbackUrl(origin, "/dashboard"),
      data: {
        restaurant_name: restaurantName,
        owner_name: ownerName || null,
      },
    },
  })

  if (error) {
    return { error: error.message }
  }

  // When email confirmation is disabled, a session is returned immediately.
  if (data.session) {
    redirect("/dashboard")
  }

  // Otherwise the owner must confirm their email before signing in.
  return {
    message:
      "Account created. Check your email to confirm your address, then sign in.",
  }
}

export async function signOutAction(): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }
  redirect("/login")
}

export async function forgotPasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured) {
    return { error: "Authentication is not configured yet." }
  }

  const email = String(formData.get("email") ?? "").trim()
  if (!email) {
    return { error: "Enter the email associated with your account." }
  }

  const origin = await getOrigin()
  const supabase = await createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackUrl(origin, "/dashboard"),
  })

  if (error) {
    return { error: error.message }
  }

  return {
    message: "If an account exists for that email, a reset link is on its way.",
  }
}
