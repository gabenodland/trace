import { memo, useCallback } from "react";
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
  /** Pass the ID instead of a derived boolean so renderItem doesn't depend on it */
  openMenuEntryId?: string | null;
  onMenuToggle: (entryId: string) => void;
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
  openMenuEntryId,
  onMenuToggle,
}: EntryListItemRowProps) {
  const showMenu = openMenuEntryId === entry.entry_id;
  const stream = entry.stream_id && streamById ? streamById[entry.stream_id] : null;
  const attributeVisibility = getStreamAttributeVisibility(stream);

  const handlePress = useCallback(() => onEntryPress(entry.entry_id), [onEntryPress, entry.entry_id]);
  const handleMenuToggle = useCallback(() => onMenuToggle(entry.entry_id), [onMenuToggle, entry.entry_id]);

  return (
    <EntryListItem
      entry={entry}
      onPress={handlePress}
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
      streamIcon={stream?.icon ?? null}
      streamColor={stream?.color ?? null}
      locationName={entry.location_id && locationMap ? locationMap[entry.location_id] : null}
      currentStreamId={currentStreamId}
      displayMode={displayMode}
      showMenu={showMenu}
      onMenuToggle={handleMenuToggle}
      attributeVisibility={attributeVisibility}
    />
  );
}, (prev, next) => {
  // Custom comparator: only re-render when showMenu actually changes for THIS row,
  // not when openMenuEntryId changes for a different row
  const prevShowMenu = prev.openMenuEntryId === prev.entry.entry_id;
  const nextShowMenu = next.openMenuEntryId === next.entry.entry_id;
  if (prevShowMenu !== nextShowMenu) return false;

  // Shallow-compare the rest (skip openMenuEntryId since we handled it above)
  if (prev.entry !== next.entry) return false;
  if (prev.onEntryPress !== next.onEntryPress) return false;
  if (prev.onTagPress !== next.onTagPress) return false;
  if (prev.onMentionPress !== next.onMentionPress) return false;
  if (prev.onStreamPress !== next.onStreamPress) return false;
  if (prev.onMove !== next.onMove) return false;
  if (prev.onCopy !== next.onCopy) return false;
  if (prev.onDelete !== next.onDelete) return false;
  if (prev.onPin !== next.onPin) return false;
  if (prev.onArchive !== next.onArchive) return false;
  if (prev.onSelectOnMap !== next.onSelectOnMap) return false;
  if (prev.selectedEntryId !== next.selectedEntryId) return false;
  if (prev.streamMap !== next.streamMap) return false;
  if (prev.locationMap !== next.locationMap) return false;
  if (prev.streamById !== next.streamById) return false;
  if (prev.currentStreamId !== next.currentStreamId) return false;
  if (prev.displayMode !== next.displayMode) return false;
  if (prev.onMenuToggle !== next.onMenuToggle) return false;
  return true;
});
