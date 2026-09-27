import type { Section } from "./types"

export type AvailabilityTone = "open" | "limited" | "full"

export interface Availability {
  tone: AvailabilityTone
  label: string
}

/** "Few seats" = 5 or fewer, or under 10% of the quota for large sections. */
export function getAvailability({ capacity, enrolled, waitlist }: Section): Availability {
  const seatsLeft = capacity - enrolled
  if (seatsLeft <= 0) {
    return { tone: "full", label: waitlist > 0 ? `Full · ${waitlist} waiting` : "Full" }
  }
  const label = seatsLeft === 1 ? "1 seat left" : `${seatsLeft} seats left`
  return { tone: seatsLeft <= Math.max(5, capacity * 0.1) ? "limited" : "open", label }
}

/** Distinct instructors across all meetings of a section. */
export function getInstructors(section: Section): string[] {
  return [...new Set(section.meetings.flatMap((meeting) => meeting.instructors))]
}
