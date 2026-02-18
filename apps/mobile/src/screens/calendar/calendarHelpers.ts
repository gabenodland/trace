import type { EntryWithRelations } from "../../modules/entries/EntryWithRelationsTypes";

/** Which date field to use for calendar display */
export type CalendarDateField = 'entry_date' | 'updated_at' | 'due_date';

export interface CalendarDateFieldOption {
  value: CalendarDateField;
  label: string;
}

export const CALENDAR_DATE_FIELDS: CalendarDateFieldOption[] = [
  { value: 'entry_date', label: 'Entry Date' },
  { value: 'updated_at', label: 'Last Updated' },
  { value: 'due_date', label: 'Due Date' },
];

/** Get date from entry based on selected field */
export function getEntryDate(entry: EntryWithRelations, field: CalendarDateField): Date | null {
  switch (field) {
    case 'entry_date':
      return new Date(entry.entry_date || entry.created_at);
    case 'updated_at':
      return new Date(entry.updated_at);
    case 'due_date':
      return entry.due_date ? new Date(entry.due_date) : null;
    default:
      return new Date(entry.entry_date || entry.created_at);
  }
}

/** Format date in YYYY-MM-DD format in local timezone */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
