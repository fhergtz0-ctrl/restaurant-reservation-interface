import * as React from "react"
import { UtensilsCrossedIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * Centered, premium dark auth layout shared by login / register /
 * forgot-password. Presentational only.
 */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
            <UtensilsCrossedIcon className="size-6 text-primary" />
          </span>
          <div className="flex flex-col gap-1">
            <p className="font-heading text-lg font-semibold tracking-tight">
              Nabiaa Reservations
            </p>
            <p className="text-xs text-muted-foreground">
              Restaurant management platform
            </p>
          </div>
        </div>

        <Card className="ring-border">
          <CardHeader className="gap-1.5">
            <CardTitle className="text-xl">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>

        {footer ? (
          <div className="text-center text-sm text-muted-foreground">
            {footer}
          </div>
        ) : null}
      </div>
    </main>
  )
}
