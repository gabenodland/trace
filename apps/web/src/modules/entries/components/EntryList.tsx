import type { Entry } from "@trace/core";
import { EntryListItem } from "./EntryListItem";

interface EntryListProps {
  entries: Entry[];
  isLoading: boolean;
  onEntryClick: (entryId: string) => void;
}

export function EntryList({ entries, isLoading, onEntryClick }: EntryListProps) {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No entries yet</p>
        <p className="text-gray-400 text-sm mt-2">
          Capture your first thought, idea, or task!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <EntryListItem
          key={entry.entry_id}
          entry={entry}
          onClick={() => onEntryClick(entry.entry_id)}
        />
      ))}
    </div>
  );
}
