import { View, StyleSheet } from "react-native";
import { CaptureForm } from "../modules/entries/components/CaptureForm";

interface CaptureScreenProps {
  entryId?: string | null;
}

export function CaptureScreen({ entryId }: CaptureScreenProps = {}) {
  return (
    <View style={styles.container}>
      <CaptureForm entryId={entryId} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});
