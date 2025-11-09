export function TasksPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Tasks</h1>
      <p className="text-gray-600 mb-8">
        View and manage your tasks and to-dos
      </p>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-500 text-center py-8">
          No tasks yet
        </p>
      </div>
    </div>
  );
}
