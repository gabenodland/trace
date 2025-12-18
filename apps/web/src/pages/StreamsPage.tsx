import { useState } from "react";
import { useStreams } from "@trace/core";
import { StreamList } from "../modules/streams/components/StreamList";
import { AddStreamModal } from "../modules/streams/components/AddStreamModal";

export function StreamsPage() {
  const { streams, isLoading, streamMutations } = useStreams();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStreamId, setSelectedStreamId] = useState<string | null>(null);

  const handleCreateStream = async (name: string) => {
    await streamMutations.createStream(name);
  };

  const handleStreamPress = (streamId: string) => {
    setSelectedStreamId(streamId === selectedStreamId ? null : streamId);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Streams</h1>
          <p className="text-gray-600">
            Organize your entries with streams
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Stream
        </button>
      </div>

      {/* Stream Count */}
      {streams.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-500">
            {streams.length} {streams.length === 1 ? "stream" : "streams"}
          </p>
        </div>
      )}

      {/* Stream List */}
      <div className="bg-white rounded-lg shadow">
        <StreamList
          streams={streams}
          onStreamPress={handleStreamPress}
          selectedId={selectedStreamId}
        />
      </div>

      {/* Add Stream Modal */}
      <AddStreamModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleCreateStream}
      />
    </div>
  );
}
