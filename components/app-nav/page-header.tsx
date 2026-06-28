"use client"

import * as React from "react"
import { StoreIcon, type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ThemeToggle } from "@/components/theme-toggle"
import type { RestaurantProfile } from "@/lib/restaurants"

/**
 * Shared header for the calendar / tables / reservations pages: a title block,
 * the account + theme controls, a restaurant selector, and an optional row of
 * extra controls (date pickers, filters) passed as children.
 */
export function PageHeader({
  badge,
  icon: Icon,
  title,
  subtitle,
  restaurants,
  selectedSlug,
  onSelect,
  accountSlot,
  children,
}: {
  badge: string
  icon: LucideIcon
  title: string
  subtitle?: string
  restaurants: RestaurantProfile[]
  selectedSlug: string
  onSelect: (slug: string) => void
  accountSlot?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
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
        <div className="flex shrink-0 items-center gap-2">
          {accountSlot}
          <ThemeToggle />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={selectedSlug} onValueChange={(v) => onSelect(v ?? selectedSlug)}>
          <SelectTrigger
            className="h-9 w-full min-w-[160px] flex-1 sm:w-[220px] sm:flex-none"
            aria-label="Restaurant"
          >
            <span className="flex items-center gap-2">
              <StoreIcon className="size-4 text-primary" />
              <SelectValue>
                {(value) =>
                  restaurants.find((r) => r.slug === value)?.name ??
                  "Select restaurant"
                }
              </SelectValue>
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {restaurants.map((r) => (
                <SelectItem key={r.slug} value={r.slug}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {children}
      </div>
    </header>
  )
}
