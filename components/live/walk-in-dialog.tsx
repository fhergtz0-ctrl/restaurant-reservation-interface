"use client"

import * as React from "react"
import { UserPlusIcon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { TableStatus } from "@/lib/admin-data"

export type WalkInDraft = {
  customerName: string
  guests: number
  tableId: string
  phone: string
  notes: string
}

/**
 * Seat-a-walk-in form. Only tables that can currently take a party (not
 * blocked, not already seated) are offered so the floor can't be
 * double-booked from here.
 */
export function WalkInDialog({
  open,
  onOpenChange,
  seatableTables,
  onSubmit,
  submitting,
  presetTableId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  seatableTables: TableStatus[]
  onSubmit: (draft: WalkInDraft) => Promise<boolean>
  submitting: boolean
  presetTableId?: string | null
}) {
  const [customerName, setCustomerName] = React.useState("")
  const [guests, setGuests] = React.useState(2)
  const [tableId, setTableId] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [notes, setNotes] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)

  // Reset the form whenever the dialog opens, seeding the preset table.
  React.useEffect(() => {
    if (open) {
      setCustomerName("")
      setGuests(2)
      setTableId(presetTableId ?? "")
      setPhone("")
      setNotes("")
      setError(null)
    }
  }, [open, presetTableId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerName.trim()) {
      setError("Enter the guest's name.")
      return
    }
    if (!tableId) {
      setError("Choose a table to seat them at.")
      return
    }
    const ok = await onSubmit({
      customerName: customerName.trim(),
      guests,
      tableId,
      phone: phone.trim(),
      notes: notes.trim(),
    })
    if (!ok) setError("Couldn't seat the walk-in. Please try again.")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlusIcon className="size-5 text-primary" />
            Seat a walk-in
          </DialogTitle>
          <DialogDescription>
            Create a seated party immediately. The stay timer starts now.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="walkin-name">Guest name</Label>
            <Input
              id="walkin-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="e.g. Diana Prince"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="walkin-guests">Party size</Label>
              <Input
                id="walkin-guests"
                type="number"
                min={1}
                max={30}
                value={guests}
                onChange={(e) =>
                  setGuests(Math.max(1, Number(e.target.value) || 1))
                }
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="walkin-table">Table</Label>
              <Select
                value={tableId}
                onValueChange={(v) => setTableId(v ?? "")}
              >
                <SelectTrigger id="walkin-table">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {seatableTables.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No open tables
                    </SelectItem>
                  ) : (
                    seatableTables.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} · seats {t.capacity} · {t.zone}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="walkin-phone">Phone (optional)</Label>
            <Input
              id="walkin-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="walkin-notes">Notes (optional)</Label>
            <Textarea
              id="walkin-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Allergies, seating preferences, occasion..."
              rows={2}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2Icon className="size-4 animate-spin" />}
              Seat party
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
