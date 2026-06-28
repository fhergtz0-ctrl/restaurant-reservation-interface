"use client"

import * as React from "react"
import { PlusIcon, PencilIcon, Trash2Icon, SparklesIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { useRestaurants } from "@/components/app-shell/restaurant-context"
import { useToast } from "@/components/ui/toast"
import { SettingsHeader, SettingsLoading } from "@/components/settings/settings-section"
import {
  FieldGrid,
  TextField,
  TextareaField,
  NumberField,
  SwitchField,
} from "@/components/settings/fields"
import {
  experienceInputSchema,
  defaultExperienceInput,
  type Experience,
  type ExperienceInput,
} from "@/lib/settings/lists"

type Errors = Partial<Record<keyof ExperienceInput, string>>

function formatPrice(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100)
}

export function ExperiencesSection() {
  const { selected } = useRestaurants()
  const toast = useToast()
  const slug = selected?.slug ?? null
  const restaurantId = selected?.id ?? null

  const [items, setItems] = React.useState<Experience[]>([])
  const [loading, setLoading] = React.useState(true)
  const [configured, setConfigured] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Experience | null>(null)

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
      const res = await fetch(`/api/admin/experiences?${params.toString()}`)
      const payload = (await res.json()) as {
        data?: Experience[]
        configured?: boolean
      }
      setItems(payload.data ?? [])
      setConfigured(payload.configured !== false)
    } catch (err) {
      console.log("[v0] experiences load error:", err instanceof Error ? err.message : err)
    } finally {
      setLoading(false)
    }
  }, [slug, restaurantId])

  React.useEffect(() => {
    void load()
  }, [load])

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }
  const openEdit = (exp: Experience) => {
    setEditing(exp)
    setDialogOpen(true)
  }

  const handleDelete = async (exp: Experience) => {
    const params = new URLSearchParams()
    if (slug) params.set("restaurant", slug)
    if (restaurantId) params.set("restaurantId", restaurantId)
    const prev = items
    setItems((list) => list.filter((e) => e.id !== exp.id))
    try {
      const res = await fetch(
        `/api/admin/experiences/${exp.id}?${params.toString()}`,
        { method: "DELETE" },
      )
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string }
        setItems(prev)
        toast.error("Couldn't delete experience", payload.error)
      } else {
        toast.success("Experience deleted")
      }
    } catch {
      setItems(prev)
      toast.error("Couldn't delete experience", "Please try again.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader
        title="Experiences"
        description="Prix-fixe menus, tasting events, and special offerings guests can book."
        action={
          <Button type="button" size="sm" onClick={openCreate} className="gap-1.5">
            <PlusIcon className="size-4" />
            New experience
          </Button>
        }
      />

      {!configured ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Connect Supabase and run{" "}
          <code className="rounded bg-amber-500/15 px-1 py-0.5 text-xs">
            scripts/005_settings_center.sql
          </code>{" "}
          to create and save experiences.
        </div>
      ) : null}

      {loading ? (
        <SettingsLoading />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <SparklesIcon className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">No experiences yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create tasting menus, chef&apos;s tables, or seasonal events.
            </p>
          </div>
          <Button type="button" size="sm" onClick={openCreate} className="mt-1 gap-1.5">
            <PlusIcon className="size-4" />
            New experience
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((exp) => (
            <li
              key={exp.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{exp.name}</span>
                  <Badge variant={exp.active ? "secondary" : "outline"}>
                    {exp.active ? "Active" : "Hidden"}
                  </Badge>
                </div>
                {exp.description ? (
                  <p className="max-w-prose text-sm text-muted-foreground">
                    {exp.description}
                  </p>
                ) : null}
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{formatPrice(exp.priceCents)} / guest</span>
                  <span>{exp.durationMinutes} min</span>
                  <span>
                    {exp.minGuests}–{exp.maxGuests} guests
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => openEdit(exp)}
                  className="gap-1.5"
                >
                  <PencilIcon className="size-4" />
                  Edit
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDelete(exp)}
                  className="gap-1.5 text-destructive hover:text-destructive"
                >
                  <Trash2Icon className="size-4" />
                  <span className="sr-only sm:not-sr-only">Delete</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ExperienceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        slug={slug}
        restaurantId={restaurantId}
        onSaved={() => {
          setDialogOpen(false)
          void load()
        }}
      />
    </div>
  )
}

function ExperienceDialog({
  open,
  onOpenChange,
  editing,
  slug,
  restaurantId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Experience | null
  slug: string | null
  restaurantId: string | null
  onSaved: () => void
}) {
  const toast = useToast()
  const [values, setValues] = React.useState<ExperienceInput>(defaultExperienceInput)
  const [errors, setErrors] = React.useState<Errors>({})
  const [saving, setSaving] = React.useState(false)

  // Sync form values whenever the dialog opens for a new target.
  React.useEffect(() => {
    if (!open) return
    if (editing) {
      setValues({
        name: editing.name,
        description: editing.description,
        priceCents: editing.priceCents,
        durationMinutes: editing.durationMinutes,
        minGuests: editing.minGuests,
        maxGuests: editing.maxGuests,
        active: editing.active,
      })
    } else {
      setValues(defaultExperienceInput)
    }
    setErrors({})
  }, [open, editing])

  const setField = <F extends keyof ExperienceInput>(
    field: F,
    value: ExperienceInput[F],
  ) => {
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => {
      if (!prev[field]) return prev
      const next = { ...prev }
      delete next[field]
      return next
    })
  }

  const submit = async () => {
    const parsed = experienceInputSchema.safeParse(values)
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors as Record<string, string[] | undefined>
      const mapped: Errors = {}
      for (const [key, msgs] of Object.entries(flat)) {
        if (msgs && msgs[0]) mapped[key as keyof ExperienceInput] = msgs[0]
      }
      setErrors(mapped)
      return
    }
    if (parsed.data.maxGuests < parsed.data.minGuests) {
      setErrors({ maxGuests: "Max guests must be at least the minimum." })
      return
    }

    setSaving(true)
    try {
      const url = editing
        ? `/api/admin/experiences/${editing.id}`
        : `/api/admin/experiences`
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant: slug,
          restaurantId,
          data: parsed.data,
        }),
      })
      if (res.ok) {
        toast.success(editing ? "Experience updated" : "Experience created")
        onSaved()
      } else {
        const payload = (await res.json()) as { error?: string }
        toast.error("Couldn't save experience", payload.error)
      }
    } catch {
      toast.error("Couldn't save experience", "Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit experience" : "New experience"}
          </DialogTitle>
          <DialogDescription>
            Configure the details guests see when booking this offering.
          </DialogDescription>
        </DialogHeader>

        <div className={cn("flex flex-col gap-5")}>
          <TextField
            label="Name"
            required
            value={values.name}
            onChange={(v) => setField("name", v)}
            error={errors.name}
            placeholder="Chef's Tasting Menu"
          />
          <TextareaField
            label="Description"
            value={values.description}
            onChange={(v) => setField("description", v)}
            error={errors.description}
            rows={3}
            placeholder="A seven-course seasonal journey…"
          />
          <FieldGrid>
            <NumberField
              label="Price per guest"
              value={values.priceCents / 100}
              onChange={(v) =>
                setField("priceCents", Math.round((Number.isFinite(v) ? v : 0) * 100))
              }
              error={errors.priceCents}
              min={0}
              suffix="USD"
            />
            <NumberField
              label="Duration"
              value={values.durationMinutes}
              onChange={(v) => setField("durationMinutes", v)}
              error={errors.durationMinutes}
              min={30}
              max={480}
              step={15}
              suffix="min"
            />
            <NumberField
              label="Min guests"
              value={values.minGuests}
              onChange={(v) => setField("minGuests", v)}
              error={errors.minGuests}
              min={1}
              max={100}
            />
            <NumberField
              label="Max guests"
              value={values.maxGuests}
              onChange={(v) => setField("maxGuests", v)}
              error={errors.maxGuests}
              min={1}
              max={100}
            />
          </FieldGrid>
          <SwitchField
            label="Active"
            description="Show this experience to guests when booking."
            checked={values.active}
            onChange={(v) => setField("active", v)}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create experience"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
