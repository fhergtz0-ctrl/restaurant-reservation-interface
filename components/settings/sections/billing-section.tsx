"use client"

import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  SettingsForm,
  SettingsCard,
  SettingsLoading,
} from "@/components/settings/settings-section"
import {
  FieldGrid,
  SelectField,
  TextField,
  TextareaField,
} from "@/components/settings/fields"
import { useSettingsForm } from "@/components/settings/use-settings-form"

type PlanKey = "starter" | "growth" | "enterprise"

const PLANS: {
  key: PlanKey
  name: string
  monthly: number
  annual: number
  tagline: string
  features: string[]
}[] = [
  {
    key: "starter",
    name: "Starter",
    monthly: 49,
    annual: 39,
    tagline: "For new restaurants getting online.",
    features: ["Up to 300 covers/mo", "1 location", "Email confirmations"],
  },
  {
    key: "growth",
    name: "Growth",
    monthly: 129,
    annual: 109,
    tagline: "For busy venues that need automation.",
    features: [
      "Unlimited covers",
      "Floor plan & combinations",
      "SMS reminders",
      "Experiences & deposits",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    monthly: 349,
    annual: 299,
    tagline: "For groups and multi-location brands.",
    features: [
      "Multi-location",
      "Roles & permissions",
      "Priority support",
      "Custom integrations",
    ],
  },
]

export function BillingSection() {
  const form = useSettingsForm("billing")

  if (form.status === "loading") return <SettingsLoading />

  const cycle = form.values.billingCycle

  return (
    <SettingsForm
      form={form}
      title="Billing & Subscription"
      description="Manage your plan, billing cycle, and invoicing details."
    >
      <SettingsCard
        title="Plan"
        description="Choose the plan that matches your venue's needs."
      >
        <div className="mb-5 inline-flex rounded-lg border border-border bg-muted/40 p-1">
          {(["monthly", "annual"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => form.setField("billingCycle", c)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors",
                cycle === c
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c}
              {c === "annual" ? (
                <span className="ml-1.5 text-xs text-primary">Save 15%</span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const selected = form.values.plan === plan.key
            const price = cycle === "annual" ? plan.annual : plan.monthly
            return (
              <button
                key={plan.key}
                type="button"
                onClick={() => form.setField("plan", plan.key)}
                aria-pressed={selected}
                className={cn(
                  "flex flex-col gap-3 rounded-xl border p-5 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-card hover:border-primary/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading text-base font-semibold">
                    {plan.name}
                  </span>
                  {selected ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <CheckIcon className="size-3.5" />
                    </span>
                  ) : null}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold">${price}</span>
                  <span className="text-sm text-muted-foreground">
                    /mo{cycle === "annual" ? ", billed yearly" : ""}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                <ul className="mt-1 flex flex-col gap-1.5">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-center gap-2 text-sm text-foreground"
                    >
                      <CheckIcon className="size-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            )
          })}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Billing details"
        description="Where invoices are sent and the legal entity on record."
      >
        <div className="flex flex-col gap-5">
          <FieldGrid>
            <TextField
              label="Billing email"
              type="email"
              value={form.values.billingEmail}
              onChange={(v) => form.setField("billingEmail", v)}
              error={form.errors.billingEmail}
              placeholder="billing@restaurant.com"
            />
            <TextField
              label="Company name"
              value={form.values.companyName}
              onChange={(v) => form.setField("companyName", v)}
              error={form.errors.companyName}
              placeholder="Maison Laurent LLC"
            />
            <TextField
              label="Tax ID / VAT"
              value={form.values.taxId}
              onChange={(v) => form.setField("taxId", v)}
              error={form.errors.taxId}
              placeholder="Optional"
            />
            <SelectField
              label="Billing cycle"
              value={form.values.billingCycle}
              onChange={(v) =>
                form.setField("billingCycle", v as "monthly" | "annual")
              }
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "annual", label: "Annual" },
              ]}
            />
          </FieldGrid>
          <TextareaField
            label="Billing address"
            value={form.values.billingAddress}
            onChange={(v) => form.setField("billingAddress", v)}
            error={form.errors.billingAddress}
            rows={2}
            placeholder="Street, city, postal code, country"
          />
        </div>
      </SettingsCard>
    </SettingsForm>
  )
}
