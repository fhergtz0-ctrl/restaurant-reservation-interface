"use client"

import * as React from "react"
import {
  CombineIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  Loader2Icon,
  TriangleAlertIcon,
  EyeIcon,
  EyeOffIcon,
  CheckIcon,
  XIcon,
  RefreshCwIcon,
  ArmchairIcon,
  MapPinIcon,
  UsersIcon,
  BanIcon,
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
  validateCombinationInput,
  previewCalculatedCapacity,
  previewZoneSummary,
  MIN_MEMBER_TABLES,
  COMBINATION_NAME_MAX,
  type CombinationWithSummary,
  type SelectableTable,
} from "@/lib/table-combinations"

/* ------------------------------------------------------------------ */
/* Draft model                                                         */
/* ------------------------------------------------------------------ */

type Draft = {
  name: string
  active: boolean
  capacityMode: "auto" | "override"
  capacity_override: number
  internal_notes: string
  tableIds: string[]
}

const NEW_DRAFT: Draft = {
  name: "",
  active: true,
  capacityMode: "auto",
  capacity_override: 0,
  internal_notes: "",
  tableIds: [],
}

function comboToDraft(c: CombinationWithSummary): Draft {
  return {
    name: c.name,
    active: c.active,
    capacityMode: c.capacity_override != null ? "override" : "auto",
    capacity_override: c.capacity_override ?? c.calculated_capacity,
    internal_notes: c.internal_notes ?? "",
    tableIds: c.members.map((m) => m.table_id),
  }
}

type EditorState = { comboId: string | null; draft: Draft }

/* ------------------------------------------------------------------ */
/* Main view                                                           */
/* ------------------------------------------------------------------ */

