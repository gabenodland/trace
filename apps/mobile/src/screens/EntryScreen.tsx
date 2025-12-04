import { View, StyleSheet } from "react-native";
import { CaptureForm, type ReturnContext } from "../modules/entries/components/CaptureForm";
import { type Location as LocationType } from "@trace/core";
import type { CopiedEntryData } from "../modules/entries/mobileEntryHooks";

// Re-export ReturnContext for backwards compatibility
export type { ReturnContext };

interface EntryScreenProps {
  entryId?: string | null;
  initialStreamId?: string | null | "all" | "tasks" | "events" | "streams" | "tags" | "people";
  initialStreamName?: string;
  initialContent?: string;
  initialDate?: string;
  initialLocation?: LocationType;
  returnContext?: ReturnContext;
  /** Copied entry data - when provided, opens form with pre-filled data (not saved to DB yet) */
  copiedEntryData?: CopiedEntryData;
}

export function EntryScreen({ entryId, initialStreamId, initialStreamName, initialContent, initialDate, initialLocation, returnContext, copiedEntryData }: EntryScreenProps = {}) {
  return (
    <View style={styles.container}>
      <CaptureForm
        entryId={entryId}
        initialStreamId={initialStreamId}
        initialStreamName={initialStreamName}
        initialContent={initialContent}
        initialDate={initialDate}
        initialLocation={initialLocation}
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
