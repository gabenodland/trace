import { View, Text, StyleSheet, ScrollView } from "react-native";
import { ScreenHeader } from "../components/navigation/ScreenHeader";

export function CaptureScreen() {
  return (
    <View style={styles.container}>
      <ScreenHeader title="Capture" />
      <ScrollView style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Entry</Text>
          <Text style={styles.cardDescription}>
            This screen will allow you to quickly capture thoughts, ideas, and tasks.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Features</Text>
          <Text style={styles.cardText}>• Text input with WYSIWYG editor</Text>
          <Text style={styles.cardText}>• Voice-to-text capture</Text>
          <Text style={styles.cardText}>• Quick category assignment</Text>
          <Text style={styles.cardText}>• Media attachments</Text>
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
