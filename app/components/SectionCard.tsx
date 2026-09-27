import { TextStyle, View, ViewStyle } from "react-native"

import { AvailabilityTone, getAvailability, getInstructors } from "@/data/sections"
import type { Meeting, Section } from "@/data/types"
import { useAppTheme } from "@/theme/context"
import type { Colors, ThemedStyle } from "@/theme/types"

import { Text } from "./Text"

function formatMeeting({ weekday, start, end, venue }: Meeting): string {
  const time = start && end ? `${start}–${end}` : "Time TBA"
  return `${weekday} ${time} · ${venue}`
}

function toneColor(colors: Colors, tone: AvailabilityTone): string {
  if (tone === "open") return colors.success
  if (tone === "limited") return colors.warning
  return colors.error
}

export function SectionCard({ section }: { section: Section }) {
  const { themed, theme } = useAppTheme()
  const availability = getAvailability(section)
  const instructors = getInstructors(section)
  const fillRatio = section.capacity > 0 ? Math.min(section.enrolled / section.capacity, 1) : 1
  const color = toneColor(theme.colors, availability.tone)

  return (
    <View style={themed($card)}>
      <View style={$header}>
        <Text weight="bold" text={`${section.section} · ${section.type}`} />
        {/* Text label, not colour alone, carries the status. */}
        <Text size="xs" weight="semiBold" style={{ color }} text={availability.label} />
      </View>

      <View
        style={themed($track)}
        accessibilityRole="progressbar"
        accessibilityLabel={`${section.enrolled} of ${section.capacity} seats taken`}
      >
        <View style={[$fill, { width: `${fillRatio * 100}%`, backgroundColor: color }]} />
      </View>
      <Text
        size="xxs"
        style={themed($dim)}
        text={`Enrolled ${section.enrolled} / ${section.capacity} · Waitlist ${section.waitlist}`}
      />

      {section.meetings.map((meeting, index) => (
        <Text key={index} size="xs" text={formatMeeting(meeting)} />
      ))}
      {instructors.length > 0 && (
        <Text size="xs" style={themed($dim)} text={instructors.join("; ")} />
      )}
      {section.consentRequired && (
        <Text size="xxs" weight="semiBold" text="Instructor consent required" />
      )}
      {section.remarks !== "" && (
        <Text size="xxs" style={themed($dim)} numberOfLines={4} text={section.remarks} />
      )}
    </View>
  )
}

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  gap: spacing.xxs,
  padding: spacing.sm,
  borderRadius: 8,
  backgroundColor: colors.surface,
})

const $header: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "baseline",
}

const $track: ThemedStyle<ViewStyle> = ({ colors }) => ({
  height: 6,
  borderRadius: 3,
  overflow: "hidden",
  backgroundColor: colors.separator,
})

const $fill: ViewStyle = { height: "100%" }

const $dim: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })
