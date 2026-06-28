"use client"

import * as React from "react"
import {
  CheckCircle2Icon,
  InfoIcon,
  XIcon,
  AlertTriangleIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

type ToastVariant = "success" | "error" | "info"

type Toast = {
  id: number
  title: string
  description?: string
  variant: ToastVariant
}

type ToastInput = {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

type ToastContextValue = {
  toast: (input: ToastInput) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

/** Access the toast API. Must be used within <ToastProvider>. */
export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return ctx
}

const VARIANT_META: Record<
  ToastVariant,
  { icon: typeof CheckCircle2Icon; className: string }
> = {
  success: {
    icon: CheckCircle2Icon,
    className: "text-emerald-400",
  },
  error: {
    icon: AlertTriangleIcon,
    className: "text-destructive",
  },
  info: {
    icon: InfoIcon,
    className: "text-primary",
  },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])
  const counter = React.useRef(0)

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = React.useCallback(
    ({ title, description, variant = "info", duration = 4000 }: ToastInput) => {
      const id = ++counter.current
      setToasts((prev) => [...prev, { id, title, description, variant }])
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration)
      }
    },
    [dismiss],
  )

  const value = React.useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) =>
        toast({ title, description, variant: "success" }),
      error: (title, description) =>
        toast({ title, description, variant: "error", duration: 6000 }),
    }),
    [toast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:bottom-4 sm:right-4 sm:left-auto sm:items-end"
      >
        {toasts.map((t) => {
          const meta = VARIANT_META[t.variant]
          const Icon = meta.icon
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg",
                "data-[enter]:animate-in data-[enter]:fade-in-0 data-[enter]:slide-in-from-bottom-2",
              )}
              data-enter=""
            >
              <Icon className={cn("mt-0.5 size-5 shrink-0", meta.className)} />
              <div className="flex-1">
                <p className="text-sm font-medium leading-tight">{t.title}</p>
                {t.description ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {t.description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Dismiss notification"
              >
                <XIcon className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
