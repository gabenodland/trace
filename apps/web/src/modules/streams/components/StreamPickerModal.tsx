/**
 * StreamPickerModal - Modal dialog for selecting a stream
 * Used for moving entries to a different stream
 */
import { useState } from "react";
import { useStreams } from "@trace/core";

interface StreamPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (streamId: string | null) => void;
  currentStreamId?: string | null;
  title?: string;
}

export function StreamPickerModal({
  visible,
  onClose,
  onSelect,
  currentStreamId,
  title = "Move to Stream",
}: StreamPickerModalProps) {
  const { streams, isLoading } = useStreams();
  const [searchQuery, setSearchQuery] = useState("");

  // Filter streams based on search query
  const filteredStreams = streams.filter((stream) =>
    stream.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (streamId: string | null) => {
    onSelect(streamId);
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
      {/* Modal Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={handleClose}
      />

      {/* Modal Content */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <button
              onClick={handleClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative px-6 py-3 border-b bg-gray-50">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {/* Unassigned Option (No Stream) - Only when not searching */}
            {searchQuery === "" && (
              <>
                <button
                  onClick={() => handleSelect(null)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors mb-2 ${
                    currentStreamId === null
                      ? "bg-blue-50 border-2 border-blue-200"
                      : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className={`w-5 h-5 ${currentStreamId === null ? "text-blue-600" : "text-gray-500"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeDasharray="3 2"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2 17l10 5 10-5" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2 12l10 5 10-5" />
                    </svg>
                    <span className={`font-medium ${currentStreamId === null ? "text-blue-900" : "text-gray-700"}`}>
                      Unassigned
                    </span>
                  </div>
                  {currentStreamId === null && (
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                <div className="h-px bg-gray-200 my-3" />
              </>
            )}

            {/* Streams List */}
            {isLoading ? (
              <div className="flex items-center justify-center gap-3 py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-500">Loading streams...</span>
              </div>
            ) : filteredStreams.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 font-semibold mb-1">
                  {searchQuery ? "No streams found" : "No streams yet"}
                </p>
                <p className="text-sm text-gray-400">
                  {searchQuery ? "Try a different search" : "Create a stream first"}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredStreams.map((stream) => (
                  <button
                    key={stream.stream_id}
                    onClick={() => handleSelect(stream.stream_id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                      currentStreamId === stream.stream_id
                        ? "bg-blue-50 border-2 border-blue-200"
                        : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <svg
                        className={`w-5 h-5 flex-shrink-0 ${
                          currentStreamId === stream.stream_id ? "text-blue-600" : "text-gray-500"
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
                          currentStreamId === stream.stream_id ? "text-blue-900" : "text-gray-700"
                        }`}
                        title={stream.name}
                      >
                        {stream.name}
                      </span>
                    </div>
                    {stream.entry_count > 0 && (
                      <span className="px-2 py-0.5 text-xs font-semibold bg-gray-200 text-gray-600 rounded-full mr-2">
                        {stream.entry_count}
                      </span>
                    )}
                    {currentStreamId === stream.stream_id && (
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer with Cancel button */}
          <div className="px-6 py-4 border-t bg-gray-50 rounded-b-xl">
            <button
              onClick={handleClose}
              className="w-full py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
