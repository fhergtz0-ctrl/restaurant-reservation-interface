"use client"

import * as React from "react"
import {
  CalendarOffIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  CopyIcon,
  ClockIcon,
  UsersIcon,
  XIcon,
  CheckIcon,
  Loader2Icon,
  MoonIcon,
  TriangleAlertIcon,
  CalendarDaysIcon,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SPECIAL_DAY_TYPES,
  BOOKING_INTERVALS,
  DURATION_PRESETS,
  SERVICE_TYPE_SUGGESTIONS,
  formatTime,
  formatSpecialDate,
  weekdayName,
  isOvernight,
  typeLabel,
  validateSpecialDay,
  validatePeriodSet,
  findPeriodOverlap,
  filterSpecialDays,
  sortSpecialDays,
  todayISO,
  type SpecialDay,
  type SpecialDayType,
  type DayFilter,
} from "@/lib/special-days"

type DurationMode = "preset" | "custom"

type PeriodDraft = {
  name: string
  start_time: string
  end_time: string
  booking_interval_minutes: number
  durationMode: DurationMode
  default_duration_minutes: number
  min_party_size: number
  max_party_size: number
}

type DayDraft = {
  special_date: string
  name: string
  type: SpecialDayType
  is_open: boolean
  description: string
  internal_notes: string
  periods: PeriodDraft[]
}

type EditorState = {
  /** Existing row id, or null when adding / duplicating. */
  id: string | null
  draft: DayDraft
}

const NEW_PERIOD: PeriodDraft = {
  name: "Dinner",
  start_time: "18:00",
  end_time: "22:00",
  booking_interval_minutes: 30,
  durationMode: "preset",
  default_duration_minutes: 90,
  min_party_size: 1,
  max_party_size: 8,
}

function blankDraft(): DayDraft {
  return {
    special_date: "",
    name: "",
    type: "holiday",
    is_open: false,
    description: "",
    internal_notes: "",
    periods: [],
  }
}

function dayToDraft(day: SpecialDay): DayDraft {
  return {
    special_date: day.special_date,
    name: day.name,
    type: day.type,
    is_open: day.is_open,
    description: day.description ?? "",
    internal_notes: day.internal_notes ?? "",
    periods: day.periods.map((p) => ({
      name: p.name,
      start_time: p.start_time,
      end_time: p.end_time,
      booking_interval_minutes: p.booking_interval_minutes,
      durationMode: (DURATION_PRESETS as readonly number[]).includes(
        p.default_duration_minutes,
      )
        ? "preset"
        : "custom",
      default_duration_minutes: p.default_duration_minutes,
      min_party_size: p.min_party_size,
      max_party_size: p.max_party_size,
    })),
  }
}

const FILTERS: { value: DayFilter; label: string }[] = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
]

