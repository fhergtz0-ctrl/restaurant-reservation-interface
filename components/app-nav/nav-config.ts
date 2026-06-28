import {
  CalendarIcon,
  CalendarCheckIcon,
  LayoutDashboardIcon,
  LayoutGridIcon,
  Table2Icon,
  UsersIcon,
  BarChart3Icon,
  UtensilsCrossedIcon,
  ClockIcon,
  SettingsIcon,
  PlugIcon,
  MenuIcon,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  label: string
  /** Route to navigate to. Omitted for action items (e.g. the drawer toggle). */
  href?: string
  icon: LucideIcon
  /** Marks routes that aren't built yet so we render them as disabled. */
  soon?: boolean
}

/**
 * Bottom navigation (mobile only). The last item opens the drawer rather than
 * navigating, so it has no `href`.
 */
export const bottomNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { label: "Reservas", href: "/reservations", icon: CalendarCheckIcon },
  { label: "Calendario", href: "/calendar", icon: CalendarIcon },
  { label: "Mesas", href: "/tables", icon: Table2Icon },
  { label: "Menú", icon: MenuIcon },
]

/** Full navigation shown in the slide-in drawer. */
export const drawerItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboardIcon },
  { label: "Reservas", href: "/reservations", icon: CalendarCheckIcon },
  { label: "Calendario", href: "/calendar", icon: CalendarIcon },
  { label: "Plano de mesas", href: "/tables", icon: LayoutGridIcon },
  { label: "Mesas", href: "/tables", icon: Table2Icon },
  { label: "Clientes", icon: UsersIcon, soon: true },
  { label: "Reportes", icon: BarChart3Icon, soon: true },
  { label: "Menú", icon: UtensilsCrossedIcon, soon: true },
  { label: "Horarios", icon: ClockIcon, soon: true },
  { label: "Configuración", icon: SettingsIcon, soon: true },
  { label: "Integraciones", icon: PlugIcon, soon: true },
]

/** True when `pathname` is within the section pointed to by `href`. */
export function isActivePath(pathname: string, href?: string): boolean {
  if (!href) return false
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}
