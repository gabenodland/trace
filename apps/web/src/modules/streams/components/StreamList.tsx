import type { Stream } from "@trace/core";

interface StreamListProps {
  streams: Stream[];
  onStreamPress?: (streamId: string) => void;
  selectedId?: string | null;
}

export function StreamList({ streams, onStreamPress, selectedId }: StreamListProps) {
  if (streams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <p className="text-lg font-semibold mb-2">No streams yet</p>
        <p className="text-sm">Create your first stream to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {streams.map((stream) => (
        <StreamListItem
          key={stream.stream_id}
          stream={stream}
          onPress={onStreamPress}
          isSelected={selectedId === stream.stream_id}
        />
      ))}
    </div>
  );
}

interface StreamListItemProps {
  stream: Stream;
  onPress?: (streamId: string) => void;
  isSelected?: boolean;
}

function StreamListItem({ stream, onPress, isSelected }: StreamListItemProps) {
  return (
    <button
      onClick={() => onPress?.(stream.stream_id)}
      className={`w-full flex items-center gap-2 py-3 px-4 rounded-lg transition-colors ${
        isSelected
          ? "bg-blue-50 text-blue-700 font-semibold"
          : "hover:bg-gray-50 text-gray-700"
      }`}
    >
      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
        />
      </svg>
      <span className="flex-1 text-left">{stream.name}</span>
      {stream.entry_count > 0 && (
        <span className="px-2 py-0.5 text-xs font-semibold bg-gray-200 text-gray-600 rounded-full">
          {stream.entry_count}
        </span>
      )}
    </button>
  );
}
