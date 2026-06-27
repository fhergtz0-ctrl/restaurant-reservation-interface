export type Slot = {
  time: string
  available: boolean
}

export type Restaurant = {
  name: string
  category: string
  logo: string
  neighborhood: string
  priceRange: string
}

export const restaurant: Restaurant = {
  name: "Maison Laurent",
  category: "Contemporary French · Fine Dining",
  logo: "/maison-logo.png",
  neighborhood: "SoHo, New York",
  priceRange: "$$$$",
}

export const guestOptions = Array.from({ length: 8 }, (_, i) => i + 1)

export type DateOption = {
  value: string
  label: string
}

function formatDate(date: Date): DateOption {
  const value = date.toISOString().split("T")[0]
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const compare = new Date(date)
  compare.setHours(0, 0, 0, 0)
  const diff = Math.round((compare.getTime() - today.getTime()) / 86400000)

  let prefix = ""
  if (diff === 0) prefix = "Today · "
  else if (diff === 1) prefix = "Tomorrow · "

  const label =
    prefix +
    date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })

  return { value, label }
}

export const dateOptions: DateOption[] = Array.from({ length: 14 }, (_, i) => {
  const d = new Date()
  d.setDate(d.getDate() + i)
  return formatDate(d)
})

export const timePreferences = [
  { value: "lunch", label: "Lunch (12–3 PM)" },
  { value: "afternoon", label: "Afternoon (3–5 PM)" },
  { value: "dinner", label: "Dinner (5–9 PM)" },
  { value: "late", label: "Late (9–11 PM)" },
]

const slotTemplate: Record<string, string[]> = {
  lunch: ["12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM"],
  afternoon: ["3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM"],
  dinner: [
    "5:00 PM",
    "5:30 PM",
    "6:00 PM",
    "6:30 PM",
    "7:00 PM",
    "7:30 PM",
    "8:00 PM",
    "8:30 PM",
    "9:00 PM",
  ],
  late: ["9:30 PM", "10:00 PM", "10:30 PM", "11:00 PM"],
}

// Deterministic pseudo-availability so slots stay stable per date/guests/time.
function seededAvailability(seed: string, index: number): boolean {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  return Math.abs((hash >> index) % 10) > 3
}

export function getSlots(
  date: string,
  guests: number,
  preference: string,
): Slot[] {
  const times = slotTemplate[preference] ?? slotTemplate.dinner
  const seed = `${date}-${guests}-${preference}`
  return times.map((time, index) => ({
    time,
    available: seededAvailability(seed, index),
  }))
}
