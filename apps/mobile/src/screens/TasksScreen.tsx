import { useState, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { type Entry, isTaskOverdue, isDueToday, isDueThisWeek, getTaskStats } from "@trace/core";
import { useEntries } from "../modules/entries/mobileEntryHooks";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { TopBar } from "../components/layout/TopBar";
import { EntryListItem } from "../modules/entries/components/EntryListItem";
import { FloatingActionButton } from "../components/buttons/FloatingActionButton";

type TaskFilter = "all" | "incomplete" | "in_progress" | "complete";
type TaskGroup = {
  title: string;
  entries: Entry[];
};

export function TasksScreen() {
  const { navigate } = useNavigation();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const { entries, isLoading, entryMutations } = useEntries();
  const [filter, setFilter] = useState<TaskFilter>("incomplete");


  // Filter entries to only tasks (any entry with a task status)
  const tasks = useMemo(() => {
    return entries.filter(entry =>
      entry.status === "incomplete" ||
      entry.status === "in_progress" ||
      entry.status === "complete"
    );
  }, [entries]);

  // Get task statistics
  const stats = getTaskStats(tasks);

  // Filter tasks based on selected filter
  const filteredTasks = useMemo(() => {
    switch (filter) {
      case "incomplete":
        return tasks.filter(t => t.status === "incomplete");
      case "in_progress":
        return tasks.filter(t => t.status === "in_progress");
      case "complete":
        return tasks.filter(t => t.status === "complete");
      default:
        return tasks;
    }
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
      groups.push({ title: "Overdue", entries: overdue });
    }
    if (today.length > 0) {
      groups.push({ title: "Today", entries: today });
    }
    if (thisWeek.length > 0) {
      groups.push({ title: "This Week", entries: thisWeek });
    }
    if (noDueDate.length > 0) {
      groups.push({ title: "No Due Date", entries: noDueDate });
    }
    if (completed.length > 0 && filter === "complete") {
      groups.push({ title: "Completed", entries: completed });
    }

    return groups;
  }, [filteredTasks, filter]);

  // Handle task completion toggle (cycles through: incomplete -> in_progress -> complete -> incomplete)
  const handleToggleComplete = async (entryId: string, currentStatus: "incomplete" | "in_progress" | "complete") => {
    try {
      // Cycle through statuses
      let newStatus: "incomplete" | "in_progress" | "complete";
      if (currentStatus === "incomplete") {
        newStatus = "in_progress";
      } else if (currentStatus === "in_progress") {
        newStatus = "complete";
      } else {
        newStatus = "incomplete";
      }

      await entryMutations.updateEntry(entryId, {
        status: newStatus,
        // Set completed_at only when status is complete
        completed_at: newStatus === "complete" ? new Date().toISOString() : null,
      });
    } catch (error) {
      console.error("Failed to toggle task:", error);
    }
  };

  const handleAddEntry = () => {
    navigate("capture", {
      returnContext: {
        screen: "tasks",
        taskFilter: filter
      }
    });
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <TopBar
          title="Tasks"
          badge={stats.incomplete + stats.inProgress}
          menuItems={menuItems}
          userEmail={userEmail}
          onProfilePress={onProfilePress}
        />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading tasks...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopBar
        title="Tasks"
        badge={stats.incomplete + stats.inProgress}
        menuItems={menuItems}
        userEmail={userEmail}
        onProfilePress={onProfilePress}
      />

      <ScrollView style={styles.content}>
        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterTab, filter === "incomplete" && styles.filterTabActive]}
            onPress={() => setFilter("incomplete")}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, filter === "incomplete" && styles.filterTabTextActive]} numberOfLines={1}>
              Not Started
            </Text>
            <Text style={[styles.filterTabCount, filter === "incomplete" && styles.filterTabCountActive]}>
              {stats.incomplete}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filter === "in_progress" && styles.filterTabActive]}
            onPress={() => setFilter("in_progress")}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, filter === "in_progress" && styles.filterTabTextActive]} numberOfLines={1}>
              In Progress
            </Text>
            <Text style={[styles.filterTabCount, filter === "in_progress" && styles.filterTabCountActive]}>
              {stats.inProgress}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filter === "complete" && styles.filterTabActive]}
            onPress={() => setFilter("complete")}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterTabText, filter === "complete" && styles.filterTabTextActive]} numberOfLines={1}>
              Complete
            </Text>
            <Text style={[styles.filterTabCount, filter === "complete" && styles.filterTabCountActive]}>
              {stats.complete}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Task Groups or Empty State */}
        {taskGroups.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✓</Text>
            <Text style={styles.emptyTitle}>No tasks yet</Text>
            <Text style={styles.emptyDescription}>
              Create a new entry and mark it as a task to get started
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => navigate("capture")}
              activeOpacity={0.7}
            >
              <Text style={styles.emptyButtonText}>Create Task</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.groupsContainer}>
            {taskGroups.map((group) => (
              <View key={group.title} style={styles.group}>
                {/* Group Header */}
                <View style={styles.groupHeader}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  <Text style={styles.groupCount}>({group.entries.length})</Text>
                </View>

                {/* Group Entries */}
                {group.entries.map((entry) => (
                  <EntryListItem
                    key={entry.entry_id}
                    entry={entry}
                    onPress={() => navigate("capture", {
                      entryId: entry.entry_id,
                      returnContext: {
                        screen: "tasks",
                        taskFilter: filter
                      }
                    })}
                    onToggleComplete={handleToggleComplete}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <FloatingActionButton onPress={handleAddEntry} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
  },
  filterContainer: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginBottom: 20,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  filterTabActive: {
    borderBottomColor: "#3b82f6",
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6b7280",
  },
  filterTabTextActive: {
    color: "#3b82f6",
    fontWeight: "600",
  },
  filterTabCount: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9ca3af",
    marginTop: 2,
  },
  filterTabCountActive: {
    color: "#3b82f6",
  },
  groupsContainer: {
    paddingBottom: 20,
  },
  group: {
    marginBottom: 24,
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  groupCount: {
    fontSize: 14,
    color: "#6b7280",
    marginLeft: 8,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});
