import { View, StyleSheet } from "react-native";
import { ScreenHeader } from "../components/navigation/ScreenHeader";
import { CaptureForm } from "../modules/entries/components/CaptureForm";

export function CaptureScreen() {
  return (
    <View style={styles.container}>
      <ScreenHeader title="Capture" />
      <View style={styles.content}>
        <CaptureForm />
      </View>
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
  },
});
