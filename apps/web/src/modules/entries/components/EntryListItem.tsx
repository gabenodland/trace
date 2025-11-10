import type { Entry } from "@trace/core";
import { getPreviewText, formatEntryDate, isTask, formatDueDate, isTaskOverdue } from "@trace/core";

interface EntryListItemProps {
  entry: Entry;
  onClick: () => void;
  onToggleComplete?: (entryId: string, currentStatus: "incomplete" | "complete") => void;
}

export function EntryListItem({ entry, onClick, onToggleComplete }: EntryListItemProps) {
  const preview = getPreviewText(entry.content, 100);
  const dateStr = formatEntryDate(entry.updated_at);
  const isATask = isTask(entry.status);
  const isOverdue = isTaskOverdue(entry.status, entry.due_date);
  const dueDateStr = formatDueDate(entry.due_date, entry.status);

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleComplete && (entry.status === "incomplete" || entry.status === "complete")) {
      onToggleComplete(entry.entry_id, entry.status);
    }
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-lg p-4 hover:shadow-md cursor-pointer transition-all ${
        isOverdue
          ? "border-red-300 hover:border-red-400 bg-red-50"
          : "border-gray-200 hover:border-blue-400"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Task Checkbox */}
        {isATask && (
          <button
            onClick={handleCheckboxClick}
            className={`mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              entry.status === "complete"
                ? "bg-green-500 border-green-500"
                : "border-gray-300 hover:border-blue-500"
            }`}
          >
            {entry.status === "complete" && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title or Preview */}
          {entry.title ? (
            <>
              <h3 className={`font-semibold text-gray-900 mb-1 ${entry.status === "complete" ? "line-through opacity-60" : ""}`}>
                {entry.title}
              </h3>
              <p className={`text-sm text-gray-600 line-clamp-2 ${entry.status === "complete" ? "line-through opacity-60" : ""}`}>
                {preview}
              </p>
            </>
          ) : (
            <p className={`text-gray-900 line-clamp-3 ${entry.status === "complete" ? "line-through opacity-60" : ""}`}>
              {preview}
            </p>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
            <span>{dateStr}</span>

            {/* Due Date Badge */}
            {dueDateStr && (
              <span
                className={`px-2 py-0.5 rounded-full font-medium ${
                  isOverdue
                    ? "bg-red-100 text-red-700"
                    : entry.due_date && formatDueDate(entry.due_date, entry.status) === "Today"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                📅 {dueDateStr}
              </span>
            )}

            {/* Tags */}
            {entry.tags && entry.tags.length > 0 && (
              <div className="flex gap-1">
                {entry.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
                {entry.tags.length > 3 && (
                  <span className="text-gray-400">+{entry.tags.length - 3}</span>
                )}
              </div>
            )}

            {/* Location indicator */}
            {entry.location_lat && entry.location_lng && (
              <span className="flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                GPS
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
