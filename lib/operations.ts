/**
 * K'áanche operational core — the single source of truth for floor service
 * logic shared by K'áanche Live, the Floor Plan, and the Timeline.
 *
 * Nothing here touches the network or React; it is pure, testable logic so
 * the same rules drive every operational surface (no duplicated business
 * logic across components).
 */

import type { LucideIcon } from "lucide-react"
import {
  ArmchairIcon,
  BanIcon,
  CircleCheckIcon,
  HourglassIcon,
  SparklesIcon,
  UtensilsIcon,
} from "lucide-react"

/* ------------------------------------------------------------------ */
/* Operational states                                                  */
/* ------------------------------------------------------------------ */

/** The six operational states a table can be in during service. */
export const OPERATIONAL_STATES = [
  "available",
  "reserved",
  "seated",
  "finishing",
  "cleaning",
  "blocked",
] as const

export type OperationalStatus = (typeof OPERATIONAL_STATES)[number]

export type OperationalMeta = {
  label: string
  icon: LucideIcon
  /** Badge classes (label + icon), accessible in both light and dark. */
  badge: string
  /** Card border/background tint. */
  card: string
  /** Solid status dot. */
  dot: string
}

/**
 * Presentation for each state. Colour is never the only signal — every state
 * also carries a text label and a distinct icon for accessibility.
 */
export const OPERATIONAL_META: Record<OperationalStatus, OperationalMeta> = {
  available: {
    label: "Available",
    icon: CircleCheckIcon,
    badge:
      "bg-emerald-500/15 text-emerald-600 ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-400",
    card: "border-emerald-500/30 bg-emerald-500/5",
    dot: "bg-emerald-500",
  },
  reserved: {
    label: "Reserved",
    icon: HourglassIcon,
    badge:
      "bg-amber-500/15 text-amber-600 ring-1 ring-inset ring-amber-500/30 dark:text-amber-400",
    card: "border-amber-500/30 bg-amber-500/5",
    dot: "bg-amber-500",
  },
  seated: {
    label: "Seated",
    icon: UtensilsIcon,
    badge:
      "bg-sky-500/15 text-sky-600 ring-1 ring-inset ring-sky-500/30 dark:text-sky-400",
    card: "border-sky-500/30 bg-sky-500/5",
    dot: "bg-sky-500",
  },
  finishing: {
    label: "Finishing",
    icon: HourglassIcon,
    badge:
      "bg-red-500/15 text-red-600 ring-1 ring-inset ring-red-500/30 dark:text-red-400",
    card: "border-red-500/30 bg-red-500/5",
    dot: "bg-red-500",
  },
  cleaning: {
    label: "Cleaning",
    icon: SparklesIcon,
    badge:
      "bg-violet-500/15 text-violet-600 ring-1 ring-inset ring-violet-500/30 dark:text-violet-400",
    card: "border-violet-500/30 bg-violet-500/5",
    dot: "bg-violet-500",
  },
  blocked: {
    label: "Blocked",
    icon: BanIcon,
    badge: "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
    card: "border-border bg-muted/40 opacity-80",
    dot: "bg-zinc-500",
  },
}

/** Non-status icon used for a plain table glyph. */
export const TABLE_GLYPH: LucideIcon = ArmchairIcon

/* ------------------------------------------------------------------ */
/* Expected duration (centralised)                                     */
/* ------------------------------------------------------------------ */

/**
 * Temporary operational default until Reservation Rules provide a real
 * per-service / per-table duration. Centralised here so a single edit (or a
 * future settings lookup) changes it everywhere.
 */
export const DEFAULT_STAY_MINUTES = 90

/**
 * Resolve the expected stay duration (minutes) for a seating. Today this is
 * the centralised default; the signature already accepts the context needed
 * to later read Reservation Rules without touching call sites.
 */
export function getExpectedDurationMinutes(_input?: {
  guests?: number
  durationMinutes?: number | null
}): number {
  const configured = _input?.durationMinutes
  if (typeof configured === "number" && configured > 0) return configured
  return DEFAULT_STAY_MINUTES
}

/* ------------------------------------------------------------------ */
/* Stay timer + time status                                            */
/* ------------------------------------------------------------------ */

export type TimeStatus = "normal" | "approaching" | "over"

export type TimeStatusMeta = {
  label: string
  className: string
  dot: string
}

