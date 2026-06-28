"use client"

import * as React from "react"
import {
  MailPlusIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserIcon,
  UsersRoundIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useRestaurants } from "@/components/app-shell/restaurant-context"
import { useToast } from "@/components/ui/toast"
import {
  SettingsHeader,
  SettingsLoading,
} from "@/components/settings/settings-section"
import { SelectField, TextField } from "@/components/settings/fields"
import {
  TEAM_ROLES,
  inviteInputSchema,
  type InviteInput,
  type TeamMember,
  type TeamRole,
} from "@/lib/settings/lists"

const ROLE_HINTS: Record<TeamRole, string> = {
  Owner: "Full access including billing and team management.",
  Manager: "Manage reservations, floor, and settings. No billing.",
  Host: "Manage reservations and seating for the floor.",
  Waiter: "View assigned reservations and update statuses.",
}

const ASSIGNABLE_ROLE_OPTIONS = TEAM_ROLES.filter((r) => r !== "Owner").map(
  (r) => ({ value: r, label: r }),
)

export function TeamSection() {
  const { selected } = useRestaurants()
  const toast = useToast()
  const slug = selected?.slug ?? null
  const restaurantId = selected?.id ?? null

  const [members, setMembers] = React.useState<TeamMember[]>([])
  const [loading, setLoading] = React.useState(true)
  const [configured, setConfigured] = React.useState(true)
  const [dialogOpen, setDialogOpen] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!slug && !restaurantId) {
      setLoading(false)
      return
    }
    setLoading(true)
    const params = new URLSearchParams()
    if (slug) params.set("restaurant", slug)
    if (restaurantId) params.set("restaurantId", restaurantId)
    try {
      const res = await fetch(`/api/admin/team?${params.toString()}`)
      const payload = (await res.json()) as {
        data?: TeamMember[]
        configured?: boolean
      }
      setMembers(payload.data ?? [])
      setConfigured(payload.configured !== false)
    } catch (err) {
      console.log(
        "[v0] team load error:",
        err instanceof Error ? err.message : err,
      )
    } finally {
      setLoading(false)
    }
  }, [slug, restaurantId])

  React.useEffect(() => {
    void load()
  }, [load])

  async function updateRole(member: TeamMember, role: TeamRole) {
    const prev = members
    setMembers((list) =>
      list.map((m) => (m.id === member.id ? { ...m, role } : m)),
    )
    try {
      const res = await fetch(`/api/admin/team/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant: slug, restaurantId, data: { role } }),
      })
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string }
        setMembers(prev)
        toast.error("Couldn't update role", payload.error)
      } else {
        toast.success("Role updated")
      }
    } catch {
      setMembers(prev)
      toast.error("Couldn't update role", "Please try again.")
    }
  }

  async function revoke(member: TeamMember) {
    const params = new URLSearchParams()
    if (slug) params.set("restaurant", slug)
    if (restaurantId) params.set("restaurantId", restaurantId)
    const prev = members
    setMembers((list) => list.filter((m) => m.id !== member.id))
    try {
      const res = await fetch(
        `/api/admin/team/${member.id}?${params.toString()}`,
        { method: "DELETE" },
      )
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string }
        setMembers(prev)
        toast.error("Couldn't revoke invitation", payload.error)
      } else {
        toast.success("Invitation revoked")
      }
    } catch {
      setMembers(prev)
      toast.error("Couldn't revoke invitation", "Please try again.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <SettingsHeader
        title="Team & Roles"
        description="Invite staff and control what each role can access across the workspace."
        action={
          <Button
            type="button"
            size="sm"
            onClick={() => setDialogOpen(true)}
            className="gap-1.5"
          >
            <MailPlusIcon className="size-4" />
            Invite member
          </Button>
        }
      />

      {!configured ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
          Connect Supabase and run{" "}
          <code className="rounded bg-amber-500/15 px-1 py-0.5 text-xs">
            scripts/005_settings_center.sql
          </code>{" "}
          to manage your team.
        </div>
      ) : null}

      {loading ? (
        <SettingsLoading />
      ) : members.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <UsersRoundIcon className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">No team members yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Invite managers, hosts, and waiters to collaborate.
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {members.map((member) => {
            const isOwner = member.role === "Owner"
            return (
              <li
                key={member.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <UserIcon className="size-4" />
                  </span>
                  <div className="flex flex-col">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      {member.name || member.email}
                      <Badge
                        variant={
                          member.status === "pending" ? "outline" : "secondary"
                        }
                        className="text-[11px]"
                      >
                        {member.status === "pending" ? "Pending" : "Active"}
                      </Badge>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {member.email}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {member.status === "pending" && !isOwner ? (
                    <SelectField<TeamRole>
                      label=""
                      value={member.role}
                      onChange={(role) => void updateRole(member, role)}
                      options={ASSIGNABLE_ROLE_OPTIONS}
                      className="w-[140px] [&_label]:sr-only"
                    />
                  ) : (
                    <Badge variant="outline" className="h-9 px-3">
                      {member.role}
                    </Badge>
                  )}
                  {member.status === "pending" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Revoke ${member.email}`}
                      onClick={() => void revoke(member)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2Icon className="size-4" />
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="flex flex-col gap-1">
          {TEAM_ROLES.map((r) => (
            <span key={r}>
              <span className="font-medium text-foreground">{r}:</span>{" "}
              {ROLE_HINTS[r]}
            </span>
          ))}
        </div>
      </div>

      <InviteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        slug={slug}
        restaurantId={restaurantId}
        onSaved={() => {
          setDialogOpen(false)
          void load()
        }}
      />
    </div>
  )
}

function InviteDialog({
  open,
  onOpenChange,
  slug,
  restaurantId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string | null
  restaurantId: string | null
  onSaved: () => void
}) {
  const toast = useToast()
  const [values, setValues] = React.useState<InviteInput>({
    email: "",
    role: "Host",
  })
  const [errors, setErrors] = React.useState<Partial<Record<keyof InviteInput, string>>>(
    {},
  )
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setValues({ email: "", role: "Host" })
      setErrors({})
    }
  }, [open])

  async function submit() {
    const parsed = inviteInputSchema.safeParse(values)
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors as Record<
        string,
        string[] | undefined
      >
      const mapped: Partial<Record<keyof InviteInput, string>> = {}
      for (const [key, msgs] of Object.entries(flat)) {
        if (msgs && msgs[0]) mapped[key as keyof InviteInput] = msgs[0]
      }
      setErrors(mapped)
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant: slug,
          restaurantId,
          data: parsed.data,
        }),
      })
      if (res.ok) {
        toast.success("Invitation sent", `${parsed.data.email} was invited.`)
        onSaved()
      } else {
        const payload = (await res.json()) as { error?: string }
        toast.error("Couldn't send invitation", payload.error)
      }
    } catch {
      toast.error("Couldn't send invitation", "Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a team member</DialogTitle>
          <DialogDescription>
            They&apos;ll receive access with the role you select.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <TextField
            label="Email address"
            type="email"
            required
            value={values.email}
            onChange={(v) => setValues((p) => ({ ...p, email: v }))}
            error={errors.email}
            placeholder="name@restaurant.com"
          />
          <SelectField<TeamRole>
            label="Role"
            value={values.role}
            onChange={(role) => setValues((p) => ({ ...p, role }))}
            options={ASSIGNABLE_ROLE_OPTIONS}
            hint={ROLE_HINTS[values.role]}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={saving}>
            {saving ? "Sending…" : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
