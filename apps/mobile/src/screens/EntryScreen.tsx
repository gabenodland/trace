import { View, StyleSheet } from "react-native";
import { CaptureForm, type ReturnContext } from "../modules/entries/components/CaptureForm";
import { type Location as LocationType } from "@trace/core";

// Re-export ReturnContext for backwards compatibility
export type { ReturnContext };

interface EntryScreenProps {
  entryId?: string | null;
  initialCategoryId?: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people";
  initialCategoryName?: string;
  initialContent?: string;
  initialDate?: string;
  initialLocation?: LocationType;
  returnContext?: ReturnContext;
}

export function EntryScreen({ entryId, initialCategoryId, initialCategoryName, initialContent, initialDate, initialLocation, returnContext }: EntryScreenProps = {}) {
  return (
    <View style={styles.container}>
      <CaptureForm
        entryId={entryId}
        initialCategoryId={initialCategoryId}
        initialCategoryName={initialCategoryName}
        initialContent={initialContent}
        initialDate={initialDate}
        initialLocation={initialLocation}
        returnContext={returnContext}
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
