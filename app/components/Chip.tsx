import { LayoutChangeEvent, Pressable, TextStyle, ViewStyle } from "react-native"

import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

import { Text } from "./Text"

interface ChipProps {
  label: string
  selected?: boolean
  onPress: () => void
  accessibilityLabel?: string
  onLayout?: (event: LayoutChangeEvent) => void
}

/** A pill-shaped toggle used for filters and term selection. */
export function Chip({
  label,
  selected = false,
  onPress,
  accessibilityLabel,
  onLayout,
}: ChipProps) {
  const { themed } = useAppTheme()

  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [
        themed($chip),
        selected && themed($chipSelected),
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text
        size="xs"
        weight="medium"
        style={themed(selected ? $labelSelected : $label)}
        text={label}
        numberOfLines={1}
      />
    </Pressable>
  )
}

const $chip: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  minHeight: 36,
  justifyContent: "center",
  paddingHorizontal: spacing.sm,
  borderRadius: 18,
  borderWidth: 1,
  borderColor: colors.border,
  backgroundColor: colors.surface,
})

const $chipSelected: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.tint,
  backgroundColor: colors.tint,
})

const $label: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.text })

const $labelSelected: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.surface })
