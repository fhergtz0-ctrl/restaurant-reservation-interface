"use client"

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
  SelectField,
} from "@/components/settings/fields"
import { useSettingsForm } from "@/components/settings/use-settings-form"

const PRICE_OPTIONS = [
  { value: "$" as const, label: "$ · Budget" },
  { value: "$$" as const, label: "$$ · Moderate" },
  { value: "$$$" as const, label: "$$$ · Upscale" },
  { value: "$$$$" as const, label: "$$$$ · Fine dining" },
]

const LANGUAGE_OPTIONS = [
  { value: "en" as const, label: "English" },
  { value: "es" as const, label: "Español" },
  { value: "fr" as const, label: "Français" },
]

const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD · US Dollar" },
  { value: "EUR", label: "EUR · Euro" },
  { value: "GBP", label: "GBP · British Pound" },
  { value: "MXN", label: "MXN · Mexican Peso" },
  { value: "CAD", label: "CAD · Canadian Dollar" },
]

const TIMEZONE_OPTIONS = [
  { value: "America/New_York", label: "Eastern (New York)" },
  { value: "America/Chicago", label: "Central (Chicago)" },
  { value: "America/Denver", label: "Mountain (Denver)" },
  { value: "America/Los_Angeles", label: "Pacific (Los Angeles)" },
  { value: "America/Mexico_City", label: "Central (Mexico City)" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
]

export function ProfileSection() {
  const form = useSettingsForm("profile")

  if (form.status === "loading") return <SettingsLoading />

  return (
    <SettingsForm
      form={form}
      title="Restaurant Profile"
      description="Core details about your restaurant used across the workspace and your public booking page."
    >
      <SettingsCard
        title="Identity"
        description="How your restaurant is named and categorized."
      >
        <FieldGrid>
          <TextField
            label="Restaurant name"
            required
            value={form.values.name}
            onChange={(v) => form.setField("name", v)}
            error={form.errors.name}
            placeholder="Maison Laurent"
          />
          <TextField
            label="Legal / business name"
            value={form.values.legalName}
            onChange={(v) => form.setField("legalName", v)}
            error={form.errors.legalName}
            hint="Shown on invoices and receipts"
          />
          <TextField
            label="Category"
            value={form.values.category}
            onChange={(v) => form.setField("category", v)}
            error={form.errors.category}
            placeholder="French · Fine dining"
          />
          <TextField
            label="Neighborhood"
            value={form.values.neighborhood}
            onChange={(v) => form.setField("neighborhood", v)}
            error={form.errors.neighborhood}
            placeholder="SoHo"
          />
        </FieldGrid>
        <div className="mt-5">
          <TextareaField
            label="Description"
            value={form.values.description}
            onChange={(v) => form.setField("description", v)}
            error={form.errors.description}
            rows={4}
            hint="A short summary guests see when booking."
            placeholder="An intimate French bistro serving seasonal tasting menus…"
          />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Service & locale"
        description="Pricing tier, capacity, and regional formatting."
      >
        <FieldGrid>
          <SelectField
            label="Price range"
            value={form.values.priceRange}
            onChange={(v) => form.setField("priceRange", v)}
            options={PRICE_OPTIONS}
            error={form.errors.priceRange}
          />
          <NumberField
            label="Total capacity"
            value={form.values.capacity}
            onChange={(v) => form.setField("capacity", v)}
            error={form.errors.capacity}
            min={0}
            suffix="seats"
            hint="Maximum guests across all areas"
          />
          <SelectField
            label="Currency"
            value={form.values.currency}
            onChange={(v) => form.setField("currency", v)}
            options={CURRENCY_OPTIONS}
            error={form.errors.currency}
          />
          <SelectField
            label="Timezone"
            value={form.values.timezone}
            onChange={(v) => form.setField("timezone", v)}
            options={TIMEZONE_OPTIONS}
            error={form.errors.timezone}
          />
          <SelectField
            label="Default language"
            value={form.values.language}
            onChange={(v) => form.setField("language", v)}
            options={LANGUAGE_OPTIONS}
            error={form.errors.language}
          />
        </FieldGrid>
      </SettingsCard>
    </SettingsForm>
  )
}
