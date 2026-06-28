"use client"

import * as React from "react"

import { useRestaurants } from "@/components/app-shell/restaurant-context"
import { useToast } from "@/components/ui/toast"
import { KV_SECTIONS, type KvSectionKey } from "@/lib/settings/schemas"

type SectionValue<K extends KvSectionKey> = (typeof KV_SECTIONS)[K]["default"]
type FieldErrors<K extends KvSectionKey> = Partial<
  Record<keyof SectionValue<K>, string>
>

export type SettingsFormStatus = "loading" | "idle" | "saving"

export type UseSettingsForm<K extends KvSectionKey> = {
  values: SectionValue<K>
  setField: <F extends keyof SectionValue<K>>(
    field: F,
    value: SectionValue<K>[F],
  ) => void
  errors: FieldErrors<K>
  status: SettingsFormStatus
  dirty: boolean
  /** False when Supabase isn't configured — UI shows a connect-to-persist note. */
  configured: boolean
  save: () => Promise<void>
  reset: () => void
}

/**
 * Loads, edits, validates (zod, shared with the server) and persists one KV
 * settings section for the currently-selected restaurant. Exposes loading /
 * saving / dirty / error state and surfaces success and error toasts.
 */
export function useSettingsForm<K extends KvSectionKey>(
  section: K,
): UseSettingsForm<K> {
  const { selected } = useRestaurants()
  const slug = selected?.slug ?? null
  const restaurantId = selected?.id ?? null
  const { schema, default: fallback } = KV_SECTIONS[section]
  const toast = useToast()

  const [values, setValues] = React.useState<SectionValue<K>>(
    fallback as SectionValue<K>,
  )
  const [loaded, setLoaded] = React.useState<SectionValue<K>>(
    fallback as SectionValue<K>,
  )
  const [status, setStatus] = React.useState<SettingsFormStatus>("loading")
  const [configured, setConfigured] = React.useState(true)
  const [errors, setErrors] = React.useState<FieldErrors<K>>({})

  // Load whenever the selected restaurant changes.
  React.useEffect(() => {
    let cancelled = false
    if (!slug && !restaurantId) {
      setStatus("idle")
      return
    }
    setStatus("loading")
    const params = new URLSearchParams()
    if (slug) params.set("restaurant", slug)
    if (restaurantId) params.set("restaurantId", restaurantId)

    void (async () => {
      try {
        const res = await fetch(
          `/api/admin/settings/${section}?${params.toString()}`,
        )
        const payload = (await res.json()) as {
          data?: unknown
          configured?: boolean
          error?: string
        }
        if (cancelled) return
        if (!res.ok) {
          toast.error("Couldn't load settings", payload.error)
          setStatus("idle")
          return
        }
        const parsed = schema.safeParse({
          ...(fallback as object),
          ...(payload.data as object | null),
        })
        const next = (
          parsed.success ? parsed.data : fallback
        ) as SectionValue<K>
        setValues(next)
        setLoaded(next)
        setConfigured(payload.configured !== false)
        setStatus("idle")
      } catch (err) {
        if (cancelled) return
        console.log(
          "[v0] useSettingsForm load error:",
          err instanceof Error ? err.message : err,
        )
        setStatus("idle")
      }
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, slug, restaurantId])

  const setField = React.useCallback(
    <F extends keyof SectionValue<K>>(
      field: F,
      value: SectionValue<K>[F],
    ) => {
      setValues((prev) => ({ ...prev, [field]: value }))
      setErrors((prev) => {
        if (!prev[field]) return prev
        const next = { ...prev }
        delete next[field]
        return next
      })
    },
    [],
  )

  const reset = React.useCallback(() => {
    setValues(loaded)
    setErrors({})
  }, [loaded])

  const dirty = React.useMemo(
    () => JSON.stringify(values) !== JSON.stringify(loaded),
    [values, loaded],
  )

  const save = React.useCallback(async () => {
    // Client-side validation using the shared schema.
    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >
      const mapped: FieldErrors<K> = {}
      for (const [key, msgs] of Object.entries(flat)) {
        if (msgs && msgs[0]) {
          mapped[key as keyof SectionValue<K>] = msgs[0]
        }
      }
      setErrors(mapped)
      toast.error("Please fix the highlighted fields")
      return
    }

    setStatus("saving")
    try {
      const res = await fetch(`/api/admin/settings/${section}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant: slug,
          restaurantId,
          data: parsed.data,
        }),
      })
      const payload = (await res.json()) as {
        ok?: boolean
        error?: string
        fieldErrors?: Record<string, string[]>
        data?: unknown
      }

      if (res.ok) {
        const saved = parsed.data as SectionValue<K>
        setValues(saved)
        setLoaded(saved)
        setErrors({})
        toast.success("Settings saved")
      } else if (res.status === 422 && payload.fieldErrors) {
        const mapped: FieldErrors<K> = {}
        for (const [key, msgs] of Object.entries(payload.fieldErrors)) {
          if (msgs && msgs[0]) mapped[key as keyof SectionValue<K>] = msgs[0]
        }
        setErrors(mapped)
        toast.error("Please fix the highlighted fields")
      } else {
        toast.error("Couldn't save settings", payload.error)
      }
    } catch (err) {
      console.log(
        "[v0] useSettingsForm save error:",
        err instanceof Error ? err.message : err,
      )
      toast.error("Couldn't save settings", "Please try again.")
    } finally {
      setStatus("saving" as SettingsFormStatus)
      setStatus("idle")
    }
  }, [schema, values, section, slug, restaurantId, toast])

  return {
    values,
    setField,
    errors,
    status,
    dirty,
    configured,
    save,
    reset,
  }
}
