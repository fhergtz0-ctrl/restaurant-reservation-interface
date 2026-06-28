"use client"

import * as React from "react"
import Link from "next/link"
import {
  LayoutGridIcon,
  UsersIcon,
  ClockIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  ArmchairIcon,
  XIcon,
  LockIcon,
  UnlockIcon,
  CheckCircle2Icon,
  EyeIcon,
  GripVerticalIcon,
  CheckIcon,
  TriangleAlertIcon,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/app-nav/page-header"
import {
  useRestaurantSelector,
  todayValue,
} from "@/hooks/use-restaurant-selector"
import {
  computeTableStatuses,
  computeFloorSummary,
  groupTablesByZone,
  floorStatusOf,
  STATUS_META,
  FLOOR_STATUSES,
  type AdminReservation,
  type AdminTable,
  type TableStatus,
  type FloorStatus,
} from "@/lib/admin-data"

/* ------------------------------------------------------------------ */
/* Status styling (dark premium)                                       */
/* ------------------------------------------------------------------ */

const FLOOR_STYLES: Record<
  FloorStatus,
  { label: string; card: string; badge: string; dot: string }
> = {
  available: {
    label: "Available",
    card: "border-emerald-500/30 bg-emerald-500/5",
    badge:
      "bg-emerald-500/15 text-emerald-600 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  reserved: {
    label: "Reserved",
    card: "border-amber-500/30 bg-amber-500/5",
    badge:
      "bg-amber-500/15 text-amber-600 ring-1 ring-inset ring-amber-500/30 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  occupied: {
    label: "Occupied",
    card: "border-red-500/30 bg-red-500/5",
    badge:
      "bg-red-500/15 text-red-600 ring-1 ring-inset ring-red-500/30 dark:text-red-400",
    dot: "bg-red-500",
  },
  blocked: {
    label: "Blocked",
    card: "border-border bg-muted/40 opacity-80",
    badge: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
    dot: "bg-zinc-500",
  },
}

/** A table can receive a moved reservation when it isn't blocked or occupied. */
function isDroppable(target: TableStatus, fromTableId: string | null): boolean {
  if (target.id === fromTableId) return false
  if (target.blocked) return false
  if (floorStatusOf(target) === "occupied") return false
  return true
}

type DragPayload = { reservationId: string; fromTableId: string }

/* ------------------------------------------------------------------ */
/* Toast                                                               */
/* ------------------------------------------------------------------ */

type ToastItem = { id: number; message: string; variant: "success" | "error" }

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onDismiss(t.id)}
          className={`pointer-events-auto flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm shadow-lg backdrop-blur transition-all duration-200 ${
            t.variant === "success"
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/15 text-destructive"
          }`}
        >
          {t.variant === "success" ? (
            <CheckIcon className="size-4 shrink-0" />
          ) : (
            <TriangleAlertIcon className="size-4 shrink-0" />
          )}
          <span className="text-pretty">{t.message}</span>
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Main view                                                           */
/* ------------------------------------------------------------------ */

