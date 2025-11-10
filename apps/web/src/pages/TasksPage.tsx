import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useEntries, type Entry, isTaskOverdue, isDueToday, isDueThisWeek, getTaskStats } from "@trace/core";
import { EntryListItem } from "../modules/entries/components/EntryListItem";

type TaskFilter = "all" | "incomplete" | "complete";
type TaskGroup = {
  title: string;
  entries: Entry[];
  color: string;
};

export function TasksPage() {
  const navigate = useNavigate();
  const { entries, isLoading, entryMutations } = useEntries();
  const [filter, setFilter] = useState<TaskFilter>("incomplete");

  // Filter entries to only tasks
  const tasks = useMemo(() => {
    return entries.filter(entry => entry.status === "incomplete" || entry.status === "complete");
  }, [entries]);

  // Get task statistics
  const stats = getTaskStats(tasks);

  // Filter tasks based on selected filter
  const filteredTasks = useMemo(() => {
    if (filter === "incomplete") {
      return tasks.filter(t => t.status === "incomplete");
    } else if (filter === "complete") {
      return tasks.filter(t => t.status === "complete");
    }
    return tasks;
  }, [tasks, filter]);

  // Group tasks by due date
  const taskGroups = useMemo((): TaskGroup[] => {
    const overdue: Entry[] = [];
    const today: Entry[] = [];
    const thisWeek: Entry[] = [];
    const noDueDate: Entry[] = [];
    const completed: Entry[] = [];

    filteredTasks.forEach(task => {
      if (task.status === "complete") {
        completed.push(task);
      } else if (isTaskOverdue(task.status, task.due_date)) {
        overdue.push(task);
      } else if (isDueToday(task.due_date)) {
        today.push(task);
      } else if (isDueThisWeek(task.due_date)) {
        thisWeek.push(task);
      } else {
        noDueDate.push(task);
      }
    });

    const groups: TaskGroup[] = [];

    if (overdue.length > 0) {
      groups.push({ title: "Overdue", entries: overdue, color: "red" });
    }
    if (today.length > 0) {
      groups.push({ title: "Today", entries: today, color: "orange" });
    }
    if (thisWeek.length > 0) {
      groups.push({ title: "This Week", entries: thisWeek, color: "blue" });
    }
    if (noDueDate.length > 0) {
      groups.push({ title: "No Due Date", entries: noDueDate, color: "gray" });
    }
    if (completed.length > 0 && filter !== "incomplete") {
      groups.push({ title: "Completed", entries: completed, color: "green" });
    }

    return groups;
  }, [filteredTasks, filter]);

  // Handle task completion toggle
  const handleToggleComplete = async (entryId: string, currentStatus: "incomplete" | "complete") => {
    try {
      const newStatus = currentStatus === "complete" ? "incomplete" : "complete";
      const entry = entries.find(e => e.entry_id === entryId);
      if (!entry) return;

      await entryMutations.updateEntry(entryId, {
        status: newStatus,
      });
    } catch (error) {
      console.error("Failed to toggle task:", error);
      alert("Failed to update task");
    }
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tasks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Tasks</h1>
        <p className="text-gray-600">
          {stats.total} total • {stats.incomplete} incomplete • {stats.complete} completed
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setFilter("incomplete")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "incomplete"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Active ({stats.incomplete})
        </button>
        <button
          onClick={() => setFilter("complete")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "complete"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          Completed ({stats.complete})
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === "all"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          All ({stats.total})
        </button>
      </div>

      {/* Task Groups */}
      {taskGroups.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-gray-300"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <p className="text-gray-500 text-lg mb-2">No tasks yet</p>
          <p className="text-gray-400 text-sm mb-4">
            Create a new entry and mark it as a task to get started
          </p>
          <button
            onClick={() => navigate("/capture")}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Task
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {taskGroups.map((group) => (
            <div key={group.title}>
              {/* Group Header */}
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  {group.title}
                </h2>
                <span className="text-sm text-gray-500">
                  ({group.entries.length})
                </span>
              </div>

              {/* Group Entries */}
              <div className="space-y-3">
                {group.entries.map((entry) => (
                  <EntryListItem
                    key={entry.entry_id}
                    entry={entry}
                    onClick={() => navigate(`/capture?id=${entry.entry_id}`)}
                    onToggleComplete={handleToggleComplete}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
