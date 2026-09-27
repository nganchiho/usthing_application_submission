import { FlatList, Pressable, TextStyle, ViewStyle } from "react-native"

import { Icon } from "@/components/Icon"
import { Text } from "@/components/Text"
import { departments } from "@/data/catalog"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useSelectedDepartment } from "@/state/preferences"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

const ROW_HEIGHT = 52

interface DepartmentOption {
  code: string | undefined // undefined = all departments
  label: string
}

const options: DepartmentOption[] = [
  { code: undefined, label: "All departments" },
  ...departments.map((d) => ({ code: d.code, label: `${d.code}  ·  ${d.courseCount} courses` })),
]

export function DepartmentPickerScreen({ navigation }: AppStackScreenProps<"DepartmentPicker">) {
  const { themed, theme } = useAppTheme()
  const [selected, setSelected] = useSelectedDepartment()

  return (
    <FlatList
      data={options}
      keyExtractor={(option) => option.code ?? "all"}
      getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
      renderItem={({ item }) => {
        const isSelected = item.code === selected
        return (
          <Pressable
            style={({ pressed }) => [themed($row), pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => {
              setSelected(item.code)
              navigation.goBack()
            }}
          >
            <Text style={$label} text={item.label} weight={isSelected ? "bold" : "normal"} />
            {isSelected && <Icon icon="check" size={20} color={theme.colors.tint} />}
          </Pressable>
        )
      }}
    />
  )
}

// The divider is a border inside the fixed row height, so getItemLayout offsets stay exact.
const $row: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  height: ROW_HEIGHT,
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: spacing.md,
  borderBottomWidth: 1,
  borderBottomColor: colors.separator,
})

const $label: TextStyle = { flex: 1 }
