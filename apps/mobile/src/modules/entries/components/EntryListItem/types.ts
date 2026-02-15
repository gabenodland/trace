import type { Entry, EntryStatus, StreamAttributeVisibility, EntryDisplayMode, RatingType } from "@trace/core";
import type { EntryWithRelations } from "../../EntryWithRelationsTypes";

export interface EntryListItemProps {
  entry: EntryWithRelations;
  onPress: () => void;
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
  onStreamPress?: (streamId: string | null, streamName: string) => void;
  onToggleComplete?: (entryId: string, currentStatus: EntryStatus) => void;
  onMove?: (entryId: string) => void;
  onCopy?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  onPin?: (entryId: string, currentPinned: boolean) => void;
  onArchive?: (entryId: string, currentArchived: boolean) => void; // Archive/unarchive entry
  onSelectOnMap?: (entryId: string) => void; // Select entry on map (MapScreen only)
  streamName?: string | null; // Stream name to display
  locationName?: string | null; // Location name to display
  currentStreamId?: string | null; // ID of the stream being viewed (to hide redundant stream badge)
  displayMode?: EntryDisplayMode; // Display mode for content rendering
  showMenu?: boolean; // Whether menu is shown for this entry
  onMenuToggle?: () => void; // Toggle menu visibility
  /** Attribute visibility settings from stream - if not provided, all attributes show */
  attributeVisibility?: StreamAttributeVisibility;
}

export interface EntryListItemCommonProps {
  entry: EntryWithRelations;
  streamName?: string | null;
  locationName?: string | null;
  currentStreamId?: string | null; // ID of the stream being viewed (to hide redundant stream badge)
  showMenu: boolean;
  onMenuToggle?: () => void;
  onSelectOnMap?: (entryId: string) => void;
  onStreamPress?: (streamId: string | null, streamName: string) => void;
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
  onToggleComplete?: (entryId: string, currentStatus: EntryStatus) => void;
  onMove?: (entryId: string) => void;
  onCopy?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  onPin?: (entryId: string, currentPinned: boolean) => void;
  onArchive?: (entryId: string, currentArchived: boolean) => void;
  // Attribute visibility
  showStatus: boolean;
  showType: boolean;
  showDueDate: boolean;
  showRating: boolean;
  showPriority: boolean;
  showLocation: boolean;
  ratingType: RatingType;
  // Formatted data
  entryDateStr: string;
  updatedDateStr: string;
  dueDateStr: string | null;
  isATask: boolean;
  isOverdue: boolean;
}
