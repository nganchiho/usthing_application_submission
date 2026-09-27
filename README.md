# HKUST Course Explorer

A React Native (Expo) app for browsing HKUST courses, their sections, and their prerequisite chains. It works fully offline from a bundled, preprocessed copy of the UST Archive datasets.

- **Catalogue**: 4,030 courses across 129 subjects (COMP, MATH, …) and 4 terms (2025-26 Winter → 2026-27 Fall)
- **Search** by course code (`comp4211`, `COMP 42`, `4211`) or title words (`machine learning`)
- **Filters** by term and department, plus a favourites-only view
- **Course detail** with description, co-requisites/exclusions, Common Core attributes and sections per term (quota, enrolment, waitlist, availability, times, venues, instructors)
- **Prerequisite explorer**: an expandable AND/OR tree that you can follow down the chain, with every course tappable
- **Unlocks**: the reverse direction, listing which courses need this one
- **Favourites** and the last-used filters persist across launches

## Setup

Requirements: Node 20+, Yarn 1 (`npx yarn@1` works), and Android Studio (SDK + an emulator) or Xcode.
The app uses `react-native-mmkv`, a native module, so it runs in a **development build**, not Expo Go.

```bash
yarn install
yarn android        # expo run:android: builds the native app, installs it on the emulator, starts Metro
# later runs, once the dev build is installed:
yarn start
```

Other commands:

```bash
yarn test           # jest: search, availability, prerequisite tree
yarn compile        # TypeScript type-check
yarn lint:check
yarn preprocess     # regenerate app/data/generated/ (needs Python 3 + pandas + pyarrow)
python -m unittest discover -s scripts   # prerequisite parser tests
```

The generated JSON is committed, so you don't need Python to run the app.

**Windows note:** build from a short path outside OneDrive (e.g. `C:\dev\course-explorer`). Deeply nested paths exceed CMake's path-length limit for the native modules, and OneDrive syncing makes Ninja fail with "build.ninja still dirty".

## Platforms tested

- **Android emulator:** Pixel 7, Android 14 (API 34), development build on Windows 11. I checked these by hand:
  - search, term and department filters
  - favourites, and persistence across an app restart
  - course detail and sections, including term switching
  - prerequisite expansion and navigation, and the UCMP 6030 ↔ 6040 cycle
  - a deep link (`apptechtest2627://course/UCMP%206030`)
  - light and dark mode
- **Automated tests:** jest (`jest-expo` preset) for search, availability and the prerequisite tree (rendered against the real data), plus Python unit tests for the parser.

iOS was not tested (no macOS machine available). The app uses no iOS-specific code.

## Architecture

```
scripts/preprocess.py        raw data  -> app/data/generated/*.json   (offline, build time)
app/
  data/                      pure TypeScript, no React
    types.ts                 shapes of the generated JSON
    catalog.ts               loads the JSON once, builds lookup maps, lazy-loads details/sections
    search.ts                search index + filter/rank function
    sections.ts              availability rules (open / few seats / full)
  state/preferences.ts       favourites + selected term/department, persisted with MMKV
  components/                CourseRow, Chip, FavouriteButton, SectionCard, PrerequisiteTree
  screens/                   CourseList, CourseDetail, DepartmentPicker
  navigators/AppNavigator    one native stack; the department picker is a modal
```

The project starts from the provided Ignite boilerplate. I removed its demo screens, auth, API client and unused components and dependencies, and kept its theme (light/dark), `Screen`, `Text`, `TextField` and error boundary.

**State management.** I added no state library, because the app has almost no mutable state:

- **The catalogue is read-only.** It is a plain module (`data/catalog.ts`) evaluated once. Screens import from it directly, so there is nothing to put in React state.
- **Persisted preferences** (favourites, term, department) use MMKV's React hooks. Every component subscribed to a key re-renders when the key changes. That keeps the list screen and the department picker modal in sync without a Context provider, and the values survive restarts.
- **Screen-local UI state** (search text, expanded tree nodes, the selected term on a detail page) is ordinary `useState`.

**Navigation.** Opening a prerequisite or an "unlocks" course *pushes* another detail screen, so Back retraces the path the user explored. Deep links: `course/COMP%204211`.

## Data processing

`courses.json` (28 MB) has one record per course **per term**, plus long learning-outcome text. It contains no sections, so sections come from the `ust-archive/schedule` `classes` dataset (the source listed with the task). The script downloads that dataset and caches it in `scripts/.cache/`.

`scripts/preprocess.py`:

1. **Deduplicates the catalogue.** It groups the 15,178 term records by course code into 4,030 courses and records which terms each one appears in. When details differ between terms (117 courses), the newest term wins.
   - The "department" used for filtering is the **subject prefix** (COMP), not the dataset's `department_code`. Those codes are organisational and opaque to students: `IELM` owns IEDA courses, `CSE` owns COMP and CSIT, and `SENG` spans 20 prefixes.
