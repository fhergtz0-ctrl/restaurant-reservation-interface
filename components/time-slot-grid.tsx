"use client"

import { CalendarX2Icon } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { TimeSlotButton } from "@/components/time-slot-button"
import type { Slot } from "@/lib/reservation-data"

type TimeSlotGridProps = {
  slots: Slot[]
  selectedTime: string | null
  onSelect: (time: string) => void
  loading: boolean
}

export function TimeSlotGrid({
  slots,
  selectedTime,
  onSelect,
  loading,
}: TimeSlotGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2.5" aria-hidden>
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-11 rounded-xl" />
        ))}
      </div>
    )
  }

  const availableCount = slots.filter((s) => s.available).length

  if (availableCount === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
        <CalendarX2Icon className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">No tables available</p>
        <p className="text-xs text-muted-foreground">
          Try a different date, time, or party size.
        </p>
      </div>
    )
  }

  return (
    <div
      className="grid grid-cols-3 gap-2.5"
      role="listbox"
      aria-label="Available reservation times"
    >
      {slots.map((slot) => (
        <TimeSlotButton
          key={slot.time}
          slot={slot}
          selected={selectedTime === slot.time}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
