"use client"

import * as React from "react"
import {
  LayersIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  Loader2Icon,
  TriangleAlertIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ArmchairIcon,
  Table2Icon,
  EyeIcon,
  EyeOffIcon,
  CheckIcon,
  XIcon,
  DownloadIcon,
  RefreshCwIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/app-nav/page-header"
import { useRestaurantSelector } from "@/hooks/use-restaurant-selector"
import { useToast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  ZONE_COLORS,
  ZONE_NAME_SUGGESTIONS,
  ZONE_NAME_MAX,
  zoneColor,
  validateZoneInput,
  type ZoneWithStats,
  type UnregisteredZone,
} from "@/lib/zones"

type Draft = {
  name: string
  description: string
  reservable: boolean
  active: boolean
  capacityMode: "auto" | "override"
  capacity_override: number
  color_tag: string
  internal_notes: string
}

const NEW_DRAFT: Draft = {
  name: "",
  description: "",
  reservable: true,
  active: true,
  capacityMode: "auto",
  capacity_override: 0,
  color_tag: ZONE_COLORS[0].value,
  internal_notes: "",
}

function zoneToDraft(z: ZoneWithStats): Draft {
  return {
    name: z.name,
    description: z.description ?? "",
    reservable: z.reservable,
    active: z.active,
    capacityMode: z.capacity_override != null ? "override" : "auto",
    capacity_override: z.capacity_override ?? z.stats.total_seats,
    color_tag: z.color_tag ?? ZONE_COLORS[0].value,
    internal_notes: z.internal_notes ?? "",
  }
}

type EditorState = { zoneId: string | null; draft: Draft }

export function SpacesView() {
  const { selected } = useRestaurantSelector()
  const slug = selected?.slug ?? null
  const restaurantId = selected?.id ?? null
  const restaurantName = selected?.name ?? null

  const [zones, setZones] = React.useState<ZoneWithStats[]>([])
  const [unregistered, setUnregistered] = React.useState<UnregisteredZone[]>([])
  const [loading, setLoading] = React.useState(true)
  const [configured, setConfigured] = React.useState(true)
  const [needsMigration, setNeedsMigration] = React.useState(false)
  const [editor, setEditor] = React.useState<EditorState | null>(null)
  const [busy, setBusy] = React.useState(false)
  const { success, error: toastError } = useToast()

  const scope = React.useCallback(() => {
    const params = new URLSearchParams()
    if (slug) params.set("restaurant", slug)
    if (restaurantId) params.set("restaurantId", restaurantId)
    if (restaurantName) params.set("name", restaurantName)
    return params
  }, [slug, restaurantId, restaurantName])

  const mutationScope = React.useCallback(
    () => ({
      restaurant: slug,
      restaurantId,
      name: restaurantName,
    }),
    [slug, restaurantId, restaurantName],
  )

  const load = React.useCallback(async () => {
    if (!slug && !restaurantId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/zones?${scope().toString()}`)
      const payload = (await res.json()) as {
        zones?: ZoneWithStats[]
        unregistered?: UnregisteredZone[]
        configured?: boolean
        needsMigration?: boolean
        error?: string
      }
      if (!res.ok) throw new Error(payload.error ?? "Failed to load zones.")
      setZones(payload.zones ?? [])
      setUnregistered(payload.unregistered ?? [])
      setConfigured(payload.configured !== false)
      setNeedsMigration(Boolean(payload.needsMigration))
    } catch (err) {
      toastError(
        "Couldn't load zones",
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setLoading(false)
    }
  }, [slug, restaurantId, scope, toastError])

  React.useEffect(() => {
    void load()
  }, [load])

  /* ---- Editor open/close ----------------------------------------- */

  const openAdd = () => setEditor({ zoneId: null, draft: { ...NEW_DRAFT } })
  const openEdit = (z: ZoneWithStats) =>
    setEditor({ zoneId: z.id, draft: zoneToDraft(z) })
  const closeEditor = () => setEditor(null)
  const patchDraft = (patch: Partial<Draft>) =>
    setEditor((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e))

  /* ---- Save (create or update) ----------------------------------- */

  const submitEditor = async () => {
    if (!editor || (!slug && !restaurantId)) return
    const d = editor.draft
    const capacity_override =
      d.capacityMode === "override" ? d.capacity_override : null

    const check = validateZoneInput({ name: d.name, capacity_override })
    if (!check.ok) {
      toastError("Invalid zone", check.error)
      return
    }

    setBusy(true)
    try {
      const isEdit = editor.zoneId !== null
      const res = await fetch(
        isEdit ? `/api/admin/zones/${editor.zoneId}` : "/api/admin/zones",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...mutationScope(),
            zone: {
              name: d.name.trim(),
              description: d.description,
              reservable: d.reservable,
              active: d.active,
              capacity_override,
              color_tag: d.color_tag,
              internal_notes: d.internal_notes,
            },
          }),
        },
      )
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(payload.error ?? "Failed to save zone.")
      success(isEdit ? "Zone updated" : "Zone added")
      closeEditor()
      await load()
    } catch (err) {
      toastError(
        "Couldn't save zone",
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setBusy(false)
    }
  }

  /* ---- Toggle active --------------------------------------------- */

  const toggleActive = async (z: ZoneWithStats) => {
    if (!slug && !restaurantId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/zones/${z.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...mutationScope(), zone: { active: !z.active } }),
      })
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(payload.error ?? "Failed to update zone.")
      success(z.active ? "Zone deactivated" : "Zone activated")
      await load()
    } catch (err) {
      toastError(
        "Couldn't update zone",
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setBusy(false)
    }
  }

  /* ---- Delete ---------------------------------------------------- */

  const deleteZone = async (z: ZoneWithStats) => {
    if (!slug && !restaurantId) return
    setBusy(true)
    try {
      const params = scope()
      const res = await fetch(`/api/admin/zones/${z.id}?${params.toString()}`, {
        method: "DELETE",
      })
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(payload.error ?? "Failed to delete zone.")
      success("Zone removed")
      await load()
    } catch (err) {
      toastError(
        "Couldn't delete zone",
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setBusy(false)
    }
  }

  /* ---- Reorder --------------------------------------------------- */

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= zones.length) return
    const next = [...zones]
    const [item] = next.splice(index, 1)
    next.splice(target, 0, item)
    setZones(next) // optimistic
    setBusy(true)
    try {
      const res = await fetch("/api/admin/zones/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...mutationScope(),
          order: next.map((z) => z.id),
        }),
      })
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string }
        throw new Error(payload.error ?? "Failed to reorder.")
      }
    } catch (err) {
      toastError(
        "Couldn't reorder zones",
        err instanceof Error ? err.message : undefined,
      )
      await load() // revert to server truth
    } finally {
      setBusy(false)
    }
  }

  /* ---- Import an unregistered zone name -------------------------- */

  const importZone = async (name: string) => {
    if (!slug && !restaurantId) return
    setBusy(true)
    try {
      const res = await fetch("/api/admin/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...mutationScope(), zone: { name } }),
      })
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(payload.error ?? "Failed to import zone.")
      success(`Imported "${name}"`)
      await load()
    } catch (err) {
      toastError(
        "Couldn't import zone",
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setBusy(false)
    }
  }

  /* ---- Render ---------------------------------------------------- */

  const totalTables = zones.reduce((sum, z) => sum + z.stats.table_count, 0)
  const totalSeats = zones.reduce((sum, z) => sum + z.stats.total_seats, 0)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        badge="Planning"
        icon={LayersIcon}
        title="Spaces / Zones"
        subtitle="Organize your venue into dining areas that power the floor plan and availability."
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading || busy}
          className="gap-1.5"
        >
          <RefreshCwIcon className={cn("size-4", loading && "animate-spin")} />
          Refresh
        </Button>
        <Button
          size="sm"
          onClick={openAdd}
          disabled={busy || editor?.zoneId === null}
          className="gap-1.5"
        >
          <PlusIcon className="size-4" />
          Add zone
        </Button>
      </PageHeader>

      {needsMigration && (
        <Banner
          title="Zone storage isn't set up yet"
          body={
            <>
              Run{" "}
              <code className="rounded bg-amber-500/15 px-1 py-0.5 text-xs">
                scripts/009_spaces_zones.sql
              </code>{" "}
              to save and manage your zones.
            </>
          }
        />
      )}
      {!configured && (
        <Banner
          title="Changes won't persist yet"
          body="Connect Supabase to save your zones."
        />
      )}

      {/* Summary strip */}
      {!loading && zones.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <SummaryStat label="Zones" value={String(zones.length)} />
          <SummaryStat label="Tables" value={String(totalTables)} />
          <SummaryStat label="Seats" value={String(totalSeats)} />
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Add-new editor at the top */}
          {editor?.zoneId === null && (
            <ZoneEditor
              draft={editor.draft}
              busy={busy}
              onPatch={patchDraft}
              onSubmit={submitEditor}
              onCancel={closeEditor}
            />
          )}

          {zones.length === 0 && editor?.zoneId !== null && (
            <EmptyState onAdd={openAdd} disabled={busy} />
          )}

          {zones.map((z, i) =>
            editor?.zoneId === z.id ? (
              <ZoneEditor
                key={z.id}
                draft={editor.draft}
                busy={busy}
                onPatch={patchDraft}
                onSubmit={submitEditor}
                onCancel={closeEditor}
              />
            ) : (
              <ZoneRow
                key={z.id}
                zone={z}
                busy={busy}
                isFirst={i === 0}
                isLast={i === zones.length - 1}
                onEdit={() => openEdit(z)}
                onDelete={() => void deleteZone(z)}
                onToggleActive={() => void toggleActive(z)}
                onMoveUp={() => void move(i, -1)}
                onMoveDown={() => void move(i, 1)}
              />
            ),
          )}

          {/* Unregistered (legacy) zones detected on tables */}
          {unregistered.length > 0 && (
            <section className="mt-2 flex flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/20 p-4">
              <div className="flex flex-col gap-1">
                <h2 className="font-heading text-sm font-semibold tracking-tight">
                  Detected on your tables
                </h2>
                <p className="text-xs text-muted-foreground text-pretty">
                  These area names are used by existing tables but aren&apos;t
                  managed zones yet. Import one to manage it here — your tables
                  aren&apos;t changed.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                {unregistered.map((u) => (
                  <div
                    key={u.name}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{u.name}</span>
                      <span className="text-muted-foreground">
                        · {u.stats.table_count} table
                        {u.stats.table_count === 1 ? "" : "s"} ·{" "}
                        {u.stats.total_seats} seats
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 self-start text-xs sm:self-auto"
                      onClick={() => void importZone(u.name)}
                      disabled={busy}
                    >
                      <DownloadIcon className="size-3.5" />
                      Import
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/* Sub-components                                                      */
/* ================================================================== */

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-heading text-lg font-semibold tabular-nums">
        {value}
      </span>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
    </div>
  )
}

function Banner({
  title,
  body,
}: {
  title: string
  body: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
      <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" />
      <div className="text-sm">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-amber-200/80">{body}</p>
      </div>
    </div>
  )
}

function EmptyState({
  onAdd,
  disabled,
}: {
  onAdd: () => void
  disabled: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <LayersIcon className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">No zones yet</p>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          Create zones like Main Dining, Terrace, or VIP to organize your
          seating areas.
        </p>
      </div>
      <Button onClick={onAdd} disabled={disabled} size="sm" className="gap-1.5">
        <PlusIcon className="size-4" />
        Add your first zone
      </Button>
    </div>
  )
}

function ZoneRow({
  zone,
  busy,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onToggleActive,
  onMoveUp,
  onMoveDown,
}: {
  zone: ZoneWithStats
  busy: boolean
  isFirst: boolean
  isLast: boolean
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const color = zoneColor(zone.color_tag)
  const overridden = zone.capacity_override != null

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-4",
        !zone.active && "opacity-70",
      )}
    >
      {/* Reorder controls */}
      <div className="flex shrink-0 flex-row gap-1 sm:flex-col">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={busy || isFirst}
          aria-label={`Move ${zone.name} up`}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <ChevronUpIcon className="size-4" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={busy || isLast}
          aria-label={`Move ${zone.name} down`}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <ChevronDownIcon className="size-4" />
        </button>
      </div>

      {/* Identity + stats */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span
            className={cn("size-2.5 shrink-0 rounded-full", color.dot)}
            aria-hidden
          />
          <h3 className="truncate font-heading text-sm font-semibold tracking-tight">
            {zone.name}
          </h3>
        </div>
        {zone.description && (
          <p className="text-xs text-muted-foreground text-pretty">
            {zone.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {zone.active ? (
            <Badge className="bg-emerald-500/15 text-emerald-500 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400">
              Active
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Inactive
            </Badge>
          )}
          {zone.reservable ? (
            <Badge variant="secondary" className="gap-1">
              Reservable
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Non-reservable
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Table2Icon className="size-3.5" />
            {zone.stats.table_count} table
            {zone.stats.table_count === 1 ? "" : "s"}
            {zone.stats.blocked_tables > 0 && (
              <span className="text-muted-foreground/70">
                {" "}
                ({zone.stats.blocked_tables} blocked)
              </span>
            )}
          </span>
          <span className="inline-flex items-center gap-1">
            <ArmchairIcon className="size-3.5" />
            {zone.effective_capacity} seats
            {overridden && (
              <span className="text-muted-foreground/70">
                {" "}
                (override)
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <span className="mr-1 text-xs text-muted-foreground">Delete?</span>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => {
                setConfirmDelete(false)
                onDelete()
              }}
              disabled={busy}
            >
              <CheckIcon className="size-3.5" />
              Yes
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setConfirmDelete(false)}
              disabled={busy}
            >
              <XIcon className="size-3.5" />
              No
            </Button>
          </div>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onToggleActive}
              disabled={busy}
              aria-label={zone.active ? "Deactivate zone" : "Activate zone"}
              title={zone.active ? "Deactivate" : "Activate"}
            >
              {zone.active ? (
                <EyeOffIcon className="size-4" />
              ) : (
                <EyeIcon className="size-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={onEdit}
              disabled={busy}
              aria-label="Edit zone"
              title="Edit"
            >
              <PencilIcon className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              aria-label="Delete zone"
              title="Delete"
            >
              <Trash2Icon className="size-4" />
            </Button>
          </>
        )}
      </div>
    </section>
  )
}

function ZoneEditor({
  draft,
  busy,
  onPatch,
  onSubmit,
  onCancel,
}: {
  draft: Draft
  busy: boolean
  onPatch: (patch: Partial<Draft>) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-primary/40 bg-primary/5 p-4 sm:p-5">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="zone-name">Zone name</Label>
        <Input
          id="zone-name"
          value={draft.name}
          maxLength={ZONE_NAME_MAX}
          placeholder="e.g. Main Dining"
          onChange={(e) => onPatch({ name: e.target.value })}
          disabled={busy}
          autoFocus
        />
        <div className="flex flex-wrap gap-1.5 pt-1">
          {ZONE_NAME_SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onPatch({ name: s })}
              disabled={busy}
              className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="zone-description">Description</Label>
        <Input
          id="zone-description"
          value={draft.description}
          placeholder="Short note shown to your team (optional)"
          onChange={(e) => onPatch({ description: e.target.value })}
          disabled={busy}
        />
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Active</span>
            <span className="text-xs text-muted-foreground">
              Available for use across the app
            </span>
          </div>
          <Switch
            checked={draft.active}
            onCheckedChange={(v) => onPatch({ active: v })}
            disabled={busy}
            aria-label="Active"
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2.5">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Reservable</span>
            <span className="text-xs text-muted-foreground">
              Guests can book tables here
            </span>
          </div>
          <Switch
            checked={draft.reservable}
            onCheckedChange={(v) => onPatch({ reservable: v })}
            disabled={busy}
            aria-label="Reservable"
          />
        </div>
      </div>

      {/* Capacity */}
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3 py-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-medium">Capacity override</span>
            <span className="text-xs text-muted-foreground text-pretty">
              By default capacity is calculated from this zone&apos;s tables.
            </span>
          </div>
          <Switch
            checked={draft.capacityMode === "override"}
            onCheckedChange={(v) =>
              onPatch({ capacityMode: v ? "override" : "auto" })
            }
            disabled={busy}
            aria-label="Enable capacity override"
          />
        </div>
        {draft.capacityMode === "override" && (
          <div className="flex items-center gap-2 pt-1">
            <Input
              type="number"
              min={0}
              value={draft.capacity_override}
              onChange={(e) =>
                onPatch({ capacity_override: Number(e.target.value) })
              }
              disabled={busy}
              className="w-28"
              aria-label="Capacity override seats"
            />
            <span className="text-sm text-muted-foreground">seats</span>
          </div>
        )}
      </div>

      {/* Color */}
      <div className="flex flex-col gap-2">
        <Label>Color tag</Label>
        <div className="flex flex-wrap gap-2">
          {ZONE_COLORS.map((c) => {
            const active = draft.color_tag === c.value
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => onPatch({ color_tag: c.value })}
                disabled={busy}
                aria-label={c.label}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                <span className={cn("size-3 rounded-full", c.dot)} aria-hidden />
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Internal notes */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="zone-notes">Internal notes</Label>
        <Textarea
          id="zone-notes"
          value={draft.internal_notes}
          placeholder="Private notes for staff (optional)"
          onChange={(e) => onPatch({ internal_notes: e.target.value })}
          disabled={busy}
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button onClick={onSubmit} disabled={busy} size="sm" className="gap-1.5">
          {busy ? (
            <>
              <Loader2Icon className="size-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <CheckIcon className="size-4" />
              Save zone
            </>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
      </div>
    </section>
  )
}
