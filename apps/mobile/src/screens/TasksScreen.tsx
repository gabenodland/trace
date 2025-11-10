import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useAuthState } from "@trace/core";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { TopBar } from "../components/layout/TopBar";

export function TasksScreen() {
  const { signOut } = useAuthState();
  const { navigate } = useNavigation();

  const menuItems = [
    { label: "Inbox", onPress: () => navigate("inbox") },
    { label: "Categories", onPress: () => navigate("categories") },
    { label: "Calendar", onPress: () => navigate("calendar") },
    { label: "Tasks", onPress: () => navigate("tasks") },
    { label: "Sign Out", onPress: signOut },
  ];

  return (
    <View style={styles.container}>
      <TopBar
        title="Tasks"
        badge={0}
        menuItems={menuItems}
      />
      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Task Management</Text>
          <Text style={styles.cardDescription}>
            Track and manage all your tasks and to-dos in one place.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Task Features</Text>
          <Text style={styles.cardText}>• Priority levels</Text>
          <Text style={styles.cardText}>• Due dates and reminders</Text>
          <Text style={styles.cardText}>• Subtasks and checklists</Text>
          <Text style={styles.cardText}>• Progress tracking</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>✓</Text>
          <Text style={styles.emptyTitle}>No tasks yet</Text>
          <Text style={styles.emptyDescription}>
            Your tasks will appear here
          </Text>
        </View>
      </ScrollView>
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
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
  },
  cardText: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 24,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
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
  },
});
