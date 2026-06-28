"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRightIcon } from "lucide-react"

import { ROUTE_LABELS } from "./nav"

function titleize(segment: string): string {
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

/**
 * Derives a breadcrumb trail from the current pathname, using the workspace
 * nav labels where available and falling back to a titleized segment.
 */
export function Breadcrumb() {
  const pathname = usePathname()
  const current =
    ROUTE_LABELS[pathname] ??
    titleize(pathname.split("/").filter(Boolean).pop() ?? "Workspace")

  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="hidden sm:block">
          <Link
            href="/dashboard"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Workspace
          </Link>
        </li>
        <li className="hidden sm:block" aria-hidden>
          <ChevronRightIcon className="size-4 text-muted-foreground/60" />
        </li>
        <li className="min-w-0 truncate font-medium text-foreground">
          {current}
        </li>
      </ol>
    </nav>
  )
}
