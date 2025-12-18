import { useState, useRef } from "react";
import type { Entry, EntryDisplayMode, EntryStatus, StreamAttributeVisibility } from "@trace/core";
import {
  formatEntryDate,
  formatEntryDateTime,
  formatEntryDateOnly,
  isTask,
  formatDueDate,
  isTaskOverdue,
  isCompletedStatus,
  getFormattedContent,
  getFirstLineOfText,
  getDisplayModeLines,
} from "@trace/core";

interface EntryListItemProps {
  entry: Entry;
  onClick: () => void;
  displayMode?: EntryDisplayMode;
  streamName?: string | null;
  locationName?: string | null;
  attributeVisibility?: StreamAttributeVisibility;
  // Action callbacks
  onTagPress?: (tag: string) => void;
  onMentionPress?: (mention: string) => void;
  onStreamPress?: (streamId: string | null, streamName: string) => void;
  onToggleComplete?: (entryId: string, currentStatus: EntryStatus) => void;
  onMove?: (entryId: string) => void;
  onCopy?: (entryId: string) => void;
  onDelete?: (entryId: string) => void;
  onPin?: (entryId: string, currentPinned: boolean) => void;
}

// Default visibility when not provided (show everything)
const DEFAULT_VISIBILITY: StreamAttributeVisibility = {
  showStatus: true,
  showType: true,
  showDueDate: true,
  showRating: true,
  showPriority: true,
  showLocation: true,
  showPhotos: true,
  availableTypes: [],
  ratingType: 'stars',
};

