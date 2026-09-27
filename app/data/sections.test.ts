import { getAvailability } from "./sections"
import type { Section } from "./types"

const section = (capacity: number, enrolled: number, waitlist = 0): Section => ({
  section: "L1",
  type: "LEC",
  capacity,
  enrolled,
  waitlist,
  consentRequired: false,
  remarks: "",
  meetings: [],
})

describe("getAvailability", () => {
  it("is open when plenty of seats remain", () => {
    expect(getAvailability(section(100, 40))).toEqual({ tone: "open", label: "60 seats left" })
  })

  it("is limited when 5 or fewer seats, or under 10% of a large quota, remain", () => {
    expect(getAvailability(section(30, 29)).label).toBe("1 seat left")
    expect(getAvailability(section(30, 25)).tone).toBe("limited")
    expect(getAvailability(section(300, 280)).tone).toBe("limited")
  })

  it("is full at or over capacity and reports the waitlist", () => {
    expect(getAvailability(section(50, 50))).toEqual({ tone: "full", label: "Full" })
    expect(getAvailability(section(50, 52, 7))).toEqual({ tone: "full", label: "Full · 7 waiting" })
  })

  it("treats a zero-quota section as full", () => {
    expect(getAvailability(section(0, 0)).tone).toBe("full")
  })
})
