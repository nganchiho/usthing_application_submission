// Strings used by the Ignite boilerplate components (error screen, empty state).
// App screens use plain English strings; see README "Assumptions".
const en = {
  common: {
    ok: "OK!",
    cancel: "Cancel",
    back: "Back",
  },
  errorScreen: {
    title: "Something went wrong",
    friendlySubtitle: "The app hit an unexpected error. Resetting usually fixes it.",
    reset: "RESET APP",
    traceTitle: "Error from %{name} stack",
  },
  emptyStateComponent: {
    generic: {
      heading: "Nothing here",
      content: "No data found.",
      button: "Try again",
    },
  },
}

export default en
export type Translations = typeof en
