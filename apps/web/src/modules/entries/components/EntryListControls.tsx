/**
 * Entry list controls: Display mode, Sort mode, Group mode, and Search
 */
import { useState } from "react";
import type {
  EntryDisplayMode,
  EntrySortMode,
  EntrySortOrder,
  EntryGroupMode,
} from "@trace/core";
import {
  ENTRY_DISPLAY_MODES,
  ENTRY_SORT_MODES,
  ENTRY_GROUP_MODES,
} from "@trace/core";

interface EntryListControlsProps {
  displayMode: EntryDisplayMode;
  onDisplayModeChange: (mode: EntryDisplayMode) => void;
  sortMode: EntrySortMode;
  onSortModeChange: (mode: EntrySortMode) => void;
  sortOrder: EntrySortOrder;
  onSortOrderChange: (order: EntrySortOrder) => void;
  groupMode: EntryGroupMode;
  onGroupModeChange: (mode: EntryGroupMode) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  showPinnedFirst?: boolean;
  onShowPinnedFirstChange?: (value: boolean) => void;
}

export function EntryListControls({
  displayMode,
  onDisplayModeChange,
  sortMode,
  onSortModeChange,
  sortOrder,
  onSortOrderChange,
  groupMode,
  onGroupModeChange,
  searchQuery,
  onSearchQueryChange,
  showPinnedFirst,
  onShowPinnedFirstChange,
}: EntryListControlsProps) {
  const [showDisplayDropdown, setShowDisplayDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);

  const currentDisplayLabel = ENTRY_DISPLAY_MODES.find(
    (m) => m.value === displayMode
  )?.label;
  const currentSortLabel = ENTRY_SORT_MODES.find(
    (m) => m.value === sortMode
  )?.label;
  const currentGroupLabel = ENTRY_GROUP_MODES.find(
    (m) => m.value === groupMode
  )?.label;

  return (
    <div className="flex flex-col gap-3 mb-6">
      {/* Search Bar */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search entries..."
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchQueryChange("")}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Display Mode Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowDisplayDropdown(!showDisplayDropdown);
              setShowSortDropdown(false);
              setShowGroupDropdown(false);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 10h16M4 14h16M4 18h16"
              />
            </svg>
            <span>{currentDisplayLabel}</span>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showDisplayDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowDisplayDropdown(false)}
              />
              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[180px]">
                {ENTRY_DISPLAY_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => {
                      onDisplayModeChange(mode.value);
                      setShowDisplayDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between ${
                      displayMode === mode.value ? "bg-blue-50 text-blue-600" : "text-gray-700"
                    }`}
                  >
                    <div>
                      <div className="font-medium">{mode.label}</div>
                      <div className="text-xs text-gray-500">{mode.description}</div>
                    </div>
                    {displayMode === mode.value && (
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sort Mode Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowSortDropdown(!showSortDropdown);
              setShowDisplayDropdown(false);
              setShowGroupDropdown(false);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
              />
            </svg>
            <span>{currentSortLabel}</span>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showSortDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowSortDropdown(false)}
              />
              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[150px]">
                {ENTRY_SORT_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => {
                      onSortModeChange(mode.value);
                      setShowSortDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between ${
                      sortMode === mode.value ? "bg-blue-50 text-blue-600" : "text-gray-700"
                    }`}
                  >
                    <span>{mode.label}</span>
                    {sortMode === mode.value && (
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sort Order Toggle */}
        <button
          onClick={() => onSortOrderChange(sortOrder === "asc" ? "desc" : "asc")}
          className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          title={sortOrder === "asc" ? "Ascending" : "Descending"}
        >
          {sortOrder === "asc" ? (
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          )}
          <span>{sortOrder === "asc" ? "Asc" : "Desc"}</span>
        </button>

        {/* Group Mode Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setShowGroupDropdown(!showGroupDropdown);
              setShowDisplayDropdown(false);
              setShowSortDropdown(false);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            <span>{currentGroupLabel}</span>
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showGroupDropdown && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowGroupDropdown(false)}
              />
              <div className="absolute left-0 top-full mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[150px]">
                {ENTRY_GROUP_MODES.map((mode) => (
                  <button
                    key={mode.value}
                    onClick={() => {
                      onGroupModeChange(mode.value);
                      setShowGroupDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between ${
                      groupMode === mode.value ? "bg-blue-50 text-blue-600" : "text-gray-700"
                    }`}
                  >
                    <span>{mode.label}</span>
                    {groupMode === mode.value && (
                      <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Show Pinned First Checkbox */}
        {onShowPinnedFirstChange && (
          <label className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-gray-50 rounded-lg transition-colors">
            <input
              type="checkbox"
              checked={showPinnedFirst ?? false}
              onChange={(e) => onShowPinnedFirstChange(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-gray-700">Pinned first</span>
          </label>
        )}
      </div>
    </div>
  );
}
