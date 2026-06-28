import {
  BellIcon,
  BuildingIcon,
  CreditCardIcon,
  GlobeIcon,
  HistoryIcon,
  MailIcon,
  PaletteIcon,
  PlugIcon,
  SparklesIcon,
  SlidersHorizontalIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react"

export type SettingsNavItem = {
  label: string
  href: string
  icon: LucideIcon
  description: string
}

export type SettingsNavGroup = {
  title: string
  items: SettingsNavItem[]
}

/**
 * Secondary navigation for the Settings / Admin Center, grouped to match the
 * primary sidebar's Restaurant / Administration / Business sections.
 */
export const settingsNav: SettingsNavGroup[] = [
  {
    title: "Restaurant",
    items: [
      {
        label: "Restaurant Profile",
        href: "/settings/profile",
        icon: BuildingIcon,
        description: "Name, category, capacity, and locale",
      },
      {
        label: "Contact",
        href: "/settings/contact",
        icon: MailIcon,
        description: "Address, phone, and social links",
      },
      {
        label: "Branding",
        href: "/settings/branding",
        icon: PaletteIcon,
        description: "Logo, colors, and typography",
      },
      {
        label: "Reservation Rules",
        href: "/settings/reservations",
        icon: SlidersHorizontalIcon,
        description: "Slots, party sizes, and policies",
      },
      {
        label: "Experiences",
        href: "/settings/experiences",
        icon: SparklesIcon,
        description: "Prix-fixe menus and special offerings",
      },
      {
        label: "Notifications",
        href: "/settings/notifications",
        icon: BellIcon,
        description: "Guest and staff messaging",
      },
      {
        label: "Online Booking",
        href: "/settings/online-booking",
        icon: GlobeIcon,
        description: "Public booking page and widget",
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        label: "Team & Roles",
        href: "/settings/team",
        icon: UsersRoundIcon,
        description: "Members, invitations, and permissions",
      },
      {
        label: "Integrations",
        href: "/settings/integrations",
        icon: PlugIcon,
        description: "Connect external services",
      },
      {
        label: "Audit Log",
        href: "/settings/audit",
        icon: HistoryIcon,
        description: "Track changes across the workspace",
      },
    ],
  },
  {
    title: "Business",
    items: [
      {
        label: "Billing & Subscription",
        href: "/settings/billing",
        icon: CreditCardIcon,
        description: "Plan, invoices, and payment details",
      },
    ],
  },
]

/** Flattened list of every settings route, for lookups and prefetching. */
export const settingsNavItems: SettingsNavItem[] = settingsNav.flatMap(
  (g) => g.items,
)

export const SETTINGS_LABELS: Record<string, string> = settingsNavItems.reduce<
  Record<string, string>
>((acc, item) => {
  acc[item.href] = item.label
  return acc
}, {})
