"use client"

import * as React from "react"
import { CopyIcon, CheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useRestaurants } from "@/components/app-shell/restaurant-context"
import {
  SettingsForm,
  SettingsCard,
  SettingsLoading,
} from "@/components/settings/settings-section"
import {
  FieldGrid,
  TextField,
  TextareaField,
  NumberField,
  SwitchField,
  ColorField,
} from "@/components/settings/fields"
import { useSettingsForm } from "@/components/settings/use-settings-form"

export function OnlineBookingSection() {
  const form = useSettingsForm("online_booking")
  const { selected } = useRestaurants()
  const [copied, setCopied] = React.useState(false)

  if (form.status === "loading") return <SettingsLoading />

  const slug = selected?.slug ?? "your-restaurant"
  const bookingUrl = `https://kaanche.app/r/${slug}`
  const embed = `<iframe src="${bookingUrl}/widget" width="100%" height="640" frameborder="0" title="Reserve a table"></iframe>`

  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embed)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard unavailable — no-op.
    }
  }

  return (
    <SettingsForm
      form={form}
      title="Online Booking"
      description="Configure your public booking page and the embeddable reservation widget."
    >
      <SettingsCard
        title="Availability"
        description="Control whether guests can book online."
      >
        <div className="flex flex-col gap-3">
          <SwitchField
            label="Enable online booking"
            description="Allow guests to reserve through your public page and widget."
            checked={form.values.enabled}
            onChange={(v) => form.setField("enabled", v)}
          />
          <SwitchField
            label="Show live availability"
            description="Display open time slots to guests in real time."
            checked={form.values.showAvailability}
            onChange={(v) => form.setField("showAvailability", v)}
          />
          <SwitchField
            label="Require approval"
            description="Hold online bookings for staff confirmation."
            checked={form.values.requireApproval}
            onChange={(v) => form.setField("requireApproval", v)}
          />
          <SwitchField
            label="Collect special requests"
            description="Show a notes field for allergies and occasions."
            checked={form.values.collectSpecialRequests}
            onChange={(v) => form.setField("collectSpecialRequests", v)}
          />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Appearance & copy"
        description="Customize how the widget looks and reads."
      >
        <FieldGrid>
          <NumberField
            label="Max guests online"
            value={form.values.maxGuestsOnline}
            onChange={(v) => form.setField("maxGuestsOnline", v)}
            error={form.errors.maxGuestsOnline}
            min={1}
            max={100}
            suffix="guests"
          />
          <ColorField
            label="Widget color"
            value={form.values.widgetColor}
            onChange={(v) => form.setField("widgetColor", v)}
            error={form.errors.widgetColor}
          />
          <TextField
            label="Button label"
            value={form.values.buttonLabel}
            onChange={(v) => form.setField("buttonLabel", v)}
            error={form.errors.buttonLabel}
            placeholder="Reserve a table"
          />
          <TextField
            label="Booking window note"
            value={form.values.bookingWindowText}
            onChange={(v) => form.setField("bookingWindowText", v)}
            error={form.errors.bookingWindowText}
            placeholder="Booking up to 90 days ahead"
          />
        </FieldGrid>
        <div className="mt-5">
          <TextareaField
            label="Welcome message"
            value={form.values.welcomeMessage}
            onChange={(v) => form.setField("welcomeMessage", v)}
            error={form.errors.welcomeMessage}
            rows={3}
            hint="Shown at the top of your booking page."
            placeholder="Reserve your table at Maison Laurent…"
          />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Embed code"
        description="Add the booking widget to your own website."
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Public page:{" "}
              <a
                href={`/r/${slug}`}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                /r/{slug}
              </a>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copyEmbed}
              className="gap-1.5"
            >
              {copied ? (
                <>
                  <CheckIcon className="size-4" /> Copied
                </>
              ) : (
                <>
                  <CopyIcon className="size-4" /> Copy embed
                </>
              )}
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
            <code>{embed}</code>
          </pre>
        </div>
      </SettingsCard>
    </SettingsForm>
  )
}
