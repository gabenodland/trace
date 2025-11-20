/**
 * Entry sort order (ascending/descending) for list views
 */
export type EntrySortOrder = 'asc' | 'desc';

export interface EntrySortOrderOption {
  value: EntrySortOrder;
  label: string;
}

export const ENTRY_SORT_ORDERS: EntrySortOrderOption[] = [
  {
    value: 'desc',
    label: 'Descending',
  },
  {
    value: 'asc',
    label: 'Ascending',
  },
];

export const DEFAULT_SORT_ORDER: EntrySortOrder = 'desc';
