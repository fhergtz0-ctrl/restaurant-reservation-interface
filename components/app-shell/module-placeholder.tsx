"use client"

import { usePathname } from "next/navigation"
import { ConstructionIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/app-nav/page-header"
import { navSections } from "@/components/app-shell/nav"

export function ModulePlaceholder({
  badge,
  title,
  subtitle,
  bullets,
}: {
  badge: string
  title: string
  subtitle: string
  bullets: string[]
}) {
  // Resolve the icon from the nav config on the client, so Server Component
  // pages only pass serializable props (no function across the boundary).
  const pathname = usePathname()
  const navItem = navSections
    .flatMap((s) => s.items)
    .find((item) => item.href === pathname)
  const icon = navItem?.icon ?? ConstructionIcon

  return (
    <div className="text-foreground">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
        <PageHeader
          badge={badge}
          icon={icon}
          title={title}
          subtitle={subtitle}
        />

        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <ConstructionIcon className="size-6 text-primary" />
          </span>
          <h2 className="mt-4 font-heading text-lg font-semibold">
            Coming soon
          </h2>
          <p className="mx-auto mt-2 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
            This module is part of the K&apos;áanche roadmap. The workspace
            navigation and layout are ready so it can slot in seamlessly.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <Badge variant="secondary" className="gap-1.5">
            Planned capabilities
          </Badge>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {bullets.map((b) => (
              <li
                key={b}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
