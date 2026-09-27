import { fireEvent, render } from "@testing-library/react-native"

import { getCourse } from "@/data/catalog"

import { PrerequisiteTree } from "./PrerequisiteTree"
import { ThemeProvider } from "../theme/context"

// These tests use the real bundled dataset, so they also guard the preprocessing output.
function renderTree(code: string) {
  const course = getCourse(code)
  if (!course?.prerequisite) throw new Error(`${code} should have prerequisites`)
  const onOpenCourse = jest.fn()
  const screen = render(
    <ThemeProvider>
      <PrerequisiteTree node={course.prerequisite} path={[code]} onOpenCourse={onOpenCourse} />
    </ThemeProvider>,
  )
  return { ...screen, onOpenCourse }
}

describe("PrerequisiteTree", () => {
  it("shows direct prerequisites and reveals deeper ones on expand", () => {
    const { getByText, queryByText, getByLabelText } = renderTree("COMP 4211")
    expect(getByText("COMP 2211")).toBeTruthy()
    expect(getByText("One of")).toBeTruthy()

    // COMP 2211 requires COMP 1023 or COMP 1028; hidden until COMP 2211 is expanded.
    expect(queryByText("COMP 1023")).toBeNull()
    fireEvent.press(getByLabelText("Prerequisites of COMP 2211"))
    expect(getByText("COMP 1023")).toBeTruthy()
  })

  it("navigates when a course code is tapped", () => {
    const { getByText, onOpenCourse } = renderTree("COMP 4211")
    fireEvent.press(getByText("COMP 2211"))
    expect(onOpenCourse).toHaveBeenCalledWith("COMP 2211")
  })

  it("stops at a cycle instead of recursing forever", () => {
    // In the dataset UCMP 6030 and UCMP 6040 each list the other as a prerequisite.
    const { getByText, getByLabelText } = renderTree("UCMP 6030")
    fireEvent.press(getByLabelText("Prerequisites of UCMP 6040"))
    expect(getByText("↻ UCMP 6030")).toBeTruthy()
    expect(getByLabelText("UCMP 6030 has nothing to expand")).toBeTruthy()
  })
})
