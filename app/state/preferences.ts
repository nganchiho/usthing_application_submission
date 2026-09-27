/**
 * User preferences, persisted with MMKV.
 *
 * MMKV's hooks re-render every component subscribed to a key when that key changes,
 * so the list screen and the department picker share state without a React Context,
 * and the choices survive app restarts.
 */
import { useCallback, useMemo } from "react"
import { useMMKVObject, useMMKVString } from "react-native-mmkv"

import { terms } from "@/data/catalog"
import type { CourseCode, TermCode } from "@/data/types"
import { storage } from "@/utils/storage"

const ALL = "all"

/** Selected term; undefined means "all terms". Defaults to the newest term. */
export function useSelectedTerm(): [TermCode | undefined, (term: TermCode | undefined) => void] {
  const [stored, setStored] = useMMKVString("filters.term", storage)
  const term = stored === ALL ? undefined : (stored ?? terms[0]?.code)
  const setTerm = useCallback((next: TermCode | undefined) => setStored(next ?? ALL), [setStored])
  return [term, setTerm]
}

/** Selected department code; undefined means "all departments". */
export function useSelectedDepartment(): [
  string | undefined,
  (department: string | undefined) => void,
] {
  const [department, setDepartment] = useMMKVString("filters.department", storage)
  return [department, setDepartment]
}

export function useFavourites() {
  const [stored, setStored] = useMMKVObject<CourseCode[]>("favourites", storage)
  const favourites = useMemo(() => new Set(stored ?? []), [stored])

  const toggleFavourite = useCallback(
    (code: CourseCode) => {
      const next = new Set(favourites)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      setStored([...next])
    },
    [favourites, setStored],
  )

  return { favourites, toggleFavourite }
}
