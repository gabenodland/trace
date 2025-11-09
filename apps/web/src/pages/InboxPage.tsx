import { useNavigate, useSearchParams } from "react-router-dom";
import { useEntries, useCategories } from "@trace/core";
import { EntryList } from "../modules/entries/components/EntryList";

export function InboxPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const { categories } = useCategories();

  // Determine filter based on URL parameter
  // - No param = Inbox (category_id: null)
  // - "all" = All entries (no category filter)
  // - specific ID = entries from that category
  let categoryFilter: { category_id?: string | null } = {};

  if (categoryParam === "all") {
    // Don't set category_id - will fetch all entries
  } else if (categoryParam) {
    // Specific category ID
    categoryFilter = { category_id: categoryParam };
  } else {
    // Default: Inbox (uncategorized entries)
    categoryFilter = { category_id: null };
  }

  const { entries, isLoading } = useEntries(categoryFilter);

  const handleEntryClick = (entryId: string) => {
    navigate(`/capture?id=${entryId}`);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-600">
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
