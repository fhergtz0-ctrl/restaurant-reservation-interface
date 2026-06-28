"use client"

import * as React from "react"
import { type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"

/**
 * In-page header for the data views (calendar / tables / reservations). The
 * restaurant selector and account/theme controls live in the global workspace
 * header now, so this renders the title block plus any view-specific controls
 * (date pickers, filters) passed as children.
 */
export function PageHeader({
  badge,
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  badge: string
  icon: LucideIcon
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Badge variant="secondary" className="w-fit gap-1.5">
          <Icon className="size-3.5 text-primary" />
          {badge}
        </Badge>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>

      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </header>
  )
}