export function SpecialDaysView() {
  const { selected } = useRestaurantSelector()
  const slug = selected?.slug ?? null
  const restaurantId = selected?.id ?? null
  const restaurantName = selected?.name ?? null

  const [days, setDays] = React.useState<SpecialDay[]>([])
  const [loading, setLoading] = React.useState(true)
  const [needsMigration, setNeedsMigration] = React.useState(false)
  const [configured, setConfigured] = React.useState(true)
  const [filter, setFilter] = React.useState<DayFilter>("upcoming")
  const [editor, setEditor] = React.useState<EditorState | null>(null)
  const [busy, setBusy] = React.useState(false)
  const { success, error: toastError } = useToast()

  const load = React.useCallback(async () => {
    if (!slug && !restaurantId) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (slug) params.set("restaurant", slug)
      if (restaurantId) params.set("restaurantId", restaurantId)
      const res = await fetch(`/api/admin/special-days?${params.toString()}`)
      const payload = (await res.json()) as {
        days?: SpecialDay[]
        configured?: boolean
        needsMigration?: boolean
        error?: string
      }
      if (!res.ok) throw new Error(payload.error ?? "Failed to load special days.")
      setDays(payload.days ?? [])
      setConfigured(payload.configured !== false)
      setNeedsMigration(Boolean(payload.needsMigration))
    } catch (err) {
      toastError(
        "Couldn't load special days",
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setLoading(false)
    }
  }, [slug, restaurantId, toastError])

  React.useEffect(() => {
    void load()
  }, [load])

  const visible = React.useMemo(() => {
    const filtered = filterSpecialDays(days, filter)
    return sortSpecialDays(filtered, filter)
  }, [days, filter])

  const counts = React.useMemo(
    () => ({
      upcoming: filterSpecialDays(days, "upcoming").length,
      past: filterSpecialDays(days, "past").length,
      all: days.length,
    }),
    [days],
  )

  /* ---- Editor open/close ----------------------------------------- */

  const openAdd = () => setEditor({ id: null, draft: blankDraft() })
  const openEdit = (day: SpecialDay) =>
    setEditor({ id: day.id, draft: dayToDraft(day) })
  const openDuplicate = (day: SpecialDay) => {
    // Copy everything except the date — the user must choose a new one.
    const draft = dayToDraft(day)
    draft.special_date = ""
    draft.name = `${day.name} (copy)`
    setEditor({ id: null, draft })
  }
  const closeEditor = () => setEditor(null)

  const patchDraft = (patch: Partial<DayDraft>) =>
    setEditor((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e))

  /* ---- Period draft helpers -------------------------------------- */

  const addPeriod = () =>
    setEditor((e) =>
      e
        ? { ...e, draft: { ...e.draft, periods: [...e.draft.periods, { ...NEW_PERIOD }] } }
        : e,
    )
  const patchPeriod = (index: number, patch: Partial<PeriodDraft>) =>
    setEditor((e) =>
      e
        ? {
            ...e,
            draft: {
              ...e.draft,
              periods: e.draft.periods.map((p, i) =>
                i === index ? { ...p, ...patch } : p,
              ),
            },
          }
        : e,
    )
  const removePeriod = (index: number) =>
    setEditor((e) =>
      e
        ? {
            ...e,
            draft: {
              ...e.draft,
              periods: e.draft.periods.filter((_, i) => i !== index),
            },
          }
        : e,
    )

  /* ---- Save ------------------------------------------------------- */

  const submitEditor = async () => {
    if (!editor || (!slug && !restaurantId)) return
    const d = editor.draft

    const topValid = validateSpecialDay({
      special_date: d.special_date,
      name: d.name,
      type: d.type,
    })
    if (!topValid.ok) {
      toastError("Check the details", topValid.error)
      return
    }

    const periodsPayload = d.is_open
      ? d.periods.map((p) => ({
          name: p.name.trim() || "Service",
          start_time: p.start_time,
          end_time: p.end_time,
          booking_interval_minutes: p.booking_interval_minutes,
          default_duration_minutes: p.default_duration_minutes,
          min_party_size: p.min_party_size,
          max_party_size: p.max_party_size,
        }))
      : []

    if (d.is_open && periodsPayload.length > 0) {
      const setValid = validatePeriodSet(periodsPayload)
      if (!setValid.ok) {
        toastError("Check the service hours", setValid.error)
        return
      }
    }

    setBusy(true)
    try {
      const isEdit = editor.id !== null
      const res = await fetch(
        isEdit
          ? `/api/admin/special-days/${editor.id}`
          : "/api/admin/special-days",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurant: slug,
            restaurantId,
            name: restaurantName,
            day: {
              special_date: d.special_date,
              name: d.name.trim(),
              type: d.type,
              is_open: d.is_open,
              description: d.description,
              internal_notes: d.internal_notes,
              periods: periodsPayload,
            },
          }),
        },
      )
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(payload.error ?? "Failed to save.")
      success(isEdit ? "Special day updated" : "Special day added")
      closeEditor()
      await load()
    } catch (err) {
      toastError(
        "Couldn't save special day",
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setBusy(false)
    }
  }

  /* ---- Delete ---------------------------------------------------- */

  const deleteDay = async (day: SpecialDay) => {
    if (!slug && !restaurantId) return
    setBusy(true)
    try {
      const params = new URLSearchParams()
      if (slug) params.set("restaurant", slug)
      if (restaurantId) params.set("restaurantId", restaurantId)
      const res = await fetch(
        `/api/admin/special-days/${day.id}?${params.toString()}`,
        { method: "DELETE" },
      )
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(payload.error ?? "Failed to delete.")
      success("Special day removed")
      if (editor?.id === day.id) closeEditor()
      await load()
    } catch (err) {
      toastError(
        "Couldn't delete special day",
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setBusy(false)
    }
  }

  /* ---- Render ---------------------------------------------------- */

  const addingNew = editor !== null && editor.id === null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        badge="Planning"
        icon={CalendarOffIcon}
        title="Special Days"
        subtitle="Manage closures and date-specific schedule overrides."
      >
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          onClick={openAdd}
          disabled={busy || addingNew}
        >
          <PlusIcon className="size-4" />
          Add special day
        </Button>
      </PageHeader>

      {needsMigration && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Special Days storage isn&apos;t set up yet</p>
            <p className="mt-0.5 text-amber-200/80">
              Run{" "}
              <code className="rounded bg-amber-500/15 px-1 py-0.5 text-xs">
                scripts/010_special_days.sql
              </code>{" "}
              to save closures and date-specific hours.
            </p>
          </div>
        </div>
      )}

      {!configured && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Changes won&apos;t persist yet</p>
            <p className="mt-0.5 text-amber-200/80">
              Connect Supabase to save your special days.
            </p>
          </div>
        </div>
      )}

      {/* Add-new editor (top of list) */}
      {addingNew && editor && (
        <DayEditor
          draft={editor.draft}
          busy={busy}
          onPatch={patchDraft}
          onAddPeriod={addPeriod}
          onPatchPeriod={patchPeriod}
          onRemovePeriod={removePeriod}
          onSubmit={submitEditor}
          onCancel={closeEditor}
        />
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1 self-start">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
            <span className="ml-1.5 text-xs opacity-70">{counts[f.value]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState filter={filter} onAdd={openAdd} disabled={busy || addingNew} />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((day) =>
            editor && editor.id === day.id ? (
              <DayEditor
                key={day.id}
                draft={editor.draft}
                busy={busy}
                onPatch={patchDraft}
                onAddPeriod={addPeriod}
                onPatchPeriod={patchPeriod}
                onRemovePeriod={removePeriod}
                onSubmit={submitEditor}
                onCancel={closeEditor}
              />
            ) : (
              <DayCard
                key={day.id}
                day={day}
                busy={busy}
                onEdit={() => openEdit(day)}
                onDuplicate={() => openDuplicate(day)}
                onDelete={() => deleteDay(day)}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/* Empty state                                                         */
/* ================================================================== */

function EmptyState({
  filter,
  onAdd,
  disabled,
}: {
  filter: DayFilter
  onAdd: () => void
  disabled: boolean
}) {
  if (filter === "past") {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
        <CalendarDaysIcon className="size-8 text-muted-foreground" />
        <p className="text-sm font-medium">No past special days</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Closures and overrides from earlier dates will appear here.
        </p>
      </div>
    )
  }
  return (
    <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <CalendarOffIcon className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium">No special days yet</p>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          Add closures, holidays, private events, or date-specific service
          hours.
        </p>
      </div>
      <Button type="button" className="mt-1 gap-1.5" onClick={onAdd} disabled={disabled}>
        <PlusIcon className="size-4" />
        Add your first special day
      </Button>
    </div>
  )
}

/* ================================================================== */
/* Read-only day card                                                  */
/* ================================================================== */

function DayCard({
  day,
  busy,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  day: SpecialDay
  busy: boolean
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const past = day.special_date < todayISO()
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        past && "opacity-70",
      )}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-heading text-sm font-semibold tracking-tight">
              {formatSpecialDate(day.special_date)}
            </span>
            <span className="text-xs text-muted-foreground">
              {weekdayName(day.special_date)}
            </span>
            {day.is_open ? (
              <Badge className="bg-emerald-500/15 text-emerald-500 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400">
                Open
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Closed
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              {typeLabel(day.type)}
            </Badge>
          </div>
          <p className="text-base font-medium">{day.name}</p>
          {day.description && (
            <p className="max-w-prose text-sm text-muted-foreground text-pretty">
              {day.description}
            </p>
          )}

          {/* Service hours summary */}
          {day.is_open && day.periods.length > 0 ? (
            <div className="mt-1 flex flex-col gap-1.5">
              {day.periods.map((p) => {
                const overnight = isOvernight(p.start_time, p.end_time)
                return (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
                  >
                    <span className="inline-flex items-center gap-1 text-sm text-foreground">
                      <ClockIcon className="size-3.5 text-muted-foreground" />
                      <span className="font-medium">{p.name}</span>
                      {formatTime(p.start_time)}&nbsp;—&nbsp;{formatTime(p.end_time)}
                    </span>
                    {overnight && (
                      <Badge
                        variant="outline"
                        className="gap-1 text-[10px] text-muted-foreground"
                      >
                        <MoonIcon className="size-3" />
                        Overnight
                      </Badge>
                    )}
                    <span>{p.booking_interval_minutes} min slots</span>
                    <span className="inline-flex items-center gap-1">
                      <UsersIcon className="size-3" />
                      {p.min_party_size}–{p.max_party_size}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : day.is_open ? (
            <p className="text-sm text-muted-foreground">
              Open — no service hours defined yet.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Closed all day — no availability.
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 sm:shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 p-0"
            onClick={onDuplicate}
            disabled={busy}
            aria-label="Duplicate special day"
          >
            <CopyIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 p-0"
            onClick={onEdit}
            disabled={busy}
            aria-label="Edit special day"
          >
            <PencilIcon className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="size-8 p-0 text-destructive hover:text-destructive"
            onClick={onDelete}
            disabled={busy}
            aria-label="Delete special day"
          >
            <Trash2Icon className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/* Inline day editor                                                   */
/* ================================================================== */

function DayEditor({
  draft,
  busy,
  onPatch,
  onAddPeriod,
  onPatchPeriod,
  onRemovePeriod,
  onSubmit,
  onCancel,
}: {
  draft: DayDraft
  busy: boolean
  onPatch: (patch: Partial<DayDraft>) => void
  onAddPeriod: () => void
  onPatchPeriod: (index: number, patch: Partial<PeriodDraft>) => void
  onRemovePeriod: (index: number) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-primary/40 bg-card ring-1 ring-primary/20">
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        {/* Date + name */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sd-date">Date</Label>
            <Input
              id="sd-date"
              type="date"
              value={draft.special_date}
              onChange={(e) => onPatch({ special_date: e.target.value })}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sd-name">Name</Label>
            <Input
              id="sd-name"
              value={draft.name}
              onChange={(e) => onPatch({ name: e.target.value })}
              placeholder="Christmas Eve"
              maxLength={80}
            />
          </div>
        </div>

        {/* Type + open toggle */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <Select
              value={draft.type}
              onValueChange={(v) => onPatch({ type: (v ?? "other") as SpecialDayType })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SPECIAL_DAY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Availability</Label>
            <div className="flex h-9 items-center gap-3 rounded-lg border border-border px-3">
              <Switch
                checked={draft.is_open}
                onCheckedChange={(checked) => onPatch({ is_open: checked })}
              />
              <span className="text-sm">
                {draft.is_open ? "Open — custom hours" : "Closed all day"}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sd-desc">Description</Label>
          <Textarea
            id="sd-desc"
            value={draft.description}
            onChange={(e) => onPatch({ description: e.target.value })}
            placeholder="Optional — shown alongside this date."
            className="min-h-16"
          />
        </div>

        {/* Internal notes */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sd-notes">Internal notes</Label>
          <Textarea
            id="sd-notes"
            value={draft.internal_notes}
            onChange={(e) => onPatch({ internal_notes: e.target.value })}
            placeholder="Optional — staff-only, never shown to guests."
            className="min-h-16"
          />
        </div>

        {/* Service periods (only when open) */}
        {draft.is_open && (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Service hours</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={onAddPeriod}
                disabled={busy}
              >
                <PlusIcon className="size-3.5" />
                Add service
              </Button>
            </div>

            {draft.periods.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No service hours yet. Add at least one, or switch to Closed.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {draft.periods.map((p, i) => (
                  <PeriodFields
                    key={i}
                    index={i}
                    period={p}
                    siblings={draft.periods}
                    busy={busy}
                    onPatch={onPatchPeriod}
                    onRemove={onRemovePeriod}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={onSubmit} disabled={busy}>
            {busy ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <CheckIcon className="size-4" />
                Save special day
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={busy}
          >
            <XIcon className="size-4" />
            Cancel
          </Button>
        </div>
      </div>
    </section>
  )
}

/* ================================================================== */
/* Single service-period field group (always editable)                */
/* ================================================================== */

function PeriodFields({
  index,
  period,
  siblings,
  busy,
  onPatch,
  onRemove,
}: {
  index: number
  period: PeriodDraft
  siblings: PeriodDraft[]
  busy: boolean
  onPatch: (index: number, patch: Partial<PeriodDraft>) => void
  onRemove: (index: number) => void
}) {
  const overnight = isOvernight(period.start_time, period.end_time)
  const overlaps = findPeriodOverlap(period, siblings, index) !== null

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          value={period.name}
          onChange={(e) => onPatch(index, { name: e.target.value })}
          placeholder="Dinner"
          list="sd-service-suggestions"
          className="h-8 max-w-[12rem] text-sm"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="size-8 p-0 text-destructive hover:text-destructive"
          onClick={() => onRemove(index)}
          disabled={busy}
          aria-label="Remove service"
        >
          <Trash2Icon className="size-4" />
        </Button>
      </div>
      <datalist id="sd-service-suggestions">
        {SERVICE_TYPE_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {/* Times */}
      <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Start</Label>
          <Input
            type="time"
            value={period.start_time}
            onChange={(e) => onPatch(index, { start_time: e.target.value })}
            className="h-9"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">End</Label>
          <Input
            type="time"
            value={period.end_time}
            onChange={(e) => onPatch(index, { end_time: e.target.value })}
            className="h-9"
          />
        </div>
      </div>
      {overnight && (
        <p className="-mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <MoonIcon className="size-3.5" />
          Ends after midnight (overnight service).
        </p>
      )}
      {overlaps && (
        <p className="-mt-1 inline-flex items-center gap-1.5 text-xs text-destructive">
          <TriangleAlertIcon className="size-3.5" />
          Overlaps another service on this date.
        </p>
      )}

      {/* Reservation settings */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Booking interval</Label>
          <Select
            value={String(period.booking_interval_minutes)}
            onValueChange={(v) =>
              onPatch(index, { booking_interval_minutes: Number(v ?? 30) })
            }
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BOOKING_INTERVALS.map((i) => (
                <SelectItem key={i} value={String(i)}>
                  {i} min
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Default duration</Label>
          <Select
            value={
              period.durationMode === "custom"
                ? "custom"
                : String(period.default_duration_minutes)
            }
            onValueChange={(v) => {
              if (v === "custom") onPatch(index, { durationMode: "custom" })
              else
                onPatch(index, {
                  durationMode: "preset",
                  default_duration_minutes: Number(v),
                })
            }}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATION_PRESETS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} min
                </SelectItem>
              ))}
              <SelectItem value="custom">Custom…</SelectItem>
            </SelectContent>
          </Select>
          {period.durationMode === "custom" && (
            <Input
              type="number"
              min={15}
              max={600}
              step={5}
              value={period.default_duration_minutes}
              onChange={(e) =>
                onPatch(index, {
                  default_duration_minutes: Number(e.target.value),
                })
              }
              className="mt-1 h-9"
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Min party</Label>
          <Input
            type="number"
            min={1}
            value={period.min_party_size}
            onChange={(e) =>
              onPatch(index, { min_party_size: Number(e.target.value) })
            }
            className="h-9"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-xs">Max party</Label>
          <Input
            type="number"
            min={1}
            value={period.max_party_size}
            onChange={(e) =>
              onPatch(index, { max_party_size: Number(e.target.value) })
            }
            className="h-9"
          />
        </div>
      </div>
    </div>
  )
}
