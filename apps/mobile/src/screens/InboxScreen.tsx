import { View, StyleSheet, Alert } from "react-native";
import { useEntries } from "@trace/core";
import { ScreenHeader } from "../components/navigation/ScreenHeader";
import { EntryList } from "../modules/entries/components/EntryList";

export function InboxScreen() {
  const { entries, isLoading } = useEntries({ category_id: null });

  const handleEntryPress = (entryId: string) => {
    // TODO: Navigate to entry edit screen when navigation is set up
    Alert.alert("Entry", `Entry ID: ${entryId}\n\nFull navigation coming soon!`);
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Inbox" badge={entries.length} />
      <EntryList
        entries={entries}
        isLoading={isLoading}
        onEntryPress={handleEntryPress}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
});
