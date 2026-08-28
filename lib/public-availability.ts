/**
 * Public booking mapper (Phase 13A).
 *
 * Converts the INTERNAL Availability Engine result (lib/availability-engine.ts)
 * into a lean, guest-safe shape for the public booking search. This is the
 * ONLY thing the guest-facing API returns — it deliberately drops every
 * internal field:
 *
 *   - table UUIDs and table names          (allocation stays server-side)
 *   - zone names / "mixed zone" flags
 *   - blocked / active status
 *   - reservation diagnostics
 *   - machine reason codes (all_tables_reserved, no_combination_available, …)
 *   - service-period business policy (min/max party, intervals, durations)
 *   - Supabase / restaurant internal ids
 *
 * Guests see only: which service periods exist and which times are bookable,
 * plus a single friendly status/message for closure or no-availability.
 *
 * No availability is computed here — this is a pure presentation mapping of a
 * result the engine already produced.
 */

import type { AvailabilityResult } from "@/lib/availability-engine"

/* ------------------------------------------------------------------ */
/* Public shapes                                                       */
/* ------------------------------------------------------------------ */

export type PublicTime = {
  /** Display time, e.g. "7:00 PM". */
  time: string
  /** 24-hour "HH:MM" — the stable value handed to Phase 13B. */
  time24: string
  available: boolean
}

export type PublicService = {
  name: string
  times: PublicTime[]
}

/**
 * Top-level guest status:
 *   available       — at least one bookable time exists
 *   closed          — the restaurant is closed on this date
 *   no_availability — open, but nothing is bookable for this party/date
 *   unavailable     — the availability service itself could not answer
 */
export type PublicAvailabilityStatus =
  | "available"
  | "closed"
  | "no_availability"
  | "unavailable"

export type PublicAvailability = {
  date: string
  partySize: number
  restaurant: { name: string; slug: string }
  status: PublicAvailabilityStatus
  /** Guest-safe sentence for non-available states; omitted when available. */
  message?: string
  services: PublicService[]
}

/* ------------------------------------------------------------------ */
/* Guest-safe copy                                                     */
/* ------------------------------------------------------------------ */

export const CLOSED_MESSAGE = "The restaurant is closed on this date."
export const NO_PARTY_MESSAGE =
  "No times are available for this party size on this date."
export const NO_AVAILABILITY_MESSAGE =
  "No tables are available for this date. Try another day."
export const UNAVAILABLE_MESSAGE = "Availability is temporarily unavailable."

/* ------------------------------------------------------------------ */
/* Mapper                                                              */
/* ------------------------------------------------------------------ */

/**
 * Map an internal engine result into the public booking response.
 *
 * By default only AVAILABLE times are included (guests should see useful
 * options, never internal reason codes). Pass `includeUnavailable` to also
 * emit disabled slots — but their reason codes are still never exposed.
 */
export function toPublicAvailability(
  result: AvailabilityResult,
  restaurant: { name: string; slug: string },
  options: { includeUnavailable?: boolean } = {},
): PublicAvailability {
  const includeUnavailable = options.includeUnavailable === true

  const base = {
    date: result.date,
    partySize: result.partySize,
    restaurant: { name: restaurant.name, slug: restaurant.slug },
  }

  // Fully closed (weekly schedule has no periods, or a Special Day closed it).
  if (!result.open || result.servicePeriods.length === 0) {
    return {
      ...base,
      status: "closed",
      message: CLOSED_MESSAGE,
      services: [],
    }
  }

  // Build guest-facing services from eligible periods only.
  const services: PublicService[] = []
  for (const period of result.servicePeriods) {
    if (!period.eligible) continue
    const times: PublicTime[] = period.slots
      .filter((slot) => includeUnavailable || slot.available)
      .map((slot) => ({
        time: slot.time,
        time24: slot.time24,
        available: slot.available,
      }))
    if (times.length > 0) {
      services.push({ name: period.name, times })
    }
  }

  const hasBookable = services.some((s) => s.times.some((t) => t.available))
  if (hasBookable) {
    return { ...base, status: "available", services }
  }

  // Open, but nothing bookable. Distinguish a party-size mismatch (every
  // period rejected the party) from generic no-availability, without leaking
  // the specific internal reason code.
  const partySizeMismatch =
    result.servicePeriods.length > 0 &&
    result.servicePeriods.every(
      (p) => !p.eligible && p.reason === "party_size_not_supported",
    )

  return {
    ...base,
    status: "no_availability",
    message: partySizeMismatch ? NO_PARTY_MESSAGE : NO_AVAILABILITY_MESSAGE,
    // When includeUnavailable is set we still return the (disabled) services
    // so the UI can show greyed-out chips; otherwise services is empty.
    services: includeUnavailable ? services : [],
  }
}

/**
 * A guest-safe response for when the availability service itself failed
 * (e.g. the frozen restaurant-context bug). NEVER surfaces the internal error.
 */
export function unavailableResponse(
  restaurant: { name: string; slug: string },
  date: string,
  partySize: number,
): PublicAvailability {
  return {
    date,
    partySize,
    restaurant: { name: restaurant.name, slug: restaurant.slug },
    status: "unavailable",
    message: UNAVAILABLE_MESSAGE,
    services: [],
  }
}
