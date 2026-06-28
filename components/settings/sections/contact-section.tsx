"use client"

import {
  SettingsForm,
  SettingsCard,
  SettingsLoading,
} from "@/components/settings/settings-section"
import { FieldGrid, TextField } from "@/components/settings/fields"
import { useSettingsForm } from "@/components/settings/use-settings-form"

export function ContactSection() {
  const form = useSettingsForm("contact")

  if (form.status === "loading") return <SettingsLoading />

  return (
    <SettingsForm
      form={form}
      title="Contact"
      description="Where guests and partners can reach you. These details appear on confirmations and your booking page."
    >
      <SettingsCard
        title="Primary contact"
        description="Used on guest confirmations and reminders."
      >
        <FieldGrid>
          <TextField
            label="Public email"
            type="email"
            value={form.values.email}
            onChange={(v) => form.setField("email", v)}
            error={form.errors.email}
            placeholder="hello@restaurant.com"
          />
          <TextField
            label="Phone"
            value={form.values.phone}
            onChange={(v) => form.setField("phone", v)}
            error={form.errors.phone}
            placeholder="+1 (212) 555-0142"
          />
          <TextField
            label="WhatsApp"
            value={form.values.whatsapp}
            onChange={(v) => form.setField("whatsapp", v)}
            error={form.errors.whatsapp}
            placeholder="+1 (212) 555-0142"
          />
          <TextField
            label="Website"
            value={form.values.website}
            onChange={(v) => form.setField("website", v)}
            error={form.errors.website}
            placeholder="https://restaurant.com"
          />
        </FieldGrid>
      </SettingsCard>

      <SettingsCard
        title="Address"
        description="Your physical location for guests and maps."
      >
        <div className="flex flex-col gap-5">
          <TextField
            label="Street address"
            value={form.values.addressLine}
            onChange={(v) => form.setField("addressLine", v)}
            error={form.errors.addressLine}
            placeholder="12 Prince Street"
          />
          <FieldGrid>
            <TextField
              label="City"
              value={form.values.city}
              onChange={(v) => form.setField("city", v)}
              error={form.errors.city}
            />
            <TextField
              label="State / Province"
              value={form.values.state}
              onChange={(v) => form.setField("state", v)}
              error={form.errors.state}
            />
            <TextField
              label="Postal code"
              value={form.values.postalCode}
              onChange={(v) => form.setField("postalCode", v)}
              error={form.errors.postalCode}
            />
            <TextField
              label="Country"
              value={form.values.country}
              onChange={(v) => form.setField("country", v)}
              error={form.errors.country}
            />
          </FieldGrid>
        </div>
      </SettingsCard>

      <SettingsCard
        title="Social"
        description="Link your social profiles for guests to follow."
      >
        <FieldGrid>
          <TextField
            label="Instagram"
            value={form.values.instagram}
            onChange={(v) => form.setField("instagram", v)}
            error={form.errors.instagram}
            placeholder="@restaurant"
          />
          <TextField
            label="Facebook"
            value={form.values.facebook}
            onChange={(v) => form.setField("facebook", v)}
            error={form.errors.facebook}
            placeholder="facebook.com/restaurant"
          />
          <TextField
            label="X (Twitter)"
            value={form.values.x}
            onChange={(v) => form.setField("x", v)}
            error={form.errors.x}
            placeholder="@restaurant"
          />
        </FieldGrid>
      </SettingsCard>
    </SettingsForm>
  )
}
