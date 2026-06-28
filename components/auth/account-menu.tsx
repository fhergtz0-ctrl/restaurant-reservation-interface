import { LogOutIcon } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { signOutAction } from "@/app/actions/auth"
import { restaurantInitials } from "@/lib/restaurants"
import type { SessionProfile } from "@/lib/auth"

/**
 * Compact account summary + sign-out, shown in the dashboard/admin headers.
 * Renders nothing when there's no authenticated profile.
 */
export function AccountMenu({ profile }: { profile: SessionProfile | null }) {
  if (!profile) return null

  return (
    <div className="flex items-center gap-3">
      <div className="hidden items-center gap-2.5 sm:flex">
        <Avatar className="size-9 rounded-xl ring-1 ring-border">
          <AvatarFallback className="rounded-xl text-xs">
            {restaurantInitials(profile.name || profile.email)}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-foreground">
            {profile.name}
          </span>
          <span className="text-xs text-muted-foreground">{profile.email}</span>
        </div>
        <Badge variant="secondary" className="ml-1">
          {profile.role}
        </Badge>
      </div>

      <form action={signOutAction}>
        <Button type="submit" variant="outline" size="sm" className="gap-1.5">
          <LogOutIcon className="size-4" />
          Sign out
        </Button>
      </form>
    </div>
  )
}
