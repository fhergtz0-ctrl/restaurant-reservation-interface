"use client"

import {
  SettingsForm,
  SettingsCard,
  SettingsLoading,
} from "@/components/settings/settings-section"
import {
  FieldGrid,
  NumberField,
  SwitchField,
  TextareaField,
} from "@/components/settings/fields"
import { useSettingsForm } from "@/components/settings/use-settings-form"

export function ReservationsSection() {
  const form = useSettingsForm("reservations")

  if (form.status === "loading") return <SettingsLoading />

  return (
    <SettingsForm
      form={form}
      title="Reservation Rules"
      description="Control how guests can book: time slots, party sizes, lead times, and policies."
    >
      <SettingsCard
        title="Slots & duration"
        description="How reservation times are generated and how long tables are held."
      >
        <FieldGrid>
          <NumberField
            label="Slot interval"
            value={form.values.slotIntervalMinutes}
            onChange={(v) => form.setField("slotIntervalMinutes", v)}
            error={form.errors.slotIntervalMinutes}
            min={15}
            max={240}
            step={15}
            suffix="min"
            hint="Time between bookable slots"
          />
          <NumberField
            label="Default duration"
            value={form.values.defaultDurationMinutes}
            onChange={(v) => form.setField("defaultDurationMinutes", v)}
            error={form.errors.defaultDurationMinutes}
            min={30}
            max={360}
            step={15}
            suffix="min"
            hint="How long a table is reserved"
          />
          <NumberField
            label="Table hold"
            value={form.values.holdMinutes}
            onChange={(v) => form.setField("holdMinutes", v)}
            error={form.errors.holdMinutes}
            min={0}
            max={240}
            suffix="min"
            hint="Grace period before a no-show"
          />
        </FieldGrid>
      </SettingsCard>

      <SettingsCard
        title="Party size"
        description="Guest count limits for a single reservation."
      >
        <FieldGrid>
          <NumberField
            label="Minimum party size"
            value={form.values.minPartySize}
            onChange={(v) => form.setField("minPartySize", v)}
            error={form.errors.minPartySize}
            min={1}
            max={100}
            suffix="guests"
          />
          <NumberField
            label="Maximum party size"
            value={form.values.maxPartySize}
            onChange={(v) => form.setField("maxPartySize", v)}
            error={form.errors.maxPartySize}
            min={1}
            max={100}
            suffix="guests"
            hint="Larger parties may require a call"
          />
        </FieldGrid>
      </SettingsCard>

      <SettingsCard
        title="Booking window"
        description="How far ahead and how close to service guests can book."
      >
        <FieldGrid>
          <NumberField
            label="Maximum advance"
            value={form.values.maxAdvanceDays}
            onChange={(v) => form.setField("maxAdvanceDays", v)}
            error={form.errors.maxAdvanceDays}
            min={1}
            max={730}
            suffix="days"
          />
          <NumberField
            label="Minimum notice"
            value={form.values.minNoticeMinutes}
            onChange={(v) => form.setField("minNoticeMinutes", v)}
            error={form.errors.minNoticeMinutes}
            min={0}
            max={20160}
            suffix="min"
            hint="Lead time required before a reservation"
          />
        </FieldGrid>
      </SettingsCard>

      <SettingsCard
        title="Policies"
        description="Automation and guest requirements."
      >
        <div className="flex flex-col gap-3">
          <SwitchField
            label="Auto-confirm reservations"
            description="Approve bookings automatically without staff review."
            checked={form.values.autoConfirm}
            onChange={(v) => form.setField("autoConfirm", v)}
          />
          <SwitchField
            label="Require email"
            description="Guests must provide an email to book."
            checked={form.values.requireEmail}
            onChange={(v) => form.setField("requireEmail", v)}
          />
          <SwitchField
            label="Require phone"
            description="Guests must provide a phone number to book."
            checked={form.values.requirePhone}
            onChange={(v) => form.setField("requirePhone", v)}
          />
          <SwitchField
            label="Enable waitlist"
            description="Let guests join a waitlist when fully booked."
            checked={form.values.allowWaitlist}
            onChange={(v) => form.setField("allowWaitlist", v)}
          />
        </div>
        <div className="mt-5">
          <TextareaField
            label="Cancellation policy"
            value={form.values.cancellationPolicy}
            onChange={(v) => form.setField("cancellationPolicy", v)}
            error={form.errors.cancellationPolicy}
            rows={3}
            hint="Shown to guests during booking and on confirmations."
            placeholder="Reservations may be cancelled up to 24 hours in advance…"
          />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Deposits"
        description="Require a deposit to secure a booking."
      >
        <div className="flex flex-col gap-5">
          <SwitchField
            label="Require a deposit"
            description="Charge guests a deposit when booking."
            checked={form.values.depositEnabled}
            onChange={(v) => form.setField("depositEnabled", v)}
          />
          {form.values.depositEnabled ? (
            <NumberField
              label="Deposit amount"
              value={form.values.depositAmountCents / 100}
              onChange={(v) =>
                form.setField(
                  "depositAmountCents",
                  Math.round((Number.isFinite(v) ? v : 0) * 100),
                )
              }
              error={form.errors.depositAmountCents}
              min={0}
              step={1}
              suffix="per guest"
              hint="Amount charged per guest at booking"
            />
          ) : null}
        </div>
      </SettingsCard>
    </SettingsForm>
  )
}
