import { useMemo } from "react";
import type { Entry, EntryDisplayMode, EntrySection, EntryStatus, Stream } from "@trace/core";
import { getStreamAttributeVisibility } from "@trace/core";
import { EntryListItem } from "./EntryListItem";

interface EntryListProps {
  entries: Entry[];
  isLoading: boolean;
  onEntryClick: (entryId: string) => void;
  displayMode?: EntryDisplayMode;
  streamMap?: Record<string, string>;
  locationMap?: Record<string, string>;
  fullStreams?: Stream[];
  sections?: EntrySection[];
  // Action callbacks
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
  onStreamPress?: (streamId: string | null, streamName: string) => void;
  onToggleComplete?: (entryId: string, currentStatus: EntryStatus) => void;
  onMove?: (entryId: string) => void;
  onCopy?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  onPin?: (entryId: string, currentPinned: boolean) => void;
}

export function EntryList({
  entries,
  isLoading,
  onEntryClick,
  displayMode = "smashed",
  streamMap,
  locationMap,
  fullStreams,
  sections,
  onTagPress,
  onMentionPress,
  onStreamPress,
  onToggleComplete,
  onMove,
  onCopy,
  onDelete,
  onPin,
}: EntryListProps) {
  // Build stream by ID map for attribute visibility
  const streamById = useMemo(() => {
    if (!fullStreams) return {};
    const map: Record<string, Stream> = {};
    for (const stream of fullStreams) {
      map[stream.stream_id] = stream;
    }
    return map;
  }, [fullStreams]);

  // Helper to get location name for an entry
  const getLocationName = (entry: Entry): string | null => {
    if (entry.location_id && locationMap) {
      return locationMap[entry.location_id] || null;
    }
    return null;
  };

  // Helper to get attribute visibility for an entry
  const getAttributeVisibility = (entry: Entry) => {
    const stream = entry.stream_id ? streamById[entry.stream_id] : null;
    return getStreamAttributeVisibility(stream);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const isEmpty = sections ? sections.every((s) => s.data.length === 0) : entries.length === 0;

  if (isEmpty) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No entries yet</p>
        <p className="text-gray-400 text-sm mt-2">
          Capture your first thought, idea, or task!
        </p>
      </div>
    );
  }

  // Render grouped sections
  if (sections) {
    return (
      <div className="space-y-6">
        {sections.map((section) => {
          if (section.data.length === 0) return null;

          return (
            <div key={section.title || "ungrouped"}>
              {/* Section header (skip if empty title) */}
              {section.title && (
                <div className="flex items-center gap-3 mb-3">
                  <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    {section.title}
                  </h2>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {section.count}
                  </span>
                </div>
              )}

              {/* Section entries */}
              <div className="space-y-3">
                {section.data.map((entry) => (
                  <EntryListItem
                    key={entry.entry_id}
                    entry={entry}
                    onClick={() => onEntryClick(entry.entry_id)}
                    displayMode={displayMode}
                    streamName={entry.stream_id && streamMap ? streamMap[entry.stream_id] : null}
                    locationName={getLocationName(entry)}
                    attributeVisibility={getAttributeVisibility(entry)}
                    onTagPress={onTagPress}
                    onMentionPress={onMentionPress}
                    onStreamPress={onStreamPress}
                    onToggleComplete={onToggleComplete}
                    onMove={onMove}
                    onCopy={onCopy}
                    onDelete={onDelete}
                    onPin={onPin}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Render flat list (no grouping)
  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <EntryListItem
          key={entry.entry_id}
          entry={entry}
          onClick={() => onEntryClick(entry.entry_id)}
          displayMode={displayMode}
          streamName={entry.stream_id && streamMap ? streamMap[entry.stream_id] : null}
          locationName={getLocationName(entry)}
          attributeVisibility={getAttributeVisibility(entry)}
          onTagPress={onTagPress}
          onMentionPress={onMentionPress}
          onStreamPress={onStreamPress}
          onToggleComplete={onToggleComplete}
          onMove={onMove}
          onCopy={onCopy}
          onDelete={onDelete}
          onPin={onPin}
        />
      ))}
    </div>
  );
}
