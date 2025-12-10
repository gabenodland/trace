import { View, StyleSheet } from "react-native";
import { CaptureForm, type ReturnContext } from "../modules/entries/components/CaptureForm";
import type { CopiedEntryData } from "../modules/entries/mobileEntryHooks";

// Re-export ReturnContext for backwards compatibility
export type { ReturnContext };

interface EntryScreenProps {
  entryId?: string | null;
  initialStreamId?: string | null | "all" | "events" | "streams" | "tags" | "people";
  initialStreamName?: string;
  initialContent?: string;
  initialDate?: string;
  returnContext?: ReturnContext;
  /** Copied entry data - when provided, opens form with pre-filled data (not saved to DB yet) */
  copiedEntryData?: CopiedEntryData;
}

export function EntryScreen({ entryId, initialStreamId, initialStreamName, initialContent, initialDate, returnContext, copiedEntryData }: EntryScreenProps = {}) {
  return (
    <View style={styles.container}>
      <CaptureForm
        entryId={entryId}
        initialStreamId={initialStreamId}
        initialStreamName={initialStreamName}
        initialContent={initialContent}
        initialDate={initialDate}
        returnContext={returnContext}
        copiedEntryData={copiedEntryData}
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
