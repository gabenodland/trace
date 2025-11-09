import { Entry, getPreviewText, formatEntryDate } from "@trace/core";

interface EntryListItemProps {
  entry: Entry;
  onClick: () => void;
}

export function EntryListItem({ entry, onClick }: EntryListItemProps) {
  const preview = getPreviewText(entry.content, 100);
  const dateStr = formatEntryDate(entry.created_at);

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all"
    >
      {/* Title or Preview */}
      {entry.title ? (
        <>
          <h3 className="font-semibold text-gray-900 mb-1">{entry.title}</h3>
          <p className="text-sm text-gray-600 line-clamp-2">{preview}</p>
        </>
      ) : (
        <p className="text-gray-900 line-clamp-3">{preview}</p>
      )}

      {/* Metadata */}
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
        <span>{dateStr}</span>

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
  );
}
