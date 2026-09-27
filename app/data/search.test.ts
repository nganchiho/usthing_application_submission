import { buildSearchIndex, CourseFilters, filterCourses } from "./search"
import type { Course } from "./types"

function makeCourse(code: string, title: string, terms = ["2610"]): Course {
  return {
    code,
    department: code.slice(0, 4),
    title,
    credits: "3",
    career: "UG",
    terms,
    prerequisiteText: "",
    prerequisite: null,
    unlocks: [],
  }
}

const index = buildSearchIndex([
  makeCourse("COMP 2011", "Programming with C++"),
  makeCourse("COMP 4211", "Machine Learning"),
  makeCourse("MATH 2111", "Matrix Algebra and Applications", ["2530"]),
  makeCourse("ISOM 3360", "Data Mining and Machine Learning for Business"),
])

const noFilters: CourseFilters = { query: "", favouritesOnly: false }
const codes = (filters: Partial<CourseFilters>, favourites = new Set<string>()) =>
  filterCourses(index, { ...noFilters, ...filters }, favourites).map((c) => c.code)

describe("filterCourses", () => {
  it("matches codes with or without the space", () => {
    expect(codes({ query: "comp4211" })).toEqual(["COMP 4211"])
    expect(codes({ query: "COMP 42" })).toEqual(["COMP 4211"])
  })

  it("matches a bare course number", () => {
    expect(codes({ query: "2111" })).toEqual(["MATH 2111"])
  })

  it("ranks titles that start with the query above titles that only contain it", () => {
    expect(codes({ query: "machine" })).toEqual(["COMP 4211", "ISOM 3360"])
  })

  it("requires every word of a multi-word title query", () => {
    expect(codes({ query: "learning business" })).toEqual(["ISOM 3360"])
  })

  it("applies term, department and favourites filters", () => {
    expect(codes({ term: "2530" })).toEqual(["MATH 2111"])
    expect(codes({ department: "COMP" })).toEqual(["COMP 2011", "COMP 4211"])
    expect(codes({ favouritesOnly: true }, new Set(["ISOM 3360"]))).toEqual(["ISOM 3360"])
  })

  it("returns an empty list when nothing matches", () => {
    expect(codes({ query: "quantum basket weaving" })).toEqual([])
  })
})
