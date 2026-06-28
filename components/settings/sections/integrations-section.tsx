"use client"

import * as React from "react"
import { PlugIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { useRestaurants } from "@/components/app-shell/restaurant-context"
import { useToast } from "@/components/ui/toast"
import {
  SettingsHeader,
  SettingsLoading,
} from "@/components/settings/settings-section"
import {
  INTEGRATION_CATALOG,
  type IntegrationProvider,
  type IntegrationState,
} from "@/lib/settings/lists"

const CATEGORY_ORDER: IntegrationProvider["category"][] = [
  "Payments",
  "Messaging",
  "Analytics",
  "Operations",
]

export function IntegrationsSection() {
  const { selected } = useRestaurants()
  const toast = useToast()
  const slug = selected?.slug ?? null
  const restaurantId = selected?.id ?? null

  const [states, setStates] = React.useState<Record<string, IntegrationState>>(
    {},
  )
  const [loading, setLoading] = React.useState(true)
  const [configured, setConfigured] = React.useState(true)
  const [pending, setPending] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!slug && !restaurantId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams()
    if (slug) params.set("restaurant", slug)
    if (restaurantId) params.set("restaurantId", restaurantId)
    try {
      const res = await fetch(`/api/admin/integrations?${params.toString()}`)
      const payload = (await res.json()) as {
        data?: IntegrationState[]
        configured?: boolean
      }
      const map: Record<string, IntegrationState> = {}
      for (const s of payload.data ?? []) map[s.provider] = s
      setStates(map)
      setConfigured(payload.configured !== false)
    } catch (err) {
      console.log(
        "[v0] integrations load error:",
        err instanceof Error ? err.message : err,
      )
    } finally {
      setLoading(false)
    }
  }, [slug, restaurantId])

  React.useEffect(() => {
    void load()
  }, [load])

  async function toggle(provider: IntegrationProvider, enabled: boolean) {
    const prev = states
    setStates((s) => ({
      ...s,
      [provider.key]: {
        provider: provider.key,
        enabled,
        config: s[provider.key]?.config ?? {},
      },
    }))
    setPending(provider.key)
    try {
      const res = await fetch("/api/admin/integrations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant: slug,
          restaurantId,
          data: {
            provider: provider.key,
            enabled,
            config: prev[provider.key]?.config ?? {},
          },
        }),
      })
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string }
        setStates(prev)
        toast.error("Couldn't update integration", payload.error)
      } else {
        toast.success(
          `${provider.name} ${enabled ? "connected" : "disconnected"}`,
        )
      }
    } catch {
      setStates(prev)
      toast.error("Couldn't update integration", "Please try again.")
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader
        title="Integrations"
        description="Connect third-party services to extend payments, messaging, and analytics."
      />

      {!configured ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Connect Supabase and run{" "}
          <code className="rounded bg-amber-500/15 px-1 py-0.5 text-xs">
            scripts/005_settings_center.sql
          </code>{" "}
          to manage integrations.
        </div>
      ) : null}

      {loading ? (
        <SettingsLoading />
      ) : (
        <div className="flex flex-col gap-8">
          {CATEGORY_ORDER.map((category) => {
            const providers = INTEGRATION_CATALOG.filter(
              (p) => p.category === category,
            )
            if (providers.length === 0) return null
            return (
              <section key={category} className="flex flex-col gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {providers.map((provider) => {
                    const enabled = states[provider.key]?.enabled ?? false
                    return (
                      <li
                        key={provider.key}
                        className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4"
                      >
                        <div className="flex items-start gap-3">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <PlugIcon className="size-5" />
                          </span>
                          <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                              {provider.name}
                              {enabled ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[11px]"
                                >
                                  Connected
                                </Badge>
                              ) : null}
                            </span>
                            <p className="text-xs text-muted-foreground text-pretty">
                              {provider.description}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={enabled}
                          disabled={pending === provider.key || !configured}
                          onCheckedChange={(v: boolean) =>
                            void toggle(provider, v)
                          }
                          aria-label={`Toggle ${provider.name}`}
                        />
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
