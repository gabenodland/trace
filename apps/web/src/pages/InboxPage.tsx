import { useNavigate } from "react-router-dom";
import { useEntries } from "@trace/core";
import { EntryList } from "../modules/entries/components/EntryList";

export function InboxPage() {
  const navigate = useNavigate();
  const { entries, isLoading } = useEntries({ category_id: null });

  const handleEntryClick = (entryId: string) => {
    navigate(`/entry/${entryId}`);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inbox</h1>
          <p className="text-gray-600 mt-1">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </p>
        </div>
      </div>

      <EntryList
        entries={entries}
        isLoading={isLoading}
        onEntryClick={handleEntryClick}
      />
    </div>
  );
}
