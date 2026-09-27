/**
 * Renders a parsed prerequisite tree as an expandable outline.
 *
 *   All of
 *   ├ › COMP 2211  Intro to AI           <- tap › to reveal its own prerequisites
 *   └ One of
 *     ├ • ELEC 2600  ...                  <- • = no prerequisites of its own
 *     └ • MATH 2411  ...
 *
 * Traversal is lazy: a course's prerequisites are only rendered once the user expands it,
 * so even the deepest chains (up to 9 levels in the data) cost nothing until opened.
 *
 * Cycles: each course node receives `path`, the codes from the root course down to it.
 * A course already on its own path is shown but cannot be expanded, which is what stops
 * infinite recursion (the data really contains UCMP 6030 <-> UCMP 6040). A course that
 * appears in two *different* branches is not a cycle, so both copies stay expandable.
 */
import { useState } from "react"
import { ImageStyle, Pressable, TextStyle, View, ViewStyle } from "react-native"

import { getCourse } from "@/data/catalog"
import type { CourseCode, PrerequisiteNode } from "@/data/types"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

import { Icon } from "./Icon"
import { Text } from "./Text"

interface PrerequisiteTreeProps {
  node: PrerequisiteNode
  /** Course codes from the root course down to this node. */
  path: CourseCode[]
  onOpenCourse: (code: CourseCode) => void
}

export function PrerequisiteTree(props: PrerequisiteTreeProps) {
  const { node } = props
  if (node.kind === "course") return <CourseNode {...props} node={node} />
  if (node.kind === "text") return <TextNode text={node.text} />
  return <GroupNode {...props} node={node} />
}

function GroupNode({
  node,
  path,
  onOpenCourse,
}: PrerequisiteTreeProps & { node: Extract<PrerequisiteNode, { kind: "all" | "any" }> }) {
  const { themed } = useAppTheme()
  const label = node.kind === "all" ? "All of" : "One of"

  return (
    <View>
      <Text
        size="xxs"
        weight="semiBold"
        style={themed($groupLabel)}
        text={node.note ? `${label} (${node.note})` : label}
      />
      <View style={themed($branch)}>
        {node.children.map((child, index) => (
          <PrerequisiteTree key={index} node={child} path={path} onOpenCourse={onOpenCourse} />
        ))}
      </View>
    </View>
  )
}

function CourseNode({
  node,
  path,
  onOpenCourse,
}: PrerequisiteTreeProps & { node: Extract<PrerequisiteNode, { kind: "course" }> }) {
  const { themed, theme } = useAppTheme()
  const [isExpanded, setIsExpanded] = useState(false)

  const course = getCourse(node.code)
  const isCycle = path.includes(node.code)
  const canExpand = course?.prerequisite != null && !isCycle

  let detail = course?.title ?? "Not in the current catalogue"
  if (isCycle) detail = "Already required above; not expanded again"

  return (
    <View>
      <View style={$row}>
        <Pressable
          onPress={() => setIsExpanded((expanded) => !expanded)}
          disabled={!canExpand}
          style={$toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded, disabled: !canExpand }}
          accessibilityLabel={
            canExpand ? `Prerequisites of ${node.code}` : `${node.code} has nothing to expand`
          }
        >
          {canExpand ? (
            <Icon
              icon="caretRight"
              size={20}
              color={theme.colors.text}
              style={isExpanded && $rotated}
            />
          ) : (
            <Text size="lg" style={themed($toggleGlyph)} text="•" />
          )}
        </Pressable>

        <Pressable
          onPress={() => onOpenCourse(node.code)}
          disabled={!course}
          style={({ pressed }) => [$label, pressed && { opacity: 0.6 }]}
          accessibilityRole="link"
          accessibilityHint={course ? "Opens course details" : undefined}
        >
          <Text
            weight="semiBold"
            style={themed(course ? $code : $dim)}
            text={isCycle ? `↻ ${node.code}` : node.code}
          />
          <Text size="xxs" numberOfLines={2} style={themed($dim)} text={detail} />
          {node.note && <Text size="xxs" style={themed($note)} text={node.note} />}
        </Pressable>
      </View>

      {isExpanded && course?.prerequisite && (
        <View style={themed($branch)}>
          <PrerequisiteTree
            node={course.prerequisite}
            path={[...path, node.code]}
            onOpenCourse={onOpenCourse}
          />
        </View>
      )}
    </View>
  )
}

function TextNode({ text }: { text: string }) {
  const { themed } = useAppTheme()
  return (
    <View style={$row}>
      <View style={$toggle}>
        <Text size="lg" style={themed($toggleGlyph)} text="◦" />
      </View>
      <Text size="xs" style={[$label, themed($note)]} text={text} />
    </View>
  )
}

const $rotated: ImageStyle = { transform: [{ rotate: "90deg" }] }

const $row: ViewStyle = { flexDirection: "row", alignItems: "center" }

const $toggle: ViewStyle = {
  width: 36,
  minHeight: 44,
  alignItems: "center",
  justifyContent: "center",
}

const $label: ViewStyle = { flex: 1, minWidth: 0, paddingVertical: 4 }

const $branch: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  marginLeft: spacing.sm,
  paddingLeft: spacing.xs,
  borderLeftWidth: 1,
  borderLeftColor: colors.separator,
})

const $groupLabel: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  paddingVertical: spacing.xxs,
})

const $toggleGlyph: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })

const $code: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.tint })

const $dim: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })

const $note: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.text, fontStyle: "italic" })
