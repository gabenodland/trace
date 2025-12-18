/**
 * EntriesPage - Main entries view with left sidebar navigation
 * Replaces InboxPage with full feature parity with mobile's EntryListScreen
 */
import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type {
  EntryDisplayMode,
  EntrySortMode,
  EntrySortOrder,
  EntryGroupMode,
  EntryFilter,
  EntryStatus,
  Stream,
  LocationEntity,
} from "@trace/core";
import {
  useEntries,
  useStreams,
  useLocations,
  sortEntries,
  groupEntries,
  filterEntriesBySearch,
  DEFAULT_DISPLAY_MODE,
  DEFAULT_SORT_MODE,
  DEFAULT_SORT_ORDER,
  DEFAULT_GROUP_MODE,
  getNextStatus,
} from "@trace/core";
import { EntryNavigator, type SelectedFilter } from "../modules/entries/components/EntryNavigator";
import { EntryList } from "../modules/entries/components/EntryList";
import { EntryListControls } from "../modules/entries/components/EntryListControls";
import { usePersistedState } from "../shared/hooks/usePersistedState";
import { StreamPickerModal } from "../modules/streams/components/StreamPickerModal";

export function EntriesPage() {
  const navigate = useNavigate();
  const { streams } = useStreams();
  const { locations } = useLocations();

  // Persisted view settings
  const [displayMode, setDisplayMode] = usePersistedState<EntryDisplayMode>(
    "@web:entriesDisplayMode",
    DEFAULT_DISPLAY_MODE
  );
  const [sortMode, setSortMode] = usePersistedState<EntrySortMode>(
    "@web:entriesSortMode",
    DEFAULT_SORT_MODE
  );
  const [sortOrder, setSortOrder] = usePersistedState<EntrySortOrder>(
    "@web:entriesSortOrder",
    DEFAULT_SORT_ORDER
  );
  const [groupMode, setGroupMode] = usePersistedState<EntryGroupMode>(
    "@web:entriesGroupMode",
    DEFAULT_GROUP_MODE
  );
  const [showPinnedFirst, setShowPinnedFirst] = usePersistedState<boolean>(
    "@web:entriesShowPinnedFirst",
    false
  );

  // Local state
  const [selectedFilter, setSelectedFilter] = useState<SelectedFilter>("all");
  const [selectedFilterName, setSelectedFilterName] = useState("All Entries");
  const [searchQuery, setSearchQuery] = useState("");

  // Move modal state
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [entryToMove, setEntryToMove] = useState<string | null>(null);
  const [entryToMoveStreamId, setEntryToMoveStreamId] = useState<string | null>(null);

  // Build filter based on selected navigation item
  const entryFilter = useMemo((): EntryFilter => {
    if (selectedFilter === "all") {
      return {}; // No filter - fetch all
    }
    if (selectedFilter === null) {
      return { stream_id: null }; // Unassigned
    }
    if (typeof selectedFilter === "string") {
      if (selectedFilter.startsWith("tag:")) {
        return { tag: selectedFilter.substring(4) };
      }
      if (selectedFilter.startsWith("mention:")) {
        return { mention: selectedFilter.substring(8) };
      }
      if (selectedFilter.startsWith("location:")) {
        return { location_id: selectedFilter.substring(9) };
      }
      // Specific stream ID
      return { stream_id: selectedFilter };
    }
    return {};
  }, [selectedFilter]);

  // Fetch all entries for navigator counts (no filter)
  const { entries: allEntries } = useEntries({});

  // Fetch filtered entries for display
  const { entries, isLoading, entryMutations } = useEntries(entryFilter);

  // Calculate counts for navigator
  const allEntriesCount = allEntries.length;
  const noStreamCount = useMemo(
    () => allEntries.filter((e) => !e.stream_id).length,
    [allEntries]
  );

  // Build stream map for display
  const streamMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const stream of streams) {
      map[stream.stream_id] = stream.name;
    }
    return map;
  }, [streams]);

  // Build stream by ID map for rating grouping
  const streamById = useMemo(() => {
    const map: Record<string, Stream> = {};
    for (const stream of streams) {
      map[stream.stream_id] = stream;
    }
    return map;
  }, [streams]);

  // Build location map for display (location_id -> name)
  const locationMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const location of locations) {
      map[location.location_id] = location.name;
    }
    return map;
  }, [locations]);

  // Process entries: search, sort, group
  const processedEntries = useMemo(() => {
    let result = filterEntriesBySearch(entries, searchQuery);
    result = sortEntries(result, sortMode, streamMap, sortOrder, showPinnedFirst);
    return result;
  }, [entries, searchQuery, sortMode, sortOrder, streamMap, showPinnedFirst]);

  // Group entries if needed
  const sections = useMemo(() => {
    if (groupMode === "none") return undefined;
    return groupEntries(processedEntries, groupMode, streamMap, sortOrder, showPinnedFirst, streamById);
  }, [processedEntries, groupMode, streamMap, sortOrder, showPinnedFirst, streamById]);

  const handleFilterSelect = (filter: SelectedFilter, displayName: string) => {
    setSelectedFilter(filter);
    setSelectedFilterName(displayName);
  };

  const handleEntryClick = (entryId: string) => {
    navigate(`/capture?id=${entryId}`);
  };

  const handleAddEntry = () => {
    // Pre-fill based on current filter
    let params = "";
    if (selectedFilter !== "all" && selectedFilter !== null) {
      if (typeof selectedFilter === "string") {
        if (selectedFilter.startsWith("tag:")) {
          const tag = selectedFilter.substring(4);
          params = `?initialContent=${encodeURIComponent(`#${tag} `)}`;
        } else if (selectedFilter.startsWith("mention:")) {
          const mention = selectedFilter.substring(8);
          params = `?initialContent=${encodeURIComponent(`@${mention} `)}`;
        } else if (!selectedFilter.startsWith("location:")) {
          // Stream ID
          params = `?streamId=${selectedFilter}`;
        }
      }
    } else if (selectedFilter === null) {
      // Unassigned - no pre-fill
    }
    navigate(`/capture${params}`);
  };

  // Action handlers for entry list items
  const handleTagPress = useCallback((tag: string) => {
    setSelectedFilter(`tag:${tag}`);
    setSelectedFilterName(`#${tag}`);
  }, []);

  const handleMentionPress = useCallback((mention: string) => {
    setSelectedFilter(`mention:${mention}`);
    setSelectedFilterName(`@${mention}`);
  }, []);

  const handleStreamPress = useCallback((streamId: string | null, streamName: string) => {
    if (streamId === null) {
      setSelectedFilter(null);
      setSelectedFilterName("Unassigned");
    } else {
      setSelectedFilter(streamId);
      setSelectedFilterName(streamName);
    }
  }, []);

  const handleToggleComplete = useCallback(async (entryId: string, currentStatus: EntryStatus) => {
    const nextStatus = getNextStatus(currentStatus);
    await entryMutations.updateEntry(entryId, { status: nextStatus });
  }, [entryMutations]);

  const handleMove = useCallback((entryId: string) => {
    const entry = entries.find(e => e.entry_id === entryId);
    setEntryToMove(entryId);
    setEntryToMoveStreamId(entry?.stream_id || null);
    setShowMoveModal(true);
  }, [entries]);

  const handleMoveSelect = useCallback(async (streamId: string | null) => {
    if (entryToMove) {
      await entryMutations.updateEntry(entryToMove, { stream_id: streamId });
      setEntryToMove(null);
      setShowMoveModal(false);
    }
  }, [entryToMove, entryMutations]);

  const handleCopy = useCallback(async (entryId: string) => {
    const entry = entries.find(e => e.entry_id === entryId);
    if (entry) {
      // Create a copy of the entry (without the IDs)
      const { entry_id, created_at, updated_at, ...entryData } = entry;
      await entryMutations.createEntry({
        ...entryData,
        title: entry.title ? `Copy of ${entry.title}` : undefined,
      });
    }
  }, [entries, entryMutations]);

  const handleDelete = useCallback(async (entryId: string) => {
    if (window.confirm("Are you sure you want to delete this entry?")) {
      await entryMutations.deleteEntry(entryId);
    }
  }, [entryMutations]);

  const handlePin = useCallback(async (entryId: string, currentPinned: boolean) => {
    await entryMutations.updateEntry(entryId, { is_pinned: !currentPinned });
  }, [entryMutations]);

  return (
    <div className="flex h-full">
      {/* Left Sidebar Navigator */}
      <div className="w-64 flex-shrink-0">
        <EntryNavigator
          streams={streams}
          entries={allEntries}
          selectedFilter={selectedFilter}
          onSelect={handleFilterSelect}
          allEntriesCount={allEntriesCount}
          noStreamCount={noStreamCount}
          locationMap={locationMap}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with title and count */}
        <div className="px-6 py-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-gray-900">{selectedFilterName}</h1>
            <span className="text-sm text-gray-500">
              {processedEntries.length} {processedEntries.length === 1 ? "entry" : "entries"}
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
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
            showPinnedFirst={showPinnedFirst}
            onShowPinnedFirstChange={setShowPinnedFirst}
          />
        </div>

        {/* Entry List */}
        <div className="flex-1 overflow-y-auto p-6">
          <EntryList
            entries={processedEntries}
            isLoading={isLoading}
            onEntryClick={handleEntryClick}
            displayMode={displayMode}
            streamMap={streamMap}
            locationMap={locationMap}
            fullStreams={streams}
            sections={sections}
            onTagPress={handleTagPress}
            onMentionPress={handleMentionPress}
            onStreamPress={handleStreamPress}
            onToggleComplete={handleToggleComplete}
            onMove={handleMove}
            onCopy={handleCopy}
            onDelete={handleDelete}
            onPin={handlePin}
          />
        </div>

        {/* Floating Action Button */}
        <button
          onClick={handleAddEntry}
          className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-50"
          title="New entry"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Move to Stream Modal */}
      <StreamPickerModal
        visible={showMoveModal}
        onClose={() => {
          setShowMoveModal(false);
          setEntryToMove(null);
        }}
        onSelect={handleMoveSelect}
        currentStreamId={entryToMoveStreamId}
        title="Move to Stream"
      />
    </div>
  );
}
