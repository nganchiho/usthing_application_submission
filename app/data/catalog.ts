/**
 * Read-only access to the bundled dataset. Everything is built once, at first import.
 *
 * JSON is loaded with require() + a cast rather than `import`, because TypeScript would
 * otherwise infer a type from each multi-megabyte file and slow type-checking down.
 */
import type { Course, CourseCode, CourseDetails, Section, Term, TermCode } from "./types"

export const courses: Course[] = require("./generated/courses.json")
export const terms: Term[] = require("./generated/terms.json")

const courseByCode = new Map(courses.map((course) => [course.code, course]))

export function getCourse(code: CourseCode): Course | undefined {
  return courseByCode.get(code)
}

export interface Department {
  code: string
  courseCount: number
}

export const departments: Department[] = (() => {
  const counts = new Map<string, number>()
  for (const course of courses) {
    counts.set(course.department, (counts.get(course.department) ?? 0) + 1)
  }
  return [...counts]
    .map(([code, courseCount]) => ({ code, courseCount }))
    .sort((a, b) => a.code.localeCompare(b.code))
})()

export function getTerm(code: TermCode): Term | undefined {
  return terms.find((term) => term.code === code)
}

// Descriptions (~2 MB) and sections (~1.7 MB) are only needed on the detail screen,
// so they are not parsed at startup. They load on first use, or earlier via
// preloadDetailData() once the list screen is idle.
let detailsByCode: Record<CourseCode, CourseDetails> | undefined
let sectionsByTerm: Record<TermCode, Record<CourseCode, Section[]>> | undefined

function loadDetails() {
  detailsByCode ??= require("./generated/course-details.json") as Record<CourseCode, CourseDetails>
  return detailsByCode
}

function loadSections() {
  sectionsByTerm ??= require("./generated/sections.json") as Record<
    TermCode,
    Record<CourseCode, Section[]>
  >
  return sectionsByTerm
}

export function preloadDetailData() {
  loadDetails()
  loadSections()
}

export function getCourseDetails(code: CourseCode): CourseDetails | undefined {
  return loadDetails()[code]
}

export function getSections(term: TermCode, code: CourseCode): Section[] {
  return loadSections()[term]?.[code] ?? []
}
