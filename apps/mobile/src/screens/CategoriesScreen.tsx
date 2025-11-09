import { View, Text, StyleSheet, ScrollView } from "react-native";
import { ScreenHeader } from "../components/navigation/ScreenHeader";

export function CategoriesScreen() {
  return (
    <View style={styles.container}>
      <ScreenHeader title="Categories" />
      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Organize Your Items</Text>
          <Text style={styles.cardDescription}>
            Create and manage categories to organize your captured items.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Category Features</Text>
          <Text style={styles.cardText}>• Hierarchical category structure</Text>
          <Text style={styles.cardText}>• Custom icons and colors</Text>
          <Text style={styles.cardText}>• Drag and drop organization</Text>
          <Text style={styles.cardText}>• Smart filtering</Text>
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
