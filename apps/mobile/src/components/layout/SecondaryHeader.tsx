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
import { Icon } from "../../shared/components/Icon";
import { useNavigate } from "../../shared/navigation";
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
  const navigate = useNavigate();
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
        <Icon name="ArrowLeft" size={24} color={theme.colors.text.primary} />
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
    height: 116,
    paddingTop: Platform.OS === "ios" ? 60 : (StatusBar.currentHeight || 0) + 16,
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
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
