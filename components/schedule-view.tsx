"use client"

import * as React from "react"
import {
  CalendarClockIcon,
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
} from "lucide-react"

import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/app-nav/page-header"
import { useRestaurantSelector } from "@/hooks/use-restaurant-selector"
import { useToast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DAYS,
  dayLabel,
  SERVICE_TYPE_SUGGESTIONS,
  BOOKING_INTERVALS,
  DURATION_PRESETS,
  formatTime,
  isOvernight,
  validatePeriod,
  findOverlap,
  groupByDay,
  type ServicePeriod,
} from "@/lib/schedule"

type DurationMode = "preset" | "custom"

type Draft = {
  name: string
  start_time: string
  end_time: string
  booking_interval_minutes: number
  durationMode: DurationMode
  default_duration_minutes: number
  min_party_size: number
  max_party_size: number
}

const NEW_DRAFT: Draft = {
  name: "Dinner",
  start_time: "18:00",
  end_time: "23:00",
  booking_interval_minutes: 30,
  durationMode: "preset",
  default_duration_minutes: 90,
  min_party_size: 1,
  max_party_size: 8,
}

function periodToDraft(p: ServicePeriod): Draft {
  const isPreset = (DURATION_PRESETS as readonly number[]).includes(
    p.default_duration_minutes,
  )
  return {
    name: p.name,
    start_time: p.start_time,
    end_time: p.end_time,
    booking_interval_minutes: p.booking_interval_minutes,
    durationMode: isPreset ? "preset" : "custom",
    default_duration_minutes: p.default_duration_minutes,
    min_party_size: p.min_party_size,
    max_party_size: p.max_party_size,
  }
}

type EditorState = {
  day: number
  periodId: string | null
  draft: Draft
}

