import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  useEntries,
  useStreams,
  sortEntries,
  groupEntries,
  filterEntriesBySearch,
  DEFAULT_DISPLAY_MODE,
  DEFAULT_SORT_MODE,
  DEFAULT_SORT_ORDER,
  DEFAULT_GROUP_MODE,
} from "@trace/core";
import type {
  EntryDisplayMode,
  EntrySortMode,
  EntrySortOrder,
  EntryGroupMode,
} from "@trace/core";
import { EntryList } from "../modules/entries/components/EntryList";
import { EntryListControls } from "../modules/entries/components/EntryListControls";

export function InboxPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const streamParam = searchParams.get("stream");
  const { streams } = useStreams();

  // List control state
  const [displayMode, setDisplayMode] = useState<EntryDisplayMode>(DEFAULT_DISPLAY_MODE);
  const [sortMode, setSortMode] = useState<EntrySortMode>(DEFAULT_SORT_MODE);
  const [sortOrder, setSortOrder] = useState<EntrySortOrder>(DEFAULT_SORT_ORDER);
  const [groupMode, setGroupMode] = useState<EntryGroupMode>(DEFAULT_GROUP_MODE);
  const [searchQuery, setSearchQuery] = useState("");

  // Build stream map for display
  const streamMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const stream of streams) {
      map[stream.stream_id] = stream.name;
    }
    return map;
  }, [streams]);

  // Determine filter based on URL parameter
  // - No param = Inbox (stream_id: null)
  // - "all" = All entries (no stream filter)
  // - specific ID = entries from that stream
  let streamFilter: { stream_id?: string | null } = {};

  if (streamParam === "all") {
    // Don't set stream_id - will fetch all entries
  } else if (streamParam) {
    // Specific stream ID
    streamFilter = { stream_id: streamParam };
  } else {
    // Default: Inbox (unassigned entries)
    streamFilter = { stream_id: null };
  }

  const { entries, isLoading } = useEntries(streamFilter);

  // Apply search, sort, and grouping
  const processedEntries = useMemo(() => {
    // Step 1: Filter by search
    let filtered = filterEntriesBySearch(entries, searchQuery);

    // Step 2: Sort entries
    filtered = sortEntries(filtered, sortMode, streamMap, sortOrder, true);

    return filtered;
  }, [entries, searchQuery, sortMode, sortOrder, streamMap]);

  // Group entries if needed
  const sections = useMemo(() => {
    if (groupMode === "none") return undefined;
    return groupEntries(processedEntries, groupMode, streamMap, sortOrder, true);
  }, [processedEntries, groupMode, streamMap, sortOrder]);

  const handleEntryClick = (entryId: string) => {
    navigate(`/capture?id=${entryId}`);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* List Controls */}
      <EntryListControls
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        sortOrder={sortOrder}
        onSortOrderChange={setSortOrder}
        groupMode={groupMode}
        onGroupModeChange={setGroupMode}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
      />

      {/* Entry count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          {processedEntries.length} {processedEntries.length === 1 ? "entry" : "entries"}
          {searchQuery && ` matching "${searchQuery}"`}
        </p>
      </div>

      {/* Entry List */}
      <EntryList
        entries={processedEntries}
        isLoading={isLoading}
        onEntryClick={handleEntryClick}
        displayMode={displayMode}
        streamMap={streamMap}
        sections={sections}
      />
    </div>
  );
}
