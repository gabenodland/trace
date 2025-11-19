import { View, StyleSheet } from "react-native";
import { CaptureForm } from "../modules/entries/components/CaptureForm";

export interface ReturnContext {
  screen: "inbox" | "calendar" | "tasks";
  // For inbox
  categoryId?: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people";
  categoryName?: string;
  // For calendar
  selectedDate?: string;
  zoomLevel?: "day" | "week" | "month" | "year";
  // For tasks
  taskFilter?: "all" | "incomplete" | "complete";
}

interface EntryScreenProps {
  entryId?: string | null;
  initialCategoryId?: string | null | "all" | "tasks" | "events" | "categories" | "tags" | "people";
  initialCategoryName?: string;
  initialContent?: string;
  initialDate?: string;
  returnContext?: ReturnContext;
}

export function EntryScreen({ entryId, initialCategoryId, initialCategoryName, initialContent, initialDate, returnContext }: EntryScreenProps = {}) {
  return (
    <View style={styles.container}>
      <CaptureForm
        entryId={entryId}
        initialCategoryId={initialCategoryId}
        initialCategoryName={initialCategoryName}
        initialContent={initialContent}
        initialDate={initialDate}
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
