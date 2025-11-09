import { View, StyleSheet } from "react-native";
import { useEntries } from "@trace/core";
import { useNavigation } from "../shared/contexts/NavigationContext";
import { ScreenHeader } from "../components/navigation/ScreenHeader";
import { EntryList } from "../modules/entries/components/EntryList";

export function InboxScreen() {
  const { entries, isLoading } = useEntries({ category_id: null });
  const { navigate } = useNavigation();

  const handleEntryPress = (entryId: string) => {
    navigate("entryEdit", { entryId });
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
