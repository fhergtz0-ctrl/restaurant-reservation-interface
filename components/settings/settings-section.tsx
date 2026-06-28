"use client"

import * as React from "react"
import { Loader2Icon, InfoIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { KvSectionKey } from "@/lib/settings/schemas"
import type { UseSettingsForm } from "@/components/settings/use-settings-form"

export function SettingsHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/** Card with an optional titled header — the building block of each section. */
export function SettingsCard({
  title,
  description,
  children,
  footer,
  className,
}: {
  title?: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <Card className={cn("gap-0 overflow-hidden", className)}>
      {title ? (
        <CardHeader className="border-b border-border bg-muted/30 py-4">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? (
            <CardDescription>{description}</CardDescription>
          ) : null}
        </CardHeader>
      ) : null}
      <CardContent className="p-5 sm:p-6">{children}</CardContent>
      {footer ? (
        <div className="border-t border-border bg-muted/20 px-5 py-3 sm:px-6">
          {footer}
        </div>
      ) : null}
    </Card>
  )
}

/** Notice shown when Supabase isn't configured so saving won't persist yet. */
export function ConfigNotice({ configured }: { configured: boolean }) {
  if (configured) return null
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
      <InfoIcon className="mt-0.5 size-5 shrink-0" />
      <div className="text-sm">
        <p className="font-medium">Changes won&apos;t persist yet</p>
        <p className="mt-0.5 text-amber-200/80">
          Connect Supabase and run{" "}
          <code className="rounded bg-amber-500/15 px-1 py-0.5 text-xs">
            scripts/005_settings_center.sql
          </code>{" "}
          to save these settings to your database.
        </p>
      </div>
    </div>
  )
}

/** Sticky action bar that appears when there are unsaved changes. */
export function SettingsSaveBar({
  dirty,
  saving,
  onSave,
  onReset,
}: {
  dirty: boolean
  saving: boolean
  onSave: () => void
  onReset: () => void
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-10 -mx-4 mt-2 flex items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur transition-all sm:-mx-6 sm:px-6",
        dirty
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <p className="text-sm text-muted-foreground">
        {dirty ? "You have unsaved changes" : "All changes saved"}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          disabled={saving}
        >
          Discard
        </Button>
        <Button type="submit" size="sm" onClick={onSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </div>
  )
}

/**
 * Full layout for a KV-backed settings section: header, config notice, the
 * form body, and a sticky save bar — all wired to a `useSettingsForm` result.
 */
export function SettingsForm<K extends KvSectionKey>({
  form,
  title,
  description,
  children,
}: {
  form: UseSettingsForm<K>
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void form.save()
      }}
      className="flex flex-col gap-6"
    >
      <SettingsHeader title={title} description={description} />
      <ConfigNotice configured={form.configured} />
      {children}
      <SettingsSaveBar
        dirty={form.dirty}
        saving={form.status === "saving"}
        onSave={() => void form.save()}
        onReset={form.reset}
      />
    </form>
  )
}

/** Centered loading state for a section that's fetching its data. */
export function SettingsLoading() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
