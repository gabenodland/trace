import { View, StyleSheet } from "react-native";
import { CaptureForm } from "../modules/entries/components/CaptureForm";

interface EntryScreenProps {
  entryId?: string | null;
  initialCategoryId?: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people";
  initialCategoryName?: string;
  initialContent?: string;
}

export function EntryScreen({ entryId, initialCategoryId, initialCategoryName, initialContent }: EntryScreenProps = {}) {
  return (
    <View style={styles.container}>
      <CaptureForm
        entryId={entryId}
        initialCategoryId={initialCategoryId}
        initialCategoryName={initialCategoryName}
        initialContent={initialContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});
