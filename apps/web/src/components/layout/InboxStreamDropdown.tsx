import { useState } from "react";
import { useStreams } from "@trace/core";
import { StreamList } from "../../modules/streams/components/StreamList";

interface InboxStreamDropdownProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (streamId: string | null | "all", streamName: string) => void;
  selectedStreamId: string | null | "all";
}

export function InboxStreamDropdown({
  visible,
  onClose,
  onSelect,
  selectedStreamId,
}: InboxStreamDropdownProps) {
  const { streams, isLoading } = useStreams();
  const [searchQuery, setSearchQuery] = useState("");

  // Filter streams based on search query
  const filteredStreams = streams.filter((stream) =>
    stream.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (streamId: string | null | "all", streamName: string) => {
    onSelect(streamId, streamName);
    setSearchQuery("");
    onClose();
  };

  const handleClose = () => {
    setSearchQuery("");
    onClose();
  };

  if (!visible) return null;

  return (
    <>
      {/* Invisible backdrop - click to close */}
      <div className="fixed inset-0 z-40" onClick={handleClose} />

      {/* Dropdown positioned below button */}
      <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col max-h-[500px]">
        {/* Header */}
        <div className="flex items-center justify-end px-4 py-2 border-b">
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
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
        </div>

        {/* Search Input */}
        <div className="relative px-4 py-3 border-b bg-gray-50">
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
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search streams..."
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
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
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Only show special options when not searching */}
          {searchQuery === "" && (
            <>
              {/* Inbox Option (No Stream) */}
              <button
                onClick={() => handleSelect(null, "Inbox")}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors mb-2 ${
                  selectedStreamId === null
                    ? "bg-blue-50 border-2 border-blue-200"
                    : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-5 h-5 ${
                      selectedStreamId === null ? "text-blue-600" : "text-gray-500"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                  <span
                    className={`font-medium ${
                      selectedStreamId === null ? "text-blue-900" : "text-gray-700"
                    }`}
                  >
                    Inbox
                  </span>
                </div>
                {selectedStreamId === null && (
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>

              {/* All Option (Show All Entries) */}
              <button
                onClick={() => handleSelect("all", "All")}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors mb-2 ${
                  selectedStreamId === "all"
                    ? "bg-blue-50 border-2 border-blue-200"
                    : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-5 h-5 ${
                      selectedStreamId === "all" ? "text-blue-600" : "text-gray-500"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 10h16M4 14h16M4 18h16"
                    />
                  </svg>
                  <span
                    className={`font-medium ${
                      selectedStreamId === "all" ? "text-blue-900" : "text-gray-700"
                    }`}
                  >
                    All
                  </span>
                </div>
                {selectedStreamId === "all" && (
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>

              <div className="h-px bg-gray-200 my-3" />
            </>
          )}

          {/* Streams - Flat List */}
          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-sm text-gray-500">Loading streams...</span>
            </div>
          ) : searchQuery === "" ? (
            // Show list when not searching
            filteredStreams.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 font-semibold mb-1">No streams yet</p>
                <p className="text-sm text-gray-400">Create a stream first</p>
              </div>
            ) : (
              <StreamList
                streams={filteredStreams}
                onStreamPress={(streamId) => {
                  const stream = streams.find((s) => s.stream_id === streamId);
                  handleSelect(streamId, stream?.name || "Unknown");
                }}
                selectedId={selectedStreamId === "all" || selectedStreamId === null ? null : selectedStreamId}
              />
            )
          ) : (
            // Show flat list when searching
            filteredStreams.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 font-semibold mb-1">No streams found</p>
                <p className="text-sm text-gray-400">Try a different search</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredStreams.map((stream) => (
                  <button
                    key={stream.stream_id}
                    onClick={() => handleSelect(stream.stream_id, stream.name)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                      selectedStreamId === stream.stream_id
                        ? "bg-blue-50 border-2 border-blue-200"
                        : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <svg
                        className={`w-5 h-5 flex-shrink-0 ${
                          selectedStreamId === stream.stream_id
                            ? "text-blue-600"
                            : "text-gray-500"
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                        />
                      </svg>
                      <span
                        className={`font-medium truncate ${
                          selectedStreamId === stream.stream_id
                            ? "text-blue-900"
                            : "text-gray-700"
                        }`}
                        title={stream.name}
                      >
                        {stream.name}
                      </span>
                    </div>
                    {selectedStreamId === stream.stream_id && (
                      <svg
                        className="w-5 h-5 text-blue-600 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    </>
  );
}
