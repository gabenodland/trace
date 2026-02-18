import { useMemo } from "react";
import type { EntrySortMode, EntrySortOrder, EntryGroupMode, EntrySection, Stream } from "@trace/core";
import { sortEntries, groupEntries } from "@trace/core";
import type { EntryWithRelations } from "../../modules/entries/EntryWithRelationsTypes";

/** Sort modes that produce grouped sections */
const GROUPABLE_MODES: readonly EntryGroupMode[] = ['status', 'type', 'stream', 'priority', 'rating', 'due_date'];

/**
 * Shared hook for calendar views that computes sorted entries and optional
 * grouped sections from a filtered entry list + display settings.
 */
export function useCalendarEntries(
  filteredEntries: EntryWithRelations[],
  sortMode: EntrySortMode,
  streamMap: Record<string, string>,
  streamById: Record<string, Stream>,
  orderMode: EntrySortOrder,
  showPinnedFirst: boolean,
) {
  const sortedEntries = useMemo(() => {
    return sortEntries(filteredEntries, sortMode, streamMap, orderMode, showPinnedFirst);
  }, [filteredEntries, sortMode, streamMap, orderMode, showPinnedFirst]);

  const entrySections = useMemo((): EntrySection<EntryWithRelations>[] | undefined => {
    if ((GROUPABLE_MODES as readonly string[]).includes(sortMode)) {
      return groupEntries(filteredEntries, sortMode as EntryGroupMode, streamMap, orderMode, showPinnedFirst, streamById);
    }
    return undefined;
  }, [filteredEntries, sortMode, streamMap, streamById, orderMode, showPinnedFirst]);

  return { sortedEntries, entrySections };
}
