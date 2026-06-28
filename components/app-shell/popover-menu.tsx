"use client"

import * as React from "react"

/**
 * Lightweight click-to-toggle popover (no external deps). Closes on outside
 * click and Escape. Used for the notifications and user menus in the header.
 */
export function PopoverMenu({
  trigger,
  children,
  align = "end",
  panelClassName,
  label,
}: {
  trigger: (props: {
    open: boolean
    toggle: () => void
    ref: React.Ref<HTMLButtonElement>
  }) => React.ReactNode
  children: (props: { close: () => void }) => React.ReactNode
  align?: "start" | "end"
  panelClassName?: string
  label: string
}) {
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const panelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node
      if (
        !panelRef.current?.contains(t) &&
        !triggerRef.current?.contains(t)
      ) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o), ref: triggerRef })}
      {open && (
        <div
          ref={panelRef}
          role="menu"
          aria-label={label}
          className={`absolute top-[calc(100%+0.5rem)] z-50 min-w-56 origin-top overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl ${
            align === "end" ? "right-0" : "left-0"
          } ${panelClassName ?? ""}`}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  )
}
