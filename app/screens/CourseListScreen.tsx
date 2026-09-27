import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react"
import { FlatList, LayoutChangeEvent, ScrollView, TextStyle, View, ViewStyle } from "react-native"

import { Button } from "@/components/Button"
import { Chip } from "@/components/Chip"
import { COURSE_ROW_HEIGHT, CourseRow } from "@/components/CourseRow"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { courses, preloadDetailData, terms } from "@/data/catalog"
import { buildSearchIndex, filterCourses } from "@/data/search"
import type { Course, CourseCode } from "@/data/types"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useFavourites, useSelectedDepartment, useSelectedTerm } from "@/state/preferences"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

const searchIndex = buildSearchIndex(courses)

export function CourseListScreen({ navigation }: AppStackScreenProps<"CourseList">) {
  const { themed } = useAppTheme()
  const termRowRef = useRef<ScrollView>(null)
  const [query, setQuery] = useState("")
  const [favouritesOnly, setFavouritesOnly] = useState(false)
  const [term, setTerm] = useSelectedTerm()
  const [department, setDepartment] = useSelectedDepartment()
  const { favourites, toggleFavourite } = useFavourites()

  // Typing updates the input immediately; the list re-filters at lower priority.
  const deferredQuery = useDeferredValue(query)
  const results = useMemo(
    () =>
      filterCourses(
        searchIndex,
        { query: deferredQuery, term, department, favouritesOnly },
        favourites,
      ),
    [deferredQuery, term, department, favouritesOnly, favourites],
  )

  // Parse the detail-screen data while the user is looking at the list, so the first
  // course opens without a pause. Startup itself still only parses courses.json.
  useEffect(() => {
    const handle = requestIdleCallback(preloadDetailData)
    return () => cancelIdleCallback(handle)
  }, [])

  const openCourse = useCallback(
    (code: CourseCode) => navigation.navigate("CourseDetail", { code }),
    [navigation],
  )

  // A remembered term can sit past the edge of the chip row; scroll it into view so the
  // active filter is always visible.
  const revealSelectedTerm = useCallback((event: LayoutChangeEvent) => {
    termRowRef.current?.scrollTo({
      x: Math.max(0, event.nativeEvent.layout.x - 16),
      animated: false,
    })
  }, [])

  const clearFilters = () => {
    setQuery("")
    setDepartment(undefined)
    setTerm(undefined)
    setFavouritesOnly(false)
  }

  const renderItem = useCallback(
    ({ item }: { item: Course }) => (
      <CourseRow
        course={item}
        isFavourite={favourites.has(item.code)}
        onPress={openCourse}
        onToggleFavourite={toggleFavourite}
      />
    ),
    [favourites, openCourse, toggleFavourite],
  )

  return (
    <Screen preset="fixed" safeAreaEdges={["bottom"]} contentContainerStyle={$flex}>
      <View style={themed($filters)}>
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Search code or title…"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search courses"
        />

        <ScrollView
          ref={termRowRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={themed($chipRow)}
        >
          <Chip
            label="All terms"
            selected={term === undefined}
            onPress={() => setTerm(undefined)}
          />
          {terms.map((t) => (
            <Chip
              key={t.code}
              label={t.name}
              selected={term === t.code}
              onPress={() => setTerm(t.code)}
              onLayout={term === t.code ? revealSelectedTerm : undefined}
            />
          ))}
        </ScrollView>

        <View style={themed($chipRow)}>
          <Chip
            label={`${department ?? "All departments"} ▾`}
            selected={department !== undefined}
            onPress={() => navigation.navigate("DepartmentPicker")}
            accessibilityLabel={`Department: ${department ?? "all"}. Change department`}
          />
          <Chip
            label="Favourites"
            selected={favouritesOnly}
            onPress={() => setFavouritesOnly((value) => !value)}
          />
        </View>

        <Text
          size="xxs"
          style={themed($count)}
          accessibilityLiveRegion="polite"
          text={`${results.length.toLocaleString()} ${results.length === 1 ? "course" : "courses"}`}
        />
      </View>

      <FlatList
        data={results}
        keyExtractor={(course) => course.code}
        renderItem={renderItem}
        extraData={favourites}
        getItemLayout={(_, index) => ({
          length: COURSE_ROW_HEIGHT,
          offset: COURSE_ROW_HEIGHT * index,
          index,
        })}
        initialNumToRender={12}
        windowSize={11}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={themed($empty)}>
            <Text preset="subheading" text="No courses found" />
            <Text
              style={themed($count)}
              text={
                favouritesOnly && favourites.size === 0
                  ? "You haven't saved any favourites yet. Tap the heart on a course to save it."
                  : "Try a different search, or widen the term and department filters."
              }
            />
            <Button text="Clear filters" onPress={clearFilters} />
          </View>
        }
      />
    </Screen>
  )
}

const $flex: ViewStyle = { flex: 1 }

const $filters: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
  paddingHorizontal: spacing.md,
  paddingBottom: spacing.xs,
})

const $chipRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.xs,
})

const $count: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })

const $empty: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
  padding: spacing.lg,
})
