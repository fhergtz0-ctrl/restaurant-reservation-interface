"use client"

import { cn } from "@/lib/utils"
import type { Slot } from "@/lib/reservation-data"

type TimeSlotButtonProps = {
  slot: Slot
  selected: boolean
  onSelect: (time: string) => void
}

export function TimeSlotButton({ slot, selected, onSelect }: TimeSlotButtonProps) {
  return (
    <button
      type="button"
      disabled={!slot.available}
      onClick={() => onSelect(slot.time)}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-xl border text-sm font-medium tabular-nums transition-colors outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        slot.available
          ? "border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent"
          : "cursor-not-allowed border-transparent bg-muted text-muted-foreground/50 line-through",
        selected &&
          "border-primary bg-primary text-primary-foreground hover:bg-primary hover:border-primary",
      )}
    >
      {slot.time}
    </button>
  )
}
