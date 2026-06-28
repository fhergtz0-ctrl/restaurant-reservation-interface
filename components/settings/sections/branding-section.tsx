"use client"

import {
  SettingsForm,
  SettingsCard,
  SettingsLoading,
} from "@/components/settings/settings-section"
import {
  FieldGrid,
  TextField,
  SelectField,
  ColorField,
} from "@/components/settings/fields"
import { useSettingsForm } from "@/components/settings/use-settings-form"

const FONT_OPTIONS = [
  { value: "serif" as const, label: "Serif · Elegant" },
  { value: "sans" as const, label: "Sans · Modern" },
  { value: "mono" as const, label: "Mono · Technical" },
]

const FONT_CLASS: Record<string, string> = {
  serif: "font-serif",
  sans: "font-sans",
  mono: "font-mono",
}

export function BrandingSection() {
  const form = useSettingsForm("branding")

  if (form.status === "loading") return <SettingsLoading />

  const { primaryColor, accentColor, tagline, logoUrl, coverUrl, font } =
    form.values

  return (
    <SettingsForm
      form={form}
      title="Branding"
      description="Customize how your restaurant looks on its public booking page and confirmation emails."
    >
      <SettingsCard
        title="Brand colors"
        description="Used for buttons, highlights, and accents on your booking page."
      >
        <FieldGrid>
          <ColorField
            label="Primary color"
            value={primaryColor}
            onChange={(v) => form.setField("primaryColor", v)}
            error={form.errors.primaryColor}
          />
          <ColorField
            label="Accent color"
            value={accentColor}
            onChange={(v) => form.setField("accentColor", v)}
            error={form.errors.accentColor}
          />
        </FieldGrid>
      </SettingsCard>

      <SettingsCard
        title="Assets & type"
        description="Logo, cover image, and typography."
      >
        <FieldGrid>
          <TextField
            label="Logo URL"
            value={logoUrl}
            onChange={(v) => form.setField("logoUrl", v)}
            error={form.errors.logoUrl}
            placeholder="https://…/logo.png"
          />
          <TextField
            label="Cover image URL"
            value={coverUrl}
            onChange={(v) => form.setField("coverUrl", v)}
            error={form.errors.coverUrl}
            placeholder="https://…/cover.jpg"
          />
          <SelectField
            label="Typography"
            value={font}
            onChange={(v) => form.setField("font", v)}
            options={FONT_OPTIONS}
            error={form.errors.font}
          />
          <TextField
            label="Tagline"
            value={tagline}
            onChange={(v) => form.setField("tagline", v)}
            error={form.errors.tagline}
            placeholder="Seasonal French cuisine"
          />
        </FieldGrid>
      </SettingsCard>

      <SettingsCard
        title="Preview"
        description="A live preview of your brand styling."
      >
        <div className="overflow-hidden rounded-xl border border-border">
          <div
            className="flex h-28 items-end p-4"
            style={{
              background: coverUrl
                ? `center / cover no-repeat url(${coverUrl})`
                : `linear-gradient(135deg, ${primaryColor}, ${accentColor})`,
            }}
          >
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logoUrl ? (
                <img
                  src={logoUrl || "/placeholder.svg"}
                  alt="Logo preview"
                  className="size-12 rounded-lg border border-white/20 bg-background object-cover"
                  crossOrigin="anonymous"
                />
              ) : (
                <div
                  className="flex size-12 items-center justify-center rounded-lg text-lg font-semibold text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  K
                </div>
              )}
            </div>
          </div>
          <div className="bg-card p-5">
            <p
              className={`text-lg font-semibold ${FONT_CLASS[font] ?? "font-serif"}`}
            >
              {form.values.tagline || "Your tagline appears here"}
            </p>
            <button
              type="button"
              className="mt-3 rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: primaryColor }}
            >
              Reserve a table
            </button>
          </div>
        </div>
      </SettingsCard>
    </SettingsForm>
  )
}
