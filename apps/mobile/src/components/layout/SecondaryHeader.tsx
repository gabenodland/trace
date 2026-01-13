/**
 * SecondaryHeader - Header for secondary screens
 *
 * Pattern: [<-] Title [Action?]
 * - Back button on left
 * - Title on left (after back button)
 * - Optional action button on right
 *
 * Uses the same container styling as TopBar for consistency.
 */

import { View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from "react-native";
import Svg, { Path } from "react-native-svg";
import { useNavigation } from "../../shared/contexts/NavigationContext";
import { useTheme } from "../../shared/contexts/ThemeContext";
import type { ReactNode } from "react";

interface SecondaryHeaderProps {
  /** Screen title */
  title: string;
  /** Optional action button (right side) */
  rightAction?: ReactNode;
  /** Custom back handler - defaults to navigate("back") */
  onBack?: () => void;
  /** Children to render in the center (replaces title if provided) */
  children?: ReactNode;
}

export function SecondaryHeader({ title, rightAction, onBack, children }: SecondaryHeaderProps) {
  const { navigate } = useNavigation();
  const theme = useTheme();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("back");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary }]}>
      {/* Left: Back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBack}
        activeOpacity={0.7}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
          <Path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </TouchableOpacity>

      {/* Center: Title or children */}
      <View style={styles.titleContainer}>
        {children || (
          <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]} numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>

      {/* Right: Optional action */}
      <View style={styles.rightSection}>
        {rightAction}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 110,
    paddingTop: Platform.OS === "ios" ? 45 : (StatusBar.currentHeight || 0) + 10,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 8,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  title: {
    fontSize: 28,
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
