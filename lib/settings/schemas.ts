import { z } from "zod"

/**
 * Shared zod schemas for the Settings / Admin Center. Each "KV section" maps
 * to one JSONB row in `restaurant_settings_kv`. Schemas are used on both the
 * client (form validation) and the server (API validation), and every schema
 * has a matching `default*` so the UI renders fully before anything is saved
 * or when Supabase is not configured.
 */

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, "Use a 6-digit hex color, e.g. #C8A35B")

const optionalUrl = z
  .string()
  .trim()
  .url("Enter a valid URL (https://…)")
  .or(z.literal(""))

const optionalEmail = z
  .string()
  .trim()
  .email("Enter a valid email")
  .or(z.literal(""))

// ---------------------------------------------------------------------------
// Restaurant Profile
// ---------------------------------------------------------------------------
export const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  legalName: z.string().trim().max(120).optional().default(""),
  category: z.string().trim().max(80).optional().default(""),
  neighborhood: z.string().trim().max(80).optional().default(""),
  description: z.string().trim().max(600).optional().default(""),
  priceRange: z.enum(["$", "$$", "$$$", "$$$$"]).default("$$$"),
  capacity: z.coerce.number().int().min(0).max(100000).default(0),
  currency: z.string().trim().min(3).max(3).default("USD"),
  timezone: z.string().trim().min(1).default("America/New_York"),
  language: z.enum(["en", "es", "fr"]).default("en"),
})
export type ProfileSettings = z.infer<typeof profileSchema>
export const defaultProfile: ProfileSettings = {
  name: "",
  legalName: "",
  category: "",
  neighborhood: "",
  description: "",
  priceRange: "$$$",
  capacity: 0,
  currency: "USD",
  timezone: "America/New_York",
  language: "en",
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------
export const contactSchema = z.object({
  email: optionalEmail.default(""),
  phone: z.string().trim().max(40).optional().default(""),
  whatsapp: z.string().trim().max(40).optional().default(""),
  addressLine: z.string().trim().max(160).optional().default(""),
  city: z.string().trim().max(80).optional().default(""),
  state: z.string().trim().max(80).optional().default(""),
  postalCode: z.string().trim().max(20).optional().default(""),
  country: z.string().trim().max(80).optional().default(""),
  website: optionalUrl.default(""),
  instagram: z.string().trim().max(120).optional().default(""),
  facebook: z.string().trim().max(120).optional().default(""),
  x: z.string().trim().max(120).optional().default(""),
})
export type ContactSettings = z.infer<typeof contactSchema>
export const defaultContact: ContactSettings = {
  email: "",
  phone: "",
  whatsapp: "",
  addressLine: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  website: "",
  instagram: "",
  facebook: "",
  x: "",
}

// ---------------------------------------------------------------------------
// Branding
// ---------------------------------------------------------------------------
export const brandingSchema = z.object({
  primaryColor: hexColor.default("#C8A35B"),
  accentColor: hexColor.default("#8B5E3C"),
  logoUrl: optionalUrl.default(""),
  coverUrl: optionalUrl.default(""),
  font: z.enum(["sans", "serif", "mono"]).default("serif"),
  tagline: z.string().trim().max(120).optional().default(""),
})
export type BrandingSettings = z.infer<typeof brandingSchema>
export const defaultBranding: BrandingSettings = {
  primaryColor: "#C8A35B",
  accentColor: "#8B5E3C",
  logoUrl: "",
  coverUrl: "",
  font: "serif",
  tagline: "",
}

// ---------------------------------------------------------------------------
// Reservation Rules
// ---------------------------------------------------------------------------
export const reservationsSchema = z
  .object({
    slotIntervalMinutes: z.coerce.number().int().min(15).max(240).default(30),
    defaultDurationMinutes: z.coerce.number().int().min(30).max(360).default(90),
    minPartySize: z.coerce.number().int().min(1).max(100).default(1),
    maxPartySize: z.coerce.number().int().min(1).max(100).default(12),
    maxAdvanceDays: z.coerce.number().int().min(1).max(730).default(90),
    minNoticeMinutes: z.coerce.number().int().min(0).max(20160).default(120),
    autoConfirm: z.boolean().default(true),
    requireEmail: z.boolean().default(true),
    requirePhone: z.boolean().default(true),
    allowWaitlist: z.boolean().default(false),
    holdMinutes: z.coerce.number().int().min(0).max(240).default(15),
    cancellationPolicy: z.string().trim().max(800).optional().default(""),
    depositEnabled: z.boolean().default(false),
    depositAmountCents: z.coerce.number().int().min(0).max(1000000).default(0),
  })
  .refine((v) => v.maxPartySize >= v.minPartySize, {
    message: "Max party size must be greater than or equal to min party size",
    path: ["maxPartySize"],
  })
export type ReservationsSettings = z.infer<typeof reservationsSchema>
export const defaultReservations: ReservationsSettings = {
  slotIntervalMinutes: 30,
  defaultDurationMinutes: 90,
  minPartySize: 1,
  maxPartySize: 12,
  maxAdvanceDays: 90,
  minNoticeMinutes: 120,
  autoConfirm: true,
  requireEmail: true,
  requirePhone: true,
  allowWaitlist: false,
  holdMinutes: 15,
  cancellationPolicy: "",
  depositEnabled: false,
  depositAmountCents: 0,
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const notificationsSchema = z.object({
  confirmationEmail: z.boolean().default(true),
  reminderEmail: z.boolean().default(true),
  reminderHoursBefore: z.coerce.number().int().min(1).max(168).default(24),
  cancellationEmail: z.boolean().default(true),
  guestSms: z.boolean().default(false),
  staffNewBooking: z.boolean().default(true),
  staffCancellation: z.boolean().default(true),
  dailySummary: z.boolean().default(false),
  notifyEmail: optionalEmail.default(""),
  fromName: z.string().trim().max(80).optional().default(""),
  confirmationMessage: z.string().trim().max(600).optional().default(""),
})
export type NotificationsSettings = z.infer<typeof notificationsSchema>
export const defaultNotifications: NotificationsSettings = {
  confirmationEmail: true,
  reminderEmail: true,
  reminderHoursBefore: 24,
  cancellationEmail: true,
  guestSms: false,
  staffNewBooking: true,
  staffCancellation: true,
  dailySummary: false,
  notifyEmail: "",
  fromName: "",
  confirmationMessage: "",
}

// ---------------------------------------------------------------------------
// Online Booking (public widget / booking page)
// ---------------------------------------------------------------------------
export const onlineBookingSchema = z.object({
  enabled: z.boolean().default(true),
  showAvailability: z.boolean().default(true),
  requireApproval: z.boolean().default(false),
  maxGuestsOnline: z.coerce.number().int().min(1).max(100).default(8),
  bookingWindowText: z.string().trim().max(200).optional().default(""),
  welcomeMessage: z.string().trim().max(400).optional().default(""),
  widgetColor: hexColor.default("#C8A35B"),
  buttonLabel: z.string().trim().max(40).default("Reserve a table"),
  collectSpecialRequests: z.boolean().default(true),
})
export type OnlineBookingSettings = z.infer<typeof onlineBookingSchema>
export const defaultOnlineBooking: OnlineBookingSettings = {
  enabled: true,
  showAvailability: true,
  requireApproval: false,
  maxGuestsOnline: 8,
  bookingWindowText: "",
  welcomeMessage: "",
  widgetColor: "#C8A35B",
  buttonLabel: "Reserve a table",
  collectSpecialRequests: true,
}

// ---------------------------------------------------------------------------
// Billing & Subscription
// ---------------------------------------------------------------------------
export const billingSchema = z.object({
  plan: z.enum(["starter", "growth", "enterprise"]).default("growth"),
  billingCycle: z.enum(["monthly", "annual"]).default("monthly"),
  billingEmail: optionalEmail.default(""),
  companyName: z.string().trim().max(120).optional().default(""),
  taxId: z.string().trim().max(60).optional().default(""),
  billingAddress: z.string().trim().max(200).optional().default(""),
})
export type BillingSettings = z.infer<typeof billingSchema>
export const defaultBilling: BillingSettings = {
  plan: "growth",
  billingCycle: "monthly",
  billingEmail: "",
  companyName: "",
  taxId: "",
  billingAddress: "",
}

// ---------------------------------------------------------------------------
// Section registry — single source of truth for the generic KV API.
// ---------------------------------------------------------------------------
export const KV_SECTIONS = {
  profile: { schema: profileSchema, default: defaultProfile },
  contact: { schema: contactSchema, default: defaultContact },
  branding: { schema: brandingSchema, default: defaultBranding },
  reservations: { schema: reservationsSchema, default: defaultReservations },
  notifications: { schema: notificationsSchema, default: defaultNotifications },
  online_booking: { schema: onlineBookingSchema, default: defaultOnlineBooking },
  billing: { schema: billingSchema, default: defaultBilling },
} as const

export type KvSectionKey = keyof typeof KV_SECTIONS

export function isKvSection(value: string): value is KvSectionKey {
  return Object.prototype.hasOwnProperty.call(KV_SECTIONS, value)
}

/**
 * Parse stored JSONB into a fully-populated, valid section object. Falls back
 * to the section default for any missing/invalid field so the UI never breaks
 * on partial or legacy data.
 */
export function parseSection<K extends KvSectionKey>(
  section: K,
  raw: unknown,
): (typeof KV_SECTIONS)[K]["default"] {
  const { schema, default: fallback } = KV_SECTIONS[section]
  const merged = { ...(fallback as object), ...(raw as object | null) }
  const result = schema.safeParse(merged)
  if (result.success) {
    return result.data as (typeof KV_SECTIONS)[K]["default"]
  }
  return fallback
}
