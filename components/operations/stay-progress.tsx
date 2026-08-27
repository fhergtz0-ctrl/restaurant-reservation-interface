"use client"

import { ClockIcon } from "lucide-react"

import {
  computeStayProgress,
  formatDuration,
  TIME_STATUS_META,
  getExpectedDurationMinutes,
} from "@/lib/operations"

/**
 * Shared live stay indicator used by K'áanche Live, the Floor Plan drawer, and
 * the Timeline. Renders the elapsed timer, a progress bar, and the time-status
 * label — all derived from the single source of truth in lib/operations.
 */
export function StayProgress({
  seatedAt,
  guests,
  expectedMin,
  nowMs,
  compact = false,
}: {
  seatedAt: string | null
  guests?: number
  /** Override the expected duration; defaults to the centralised resolver. */
  expectedMin?: number
  nowMs: number
  compact?: boolean
}) {
  const expected = expectedMin ?? getExpectedDurationMinutes({ guests })
  const progress = computeStayProgress(seatedAt, expected, nowMs)

  if (progress.elapsedMin === null) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <ClockIcon className="size-3.5" />
        Not seated yet
      </span>
    )
  }

  const meta = TIME_STATUS_META[progress.timeStatus]
  const pct = Math.min(100, Math.round(progress.ratio * 100))
  const barColor =
    progress.timeStatus === "over"
      ? "bg-red-500"
      : progress.timeStatus === "approaching"
        ? "bg-amber-500"
        : "bg-emerald-500"

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={`inline-flex items-center gap-1.5 font-medium ${meta.className}`}>
          <ClockIcon className="size-3.5" />
          {formatDuration(progress.elapsedMin)} seated
        </span>
        {!compact && (
          <span className="text-muted-foreground">
            {progress.remainingMin !== null && progress.remainingMin >= 0
              ? `${formatDuration(progress.remainingMin)} left`
              : `${formatDuration(progress.remainingMin)} over`}
          </span>
        )}
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Stay progress: ${meta.label}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
      {!compact && (
        <span className={`text-[11px] font-medium ${meta.className}`}>
          {meta.label} · expected {formatDuration(expected)}
        </span>
      )}
    </div>
  )
}