export const TIME_STATUS_META: Record<TimeStatus, TimeStatusMeta> = {
  normal: {
    label: "On time",
    className: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  approaching: {
    label: "Approaching limit",
    className: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  over: {
    label: "Over expected time",
    className: "text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
}

/**
 * Map elapsed-vs-expected into a time status. The single place this rule
 * lives — presentation components must not re-derive it.
 *   Normal:      < 75% of expected
 *   Approaching: 75%–100%
 *   Over:        > 100%
 */
export function timeStatusOf(elapsedMin: number, expectedMin: number): TimeStatus {
  if (expectedMin <= 0) return "normal"
  const pct = elapsedMin / expectedMin
  if (pct > 1) return "over"
  if (pct >= 0.75) return "approaching"
  return "normal"
}

export type StayProgress = {
  /** Minutes since seating, or null when there is no seated_at. */
  elapsedMin: number | null
  expectedMin: number
  /** expected − elapsed; may be negative when over. null when not seated. */
  remainingMin: number | null
  /** 0–1+ ratio of elapsed to expected (clamped ≥ 0). */
  ratio: number
  timeStatus: TimeStatus
}

/**
 * Compute live stay progress from the seated_at source of truth. `nowMs`
 * is injected so callers control the tick (and results stay deterministic).
 */
export function computeStayProgress(
  seatedAt: string | null,
  expectedMin: number,
  nowMs: number,
): StayProgress {
  if (!seatedAt) {
    return {
      elapsedMin: null,
      expectedMin,
      remainingMin: null,
      ratio: 0,
      timeStatus: "normal",
    }
  }
  const seatedMs = new Date(seatedAt).getTime()
  const elapsedMin = Math.max(0, Math.floor((nowMs - seatedMs) / 60000))
  const remainingMin = expectedMin - elapsedMin
  const ratio = expectedMin > 0 ? elapsedMin / expectedMin : 0
  return {
    elapsedMin,
    expectedMin,
    remainingMin,
    ratio,
    timeStatus: timeStatusOf(elapsedMin, expectedMin),
  }
}

/** Human duration, e.g. 42 -> "42 min", 92 -> "1h 32m". Handles negatives. */
export function formatDuration(minutes: number | null): string {
  if (minutes === null || Number.isNaN(minutes)) return "—"
  const sign = minutes < 0 ? "-" : ""
  const abs = Math.abs(Math.round(minutes))
  if (abs < 60) return `${sign}${abs} min`
  const h = Math.floor(abs / 60)
  const m = abs % 60
  return m === 0 ? `${sign}${h}h` : `${sign}${h}h ${m}m`
}

/* ------------------------------------------------------------------ */
/* Table operational-state derivation                                  */
/* ------------------------------------------------------------------ */

/** Minimal shape of a seated party used to derive state + drive the timer. */
export type SeatedParty = {
  reservationId: string
  seatedAt: string | null
  customerName: string
  guests: number
  expectedMin: number
}

export type OperationalInput = {
  blocked: boolean
  /** Cleaning marker timestamp (tables.cleaning_since); null = not cleaning. */
  cleaningSince: string | null
  /** The party currently seated at the table, if any. */
  seated: SeatedParty | null
  /** Count of upcoming (confirmed, not yet seated) bookings today. */
  upcomingCount: number
  nowMs: number
}

/**
 * Derive the operational state. Precedence (highest first):
 *   blocked > seated/finishing (active party) > cleaning > reserved > available
 * "Finishing" is a seated party past its expected duration.
 */
export function deriveOperationalStatus(input: OperationalInput): OperationalStatus {
  if (input.blocked) return "blocked"
  if (input.seated) {
    const progress = computeStayProgress(
      input.seated.seatedAt,
      input.seated.expectedMin,
      input.nowMs,
    )
    return progress.timeStatus === "over" ? "finishing" : "seated"
  }
  if (input.cleaningSince) return "cleaning"
  if (input.upcomingCount > 0) return "reserved"
  return "available"
}

/* ------------------------------------------------------------------ */
/* Live metrics                                                        */
/* ------------------------------------------------------------------ */

export type LiveMetrics = {
  available: number
  reserved: number
  seated: number
  finishing: number
  cleaning: number
  blocked: number
  /** Guests currently seated (sum of party sizes in seated/finishing tables). */
  guestsSeated: number
  /** Average completed stay today in minutes, or null if none finished yet. */
  averageStayMin: number | null
}
