import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { useNavigationMenu } from "../shared/hooks/useNavigationMenu";
import { TopBar } from "../components/layout/TopBar";

export function CalendarScreen() {
  const { navigate } = useNavigation();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();


  return (
    <View style={styles.container}>
      <TopBar
        title="Calendar"
        menuItems={menuItems}
        userEmail={userEmail}
        onProfilePress={onProfilePress}
      />
      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Date-Based View</Text>
          <Text style={styles.cardDescription}>
            View your captured items and tasks organized by date.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Calendar Features</Text>
          <Text style={styles.cardText}>• Month, week, and day views</Text>
          <Text style={styles.cardText}>• Scheduled items and deadlines</Text>
          <Text style={styles.cardText}>• Recurring tasks</Text>
          <Text style={styles.cardText}>• Time blocking</Text>
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
});