export function ScheduleView() {
  const { selected } = useRestaurantSelector()
  const slug = selected?.slug ?? null
  const restaurantName = selected?.name ?? null

  const [periods, setPeriods] = React.useState<ServicePeriod[]>([])
  const [loading, setLoading] = React.useState(true)
  const [needsMigration, setNeedsMigration] = React.useState(false)
  const [configured, setConfigured] = React.useState(true)
  const [editor, setEditor] = React.useState<EditorState | null>(null)
  const [copyDay, setCopyDay] = React.useState<number | null>(null)
  const [copyTargets, setCopyTargets] = React.useState<Set<number>>(new Set())
  const [busy, setBusy] = React.useState(false)
  const { success, error: toastError } = useToast()

  const load = React.useCallback(async () => {
    if (!slug) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/admin/schedule?restaurant=${encodeURIComponent(slug)}`,
      )
      const payload = (await res.json()) as {
        periods?: ServicePeriod[]
        configured?: boolean
        needsMigration?: boolean
        error?: string
      }
      if (!res.ok) throw new Error(payload.error ?? "Failed to load schedule.")
      setPeriods(payload.periods ?? [])
      setConfigured(payload.configured !== false)
      setNeedsMigration(Boolean(payload.needsMigration))
    } catch (err) {
      toastError(
        "Couldn't load schedule",
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setLoading(false)
    }
  }, [slug, toastError])

  React.useEffect(() => {
    void load()
  }, [load])

  const grouped = React.useMemo(() => groupByDay(periods), [periods])

  /* ---- Editor open/close ----------------------------------------- */

  const openAdd = (day: number) => {
    setCopyDay(null)
    setEditor({ day, periodId: null, draft: { ...NEW_DRAFT } })
  }
  const openEdit = (p: ServicePeriod) => {
    setCopyDay(null)
    setEditor({ day: p.day_of_week, periodId: p.id, draft: periodToDraft(p) })
  }
  const closeEditor = () => setEditor(null)

  const patchDraft = (patch: Partial<Draft>) =>
    setEditor((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e))

  /* ---- Save (create or update) ----------------------------------- */

  const submitEditor = async () => {
    if (!editor || !slug) return
    const d = editor.draft
    const payloadPeriod = {
      day_of_week: editor.day,
      name: d.name.trim() || "Service",
      start_time: d.start_time,
      end_time: d.end_time,
      booking_interval_minutes: d.booking_interval_minutes,
      default_duration_minutes: d.default_duration_minutes,
      min_party_size: d.min_party_size,
      max_party_size: d.max_party_size,
    }

    // Client-side validation first for instant feedback.
    const valid = validatePeriod(payloadPeriod)
    if (!valid.ok) {
      toastError("Invalid service period", valid.error)
      return
    }
    const conflict = findOverlap(payloadPeriod, periods, editor.periodId ?? undefined)
    if (conflict) {
      toastError(
        "Overlapping service",
        `Conflicts with "${conflict.name}" (${formatTime(conflict.start_time)}–${formatTime(conflict.end_time)}).`,
      )
      return
    }

    setBusy(true)
    try {
      const isEdit = editor.periodId !== null
      const res = await fetch(
        isEdit
          ? `/api/admin/schedule/${editor.periodId}`
          : "/api/admin/schedule",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurant: slug,
            name: restaurantName,
            period: payloadPeriod,
          }),
        },
      )
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(payload.error ?? "Failed to save.")
      success(isEdit ? "Service updated" : "Service added")
      closeEditor()
      await load()
    } catch (err) {
      toastError(
        "Couldn't save service",
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setBusy(false)
    }
  }

  /* ---- Delete ---------------------------------------------------- */

  const deletePeriod = async (p: ServicePeriod) => {
    if (!slug) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/admin/schedule/${p.id}?restaurant=${encodeURIComponent(slug)}`,
        { method: "DELETE" },
      )
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(payload.error ?? "Failed to delete.")
      success("Service removed")
      await load()
    } catch (err) {
      toastError(
        "Couldn't delete service",
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setBusy(false)
    }
  }

  /* ---- Copy day to other days ------------------------------------ */

  const openCopy = (day: number) => {
    setEditor(null)
    setCopyDay(day)
    setCopyTargets(new Set())
  }
  const toggleTarget = (day: number) =>
    setCopyTargets((prev) => {
      const next = new Set(prev)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })

  const submitCopy = async () => {
    if (copyDay === null || !slug || copyTargets.size === 0) return
    const source = grouped[copyDay].filter((p) => p.active)
    if (source.length === 0) {
      toastError("Nothing to copy", "This day has no service periods.")
      return
    }

    setBusy(true)
    let created = 0
    let skipped = 0
    try {
      for (const target of copyTargets) {
        for (const p of source) {
          const candidate = {
            day_of_week: target,
            name: p.name,
            start_time: p.start_time,
            end_time: p.end_time,
            booking_interval_minutes: p.booking_interval_minutes,
            default_duration_minutes: p.default_duration_minutes,
            min_party_size: p.min_party_size,
            max_party_size: p.max_party_size,
          }
          const res = await fetch("/api/admin/schedule", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              restaurant: slug,
              name: restaurantName,
              period: candidate,
            }),
          })
          if (res.ok) created += 1
          else skipped += 1
        }
      }
      if (created > 0) {
        success(
          `Copied ${created} service${created === 1 ? "" : "s"}`,
          skipped > 0 ? `${skipped} skipped (overlaps).` : undefined,
        )
      } else {
        toastError("Nothing copied", "All targets overlapped existing services.")
      }
      setCopyDay(null)
      setCopyTargets(new Set())
      await load()
    } finally {
      setBusy(false)
    }
  }

  /* ---- Render ---------------------------------------------------- */

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        badge="Planning"
        icon={CalendarClockIcon}
        title="Schedule"
        subtitle="Define your recurring weekly service hours and booking rules."
      />

      {needsMigration && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
          <TriangleAlertIcon className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">Schedule storage isn&apos;t set up yet</p>
            <p className="mt-0.5 text-amber-200/80">
              Run{" "}
              <code className="rounded bg-amber-500/15 px-1 py-0.5 text-xs">
                scripts/008_schedule.sql
              </code>{" "}
              to save your weekly schedule.
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
              Connect Supabase to save your weekly schedule.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {DAYS.map((day) => (
            <DayCard
              key={day.value}
              day={day.value}
              periods={grouped[day.value] ?? []}
              editor={editor?.day === day.value ? editor : null}
              copyOpen={copyDay === day.value}
              copyTargets={copyTargets}
              busy={busy}
              onAdd={() => openAdd(day.value)}
              onEdit={openEdit}
              onDelete={deletePeriod}
              onOpenCopy={() => openCopy(day.value)}
              onCancelCopy={() => setCopyDay(null)}
              onToggleTarget={toggleTarget}
              onSubmitCopy={submitCopy}
              onPatchDraft={patchDraft}
              onSubmitEditor={submitEditor}
              onCancelEditor={closeEditor}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ================================================================== */
/* Day card                                                            */
/* ================================================================== */

function DayCard({
  day,
  periods,
  editor,
  copyOpen,
  copyTargets,
  busy,
  onAdd,
  onEdit,
  onDelete,
  onOpenCopy,
  onCancelCopy,
  onToggleTarget,
  onSubmitCopy,
  onPatchDraft,
  onSubmitEditor,
  onCancelEditor,
}: {
  day: number
  periods: ServicePeriod[]
  editor: EditorState | null
  copyOpen: boolean
  copyTargets: Set<number>
  busy: boolean
  onAdd: () => void
  onEdit: (p: ServicePeriod) => void
  onDelete: (p: ServicePeriod) => void
  onOpenCopy: () => void
  onCancelCopy: () => void
  onToggleTarget: (day: number) => void
  onSubmitCopy: () => void
  onPatchDraft: (patch: Partial<Draft>) => void
  onSubmitEditor: () => void
  onCancelEditor: () => void
}) {
  const active = periods.filter((p) => p.active)
  const isClosed = active.length === 0
  const addingNew = editor !== null && editor.periodId === null
  const hasCopySource = active.length > 0

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      {/* Day header */}
      <header className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <h2 className="font-heading text-sm font-semibold tracking-tight">
            {dayLabel(day)}
          </h2>
          {isClosed ? (
            <Badge variant="outline" className="text-muted-foreground">
              Closed
            </Badge>
          ) : (
            <Badge className="bg-emerald-500/15 text-emerald-500 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400">
              Open
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {hasCopySource && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={copyOpen ? onCancelCopy : onOpenCopy}
              disabled={busy}
            >
              <CopyIcon className="size-3.5" />
              <span className="hidden sm:inline">Copy to…</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={onAdd}
            disabled={busy || addingNew}
          >
            <PlusIcon className="size-3.5" />
            Add service
          </Button>
        </div>
      </header>

      {/* Copy-to panel */}
      {copyOpen && (
        <div className="flex flex-col gap-3 border-b border-border bg-primary/5 px-4 py-4 sm:px-5">
          <p className="text-sm font-medium">
            Copy {dayLabel(day)}&apos;s services to:
          </p>
          <div className="flex flex-wrap gap-2">
            {DAYS.filter((d) => d.value !== day).map((d) => {
              const checked = copyTargets.has(d.value)
              return (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => onToggleTarget(d.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                    checked
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded border",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40",
                    )}
                  >
                    {checked && <CheckIcon className="size-3" />}
                  </span>
                  {d.short}
                </button>
              )
            })}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={onSubmitCopy}
              disabled={busy || copyTargets.size === 0}
            >
              {busy ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Copying…
                </>
              ) : (
                `Copy to ${copyTargets.size || ""} day${copyTargets.size === 1 ? "" : "s"}`.trim()
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancelCopy}
              disabled={busy}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Body: periods + editor */}
      <div className="flex flex-col">
        {isClosed && !addingNew && !editor && (
          <p className="px-4 py-4 text-sm text-muted-foreground sm:px-5">
            Closed — no service periods.
          </p>
        )}

        {periods.map((p) =>
          editor && editor.periodId === p.id ? (
            <PeriodEditor
              key={p.id}
              draft={editor.draft}
              busy={busy}
              onPatch={onPatchDraft}
              onSubmit={onSubmitEditor}
              onCancel={onCancelEditor}
            />
          ) : (
            <PeriodRow
              key={p.id}
              period={p}
              busy={busy}
              onEdit={() => onEdit(p)}
              onDelete={() => onDelete(p)}
            />
          ),
        )}

        {addingNew && editor && (
          <PeriodEditor
            draft={editor.draft}
            busy={busy}
            onPatch={onPatchDraft}
            onSubmit={onSubmitEditor}
            onCancel={onCancelEditor}
          />
        )}
      </div>
    </section>
  )
}

/* ================================================================== */
/* Read-only period row                                                */
/* ================================================================== */

function PeriodRow({
  period,
  busy,
  onEdit,
  onDelete,
}: {
  period: ServicePeriod
  busy: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const overnight = isOvernight(period.start_time, period.end_time)
  return (
    <div className="flex flex-col gap-3 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{period.name}</span>
          {overnight && (
            <Badge
              variant="outline"
              className="gap-1 text-[10px] text-muted-foreground"
            >
              <MoonIcon className="size-3" />
              Overnight
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 text-sm text-foreground">
            <ClockIcon className="size-3.5 text-muted-foreground" />
            {formatTime(period.start_time)} — {formatTime(period.end_time)}
          </span>
          <span>{period.booking_interval_minutes} min slots</span>
          <span>{period.default_duration_minutes} min duration</span>
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="size-3" />
            {period.min_party_size}–{period.max_party_size}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={onEdit}
          disabled={busy}
        >
          <PencilIcon className="size-3.5" />
          Edit
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={busy}
        >
          <Trash2Icon className="size-3.5" />
          <span className="sr-only sm:not-sr-only">Delete</span>
        </Button>
      </div>
    </div>
  )
}

/* ================================================================== */
/* Inline editor                                                       */
/* ================================================================== */

function PeriodEditor({
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
    <div className="flex flex-col gap-4 border-b border-border bg-muted/20 px-4 py-4 last:border-b-0 sm:px-5">
      {/* Service name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="svc-name">Service name</Label>
        <Input
          id="svc-name"
          value={draft.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Dinner"
          list="service-type-suggestions"
          className="max-w-xs"
        />
        <datalist id="service-type-suggestions">
          {SERVICE_TYPE_SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      {/* Times */}
      <div className="grid grid-cols-2 gap-3 sm:max-w-xs">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="svc-start">Start</Label>
          <Input
            id="svc-start"
            type="time"
            value={draft.start_time}
            onChange={(e) => onPatch({ start_time: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="svc-end">End</Label>
          <Input
            id="svc-end"
            type="time"
            value={draft.end_time}
            onChange={(e) => onPatch({ end_time: e.target.value })}
          />
        </div>
      </div>
      {isOvernight(draft.start_time, draft.end_time) && (
        <p className="-mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <MoonIcon className="size-3.5" />
          Ends after midnight (overnight service).
        </p>
      )}

      {/* Reservation settings */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label>Booking interval</Label>
          <Select
            value={String(draft.booking_interval_minutes)}
            onValueChange={(v) =>
              onPatch({ booking_interval_minutes: Number(v ?? 30) })
            }
          >
            <SelectTrigger className="w-full">
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
          <Label>Default duration</Label>
          <Select
            value={draft.durationMode === "custom" ? "custom" : String(draft.default_duration_minutes)}
            onValueChange={(v) => {
              if (v === "custom") {
                onPatch({ durationMode: "custom" })
              } else {
                onPatch({
                  durationMode: "preset",
                  default_duration_minutes: Number(v),
                })
              }
            }}
          >
            <SelectTrigger className="w-full">
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
          {draft.durationMode === "custom" && (
            <Input
              type="number"
              min={15}
              max={600}
              step={5}
              value={draft.default_duration_minutes}
              onChange={(e) =>
                onPatch({ default_duration_minutes: Number(e.target.value) })
              }
              className="mt-1"
            />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="svc-min">Min party</Label>
          <Input
            id="svc-min"
            type="number"
            min={1}
            value={draft.min_party_size}
            onChange={(e) => onPatch({ min_party_size: Number(e.target.value) })}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="svc-max">Max party</Label>
          <Input
            id="svc-max"
            type="number"
            min={1}
            value={draft.max_party_size}
            onChange={(e) => onPatch({ max_party_size: Number(e.target.value) })}
          />
        </div>
      </div>

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
              Save service
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
  )
}
