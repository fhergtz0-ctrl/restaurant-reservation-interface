import {
  BarChart3Icon,
  BellIcon,
  BuildingIcon,
  CalendarIcon,
  CalendarCheckIcon,
  ClockIcon,
  CombineIcon,
  CreditCardIcon,
  CrownIcon,
  ExternalLinkIcon,
  GlobeIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  MailIcon,
  MapIcon,
  PaletteIcon,
  PlugIcon,
  RadioIcon,
  Rows3Icon,
  SlidersHorizontalIcon,
  SparklesIcon,
  StarIcon,
  StickyNoteIcon,
  UsersIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react"

export type WorkspaceNavItem = {
  label: string
  /** Static route. Omitted for dynamic / action items. */
  href?: string
  icon: LucideIcon
  /** Renders as a disabled "Soon" item when the module isn't built yet. */
  soon?: boolean
  /** Links to the selected restaurant's public booking page in a new tab. */
  bookingPage?: boolean
}

export type WorkspaceNavSection = {
  title: string
  items: WorkspaceNavItem[]
}

/**
 * The full sidebar / drawer navigation, grouped into sections. Routes that
 * exist today link through; everything else is a built placeholder page so the
 * information architecture is complete and navigable.
 */
export const navSections: WorkspaceNavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
    ],
  },
  {
    title: "Reservations",
    items: [
      { label: "Reservations", href: "/reservations", icon: CalendarCheckIcon },
      { label: "Timeline", href: "/timeline", icon: Rows3Icon },
      { label: "Calendar", href: "/calendar", icon: CalendarIcon },
    ],
  },
  {
    title: "Availability Planning",
    items: [
      { label: "K'áanche Live", href: "/live", icon: RadioIcon },
      { label: "Floor Plan", href: "/tables", icon: LayoutGridIcon },
      { label: "Table Combinations", href: "/combinations", icon: CombineIcon },
      { label: "Schedule", href: "/schedule", icon: ClockIcon },
      { label: "Special Days", href: "/special-days", icon: StarIcon },
      { label: "Spaces / Zones", href: "/spaces", icon: MapIcon },
    ],
  },
  {
    title: "Guests",
    items: [
      { label: "Guest List", href: "/guests", icon: UsersIcon },
      { label: "Notes", href: "/notes", icon: StickyNoteIcon },
      { label: "VIP", href: "/vip", icon: CrownIcon },
    ],
  },
  {
    title: "Restaurant",
    items: [
      { label: "Settings", href: "/settings", icon: SettingsIcon },
      { label: "Branding", href: "/branding", icon: PaletteIcon },
      {
        label: "Public Booking Page",
        icon: ExternalLinkIcon,
        bookingPage: true,
      },
    ],
  },
  {
    title: "Business",
    items: [
      { label: "Reports", href: "/reports", icon: BarChart3Icon },
      { label: "Team", href: "/team", icon: UsersRoundIcon },
      { label: "Subscription", href: "/subscription", icon: CreditCardIcon },
    ],
  },
]

/** Compact mobile bottom navigation: four key routes + a menu trigger. */
export const bottomNavItems: { label: string; href?: string; icon: LucideIcon }[] =
  [
    { label: "Home", href: "/dashboard", icon: LayoutDashboardIcon },
    { label: "Reservas", href: "/reservations", icon: CalendarCheckIcon },
    { label: "Calendar", href: "/calendar", icon: CalendarIcon },
    { label: "Floor", href: "/tables", icon: LayoutGridIcon },
  ]

/** Flattened lookup of label by href, for breadcrumbs and titles. */
export const ROUTE_LABELS: Record<string, string> = navSections
  .flatMap((s) => s.items)
  .reduce<Record<string, string>>((acc, item) => {
    if (item.href) acc[item.href] = item.label
    return acc
  }, {})

/** True when `pathname` is within the section pointed to by `href`. */
export function isActivePath(pathname: string, href?: string): boolean {
  if (!href) return false
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}
