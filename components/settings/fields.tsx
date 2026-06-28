"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

let uid = 0
function useFieldId(provided?: string) {
  const [generated] = React.useState(() => `fld-${++uid}`)
  return provided ?? generated
}

/** Responsive two-column grid for form fields. */
export function FieldGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("grid gap-5 sm:grid-cols-2", className)}>{children}</div>
  )
}

function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  required,
  type = "text",
  placeholder,
  id: idProp,
  className,
  inputClassName,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
  required?: boolean
  type?: string
  placeholder?: string
  id?: string
  className?: string
  inputClassName?: string
}) {
  const id = useFieldId(idProp)
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value)}
        className={inputClassName}
      />
    </FieldShell>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  hint,
  error,
  required,
  min,
  max,
  step,
  suffix,
  id: idProp,
  className,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  hint?: string
  error?: string
  required?: boolean
  min?: number
  max?: number
  step?: number
  suffix?: string
  id?: string
  className?: string
}) {
  const id = useFieldId(idProp)
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <div className="relative">
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step}
          aria-invalid={Boolean(error)}
          onChange={(e) => onChange(e.target.valueAsNumber)}
          className={suffix ? "pr-12" : undefined}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
    </FieldShell>
  )
}

export function TextareaField({
  label,
  value,
  onChange,
  hint,
  error,
  rows = 3,
  placeholder,
  id: idProp,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
  rows?: number
  placeholder?: string
  id?: string
  className?: string
}) {
  const id = useFieldId(idProp)
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      className={className}
    >
      <Textarea
        id={id}
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value)}
      />
    </FieldShell>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  hint,
  error,
  required,
  id: idProp,
  className,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  hint?: string
  error?: string
  required?: boolean
  id?: string
  className?: string
}) {
  const id = useFieldId(idProp)
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <Select
        value={value}
        onValueChange={(v) => onChange((v ?? value) as T)}
      >
        <SelectTrigger id={id} className="h-9 w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FieldShell>
  )
}

/** A labelled toggle row, ideal for booleans within a card. */
export function SwitchField({
  label,
  description,
  checked,
  onChange,
  className,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  className?: string
}) {
  const id = useFieldId()
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border border-border bg-background/40 px-4 py-3",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className="cursor-pointer text-sm font-medium">
          {label}
        </Label>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={(value: boolean) => onChange(value)}
      />
    </div>
  )
}

export function ColorField({
  label,
  value,
  onChange,
  hint,
  error,
  id: idProp,
  className,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
  id?: string
  className?: string
}) {
  const id = useFieldId(idProp)
  const valid = /^#([0-9a-fA-F]{6})$/.test(value)
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      className={className}
    >
      <div className="flex items-center gap-2">
        <span
          className="size-9 shrink-0 rounded-lg border border-border"
          style={{ backgroundColor: valid ? value : "transparent" }}
          aria-hidden
        />
        <input
          type="color"
          value={valid ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-12 cursor-pointer rounded-lg border border-input bg-transparent p-1"
          aria-label={`${label} color picker`}
        />
        <Input
          id={id}
          value={value}
          aria-invalid={Boolean(error)}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="font-mono uppercase"
        />
      </div>
    </FieldShell>
  )
}
