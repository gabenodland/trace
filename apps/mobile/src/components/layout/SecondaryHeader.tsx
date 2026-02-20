/**
 * SecondaryHeader - Header for secondary screens
 *
 * Pattern:
 *   [<-]  Title                [Action?]
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../../shared/components/Icon";
import { useNavigate } from "../../shared/navigation";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { themeBase } from "../../shared/theme/themeBase";
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
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate("back");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.primary, paddingTop: insets.top + 12 }]}>
      {/* Left: Back button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBack}
        activeOpacity={0.7}
      >
        <Icon name="ArrowLeft" size={24} color={theme.colors.text.primary} />
      </TouchableOpacity>

      {/* Center: Title (or children) */}
      <View style={styles.titleContainer}>
        {children || (
          <Text
            style={[
              styles.title,
              {
                color: theme.colors.text.primary,
                fontFamily: theme.typography.fontFamily.bold,
              },
            ]}
            numberOfLines={1}
          >
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
    paddingHorizontal: themeBase.spacing.xl,
    paddingBottom: themeBase.spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    padding: 12,
    marginLeft: -12,
    marginRight: 4,
  },
  titleContainer: {
    flexDirection: "column",
    justifyContent: "center",
    flex: 1,
  },
  title: {
    fontSize: themeBase.typography.fontSize.xl,
  },
  rightSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
});
