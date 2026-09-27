import { ViewStyle } from "react-native"

import { useAppTheme } from "@/theme/context"

import { PressableIcon } from "./Icon"

interface FavouriteButtonProps {
  courseCode: string
  isFavourite: boolean
  onToggle: () => void
}

export function FavouriteButton({ courseCode, isFavourite, onToggle }: FavouriteButtonProps) {
  const { theme } = useAppTheme()

  return (
    <PressableIcon
      // Filled vs outline, so the state doesn't rely on colour alone.
      icon={isFavourite ? "heartFilled" : "heart"}
      size={22}
      color={isFavourite ? theme.colors.tint : theme.colors.tintInactive}
      containerStyle={$hitArea}
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ selected: isFavourite }}
      accessibilityLabel={
        isFavourite ? `Remove ${courseCode} from favourites` : `Add ${courseCode} to favourites`
      }
    />
  )
}

// 44pt minimum touch target around a 22pt icon.
const $hitArea: ViewStyle = {
  width: 44,
  height: 44,
  alignItems: "center",
  justifyContent: "center",
}
