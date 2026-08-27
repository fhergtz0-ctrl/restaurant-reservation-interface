"use client"

import * as React from "react"
import {
  RadioIcon,
  RefreshCwIcon,
  UsersIcon,
  TimerIcon,
  GaugeIcon,
  UserPlusIcon,
  XIcon,
  AlertCircleIcon,
  ArrowRightCircleIcon,
  CheckCircle2Icon,
  SparklesIcon,
  BanIcon,
  Loader2Icon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/app-nav/page-header"
import { StayProgress } from "@/components/operations/stay-progress"
import { WalkInDialog, type WalkInDraft } from "@/components/live/walk-in-dialog"
import { useToast } from "@/components/ui/toast"
import { useNow } from "@/hooks/use-now"
import {
  useRestaurantSelector,
  todayValue,
} from "@/hooks/use-restaurant-selector"
import {
  computeTableStatuses,
  groupTablesByZone,
  computeLiveMetrics,
  operationalStatusOf,
  seatedPartyOf,
  upcomingCountOf,
  type AdminReservation,
  type AdminTable,
  type TableStatus,
} from "@/lib/admin-data"
import {
  OPERATIONAL_META,
  type OperationalStatus,
} from "@/lib/operations"

const POLL_MS = 20_000

/* ------------------------------------------------------------------ */
/* Metric card                                                         */
/* ------------------------------------------------------------------ */

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string
  value: string | number
  hint?: string
  icon: React.ElementType
  accent?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className={`size-4 ${accent ?? "text-muted-foreground"}`} />
      </div>
      <span className="font-heading text-2xl font-semibold tabular-nums">
        {value}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Table card                                                          */
/* ------------------------------------------------------------------ */

function StateBadge({ status }: { status: OperationalStatus }) {
  const meta = OPERATIONAL_META[status]
  const Icon = meta.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${meta.badge}`}
    >
      <Icon className="size-3.5" />
      {meta.label}
    </span>
  )
}

function TableCard({
  table,
  nowMs,
  onClick,
}: {
  table: TableStatus
  nowMs: number
  onClick: () => void
}) {
  const status = operationalStatusOf(table, nowMs)
  const meta = OPERATIONAL_META[status]
  const party = seatedPartyOf(table)
  const upcoming = upcomingCountOf(table)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col gap-3 rounded-xl border p-4 text-left transition-all duration-150 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${meta.card}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <span className="font-heading text-base font-semibold">
            {table.name}
          </span>
          <span className="text-xs text-muted-foreground">
            Seats {table.capacity}
          </span>
        </div>
        <StateBadge status={status} />
      </div>

      {party ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-sm">
            <UsersIcon className="size-3.5 text-muted-foreground" />
            <span className="font-medium">{party.customerName}</span>
            <span className="text-muted-foreground">· {party.guests}</span>
          </div>
          <StayProgress
            seatedAt={party.seatedAt}
            guests={party.guests}
            expectedMin={party.expectedMin}
            nowMs={nowMs}
            compact
          />
        </div>
      ) : status === "reserved" ? (
        <span className="text-xs text-muted-foreground">
          {upcoming} upcoming {upcoming === 1 ? "booking" : "bookings"}
        </span>
      ) : status === "cleaning" ? (
        <span className="text-xs text-violet-600 dark:text-violet-400">
          Being turned over
        </span>
      ) : status === "blocked" ? (
        <span className="text-xs text-muted-foreground">Out of service</span>
      ) : (
        <span className="text-xs text-emerald-600 dark:text-emerald-400">
          Ready to seat
        </span>
      )}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Action drawer                                                       */
/* ------------------------------------------------------------------ */

function ActionRow({
  icon: Icon,
  label,
  description,
  onClick,
  disabled,
  tone = "default",
}: {
  icon: React.ElementType
  label: string
  description?: string
  onClick: () => void
  disabled?: boolean
  tone?: "default" | "primary" | "danger"
}) {
  const toneClass =
    tone === "primary"
      ? "hover:border-primary/40 hover:bg-primary/5"
      : tone === "danger"
        ? "hover:border-destructive/40 hover:bg-destructive/5"
        : "hover:border-border hover:bg-muted/60"
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
          tone === "primary"
            ? "bg-primary/10 text-primary"
            : tone === "danger"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="size-4.5" />
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Main view                                                           */
/* ------------------------------------------------------------------ */

export function LiveView() {
  const { selected } = useRestaurantSelector()
  const toast = useToast()
  const nowMs = useNow(30_000)

  const [tables, setTables] = React.useState<AdminTable[]>([])
  const [reservations, setReservations] = React.useState<AdminReservation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [refreshing, setRefreshing] = React.useState(false)

  const [selectedTableId, setSelectedTableId] = React.useState<string | null>(
    null,
  )
  const [walkInOpen, setWalkInOpen] = React.useState(false)
  const [walkInPreset, setWalkInPreset] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [pending, setPending] = React.useState(false)

  const load = React.useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!selected) return
      if (opts?.silent) setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const resParams = new URLSearchParams({
          date: todayValue(),
          restaurant: selected.name,
          restaurantSlug: selected.slug,
        })
        const tableParams = new URLSearchParams({ restaurant: selected.name })
        const [tablesResponse, resResponse] = await Promise.all([
          fetch(`/api/admin/tables?${tableParams.toString()}`),
          fetch(`/api/admin/reservations?${resParams.toString()}`),
        ])
        const tablesPayload = (await tablesResponse.json()) as {
          tables?: AdminTable[]
          error?: string
        }
        if (!tablesResponse.ok) {
          throw new Error(tablesPayload.error ?? "Failed to load the floor.")
        }
        setTables(tablesPayload.tables ?? [])
        const resPayload = (await resResponse.json()) as {
          reservations?: AdminReservation[]
        }
        setReservations(
          resResponse.ok ? (resPayload.reservations ?? []) : [],
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [selected],
  )

  React.useEffect(() => {
    void load()
  }, [load])

  // Silent background polling keeps the floor live.
  React.useEffect(() => {
    const id = setInterval(() => void load({ silent: true }), POLL_MS)
    return () => clearInterval(id)
  }, [load])

  const statuses = React.useMemo(
    () => computeTableStatuses(tables, reservations),
    [tables, reservations],
  )
  const zones = React.useMemo(() => groupTablesByZone(statuses), [statuses])
  const metrics = React.useMemo(
    () => computeLiveMetrics(statuses, reservations, nowMs),
    [statuses, reservations, nowMs],
  )
  const seatableTables = React.useMemo(
    () =>
      statuses.filter((t) => {
        const op = operationalStatusOf(t, nowMs)
        return op !== "blocked" && op !== "seated" && op !== "finishing"
      }),
    [statuses, nowMs],
  )
  const selectedTable = React.useMemo(
    () => statuses.find((t) => t.id === selectedTableId) ?? null,
    [statuses, selectedTableId],
  )

  /* ---- Mutations ------------------------------------------------- */

  const patchReservation = React.useCallback(
    async (reservationId: string, body: Record<string, unknown>) => {
      const response = await fetch(
        `/api/admin/reservations/${reservationId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      )
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error ?? "Request failed.")
      }
    },
    [],
  )

  const patchTable = React.useCallback(
    async (tableId: string, body: Record<string, unknown>) => {
      const response = await fetch(`/api/admin/tables/${tableId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string }
        throw new Error(payload.error ?? "Request failed.")
      }
    },
    [],
  )

  const seatNext = React.useCallback(
    async (table: TableStatus) => {
      const next = table.bookings.find((b) => b.status === "confirmed")
      if (!next) return
      setPending(true)
      try {
        await patchReservation(next.id, { status: "seated" })
        toast.success(`${next.customer} seated at ${table.name}.`)
        await load({ silent: true })
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't seat the guest.",
        )
      } finally {
        setPending(false)
      }
    },
    [patchReservation, toast, load],
  )

  const finishParty = React.useCallback(
    async (table: TableStatus) => {
      const party = seatedPartyOf(table)
      if (!party) return
      setPending(true)
      try {
        await patchReservation(party.reservationId, { status: "finished" })
        // Move the table into turnover automatically.
        await patchTable(table.id, { cleaning_since: new Date().toISOString() })
        toast.success(`${party.customerName} finished. ${table.name} now cleaning.`)
        await load({ silent: true })
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't finish the party.",
        )
      } finally {
        setPending(false)
      }
    },
    [patchReservation, patchTable, toast, load],
  )

  const markClean = React.useCallback(
    async (table: TableStatus) => {
      setPending(true)
      try {
        await patchTable(table.id, { cleaning_since: null })
        toast.success(`${table.name} is available.`)
        await load({ silent: true })
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't update the table.",
        )
      } finally {
        setPending(false)
      }
    },
    [patchTable, toast, load],
  )

  const startCleaning = React.useCallback(
    async (table: TableStatus) => {
      setPending(true)
      try {
        await patchTable(table.id, { cleaning_since: new Date().toISOString() })
        toast.success(`${table.name} marked for cleaning.`)
        await load({ silent: true })
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't update the table.",
        )
      } finally {
        setPending(false)
      }
    },
    [patchTable, toast, load],
  )

  const toggleBlock = React.useCallback(
    async (table: TableStatus, blocked: boolean) => {
      setPending(true)
      try {
        await patchTable(table.id, { blocked })
        toast.success(blocked ? `${table.name} blocked.` : `${table.name} unblocked.`)
        await load({ silent: true })
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't update the table.",
        )
      } finally {
        setPending(false)
      }
    },
    [patchTable, toast, load],
  )

  const createWalkIn = React.useCallback(
    async (draft: WalkInDraft): Promise<boolean> => {
      if (!selected) return false
      setSubmitting(true)
      try {
        const response = await fetch("/api/admin/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...draft,
            restaurant: selected.name,
            restaurantSlug: selected.slug,
          }),
        })
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string }
          throw new Error(payload.error ?? "Couldn't seat the walk-in.")
        }
        toast.success(`${draft.customerName} seated.`)
        setWalkInOpen(false)
        setWalkInPreset(null)
        await load({ silent: true })
        return true
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Couldn't seat the walk-in.",
        )
        return false
      } finally {
        setSubmitting(false)
      }
    },
    [selected, toast, load],
  )

  /* ---- Render ---------------------------------------------------- */

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        badge="K'áanche Live"
        icon={RadioIcon}
        title="Live service"
        subtitle="Real-time floor status, stay timers, and turnover."
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load({ silent: true })}
            disabled={refreshing}
          >
            <RefreshCwIcon
              className={`size-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setWalkInPreset(null)
              setWalkInOpen(true)
            }}
          >
            <UserPlusIcon className="size-4" />
            Seat walk-in
          </Button>
        </div>
      </PageHeader>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircleIcon className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="Occupancy"
          value={`${metrics.occupancyPct}%`}
          hint={`${metrics.seated + metrics.finishing} of ${metrics.total} tables`}
          icon={GaugeIcon}
          accent="text-primary"
        />
        <MetricCard
          label="Guests seated"
          value={metrics.guestsSeated}
          icon={UsersIcon}
          accent="text-sky-500"
        />
        <MetricCard
          label="Finishing"
          value={metrics.finishing}
          hint="Past expected time"
          icon={TimerIcon}
          accent={metrics.finishing > 0 ? "text-red-500" : "text-muted-foreground"}
        />
        <MetricCard
          label="Cleaning"
          value={metrics.cleaning}
          icon={SparklesIcon}
          accent="text-violet-500"
        />
        <MetricCard
          label="Avg stay"
          value={
            metrics.averageStayMin === null
              ? "—"
              : `${metrics.averageStayMin}m`
          }
          hint="Completed today"
          icon={TimerIcon}
        />
      </div>

      {/* Floor */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : statuses.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
          <RadioIcon className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No tables yet. Add tables in the Floor Plan to start live service.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {zones.map(({ zone, tables: zoneTables }) => (
            <section key={zone} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {zone}
                </h2>
                <Badge variant="secondary">{zoneTables.length}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {zoneTables.map((t) => (
                  <TableCard
                    key={t.id}
                    table={t}
                    nowMs={nowMs}
                    onClick={() => setSelectedTableId(t.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Action drawer */}
      {selectedTable && (
        <TableDrawer
          table={selectedTable}
          nowMs={nowMs}
          pending={pending}
          onClose={() => setSelectedTableId(null)}
          onSeatNext={() => seatNext(selectedTable)}
          onFinish={() => finishParty(selectedTable)}
          onStartCleaning={() => startCleaning(selectedTable)}
          onMarkClean={() => markClean(selectedTable)}
          onToggleBlock={(blocked) => toggleBlock(selectedTable, blocked)}
          onWalkIn={() => {
            setWalkInPreset(selectedTable.id)
            setSelectedTableId(null)
            setWalkInOpen(true)
          }}
        />
      )}

      <WalkInDialog
        open={walkInOpen}
        onOpenChange={(o) => {
          setWalkInOpen(o)
          if (!o) setWalkInPreset(null)
        }}
        seatableTables={seatableTables}
        onSubmit={createWalkIn}
        submitting={submitting}
        presetTableId={walkInPreset}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Drawer                                                              */
/* ------------------------------------------------------------------ */

function TableDrawer({
  table,
  nowMs,
  pending,
  onClose,
  onSeatNext,
  onFinish,
  onStartCleaning,
  onMarkClean,
  onToggleBlock,
  onWalkIn,
}: {
  table: TableStatus
  nowMs: number
  pending: boolean
  onClose: () => void
  onSeatNext: () => void
  onFinish: () => void
  onStartCleaning: () => void
  onMarkClean: () => void
  onToggleBlock: (blocked: boolean) => void
  onWalkIn: () => void
}) {
  const status = operationalStatusOf(table, nowMs)
  const meta = OPERATIONAL_META[status]
  const party = seatedPartyOf(table)
  const nextBooking = table.bookings.find((b) => b.status === "confirmed")

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0"
      />
      <aside className="relative flex h-full w-full max-w-sm flex-col gap-5 overflow-y-auto border-l border-border bg-card p-6 shadow-xl animate-in slide-in-from-right duration-200">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="font-heading text-xl font-semibold">
              {table.name}
            </span>
            <span className="text-sm text-muted-foreground">
              Seats {table.capacity} · {table.zone}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md text-muted-foreground transition-colors hover:text-foreground"
          >
            <XIcon className="size-5" />
            <span className="sr-only">Close</span>
          </button>
        </div>

        <span
          className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${meta.badge}`}
        >
          <meta.icon className="size-4" />
          {meta.label}
        </span>

        {party && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex items-center gap-2 text-sm">
              <UsersIcon className="size-4 text-muted-foreground" />
              <span className="font-medium">{party.customerName}</span>
              <span className="text-muted-foreground">
                · party of {party.guests}
              </span>
            </div>
            <StayProgress
              seatedAt={party.seatedAt}
              guests={party.guests}
              expectedMin={party.expectedMin}
              nowMs={nowMs}
            />
          </div>
        )}

        {pending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" />
            Updating...
          </div>
        )}

        {/* Contextual actions */}
        <div className="flex flex-col gap-2">
          {(status === "seated" || status === "finishing") && (
            <ActionRow
              icon={CheckCircle2Icon}
              label="Finish party"
              description="Complete the meal and start turnover"
              tone="primary"
              disabled={pending}
              onClick={onFinish}
            />
          )}

          {status === "reserved" && nextBooking && (
            <ActionRow
              icon={ArrowRightCircleIcon}
              label={`Seat ${nextBooking.customer}`}
              description={`Next booking at ${nextBooking.time}`}
              tone="primary"
              disabled={pending}
              onClick={onSeatNext}
            />
          )}

          {(status === "available" || status === "reserved") && (
            <ActionRow
              icon={UserPlusIcon}
              label="Seat a walk-in here"
              description="Create a seated party now"
              disabled={pending}
              onClick={onWalkIn}
            />
          )}

          {status === "cleaning" && (
            <ActionRow
              icon={CheckCircle2Icon}
              label="Mark as available"
              description="Turnover complete"
              tone="primary"
              disabled={pending}
              onClick={onMarkClean}
            />
          )}

          {status === "available" && (
            <ActionRow
              icon={SparklesIcon}
              label="Start cleaning"
              description="Take the table into turnover"
              disabled={pending}
              onClick={onStartCleaning}
            />
          )}

          {status === "blocked" ? (
            <ActionRow
              icon={CheckCircle2Icon}
              label="Unblock table"
              description="Return it to service"
              disabled={pending}
              onClick={() => onToggleBlock(false)}
            />
          ) : (
            status !== "seated" &&
            status !== "finishing" && (
              <ActionRow
                icon={BanIcon}
                label="Block table"
                description="Take it out of service"
                tone="danger"
                disabled={pending}
                onClick={() => onToggleBlock(true)}
              />
            )
          )}
        </div>
      </aside>
    </div>
  )
}
