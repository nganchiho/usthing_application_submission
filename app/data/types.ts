// Shapes of the JSON files produced by scripts/preprocess.py.

export type CourseCode = string // "COMP 4211"
export type TermCode = string // "2610" = 2026-27 Fall

export interface Term {
  code: TermCode
  name: string
  /** When section enrolment numbers were last scraped (ISO timestamp). */
  sectionsUpdatedAt: string | null
}

/**
 * A prerequisite requirement, parsed from the catalogue's free-text string.
 *   all    -> every child is required (AND)
 *   any    -> one child is enough (OR)
 *   course -> a course code, possibly with a note such as "Grade B- or above in"
 *   text   -> a condition that is not a course, e.g. "Level 5 in HKDSE Mathematics M2"
 */
export type PrerequisiteNode =
  | { kind: "all" | "any"; children: PrerequisiteNode[]; note?: string }
  | { kind: "course"; code: CourseCode; note?: string }
  | { kind: "text"; text: string }

export interface Course {
  code: CourseCode
  /** Subject prefix, e.g. "COMP" (see scripts/preprocess.py for why not department_code). */
  department: string
  title: string
  credits: string
  career: "UG" | "PG"
  /** Terms the course appears in, newest first. */
  terms: TermCode[]
  prerequisiteText: string
  prerequisite: PrerequisiteNode | null
  /** Courses whose prerequisites mention this course. */
  unlocks: CourseCode[]
}

/** Long text fields, kept in a separate file that is only loaded for the detail screen. */
export interface CourseDetails {
  description: string
  corequisite: string
  exclusion: string
  attributes: string[]
}

export interface Meeting {
  weekday: string
  start: string | null
  end: string | null
  venue: string
  instructors: string[]
}

export interface Section {
  section: string // "L1", "T1A", "LA2"
  type: string // "LEC", "TUT", "LAB"
  capacity: number
  enrolled: number
  waitlist: number
  consentRequired: boolean
  remarks: string
  meetings: Meeting[]
}
