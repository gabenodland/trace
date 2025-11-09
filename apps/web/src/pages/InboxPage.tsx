export function InboxPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Inbox</h1>
      <p className="text-gray-600 mb-8">
        Uncategorized entries waiting to be processed
      </p>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500 text-center py-8">
          No entries in inbox yet
        </p>
      </div>
    </div>
  );
}
