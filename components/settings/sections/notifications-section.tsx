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
  SwitchField,
} from "@/components/settings/fields"
import { useSettingsForm } from "@/components/settings/use-settings-form"

export function NotificationsSection() {
  const form = useSettingsForm("notifications")

  if (form.status === "loading") return <SettingsLoading />

  return (
    <SettingsForm
      form={form}
      title="Notifications"
      description="Configure the automated messages sent to guests and your team."
    >
      <SettingsCard
        title="Guest messaging"
        description="Emails and texts sent to guests about their reservations."
      >
        <div className="flex flex-col gap-3">
          <SwitchField
            label="Confirmation email"
            description="Send an email when a reservation is confirmed."
            checked={form.values.confirmationEmail}
            onChange={(v) => form.setField("confirmationEmail", v)}
          />
          <SwitchField
            label="Reminder email"
            description="Remind guests before their reservation."
            checked={form.values.reminderEmail}
            onChange={(v) => form.setField("reminderEmail", v)}
          />
          <SwitchField
            label="Cancellation email"
            description="Notify guests when a reservation is cancelled."
            checked={form.values.cancellationEmail}
            onChange={(v) => form.setField("cancellationEmail", v)}
          />
          <SwitchField
            label="Guest SMS"
            description="Send text-message confirmations and reminders."
            checked={form.values.guestSms}
            onChange={(v) => form.setField("guestSms", v)}
          />
        </div>
        {form.values.reminderEmail ? (
          <div className="mt-5">
            <NumberField
              label="Reminder timing"
              value={form.values.reminderHoursBefore}
              onChange={(v) => form.setField("reminderHoursBefore", v)}
              error={form.errors.reminderHoursBefore}
              min={1}
              max={168}
              suffix="hours before"
              className="sm:max-w-xs"
            />
          </div>
        ) : null}
      </SettingsCard>

      <SettingsCard
        title="Staff alerts"
        description="Internal notifications for your team."
      >
        <div className="flex flex-col gap-3">
          <SwitchField
            label="New booking alert"
            description="Notify staff whenever a new reservation comes in."
            checked={form.values.staffNewBooking}
            onChange={(v) => form.setField("staffNewBooking", v)}
          />
          <SwitchField
            label="Cancellation alert"
            description="Notify staff when a guest cancels."
            checked={form.values.staffCancellation}
            onChange={(v) => form.setField("staffCancellation", v)}
          />
          <SwitchField
            label="Daily summary"
            description="Send a daily digest of upcoming reservations."
            checked={form.values.dailySummary}
            onChange={(v) => form.setField("dailySummary", v)}
          />
        </div>
      </SettingsCard>

      <SettingsCard
        title="Sender details"
        description="How messages appear to guests."
      >
        <FieldGrid>
          <TextField
            label="From name"
            value={form.values.fromName}
            onChange={(v) => form.setField("fromName", v)}
            error={form.errors.fromName}
            placeholder="Maison Laurent"
          />
          <TextField
            label="Notifications email"
            type="email"
            value={form.values.notifyEmail}
            onChange={(v) => form.setField("notifyEmail", v)}
            error={form.errors.notifyEmail}
            hint="Where staff alerts are delivered"
            placeholder="team@restaurant.com"
          />
        </FieldGrid>
        <div className="mt-5">
          <TextareaField
            label="Confirmation message"
            value={form.values.confirmationMessage}
            onChange={(v) => form.setField("confirmationMessage", v)}
            error={form.errors.confirmationMessage}
            rows={3}
            hint="Custom note added to confirmation emails."
            placeholder="We look forward to welcoming you…"
          />
        </div>
      </SettingsCard>
    </SettingsForm>
  )
}
