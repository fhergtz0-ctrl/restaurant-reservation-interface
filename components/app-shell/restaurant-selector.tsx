"use client"

import { StoreIcon } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useRestaurants } from "./restaurant-context"

/**
 * Global restaurant switcher, wired to the shared restaurant context. Changing
 * it re-points every data view in the workspace.
 */
export function RestaurantSelector({ className }: { className?: string }) {
  const { restaurants, selectedSlug, setSelectedSlug } = useRestaurants()

  return (
    <Select
      value={selectedSlug}
      onValueChange={(v) => setSelectedSlug(v ?? selectedSlug)}
    >
      <SelectTrigger
        className={`h-9 w-[180px] ${className ?? ""}`}
        aria-label="Select restaurant"
      >
        <span className="flex items-center gap-2 truncate">
          <StoreIcon className="size-4 shrink-0 text-primary" />
          <SelectValue>
            {(value) =>
              restaurants.find((r) => r.slug === value)?.name ?? "Restaurant"
            }
          </SelectValue>
        </span>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {restaurants.length === 0 ? (
            <SelectItem value={selectedSlug} disabled>
              No restaurants
            </SelectItem>
          ) : (
            restaurants.map((r) => (
              <SelectItem key={r.slug} value={r.slug}>
                {r.name}
              </SelectItem>
            ))
          )}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
