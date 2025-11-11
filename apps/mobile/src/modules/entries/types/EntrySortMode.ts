/**
 * Entry sort modes for list views
 */
export type EntrySortMode = 'title' | 'category' | 'entry_date' | 'created_date' | 'updated_date' | 'due_date';

export interface EntrySortModeOption {
  value: EntrySortMode;
  label: string;
}

export const ENTRY_SORT_MODES: EntrySortModeOption[] = [
  {
    value: 'updated_date',
    label: 'Last Updated',
  },
  {
    value: 'entry_date',
    label: 'Entry Date',
  },
  {
    value: 'created_date',
    label: 'Created Date',
  },
  {
    value: 'title',
    label: 'Title',
  },
  {
    value: 'category',
    label: 'Category',
  },
  {
    value: 'due_date',
    label: 'Due Date',
  },
];

export const DEFAULT_SORT_MODE: EntrySortMode = 'updated_date';
