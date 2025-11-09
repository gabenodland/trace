import { View, StyleSheet } from "react-native";
import { CaptureForm } from "../modules/entries/components/CaptureForm";

export function CaptureScreen() {
  return (
    <View style={styles.container}>
      <CaptureForm />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
});
