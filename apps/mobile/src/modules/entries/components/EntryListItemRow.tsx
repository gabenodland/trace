import { memo } from "react";
import type { Stream, EntryDisplayMode } from "@trace/core";
import { getStreamAttributeVisibility } from "@trace/core";
import type { EntryWithRelations } from "../EntryWithRelationsTypes";
import { EntryListItem } from "./EntryListItem";

interface EntryListItemRowProps {
  entry: EntryWithRelations;
  onEntryPress: (entryId: string) => void;
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
  onStreamPress?: (streamId: string | null, streamName: string) => void;
  onMove?: (entryId: string) => void;
  onCopy?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  onPin?: (entryId: string, currentPinned: boolean) => void;
  onArchive?: (entryId: string, currentArchived: boolean) => void;
  onSelectOnMap?: (entryId: string) => void;
  selectedEntryId?: string | null;
  streamMap?: Record<string, string> | null;
  locationMap?: Record<string, string> | null;
  streamById?: Record<string, Stream> | null;
  currentStreamId?: string | null;
  displayMode?: EntryDisplayMode;
  showMenu: boolean;
  onMenuToggle: () => void;
}

/**
 * Shared entry row renderer used by both EntryList (FlatList) and
 * EntryListContent (non-scrolling). Handles attribute visibility
 * computation and name lookups from maps.
 */
export const EntryListItemRow = memo(function EntryListItemRow({
  entry,
  onEntryPress,
  onTagPress,
  onMentionPress,
  onStreamPress,
  onMove,
  onCopy,
  onDelete,
  onPin,
  onArchive,
  onSelectOnMap,
  selectedEntryId,
  streamMap,
  locationMap,
  streamById,
  currentStreamId,
  displayMode,
  showMenu,
  onMenuToggle,
}: EntryListItemRowProps) {
  const stream = entry.stream_id && streamById ? streamById[entry.stream_id] : null;
  const attributeVisibility = getStreamAttributeVisibility(stream);

  return (
    <EntryListItem
      entry={entry}
      onPress={() => onEntryPress(entry.entry_id)}
      onTagPress={onTagPress}
      onMentionPress={onMentionPress}
      onStreamPress={onStreamPress}
      onMove={onMove}
      onCopy={onCopy}
      onDelete={onDelete}
      onPin={onPin}
      onArchive={onArchive}
      onSelectOnMap={onSelectOnMap}
      selectedEntryId={selectedEntryId}
      streamName={entry.stream_id && streamMap ? streamMap[entry.stream_id] : null}
      locationName={entry.location_id && locationMap ? locationMap[entry.location_id] : null}
      currentStreamId={currentStreamId}
      displayMode={displayMode}
      showMenu={showMenu}
      onMenuToggle={onMenuToggle}
      attributeVisibility={attributeVisibility}
    />
  );
});
