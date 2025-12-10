/**
 * Entry display modes for list views
 */
export type EntryDisplayMode = 'title' | 'smashed' | 'short' | 'flow';

export interface EntryDisplayModeOption {
  value: EntryDisplayMode;
  label: string;
  description: string;
}

export const ENTRY_DISPLAY_MODES: EntryDisplayModeOption[] = [
  {
    value: 'title',
    label: 'Title Only',
    description: 'Minimal - title, date, and attributes only',
  },
  {
    value: 'smashed',
    label: 'Smashed',
    description: 'Compact view - 2 lines max, no formatting',
  },
  {
    value: 'short',
    label: 'Short',
    description: 'Brief view with line breaks',
  },
  {
    value: 'flow',
    label: 'Flow',
    description: 'Full formatted text with all details',
  },
];

export const DEFAULT_DISPLAY_MODE: EntryDisplayMode = 'smashed';
