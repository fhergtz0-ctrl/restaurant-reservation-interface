"use client"

import { CalendarIcon, ClockIcon, UsersIcon } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  dateOptions,
  guestOptions,
  timePreferences,
} from "@/lib/reservation-data"

type ReservationSelectorsProps = {
  guests: number
  date: string
  preference: string
  onGuestsChange: (value: number) => void
  onDateChange: (value: string) => void
  onPreferenceChange: (value: string) => void
}

function FieldLabel({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <Icon className="size-3.5" />
      {children}
    </span>
  )
}

export function ReservationSelectors({
  guests,
  date,
  preference,
  onGuestsChange,
  onDateChange,
  onPreferenceChange,
}: ReservationSelectorsProps) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <div className="flex flex-col gap-1.5">
        <FieldLabel icon={UsersIcon}>Guests</FieldLabel>
        <Select
          value={String(guests)}
          onValueChange={(value) => onGuestsChange(Number(value))}
        >
          <SelectTrigger className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {guestOptions.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n === 1 ? "1 guest" : `${n} guests`}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel icon={CalendarIcon}>Date</FieldLabel>
        <Select
          value={date}
          onValueChange={(value) => onDateChange(value ?? date)}
        >
          <SelectTrigger className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {dateOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <FieldLabel icon={ClockIcon}>Time</FieldLabel>
        <Select
          value={preference}
          onValueChange={(value) => onPreferenceChange(value ?? preference)}
        >
          <SelectTrigger className="h-10 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {timePreferences.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
