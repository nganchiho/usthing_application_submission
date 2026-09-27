import type { Course, CourseCode, TermCode } from "./types"

export interface CourseFilters {
  query: string
  /** undefined = every term */
  term?: TermCode
  /** undefined = every department */
  department?: string
  favouritesOnly: boolean
}

interface SearchEntry {
  course: Course
  compactCode: string // "comp4211"
  lowerTitle: string
}

/** Precomputes lowercase keys once so each keystroke only does string comparisons. */
export function buildSearchIndex(courses: Course[]): SearchEntry[] {
  return courses.map((course) => ({
    course,
    compactCode: course.code.replace(" ", "").toLowerCase(),
    lowerTitle: course.title.toLowerCase(),
  }))
}

/**
 * Lower rank = better match; null = no match.
 *   0  code starts with the query   "comp42", "comp 42"  -> COMP 4211
 *   1  code contains the query      "4211"               -> COMP 4211
 *   2  title starts with the words  "machine"            -> "Machine Learning"
 *   3  title contains every word    "learning machine"   -> "Machine Learning"
 */
function rankMatch(entry: SearchEntry, compactQuery: string, words: string[]): number | null {
  if (entry.compactCode.startsWith(compactQuery)) return 0
  if (entry.compactCode.includes(compactQuery)) return 1
  if (!words.every((word) => entry.lowerTitle.includes(word))) return null
  return entry.lowerTitle.startsWith(words[0]) ? 2 : 3
}

/**
 * Filters then ranks. A linear scan over ~4,000 entries takes a few milliseconds,
 * so no inverted index is needed; the input is sorted by code, and Array.sort is
 * stable, so equally ranked results stay in code order.
 */
export function filterCourses(
  index: SearchEntry[],
  filters: CourseFilters,
  favourites: ReadonlySet<CourseCode>,
): Course[] {
  const query = filters.query.trim().toLowerCase()
  const compactQuery = query.replace(/\s+/g, "")
  const words = query.split(/\s+/).filter(Boolean)

  const matches: { course: Course; rank: number }[] = []
  for (const entry of index) {
    const { course } = entry
    if (filters.term && !course.terms.includes(filters.term)) continue
    if (filters.department && course.department !== filters.department) continue
    if (filters.favouritesOnly && !favourites.has(course.code)) continue

    const rank = query ? rankMatch(entry, compactQuery, words) : 0
    if (rank !== null) matches.push({ course, rank })
  }

  if (query) matches.sort((a, b) => a.rank - b.rank)
  return matches.map((match) => match.course)
}