export function CombinationsView() {
  const { selected } = useRestaurantSelector()
  const slug = selected?.slug ?? null
  const restaurantId = selected?.id ?? null
  const restaurantName = selected?.name ?? null

  const [combinations, setCombinations] = React.useState<
    CombinationWithSummary[]
  >([])
  const [tables, setTables] = React.useState<SelectableTable[]>([])
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
    () => ({ restaurant: slug, restaurantId, name: restaurantName }),
    [slug, restaurantId, restaurantName],
  )

  const load = React.useCallback(async () => {
    if (!slug && !restaurantId) return
    setLoading(true)
    try {
      const res = await fetch(
        `/api/admin/table-combinations?${scope().toString()}`,
      )
      const payload = (await res.json()) as {
        combinations?: CombinationWithSummary[]
        tables?: SelectableTable[]
        configured?: boolean
        needsMigration?: boolean
        error?: string
      }
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to load combinations.")
      }
      setCombinations(payload.combinations ?? [])
      setTables(payload.tables ?? [])
      setConfigured(payload.configured !== false)
      setNeedsMigration(Boolean(payload.needsMigration))
    } catch (err) {
      toastError(
        "Couldn't load combinations",
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

  const openAdd = () => setEditor({ comboId: null, draft: { ...NEW_DRAFT } })
  const openEdit = (c: CombinationWithSummary) =>
    setEditor({ comboId: c.id, draft: comboToDraft(c) })
  const closeEditor = () => setEditor(null)
  const patchDraft = (patch: Partial<Draft>) =>
    setEditor((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e))

  /* ---- Save (create or update) ----------------------------------- */

  const submitEditor = async () => {
    if (!editor || (!slug && !restaurantId)) return
    const d = editor.draft
    const capacityOverride =
      d.capacityMode === "override" ? d.capacity_override : null

    const check = validateCombinationInput({
      name: d.name,
      tableIds: d.tableIds,
      capacityOverride,
    })
    if (!check.ok) {
      toastError("Invalid combination", check.error)
      return
    }

    setBusy(true)
    try {
      const isEdit = editor.comboId !== null
      const res = await fetch(
        isEdit
          ? `/api/admin/table-combinations/${editor.comboId}`
          : "/api/admin/table-combinations",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...mutationScope(),
            combination: {
              name: d.name.trim(),
              active: d.active,
              capacityOverride,
              internalNotes: d.internal_notes,
              tableIds: d.tableIds,
            },
          }),
        },
      )
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to save combination.")
      }
      success(isEdit ? "Combination updated" : "Combination added")
      closeEditor()
      await load()
    } catch (err) {
      toastError(
        "Couldn't save combination",
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setBusy(false)
    }
  }

  /* ---- Toggle active --------------------------------------------- */

  const toggleActive = async (c: CombinationWithSummary) => {
    if (!slug && !restaurantId) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/table-combinations/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...mutationScope(),
          combination: { active: !c.active },
        }),
      })
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to update combination.")
      }
      success(c.active ? "Combination deactivated" : "Combination activated")
      await load()
    } catch (err) {
      toastError(
        "Couldn't update combination",
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setBusy(false)
    }
  }

  /* ---- Delete ---------------------------------------------------- */

  const deleteCombo = async (c: CombinationWithSummary) => {
    if (!slug && !restaurantId) return
    setBusy(true)
    try {
      const res = await fetch(
        `/api/admin/table-combinations/${c.id}?${scope().toString()}`,
        { method: "DELETE" },
      )
      const payload = (await res.json()) as { error?: string }
      if (!res.ok) {
        throw new Error(payload.error ?? "Failed to delete combination.")
      }
      success("Combination removed")
      await load()
    } catch (err) {
      toastError(
        "Couldn't delete combination",
        err instanceof Error ? err.message : undefined,
      )
    } finally {
      setBusy(false)
    }
  }

  /* ---- Render ---------------------------------------------------- */

  const totalSeats = combinations.reduce(
    (sum, c) => sum + c.effective_capacity,
    0,
  )
  const hasTables = tables.length > 0
  const notEnoughTables = tables.length < MIN_MEMBER_TABLES

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
      <PageHeader
        badge="Planning"
        icon={CombineIcon}
        title="Table Combinations"
        subtitle="Define tables that can be joined for larger parties."
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
          disabled={busy || editor?.comboId === null || notEnoughTables}
          className="gap-1.5"
        >
          <PlusIcon className="size-4" />
          Add combination
        </Button>
      </PageHeader>

      {needsMigration && (
        <Banner
          title="Combination storage isn't set up yet"
          body={
            <>
              Run{" "}
              <code className="rounded bg-amber-500/15 px-1 py-0.5 text-xs">
                scripts/011_table_combinations.sql
              </code>{" "}
              to save and manage your combinations.
            </>
          }
        />
      )}
      {!configured && (
        <Banner
          title="Changes won't persist yet"
          body="Connect Supabase to save your combinations."
        />
      )}
      {configured && !loading && notEnoughTables && (
        <Banner
          title="Add more tables first"
          body={`A combination needs at least ${MIN_MEMBER_TABLES} tables. Add tables on the Tables page, then come back.`}
        />
      )}

      {/* Summary strip */}
      {!loading && combinations.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <SummaryStat
            label="Combinations"
            value={String(combinations.length)}
          />
          <SummaryStat
            label="Active"
            value={String(combinations.filter((c) => c.active).length)}
          />
          <SummaryStat label="Combined seats" value={String(totalSeats)} />
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Add-new editor at the top */}
          {editor?.comboId === null && (
            <CombinationEditor
              draft={editor.draft}
              tables={tables}
              busy={busy}
              onPatch={patchDraft}
              onSubmit={submitEditor}
              onCancel={closeEditor}
            />
          )}

          {combinations.length === 0 &&
            editor?.comboId !== null &&
            hasTables && <EmptyState onAdd={openAdd} disabled={busy} />}

          {combinations.map((c) =>
            editor?.comboId === c.id ? (
              <CombinationEditor
                key={c.id}
                draft={editor.draft}
                tables={tables}
                busy={busy}
                onPatch={patchDraft}
                onSubmit={submitEditor}
                onCancel={closeEditor}
              />
            ) : (
              <CombinationRow
                key={c.id}
                combo={c}
                busy={busy}
                onEdit={() => openEdit(c)}
                onDelete={() => void deleteCombo(c)}
                onToggleActive={() => void toggleActive(c)}
              />
            ),
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

function Banner({ title, body }: { title: string; body: React.ReactNode }) {
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
      <CombineIcon className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="font-medium text-foreground">No table combinations yet</p>
        <p className="max-w-sm text-sm text-muted-foreground text-pretty">
          Create combinations for tables that can be joined to accommodate
          larger parties.
        </p>
      </div>
      <Button onClick={onAdd} disabled={disabled} size="sm" className="gap-1.5">
        <PlusIcon className="size-4" />
        Add your first combination
      </Button>
    </div>
  )
}

/* ---- Card ------------------------------------------------------- */

function CombinationRow({
  combo,
  busy,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  combo: CombinationWithSummary
  busy: boolean
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
}) {
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const overridden = combo.capacity_override != null
  const tableLabels = combo.members.map((m) => m.table?.name ?? "removed")

  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-4",
        !combo.active && "opacity-70",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        {/* Identity */}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-heading text-sm font-semibold tracking-tight">
              {combo.name}
            </h3>
            {combo.active ? (
              <Badge className="bg-emerald-500/15 text-emerald-500 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400">
                Active
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Inactive
              </Badge>
            )}
          </div>

          {/* Tables as joined chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {combo.members.map((m, i) => (
              <React.Fragment key={m.table_id}>
                {i > 0 && (
                  <span
                    aria-hidden
                    className="text-xs font-semibold text-muted-foreground"
                  >
                    +
                  </span>
                )}
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs",
                    m.table
                      ? "border-border bg-muted/40 text-foreground"
                      : "border-destructive/40 bg-destructive/10 text-destructive",
                  )}
                  title={
                    m.table
                      ? `${m.table.capacity} seats${
                          m.table.zone ? ` · ${m.table.zone}` : ""
                        }`
                      : "This table no longer exists"
                  }
                >
                  {m.table?.name ?? "Removed table"}
                  {m.table && (
                    <span className="text-muted-foreground">
                      · {m.table.capacity}
                    </span>
                  )}
                  {m.table?.blocked && (
                    <BanIcon
                      className="size-3 text-amber-500"
                      aria-label="Blocked"
                    />
                  )}
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <UsersIcon className="size-3.5" />
              <span className="font-medium text-foreground">
                {combo.effective_capacity} seats
              </span>
              {overridden && (
                <span className="text-muted-foreground">
                  (calc {combo.calculated_capacity})
                </span>
              )}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1",
                combo.zone_summary.mixed && "text-amber-500",
              )}
            >
              <MapPinIcon className="size-3.5" />
              {combo.zone_summary.label}
            </span>
            <span className="inline-flex items-center gap-1">
              <ArmchairIcon className="size-3.5" />
              {combo.members.length} tables
            </span>
          </div>

          {combo.zone_summary.mixed && (
            <p className="text-xs text-amber-500/90">
              These tables belong to multiple zones.
            </p>
          )}
          {combo.has_missing_tables && (
            <p className="text-xs text-destructive/90">
              One or more member tables no longer exist. Edit to fix.
            </p>
          )}
          {combo.internal_notes && (
            <p className="text-xs text-muted-foreground text-pretty">
              {combo.internal_notes}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={onToggleActive}
            disabled={busy}
            aria-label={combo.active ? "Deactivate" : "Activate"}
            title={combo.active ? "Deactivate" : "Activate"}
          >
            {combo.active ? (
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
            aria-label="Edit combination"
            title="Edit"
          >
            <PencilIcon className="size-4" />
          </Button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <Button
                variant="destructive"
                size="icon"
                className="size-8"
                onClick={onDelete}
                disabled={busy}
                aria-label="Confirm delete"
                title="Confirm delete"
              >
                <CheckIcon className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
                aria-label="Cancel delete"
                title="Cancel"
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              aria-label="Delete combination"
              title="Delete"
            >
              <Trash2Icon className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

/* ---- Editor ----------------------------------------------------- */

function CombinationEditor({
  draft,
  tables,
  busy,
  onPatch,
  onSubmit,
  onCancel,
}: {
  draft: Draft
  tables: SelectableTable[]
  busy: boolean
  onPatch: (patch: Partial<Draft>) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const selectedSet = React.useMemo(
    () => new Set(draft.tableIds),
    [draft.tableIds],
  )
  const calculated = previewCalculatedCapacity(tables, draft.tableIds)
  const zoneSummary = previewZoneSummary(tables, draft.tableIds)
  const effective =
    draft.capacityMode === "override" && draft.capacity_override > 0
      ? draft.capacity_override
      : calculated
  const enoughTables = draft.tableIds.length >= MIN_MEMBER_TABLES

  const toggleTable = (id: string) => {
    if (selectedSet.has(id)) {
      onPatch({ tableIds: draft.tableIds.filter((t) => t !== id) })
    } else {
      onPatch({ tableIds: [...draft.tableIds, id] })
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-xl border border-primary/40 bg-card p-4 ring-1 ring-inset ring-primary/10">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="combo-name">Name</Label>
        <Input
          id="combo-name"
          value={draft.name}
          maxLength={COMBINATION_NAME_MAX}
          placeholder="e.g. Window Group"
          onChange={(e) => onPatch({ name: e.target.value })}
          disabled={busy}
        />
      </div>

      {/* Table selector */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Tables</Label>
          <span className="text-xs text-muted-foreground">
            {draft.tableIds.length} selected · min {MIN_MEMBER_TABLES}
          </span>
        </div>
        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto rounded-lg border border-border bg-background/40 p-1.5">
          {tables.map((t) => {
            const checked = selectedSet.has(t.id)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTable(t.id)}
                disabled={busy}
                className={cn(
                  "flex items-center gap-3 rounded-md border px-2.5 py-2 text-left text-sm transition-colors",
                  checked
                    ? "border-primary/50 bg-primary/10"
                    : "border-transparent hover:bg-muted/50",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded border",
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40",
                  )}
                  aria-hidden
                >
                  {checked && <CheckIcon className="size-3" />}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">
                  {t.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t.capacity} seats
                </span>
                {t.zone && (
                  <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                    {t.zone}
                  </span>
                )}
                {t.blocked && (
                  <Badge
                    variant="outline"
                    className="shrink-0 border-amber-500/40 text-amber-500"
                  >
                    Blocked
                  </Badge>
                )}
                {!t.active && (
                  <Badge
                    variant="outline"
                    className="shrink-0 text-muted-foreground"
                  >
                    Inactive
                  </Badge>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Live summary */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border border-border bg-muted/20 px-3 py-2.5 text-sm">
        <span className="text-muted-foreground">
          Selected tables:{" "}
          <span className="font-medium text-foreground">
            {draft.tableIds.length}
          </span>
        </span>
        <span className="text-muted-foreground">
          Calculated capacity:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {calculated}
          </span>
        </span>
        <span className="text-muted-foreground">
          Effective capacity:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {effective}
          </span>
        </span>
        <span
          className={cn(
            "text-muted-foreground",
            zoneSummary.mixed && "text-amber-500",
          )}
        >
          Zone:{" "}
          <span
            className={cn(
              "font-medium",
              zoneSummary.mixed ? "text-amber-500" : "text-foreground",
            )}
          >
            {zoneSummary.label}
          </span>
        </span>
      </div>

      {zoneSummary.mixed && (
        <p className="-mt-2 flex items-center gap-1.5 text-xs text-amber-500">
          <TriangleAlertIcon className="size-3.5" />
          These tables belong to multiple zones. You can still save this
          combination.
        </p>
      )}
      {!enoughTables && draft.tableIds.length > 0 && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Select at least {MIN_MEMBER_TABLES} tables.
        </p>
      )}

      {/* Capacity override */}
      <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <Label htmlFor="combo-override" className="cursor-pointer">
              Capacity override
            </Label>
            <span className="text-xs text-muted-foreground">
              Off uses the calculated {calculated} seats.
            </span>
          </div>
          <Switch
            id="combo-override"
            checked={draft.capacityMode === "override"}
            onCheckedChange={(v) =>
              onPatch({
                capacityMode: v ? "override" : "auto",
                capacity_override:
                  draft.capacity_override > 0
                    ? draft.capacity_override
                    : calculated,
              })
            }
            disabled={busy}
          />
        </div>
        {draft.capacityMode === "override" && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="combo-override-value" className="sr-only">
              Override seats
            </Label>
            <Input
              id="combo-override-value"
              type="number"
              min={1}
              value={draft.capacity_override || ""}
              onChange={(e) =>
                onPatch({ capacity_override: Number(e.target.value) })
              }
              disabled={busy}
              className="max-w-32"
            />
          </div>
        )}
      </div>

      {/* Active + notes */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <Label htmlFor="combo-active" className="cursor-pointer">
            Active
          </Label>
          <span className="text-xs text-muted-foreground">
            Inactive combinations are kept but not used for seating.
          </span>
        </div>
        <Switch
          id="combo-active"
          checked={draft.active}
          onCheckedChange={(v) => onPatch({ active: v })}
          disabled={busy}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="combo-notes">Internal notes</Label>
        <Textarea
          id="combo-notes"
          value={draft.internal_notes}
          placeholder="Optional notes for your team."
          onChange={(e) => onPatch({ internal_notes: e.target.value })}
          disabled={busy}
          rows={2}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={busy || !draft.name.trim() || !enoughTables}
          className="gap-1.5"
        >
          {busy && <Loader2Icon className="size-4 animate-spin" />}
          Save combination
        </Button>
      </div>
    </section>
  )
}
