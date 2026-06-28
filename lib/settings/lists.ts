import { z } from "zod"

/**
 * Schemas + types for the "list" settings sections, which are backed by their
 * own relational tables rather than the generic KV store: Experiences, Team &
 * Roles (invitations), and Integrations.
 */

// ---------------------------------------------------------------------------
// Experiences
// ---------------------------------------------------------------------------
export const experienceInputSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  description: z.string().trim().max(600).optional().default(""),
  priceCents: z.coerce.number().int().min(0).max(10_000_000).default(0),
  durationMinutes: z.coerce.number().int().min(30).max(480).default(120),
  minGuests: z.coerce.number().int().min(1).max(100).default(1),
  maxGuests: z.coerce.number().int().min(1).max(100).default(8),
  active: z.boolean().default(true),
})
export type ExperienceInput = z.infer<typeof experienceInputSchema>

export type Experience = ExperienceInput & {
  id: string
  position: number
}

export const defaultExperienceInput: ExperienceInput = {
  name: "",
  description: "",
  priceCents: 0,
  durationMinutes: 120,
  minGuests: 1,
  maxGuests: 8,
  active: true,
}

// ---------------------------------------------------------------------------
// Team & Roles
// ---------------------------------------------------------------------------
export const TEAM_ROLES = ["Owner", "Manager", "Host", "Waiter"] as const
export type TeamRole = (typeof TEAM_ROLES)[number]

export const inviteInputSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  role: z.enum(TEAM_ROLES).default("Host"),
})
export type InviteInput = z.infer<typeof inviteInputSchema>

export type TeamMember = {
  id: string
  email: string
  name: string | null
  role: TeamRole
  status: "active" | "pending"
}

// ---------------------------------------------------------------------------
// Integrations
// ---------------------------------------------------------------------------
export type IntegrationProvider = {
  key: string
  name: string
  description: string
  category: "Payments" | "Messaging" | "Analytics" | "Operations"
}

/** The catalog of integrations the product supports surfacing. */
export const INTEGRATION_CATALOG: IntegrationProvider[] = [
  {
    key: "stripe",
    name: "Stripe",
    description: "Collect deposits and prepaid experiences at booking time.",
    category: "Payments",
  },
  {
    key: "twilio",
    name: "Twilio SMS",
    description: "Send SMS confirmations and reminders to guests.",
    category: "Messaging",
  },
  {
    key: "mailchimp",
    name: "Mailchimp",
    description: "Sync guest emails into marketing audiences.",
    category: "Messaging",
  },
  {
    key: "google_analytics",
    name: "Google Analytics",
    description: "Track booking funnel conversions on your booking page.",
    category: "Analytics",
  },
  {
    key: "google_reserve",
    name: "Reserve with Google",
    description: "Accept reservations directly from Google Search and Maps.",
    category: "Operations",
  },
  {
    key: "quickbooks",
    name: "QuickBooks",
    description: "Export revenue and deposits to your accounting ledger.",
    category: "Operations",
  },
]

export const integrationUpdateSchema = z.object({
  provider: z.string().trim().min(1),
  enabled: z.boolean(),
  config: z.record(z.string(), z.unknown()).optional().default({}),
})
export type IntegrationUpdate = z.infer<typeof integrationUpdateSchema>

export type IntegrationState = {
  provider: string
  enabled: boolean
  config: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Audit log (read model)
// ---------------------------------------------------------------------------
export type AuditEntry = {
  id: string
  actorEmail: string | null
  action: string
  section: string | null
  summary: string | null
  createdAt: string
}