2. **Drops unused fields** (learning outcomes, internal IDs, timestamps, vector strings).
3. **Parses prerequisites** into a tree (see below) and **precomputes "unlocks"**, the reverse edges, so neither happens on the device.
4. **Reduces section history.** The schedule dataset stores every scrape of every section (about 23 snapshots per section for Fall 2026). The script keeps only the latest snapshot per `(term, course, section)` and drops cancelled sections. That leaves 5,701 sections. It records the scrape time so the UI can say "Enrolment as of …".
5. **Splits output by when it is needed:**

| File | Size | Loaded |
|---|---|---|
| `courses.json` | ~1.0 MB | at startup: everything the list and the tree need |
| `course-details.json` | ~2.2 MB | when the list screen is idle (descriptions are ~60% of the bytes) |
| `sections.json` | ~1.7 MB | when the list screen is idle |
| `terms.json` | <1 KB | at startup |

Total on-device data: about 5 MB instead of 28 MB, and only about 1 MB is parsed before the first screen appears. The larger files are `require`d inside functions in `catalog.ts`, so they aren't evaluated at startup.

On the emulator, loading them on the first tap caused a visible pause before the first detail screen opened. So once the list is showing, `requestIdleCallback` preloads them, and the first course opens immediately. If a detail screen is opened before that (e.g. through a deep link), it loads them itself.

### Search and filtering

`buildSearchIndex` precomputes a compact lowercase code (`comp4211`) and a lowercase title per course, once. Each keystroke then runs a linear scan over 4,030 entries (a few milliseconds) that applies the term, department and favourites filters, then ranks matches:

1. code starts with the query (`comp42`)
2. code contains the query (`4211`)
3. title starts with the query words
4. title contains every query word, in any order

An inverted index or fuzzy-search library would add code and memory for no visible gain at this size. The input uses `useDeferredValue`, so typing stays responsive even if a filter pass takes longer on a slow device. The list is a `FlatList` with fixed-height, memoised rows and `getItemLayout`, so it never measures rows while scrolling.

## Prerequisite traversal

### Extraction (build time, Python)

Prerequisite strings are free text, but most look like `COMP 2211 AND (ELEC 2600 OR MATH 2411)`. The parser is a small tokenizer plus bracket-aware splitting, not an NLP parser:

- It normalises `[ ]` to `( )` and `&` to AND, and protects phrases like "or above" so they aren't read as an OR.
- It tokenises into course codes, AND, OR, commas, brackets and free text. `DSAA4040` becomes `DSAA 4040`, and a bare number after an operator reuses the previous prefix (`UFUG 1103 or 1106`).
- It splits on OR, then AND, so AND binds tighter. Commas take the meaning of the surrounding list ("One of A, B or C" means OR; "A, B and C" means AND).
- Text attached to a course becomes a **note** on it (`MATH 1012 (prior to 2025-26)`). Text on its own becomes a **text requirement** (`Level 5 in HKDSE Mathematics M2`).

The result is a tree of `all` / `any` / `course` / `text` nodes (`app/data/types.ts`). 877 of the 1,033 non-empty prerequisites parse into pure course logic; the other 156 contain some free-text condition. The app always offers the original catalogue wording next to the tree, so an imperfect parse can't hide information.

### Display (runtime)

`components/PrerequisiteTree.tsx` renders the tree recursively:

- Direct prerequisites show immediately. Each course with its own prerequisites has a › toggle, and expanding it renders that course's tree inside the current one. The deeper tree is looked up from the catalogue only at that point, so traversal is **lazy**. Fully expanding the worst course (MATH 4996) would produce 579 rows, which is why there is no "expand all".
- Tapping a course code opens its detail page. Codes that aren't in the dataset (retired courses) are shown greyed and aren't tappable.
- **Cycles.** Each node receives `path`, the list of codes from the root down to it. A course already on its own path is marked ↻ and can't be expanded, which bounds the recursion. The dataset really contains a cycle (UCMP 6030 ↔ UCMP 6040), and a test covers it.
- **Repeated courses.** A course that appears in two different branches isn't on the same path, so both copies stay independently expandable. A global "visited" set would wrongly hide the second copy.
- **No prerequisites.** The card shows "No prerequisites listed", and the course's own "Unlocks" list still works.

## Assumptions and limitations

- **Snapshot data.** Enrolment numbers are as of the scrape time shown in the app, not live.
- **The newest term's catalogue entry is shown** when details changed between terms.
- **Parser approximations.** A qualifier that applies to a list is attached to the first course only. For example, in "grade A- or above in MATH 1014/MATH 1020/MATH 1024" the grade note is attached to MATH 1014. Semicolon-separated alternative pathways ("(For DDP only) …; (For all others) …") are treated as OR. The catalogue wording is always one tap away.
- **Unlocks** only considers prerequisites, not co-requisites.
- **English only.** Ignite's i18n remains for its own components; the new screens use plain strings.
- **No prerequisite-completion tracking.** I left it out to keep the app small; the AND/OR tree is the structure it would build on.

## Optional features

- **Unlocks (reverse graph)**: precomputed at build time and shown on every course.
- **Favourites**: persisted with MMKV, plus a favourites-only filter.
- **Persisted filters**: the app reopens on the last term and department.
- **Accessibility**: 44pt touch targets, labelled icon buttons, expanded/selected states announced, and availability shown in text as well as colour. Dark mode comes from the existing theme.