export function TablesView() {
  const { selected } = useRestaurantSelector()
  const [date, setDate] = React.useState(todayValue)
  const [tables, setTables] = React.useState<AdminTable[]>([])
  const [reservations, setReservations] = React.useState<AdminReservation[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [selectedTableId, setSelectedTableId] = React.useState<string | null>(
    null,
  )
  const [dragPayload, setDragPayload] = React.useState<DragPayload | null>(null)
  const [dragOverTableId, setDragOverTableId] = React.useState<string | null>(
    null,
  )
  const [justMovedTableId, setJustMovedTableId] = React.useState<string | null>(
    null,
  )
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  const pushToast = React.useCallback(
    (message: string, variant: "success" | "error") => {
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev, { id, message, variant }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 3200)
    },
    [],
  )

  const dismissToast = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const load = React.useCallback(async () => {
    if (!selected) return
    setLoading(true)
    setError(null)
    try {
      const resParams = new URLSearchParams({
        date,
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
        throw new Error(tablesPayload.error ?? "Failed to load tables.")
      }
      setTables(tablesPayload.tables ?? [])

      const resPayload = (await resResponse.json()) as {
        reservations?: AdminReservation[]
      }
      setReservations(resResponse.ok ? (resPayload.reservations ?? []) : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setTables([])
      setReservations([])
    } finally {
      setLoading(false)
    }
  }, [date, selected])

  React.useEffect(() => {
    void load()
  }, [load])

  const statuses = React.useMemo(
    () => computeTableStatuses(tables, reservations),
    [tables, reservations],
  )
  const zones = React.useMemo(() => groupTablesByZone(statuses), [statuses])
  const summary = React.useMemo(
    () => computeFloorSummary(statuses),
    [statuses],
  )

  const selectedTable = React.useMemo(
    () => statuses.find((t) => t.id === selectedTableId) ?? null,
    [statuses, selectedTableId],
  )

  /* ---- Mutations (optimistic) ------------------------------------ */

  const flashMoved = React.useCallback((tableId: string) => {
    setJustMovedTableId(tableId)
    setTimeout(() => setJustMovedTableId(null), 700)
  }, [])

  const moveReservation = React.useCallback(
    async (reservationId: string, toTable: TableStatus) => {
      const reservation = reservations.find((r) => r.id === reservationId)
      if (!reservation) return
      const fromTableId = reservation.table_id
      if (fromTableId === toTable.id) return

      // Optimistic update.
      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId
            ? { ...r, table_id: toTable.id, table_name: toTable.name }
            : r,
        ),
      )
      flashMoved(toTable.id)

      try {
        const response = await fetch(
          `/api/admin/reservations/${reservationId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              table_id: toTable.id,
              table_name: toTable.name,
            }),
          },
        )
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string }
          throw new Error(payload.error ?? "Couldn't move the reservation.")
        }
        pushToast(
          `Moved ${reservation.customer_name} to ${toTable.name}.`,
          "success",
        )
      } catch (err) {
        // Revert.
        setReservations((prev) =>
          prev.map((r) =>
            r.id === reservationId
              ? {
                  ...r,
                  table_id: fromTableId,
                  table_name: reservation.table_name,
                }
              : r,
          ),
        )
        pushToast(
          err instanceof Error ? err.message : "Couldn't move the reservation.",
          "error",
        )
      }
    },
    [reservations, flashMoved, pushToast],
  )

  const setBlocked = React.useCallback(
    async (tableId: string, blocked: boolean) => {
      const prevTables = tables
      setTables((prev) =>
        prev.map((t) => (t.id === tableId ? { ...t, blocked } : t)),
      )
      try {
        const response = await fetch(`/api/admin/tables/${tableId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocked }),
        })
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string }
          throw new Error(payload.error ?? "Couldn't update the table.")
        }
        pushToast(blocked ? "Table blocked." : "Table marked available.", "success")
      } catch (err) {
        setTables(prevTables)
        pushToast(
          err instanceof Error ? err.message : "Couldn't update the table.",
          "error",
        )
      }
    },
    [tables, pushToast],
  )

  const seatGuest = React.useCallback(
    async (reservationId: string) => {
      const reservation = reservations.find((r) => r.id === reservationId)
      if (!reservation) return
      const prevStatus = reservation.status
      setReservations((prev) =>
        prev.map((r) =>
          r.id === reservationId ? { ...r, status: "seated" } : r,
        ),
      )
      try {
        const response = await fetch(
          `/api/admin/reservations/${reservationId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "seated" }),
          },
        )
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string }
          throw new Error(payload.error ?? "Couldn't seat the guest.")
        }
        pushToast(`${reservation.customer_name} seated.`, "success")
      } catch (err) {
        setReservations((prev) =>
          prev.map((r) =>
            r.id === reservationId ? { ...r, status: prevStatus } : r,
          ),
        )
        pushToast(
          err instanceof Error ? err.message : "Couldn't seat the guest.",
          "error",
        )
      }
    },
    [reservations, pushToast],
  )

  /* ---- Drag & drop handlers -------------------------------------- */

  const handleDrop = React.useCallback(
    (target: TableStatus) => {
      const payload = dragPayload
      setDragPayload(null)
      setDragOverTableId(null)
      if (!payload) return
      if (!isDroppable(target, payload.fromTableId)) {
        pushToast(
          target.blocked
            ? "That table is blocked."
            : "That table is already occupied.",
          "error",
        )
        return
      }
      void moveReservation(payload.reservationId, target)
    },
    [dragPayload, moveReservation, pushToast],
  )

  return (
    <div className="text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <PageHeader
          badge="Floor plan"
          icon={LayoutGridIcon}
          title="Tables"
          subtitle={`Live floor plan for ${selected?.name ?? "your restaurant"}.`}
        >
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-9 w-[150px]"
            aria-label="Date"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCwIcon className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </PageHeader>

        {/* Occupancy summary */}
        <FloorStats summary={summary} />

        {/* Legend */}
        <Legend />

        {/* Floor */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
            <AlertCircleIcon className="size-8 text-destructive" />
            <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void load()}
              className="gap-1.5"
            >
              <RefreshCwIcon className="size-4" />
              Try again
            </Button>
          </div>
        ) : statuses.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <LayoutGridIcon className="size-8 text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <p className="font-medium text-foreground">No tables</p>
              <p className="text-sm text-muted-foreground">
                This restaurant has no active tables yet.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {zones.map(({ zone, tables: zoneTables }) => (
              <section key={zone} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {zone}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {zoneTables.length}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {zoneTables.map((t) => (
                    <TableCard
                      key={t.id}
                      table={t}
                      isDragOver={dragOverTableId === t.id}
                      isDroppableTarget={
                        dragPayload
                          ? isDroppable(t, dragPayload.fromTableId)
                          : true
                      }
                      isDragging={Boolean(dragPayload)}
                      justMoved={justMovedTableId === t.id}
                      onOpen={() => setSelectedTableId(t.id)}
                      onChipDragStart={(reservationId) =>
                        setDragPayload({
                          reservationId,
                          fromTableId: t.id,
                        })
                      }
                      onChipDragEnd={() => {
                        setDragPayload(null)
                        setDragOverTableId(null)
                      }}
                      onDragOver={(e) => {
                        if (
                          dragPayload &&
                          isDroppable(t, dragPayload.fromTableId)
                        ) {
                          e.preventDefault()
                          setDragOverTableId(t.id)
                        }
                      }}
                      onDragLeave={() => {
                        setDragOverTableId((cur) => (cur === t.id ? null : cur))
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        handleDrop(t)
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <TableDrawer
        table={selectedTable}
        droppableTargets={statuses}
        onClose={() => setSelectedTableId(null)}
        onSeat={seatGuest}
        onBlock={(blocked) => {
          if (selectedTable) void setBlocked(selectedTable.id, blocked)
        }}
        onMove={moveReservation}
      />

      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Occupancy stats                                                     */
/* ------------------------------------------------------------------ */

function FloorStats({
  summary,
}: {
  summary: ReturnType<typeof computeFloorSummary>
}) {
  const stats: { label: string; value: string | number; tone?: FloorStatus }[] =
    [
      { label: "Total", value: summary.total },
      { label: "Available", value: summary.available, tone: "available" },
      { label: "Reserved", value: summary.reserved, tone: "reserved" },
      { label: "Occupied", value: summary.occupied, tone: "occupied" },
      { label: "Blocked", value: summary.blocked, tone: "blocked" },
      { label: "Occupancy", value: `${summary.occupancyPct}%` },
    ]
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {stats.map((s) => (
        <div
          key={s.label}
          className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-3"
        >
          <span className="flex items-center gap-1.5">
            {s.tone && (
              <span
                className={`size-2 shrink-0 rounded-full ${FLOOR_STYLES[s.tone].dot}`}
              />
            )}
            <span className="truncate text-xs text-muted-foreground">
              {s.label}
            </span>
          </span>
          <span className="font-heading text-xl font-semibold leading-none tracking-tight">
            {s.value}
          </span>
        </div>
      ))}
    </div>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border bg-card/50 px-4 py-3">
      {FLOOR_STATUSES.map((status) => (
        <span key={status} className="flex items-center gap-2 text-xs">
          <span
            className={`size-2.5 rounded-full ${FLOOR_STYLES[status].dot}`}
          />
          <span className="text-muted-foreground">
            {FLOOR_STYLES[status].label}
          </span>
        </span>
      ))}
      <span className="ml-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
        <GripVerticalIcon className="size-3.5" />
        Drag a booking onto another table to move it
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Table card                                                          */
/* ------------------------------------------------------------------ */

function TableCard({
  table,
  isDragOver,
  isDroppableTarget,
  isDragging,
  justMoved,
  onOpen,
  onChipDragStart,
  onChipDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  table: TableStatus
  isDragOver: boolean
  isDroppableTarget: boolean
  isDragging: boolean
  justMoved: boolean
  onOpen: () => void
  onChipDragStart: (reservationId: string) => void
  onChipDragEnd: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
}) {
  const status = floorStatusOf(table)
  const style = FLOOR_STYLES[status]
  const next = table.bookings[0]
  const seated = table.bookings.find((b) => b.status === "seated")
  const current = seated ?? next

  // Dim non-droppable targets while a drag is in progress.
  const dimmed = isDragging && !isDroppableTarget && !isDragOver

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-label={`${table.name}, ${style.label}, seats ${table.capacity}`}
      className={`group relative flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 text-left outline-none transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/20 hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary ${
        style.card
      } ${
        isDragOver
          ? "scale-[1.03] ring-2 ring-primary shadow-lg shadow-primary/30"
          : ""
      } ${dimmed ? "opacity-40" : ""} ${
        justMoved ? "animate-pulse ring-2 ring-primary" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-9 items-center justify-center rounded-xl bg-background/60">
          <ArmchairIcon className="size-5 text-foreground" />
        </span>
        <span
          className={`inline-flex h-5 items-center gap-1 rounded-full px-2 text-[10px] font-medium ${style.badge}`}
        >
          <span className={`size-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>
      </div>

      <div className="flex flex-col">
        <span className="font-heading text-base font-semibold tracking-tight">
          {table.name}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <UsersIcon className="size-3" />
          Seats {table.capacity}
        </span>
      </div>

      {/* Current / next booking + draggable chips */}
      {table.bookings.length > 0 ? (
        <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2">
          {current && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <ClockIcon className="size-3 text-muted-foreground" />
                {current.time}
              </span>
              <span className="truncate text-muted-foreground">
                {current.customer}
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {table.bookings.map((b) => (
              <span
                key={b.id}
                draggable
                onClick={(e) => e.stopPropagation()}
                onDragStart={(e) => {
                  e.stopPropagation()
                  e.dataTransfer.effectAllowed = "move"
                  e.dataTransfer.setData("text/plain", b.id)
                  onChipDragStart(b.id)
                }}
                onDragEnd={onChipDragEnd}
                className="inline-flex cursor-grab items-center gap-1 rounded-md border border-border bg-background/70 px-1.5 py-0.5 text-[10px] text-foreground active:cursor-grabbing"
                title={`${b.customer} · ${b.guests} guests · drag to move`}
              >
                <GripVerticalIcon className="size-2.5 text-muted-foreground" />
                {b.time}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="border-t border-border/60 pt-2 text-xs text-muted-foreground">
          {table.blocked ? "Out of service" : "No bookings"}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Side drawer                                                         */
/* ------------------------------------------------------------------ */

function TableDrawer({
  table,
  droppableTargets,
  onClose,
  onSeat,
  onBlock,
  onMove,
}: {
  table: TableStatus | null
  droppableTargets: TableStatus[]
  onClose: () => void
  onSeat: (reservationId: string) => void
  onBlock: (blocked: boolean) => void
  onMove: (reservationId: string, toTable: TableStatus) => void
}) {
  const open = table !== null

  // Lock body scroll while open.
  React.useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  const status = table ? floorStatusOf(table) : "available"
  const style = FLOOR_STYLES[status]

  return (
    <div
      className={`fixed inset-0 z-[70] ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-background/70 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={table ? `${table.name} details` : "Table details"}
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {table && (
          <>
            <header className="flex items-start justify-between gap-3 border-b border-border p-5">
              <div className="flex flex-col gap-1.5">
                <span
                  className={`inline-flex h-5 w-fit items-center gap-1 rounded-full px-2 text-[10px] font-medium ${style.badge}`}
                >
                  <span className={`size-1.5 rounded-full ${style.dot}`} />
                  {style.label}
                </span>
                <h2 className="font-heading text-xl font-semibold tracking-tight">
                  {table.name}
                </h2>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <UsersIcon className="size-3" />
                    Seats {table.capacity}
                  </span>
                  <span aria-hidden>·</span>
                  <span>{table.zone}</span>
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0"
              >
                <XIcon className="size-5" />
              </Button>
            </header>

            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
              {/* Bookings */}
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {table.bookings.length > 0
                    ? `Reservations (${table.bookings.length})`
                    : "Reservations"}
                </h3>
                {table.bookings.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
                    {table.blocked
                      ? "This table is out of service."
                      : "No reservations for this date."}
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {table.bookings.map((b) => (
                      <li
                        key={b.id}
                        className="flex flex-col gap-2 rounded-xl border border-border bg-background/50 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            <ClockIcon className="size-3.5 text-muted-foreground" />
                            {b.time}
                          </span>
                          <span
                            className={`inline-flex h-5 items-center rounded-full px-2 text-[10px] font-medium ${STATUS_META[b.status].className}`}
                          >
                            {STATUS_META[b.status].label}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span className="truncate text-foreground">
                            {b.customer}
                          </span>
                          <span className="flex items-center gap-1">
                            <UsersIcon className="size-3" />
                            {b.guests}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {b.status === "confirmed" && (
                            <Button
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs"
                              onClick={() => onSeat(b.id)}
                            >
                              <CheckCircle2Icon className="size-3.5" />
                              Seat guest
                            </Button>
                          )}
                          <MoveControl
                            currentTableId={table.id}
                            targets={droppableTargets}
                            onMove={(toTable) => onMove(b.id, toTable)}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {/* Footer actions */}
            <footer className="flex flex-col gap-2 border-t border-border p-5">
              <div className="grid grid-cols-2 gap-2">
                {table.blocked ? (
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => onBlock(false)}
                  >
                    <UnlockIcon className="size-4" />
                    Mark available
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => onBlock(true)}
                    disabled={floorStatusOf(table) === "occupied"}
                  >
                    <LockIcon className="size-4" />
                    Block table
                  </Button>
                )}
                <Link
                  href="/reservations"
                  className={`${buttonVariants({ variant: "outline" })} gap-1.5`}
                >
                  <EyeIcon className="size-4" />
                  View reservations
                </Link>
              </div>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}

/** Inline "Move reservation" control: pick a target table from a dropdown. */
function MoveControl({
  currentTableId,
  targets,
  onMove,
}: {
  currentTableId: string
  targets: TableStatus[]
  onMove: (toTable: TableStatus) => void
}) {
  const options = targets.filter((t) => isDroppable(t, currentTableId))
  if (options.length === 0) return null

  return (
    <Select
      value=""
      onValueChange={(id) => {
        const target = options.find((t) => t.id === id)
        if (target) onMove(target)
      }}
    >
      <SelectTrigger
        className="h-7 w-auto gap-1 px-2 text-xs"
        aria-label="Move reservation to another table"
      >
        <SelectValue placeholder="Move to…" />
      </SelectTrigger>
      <SelectContent>
        {options.map((t) => (
          <SelectItem key={t.id} value={t.id} className="text-xs">
            {t.name} · {t.zone}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
