import { memo } from "react"
import { Pressable, TextStyle, View, ViewStyle } from "react-native"

import type { Course, CourseCode } from "@/data/types"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

import { FavouriteButton } from "./FavouriteButton"
import { Text } from "./Text"

/** Fixed so the list can use getItemLayout and skip measuring rows. */
export const COURSE_ROW_HEIGHT = 72

interface CourseRowProps {
  course: Course
  isFavourite: boolean
  onPress: (code: CourseCode) => void
  onToggleFavourite: (code: CourseCode) => void
}

/** Memoised: while scrolling or toggling one favourite, other rows don't re-render. */
export const CourseRow = memo(function CourseRow({
  course,
  isFavourite,
  onPress,
  onToggleFavourite,
}: CourseRowProps) {
  const { themed } = useAppTheme()

  return (
    <View style={themed($row)}>
      <Pressable
        style={({ pressed }) => [$main, pressed && { opacity: 0.6 }]}
        onPress={() => onPress(course.code)}
        accessibilityRole="button"
        accessibilityLabel={`${course.code}, ${course.title}, ${course.credits} credits`}
      >
        <View style={$topLine}>
          <Text weight="bold" text={course.code} />
          <Text size="xxs" style={themed($meta)} text={`${course.credits} cr · ${course.career}`} />
        </View>
        <Text size="xs" numberOfLines={1} text={course.title} />
      </Pressable>
      <FavouriteButton
        courseCode={course.code}
        isFavourite={isFavourite}
        onToggle={() => onToggleFavourite(course.code)}
      />
    </View>
  )
})

const $row: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  height: COURSE_ROW_HEIGHT,
  flexDirection: "row",
  alignItems: "center",
  paddingLeft: spacing.md,
  paddingRight: spacing.xs,
  borderBottomWidth: 1,
  borderBottomColor: colors.separator,
})

const $main: ViewStyle = { flex: 1, minWidth: 0, justifyContent: "center", height: "100%" }

const $topLine: ViewStyle = { flexDirection: "row", alignItems: "baseline", gap: 8 }

const $meta: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })
