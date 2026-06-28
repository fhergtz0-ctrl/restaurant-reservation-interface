"use client"

import * as React from "react"
import { HistoryIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { useRestaurants } from "@/components/app-shell/restaurant-context"
import { SettingsHeader, SettingsLoading } from "@/components/settings/settings-section"
import type { AuditEntry } from "@/lib/settings/lists"

function formatWhen(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export function AuditSection() {
  const { selected } = useRestaurants()
  const slug = selected?.slug ?? null
  const restaurantId = selected?.id ?? null

  const [items, setItems] = React.useState<AuditEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [configured, setConfigured] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    if (!slug && !restaurantId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams()
    if (slug) params.set("restaurant", slug)
    if (restaurantId) params.set("restaurantId", restaurantId)
    void (async () => {
      try {
        const res = await fetch(`/api/admin/audit?${params.toString()}`)
        const payload = (await res.json()) as {
          data?: AuditEntry[]
          configured?: boolean
        }
        if (cancelled) return
        setItems(payload.data ?? [])
        setConfigured(payload.configured !== false)
      } catch (err) {
        console.log("[v0] audit load error:", err instanceof Error ? err.message : err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug, restaurantId])

  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader
        title="Audit Log"
        description="A record of administrative changes across your workspace. Read-only."
      />

      {loading ? (
        <SettingsLoading />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <HistoryIcon className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">No activity yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {configured
                ? "Changes to settings, experiences, and the team will appear here."
                : "Connect Supabase and run scripts/005_settings_center.sql to start recording activity."}
            </p>
          </div>
        </div>
      ) : (
        <ol className="flex flex-col gap-px overflow-hidden rounded-xl border border-border bg-border">
          {items.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start justify-between gap-4 bg-card px-4 py-3"
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-mono">
                    {entry.action}
                  </Badge>
                  {entry.section ? (
                    <span className="text-xs text-muted-foreground">
                      {entry.section}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm">
                  {entry.summary ?? "Change recorded"}
                </p>
                {entry.actorEmail ? (
                  <p className="text-xs text-muted-foreground">
                    by {entry.actorEmail}
                  </p>
                ) : null}
              </div>
              <time className="shrink-0 text-xs text-muted-foreground">
                {formatWhen(entry.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
