"use client"

import * as React from "react"

/**
 * Shared ticking clock. Returns `Date.now()` and re-renders every
 * `intervalMs` so live stay timers stay current without each component
 * running its own interval. Defaults to a 30s tick (timers show minutes).
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])

  return now
}
