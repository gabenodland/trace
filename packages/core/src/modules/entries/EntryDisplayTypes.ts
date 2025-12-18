/**
 * Entry display modes for list views
 */
export type EntryDisplayMode = "title" | "smashed" | "short" | "flow";

export interface EntryDisplayModeOption {
  value: EntryDisplayMode;
  label: string;
  description: string;
}

export const ENTRY_DISPLAY_MODES: EntryDisplayModeOption[] = [
  {
    value: "title",
    label: "Title Only",
    description: "Minimal - title, date, and attributes only",
  },
  {
    value: "smashed",
    label: "Smashed",
    description: "Compact view - 2 lines max, no formatting",
  },
  {
    value: "short",
    label: "Short",
    description: "Brief view with line breaks",
  },
  {
    value: "flow",
    label: "Flow",
    description: "Full formatted text with all details",
  },
];

export const DEFAULT_DISPLAY_MODE: EntryDisplayMode = "smashed";

/**
 * Entry sort modes for list views
 */
export type EntrySortMode =
  | "title"
  | "stream"
  | "entry_date"
  | "created_date"
  | "updated_date"
  | "due_date"
  | "priority"
  | "rating"
  | "status"
  | "type";

export interface EntrySortModeOption {
  value: EntrySortMode;
  label: string;
}

export const ENTRY_SORT_MODES: EntrySortModeOption[] = [
  { value: "updated_date", label: "Last Updated" },
  { value: "entry_date", label: "Entry Date" },
  { value: "created_date", label: "Created Date" },
  { value: "title", label: "Title" },
  { value: "stream", label: "Stream" },
  { value: "status", label: "Status" },
  { value: "type", label: "Type" },
  { value: "due_date", label: "Due Date" },
  { value: "priority", label: "Priority" },
  { value: "rating", label: "Rating" },
];

export const DEFAULT_SORT_MODE: EntrySortMode = "updated_date";

/**
 * Sort order for entries
 */
export type EntrySortOrder = "asc" | "desc";

export interface EntrySortOrderOption {
  value: EntrySortOrder;
  label: string;
}

export const ENTRY_SORT_ORDERS: EntrySortOrderOption[] = [
  { value: "desc", label: "Descending" },
  { value: "asc", label: "Ascending" },
];

export const DEFAULT_SORT_ORDER: EntrySortOrder = "desc";

/**
 * Group mode for entries
 */
export type EntryGroupMode = "none" | "status" | "stream" | "type" | "due_date" | "priority" | "rating";

export interface EntryGroupModeOption {
  value: EntryGroupMode;
  label: string;
}

export const ENTRY_GROUP_MODES: EntryGroupModeOption[] = [
  { value: "none", label: "No Grouping" },
  { value: "status", label: "By Status" },
  { value: "stream", label: "By Stream" },
  { value: "type", label: "By Type" },
  { value: "due_date", label: "By Due Date" },
  { value: "priority", label: "By Priority" },
  { value: "rating", label: "By Rating" },
];

export const DEFAULT_GROUP_MODE: EntryGroupMode = "none";