export function EntryListItem({
  entry,
  onClick,
  displayMode = "smashed",
  streamName,
  locationName,
  attributeVisibility = DEFAULT_VISIBILITY,
  onTagPress,
  onMentionPress,
  onStreamPress,
  onToggleComplete,
  onMove,
  onCopy,
  onDelete,
  onPin,
}: EntryListItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const formattedContent = getFormattedContent(entry.content, displayMode);
  const maxLines = getDisplayModeLines(displayMode);
  const dateStr = formatEntryDate(entry.updated_at);
  const entryDateStr = formatEntryDateTime(entry.entry_date || entry.updated_at);
  const isATask = attributeVisibility.showStatus && isTask(entry.status);
  const isOverdue = attributeVisibility.showDueDate && isTaskOverdue(entry.status, entry.due_date);
  const dueDateStr = attributeVisibility.showDueDate ? formatDueDate(entry.due_date, entry.status) : null;
  const isCompleted = isCompletedStatus(entry.status);

  // Determine what location text to show
  const hasLocation = entry.entry_latitude || entry.location_id;
  const locationText = locationName || (hasLocation ? "GPS" : null);

  // Handle menu toggle
  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  // Close menu when clicking outside
  const handleMenuClose = () => {
    setShowMenu(false);
  };

  // Menu actions
  const menuItems = [
    {
      label: entry.is_pinned ? "Unpin" : "Pin",
      onClick: () => {
        onPin?.(entry.entry_id, entry.is_pinned);
        setShowMenu(false);
      },
    },
    {
      label: "Move",
      onClick: () => {
        onMove?.(entry.entry_id);
        setShowMenu(false);
      },
    },
    {
      label: "Copy",
      onClick: () => {
        onCopy?.(entry.entry_id);
        setShowMenu(false);
      },
    },
    {
      label: "Delete",
      onClick: () => {
        onDelete?.(entry.entry_id);
        setShowMenu(false);
      },
      danger: true,
    },
  ];

  // Title-only mode: compact single-line layout
  if (displayMode === "title") {
    return (
      <div
        onClick={onClick}
        className={`relative bg-white border rounded-lg px-4 py-2.5 hover:shadow-md cursor-pointer transition-all ${
          isOverdue
            ? "border-red-300 hover:border-red-400 bg-red-50"
            : "border-gray-200 hover:border-blue-400"
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Pin indicator */}
          {entry.is_pinned && (
            <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
            </svg>
          )}

          {/* Title/Content */}
          <span
            className={`flex-1 truncate font-medium text-gray-900 ${
              isCompleted ? "line-through opacity-60" : ""
            }`}
          >
            {entry.title || getFirstLineOfText(entry.content)}
          </span>

          {/* Date */}
          <span className="text-xs text-gray-500 flex-shrink-0">
            {formatEntryDateOnly(entry.entry_date || entry.updated_at)}
          </span>

          {/* Menu Button */}
          <button
            onClick={handleMenuToggle}
            className="p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
              <circle cx={12} cy={6} r={2} />
              <circle cx={12} cy={12} r={2} />
              <circle cx={12} cy={18} r={2} />
            </svg>
          </button>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {/* Stream */}
          {streamName && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStreamPress?.(entry.stream_id || null, streamName || "Unassigned");
              }}
              className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
            >
              {streamName}
            </button>
          )}

          {/* Due date */}
          {dueDateStr && (
            <span
              className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                isOverdue
                  ? "bg-red-100 text-red-700"
                  : dueDateStr === "Today"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-blue-100 text-blue-700"
              }`}
            >
              {dueDateStr}
            </span>
          )}

          {/* Type */}
          {entry.type && (
            <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
              {entry.type}
            </span>
          )}

          {/* Tags (limited) */}
          {entry.tags && entry.tags.length > 0 && (
            <>
              {entry.tags.slice(0, 2).map((tag) => (
                <button
                  key={tag}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagPress?.(tag);
                  }}
                  className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                >
                  #{tag}
                </button>
              ))}
              {entry.tags.length > 2 && (
                <span className="text-xs text-gray-400">+{entry.tags.length - 2}</span>
              )}
            </>
          )}
        </div>

        {/* Dropdown Menu */}
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={handleMenuClose} />
            <div
              ref={menuRef}
              className="absolute right-4 top-10 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]"
            >
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    item.onClick();
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                    item.danger ? "text-red-600 hover:bg-red-50" : "text-gray-700"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  // Other display modes (smashed, short, flow)
  return (
    <div
      onClick={onClick}
      className={`relative bg-white border rounded-lg p-4 hover:shadow-md cursor-pointer transition-all ${
        isOverdue
          ? "border-red-300 hover:border-red-400 bg-red-50"
          : "border-gray-200 hover:border-blue-400"
      }`}
    >
      {/* Menu Button - Top Right */}
      <button
        onClick={handleMenuToggle}
        className="absolute top-3 right-3 p-1.5 hover:bg-gray-100 rounded transition-colors z-10"
      >
        <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
          <circle cx={12} cy={6} r={2} />
          <circle cx={12} cy={12} r={2} />
          <circle cx={12} cy={18} r={2} />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={handleMenuClose} />
          <div
            ref={menuRef}
            className="absolute right-3 top-12 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px]"
          >
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={(e) => {
                  e.stopPropagation();
                  item.onClick();
                }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                  item.danger ? "text-red-600 hover:bg-red-50" : "text-gray-700"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}

      <div className="flex items-start gap-3">
        {/* Task Checkbox */}
        {isATask && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete?.(entry.entry_id, entry.status);
            }}
            className={`mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
              isCompleted
                ? "bg-green-500 border-green-500"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            {isCompleted && (
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0 pr-8">
          {/* Pin indicator */}
          {entry.is_pinned && (
            <div className="flex items-center gap-1 text-blue-500 text-xs mb-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 9V4h1c.55 0 1-.45 1-1s-.45-1-1-1H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3z" />
              </svg>
              <span>Pinned</span>
            </div>
          )}

          {/* Title or Preview */}
          {entry.title ? (
            <>
              <h3
                className={`font-semibold text-gray-900 mb-1 ${
                  isCompleted ? "line-through opacity-60" : ""
                }`}
              >
                {entry.title}
              </h3>

              {/* Entry date for flow mode */}
              {displayMode === "flow" && (
                <p className="text-xs text-gray-500 mb-2">{entryDateStr}</p>
              )}

              {/* Content */}
              {displayMode === "flow" ? (
                <div
                  className={`prose prose-sm max-w-none ${
                    isCompleted ? "line-through opacity-60" : ""
                  }`}
                  dangerouslySetInnerHTML={{ __html: entry.content }}
                />
              ) : (
                <p
                  className={`text-sm text-gray-600 ${
                    isCompleted ? "line-through opacity-60" : ""
                  }`}
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: maxLines,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {formattedContent}
                </p>
              )}
            </>
          ) : (
            <>
              {/* Entry date for flow mode */}
              {displayMode === "flow" && (
                <p className="text-xs text-gray-500 mb-2">{entryDateStr}</p>
              )}

              {displayMode === "flow" ? (
                <div
                  className={`prose prose-sm max-w-none ${
                    isCompleted ? "line-through opacity-60" : ""
                  }`}
                  dangerouslySetInnerHTML={{ __html: entry.content }}
                />
              ) : (
                <p
                  className={`text-gray-900 ${
                    isCompleted ? "line-through opacity-60" : ""
                  }`}
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: maxLines,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {formattedContent}
                </p>
              )}
            </>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 flex-wrap">
            <span>{dateStr}</span>

            {/* Stream badge */}
            {streamName && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onStreamPress?.(entry.stream_id || null, streamName || "Unassigned");
                }}
                className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 transition-colors"
              >
                {streamName}
              </button>
            )}

            {/* Due Date Badge */}
            {dueDateStr && (
              <span
                className={`px-2 py-0.5 rounded-full font-medium ${
                  isOverdue
                    ? "bg-red-100 text-red-700"
                    : dueDateStr === "Today"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-blue-100 text-blue-700"
                }`}
              >
                {dueDateStr}
              </span>
            )}

            {/* Type */}
            {attributeVisibility.showType && entry.type && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                {entry.type}
              </span>
            )}

            {/* Priority */}
            {attributeVisibility.showPriority && entry.priority > 0 && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                P{entry.priority}
              </span>
            )}

            {/* Rating */}
            {attributeVisibility.showRating && entry.rating > 0 && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {entry.rating.toFixed(1)}
              </span>
            )}

            {/* Tags */}
            {entry.tags && entry.tags.length > 0 && (
              <div className="flex gap-1">
                {entry.tags.slice(0, 3).map((tag) => (
                  <button
                    key={tag}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagPress?.(tag);
                    }}
                    className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                  >
                    #{tag}
                  </button>
                ))}
                {entry.tags.length > 3 && (
                  <span className="text-gray-400">+{entry.tags.length - 3}</span>
                )}
              </div>
            )}

            {/* Mentions */}
            {entry.mentions && entry.mentions.length > 0 && (
              <div className="flex gap-1">
                {entry.mentions.slice(0, 3).map((mention) => (
                  <button
                    key={mention}
                    onClick={(e) => {
                      e.stopPropagation();
                      onMentionPress?.(mention);
                    }}
                    className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full hover:bg-green-200 transition-colors"
                  >
                    @{mention}
                  </button>
                ))}
                {entry.mentions.length > 3 && (
                  <span className="text-gray-400">+{entry.mentions.length - 3}</span>
                )}
              </div>
            )}

            {/* Location indicator */}
            {attributeVisibility.showLocation && locationText && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full">
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
                {locationText}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
