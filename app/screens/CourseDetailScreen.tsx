import { ReactNode, useState } from "react"
import { TextStyle, View, ViewStyle } from "react-native"

import { Chip } from "@/components/Chip"
import { EmptyState } from "@/components/EmptyState"
import { FavouriteButton } from "@/components/FavouriteButton"
import { PrerequisiteTree } from "@/components/PrerequisiteTree"
import { Screen } from "@/components/Screen"
import { SectionCard } from "@/components/SectionCard"
import { Text } from "@/components/Text"
import { getCourse, getCourseDetails, getSections, getTerm } from "@/data/catalog"
import type { Course, CourseCode, TermCode } from "@/data/types"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useFavourites, useSelectedTerm } from "@/state/preferences"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

const updatedAtFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" })

export function CourseDetailScreen({ navigation, route }: AppStackScreenProps<"CourseDetail">) {
  const course = getCourse(route.params.code)

  if (!course) {
    // Reachable through a deep link to a code that isn't in the dataset.
    return (
      <Screen preset="fixed" contentContainerStyle={$notFound}>
        <EmptyState
          heading="Course not found"
          content={`${route.params.code} isn't in the bundled catalogue.`}
          button="Back to courses"
          buttonOnPress={() => navigation.popToTop()}
        />
      </Screen>
    )
  }
  return (
    <CourseDetail
      course={course}
      onOpenCourse={(code) => navigation.push("CourseDetail", { code })}
    />
  )
}

function CourseDetail({
  course,
  onOpenCourse,
}: {
  course: Course
  onOpenCourse: (code: CourseCode) => void
}) {
  const { themed } = useAppTheme()
  const details = getCourseDetails(course.code)
  const { favourites, toggleFavourite } = useFavourites()
  const [listTerm] = useSelectedTerm()
  // Show sections for the term chosen on the list, if the course runs then; otherwise its newest term.
  const [term, setTerm] = useState<TermCode>(
    listTerm && course.terms.includes(listTerm) ? listTerm : course.terms[0],
  )
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)
  const [isSourceVisible, setIsSourceVisible] = useState(false)

  const sections = getSections(term, course.code)
  const termInfo = getTerm(term)

  return (
    <Screen preset="scroll" safeAreaEdges={["bottom"]} contentContainerStyle={themed($content)}>
      <View style={$titleRow}>
        <View style={$flexShrink}>
          <Text preset="heading" size="xl" text={course.title} />
          <Text
            style={themed($dim)}
            text={`${course.code} · ${course.credits} credits · ${course.career}`}
          />
        </View>
        <FavouriteButton
          courseCode={course.code}
          isFavourite={favourites.has(course.code)}
          onToggle={() => toggleFavourite(course.code)}
        />
      </View>

      {details?.description ? (
        <View>
          <Text numberOfLines={isDescriptionExpanded ? undefined : 4} text={details.description} />
          <Text
            size="xs"
            weight="semiBold"
            style={themed($link)}
            onPress={() => setIsDescriptionExpanded((value) => !value)}
            accessibilityRole="button"
            text={isDescriptionExpanded ? "Show less" : "Show more…"}
          />
        </View>
      ) : null}

      <Card title="Prerequisites">
        {course.prerequisite ? (
          <PrerequisiteTree
            node={course.prerequisite}
            path={[course.code]}
            onOpenCourse={onOpenCourse}
          />
        ) : (
          <Text style={themed($dim)} text="No prerequisites listed." />
        )}
        {course.prerequisiteText !== "" && (
          <>
            <Text
              size="xs"
              weight="semiBold"
              style={themed($link)}
              onPress={() => setIsSourceVisible((value) => !value)}
              accessibilityRole="button"
              text={isSourceVisible ? "Hide catalogue wording" : "Show catalogue wording…"}
            />
            {isSourceVisible && (
              <Text size="xs" style={themed($dim)} text={course.prerequisiteText} />
            )}
          </>
        )}
        {details?.corequisite ? (
          <LabelledText label="Co-requisite" text={details.corequisite} />
        ) : null}
        {details?.exclusion ? <LabelledText label="Exclusion" text={details.exclusion} /> : null}
      </Card>

      <Card title={`Unlocks (${course.unlocks.length})`}>
        {course.unlocks.length > 0 ? (
          <>
            <Text
              size="xs"
              style={themed($dim)}
              text="Courses that list this one as a prerequisite."
            />
            <View style={themed($wrap)}>
              {course.unlocks.map((code) => (
                <Chip key={code} label={code} onPress={() => onOpenCourse(code)} />
              ))}
            </View>
          </>
        ) : (
          <Text style={themed($dim)} text="No other course lists this one as a prerequisite." />
        )}
      </Card>

      <Card title="Sections">
        <View style={themed($wrap)}>
          {course.terms.map((code) => (
            <Chip
              key={code}
              label={getTerm(code)?.name ?? code}
              selected={code === term}
              onPress={() => setTerm(code)}
            />
          ))}
        </View>
        {termInfo?.sectionsUpdatedAt && sections.length > 0 && (
          <Text
            size="xxs"
            style={themed($dim)}
            text={`Enrolment as of ${updatedAtFormat.format(new Date(termInfo.sectionsUpdatedAt))}`}
          />
        )}
        {sections.length > 0 ? (
          sections.map((section) => <SectionCard key={section.section} section={section} />)
        ) : (
          <Text
            style={themed($dim)}
            text={`No section schedule is available for ${termInfo?.name ?? "this term"}.`}
          />
        )}
      </Card>

      {details && details.attributes.length > 0 && (
        <Card title="Attributes">
          {details.attributes.map((attribute) => (
            <Text key={attribute} size="xs" text={`• ${attribute}`} />
          ))}
        </Card>
      )}
    </Screen>
  )
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  const { themed } = useAppTheme()
  return (
    <View style={themed($card)}>
      <Text preset="subheading" size="md" text={title} accessibilityRole="header" />
      {children}
    </View>
  )
}

function LabelledText({ label, text }: { label: string; text: string }) {
  const { themed } = useAppTheme()
  return (
    <Text size="xs">
      <Text size="xs" weight="semiBold" text={`${label}: `} />
      <Text size="xs" style={themed($dim)} text={text} />
    </Text>
  )
}

const $notFound: ViewStyle = { flex: 1, justifyContent: "center" }

const $content: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.md,
  padding: spacing.md,
})

const $titleRow: ViewStyle = { flexDirection: "row", alignItems: "flex-start", gap: 8 }

const $flexShrink: ViewStyle = { flex: 1, minWidth: 0 }

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  gap: spacing.xs,
  padding: spacing.md,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: colors.separator,
})

const $wrap: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
})

const $dim: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })

const $link: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.tint,
  paddingVertical: spacing.xs,
})
