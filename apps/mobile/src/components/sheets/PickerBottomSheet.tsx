/**
 * PickerBottomSheet - Standardized picker container using bottom sheet
 *
 * Provides consistent layout for all pickers:
 * - Header with title and close button
 * - Main content area
 * - Optional action buttons at bottom (Save/Remove)
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Svg, { Line } from "react-native-svg";
import { BottomSheet, SheetHeight } from "./BottomSheet";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { themeBase } from "../../shared/theme/themeBase";

export interface PickerAction {
  label: string;
  onPress: () => void;
  variant?: "primary" | "danger";
  /** Icon component to show before label */
  icon?: React.ReactNode;
}

interface PickerBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Height preset - defaults to "auto" */
  height?: SheetHeight;
  /** Primary action button (right side, e.g., "Done", "Save") */
  primaryAction?: PickerAction;
  /** Secondary action button (left side, e.g., "Remove", "Clear") */
  secondaryAction?: PickerAction;
}

export function PickerBottomSheet({
  visible,
  onClose,
  title,
  children,
  height = "auto",
  primaryAction,
  secondaryAction,
}: PickerBottomSheetProps) {
  const dynamicTheme = useTheme();

  const hasActions = primaryAction || secondaryAction;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height={height}
      showGrabber={true}
      swipeToDismiss={true}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text
            style={[
              styles.title,
              {
                fontFamily: dynamicTheme.typography.fontFamily.semibold,
                color: dynamicTheme.colors.text.primary,
              },
            ]}
          >
            {title}
          </Text>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Svg
              width={22}
              height={22}
              viewBox="0 0 24 24"
              fill="none"
              stroke={dynamicTheme.colors.text.secondary}
              strokeWidth={2}
            >
              <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
              <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {children}
        </View>

        {/* Action Buttons */}
        {hasActions && (
          <View style={styles.actions}>
            {secondaryAction && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.secondaryButton,
                  {
                    backgroundColor:
                      secondaryAction.variant === "danger"
                        ? `${dynamicTheme.colors.functional.overdue}15`
                        : dynamicTheme.colors.background.secondary,
                  },
                ]}
                onPress={secondaryAction.onPress}
              >
                {secondaryAction.icon}
                <Text
                  style={[
                    styles.actionButtonText,
                    {
                      fontFamily: dynamicTheme.typography.fontFamily.medium,
                      color:
                        secondaryAction.variant === "danger"
                          ? dynamicTheme.colors.functional.overdue
                          : dynamicTheme.colors.text.primary,
                    },
                  ]}
                >
                  {secondaryAction.label}
                </Text>
              </TouchableOpacity>
            )}
            {primaryAction && (
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.primaryButton,
                  { backgroundColor: dynamicTheme.colors.text.primary },
                  !secondaryAction && styles.fullWidthButton,
                ]}
                onPress={primaryAction.onPress}
              >
                {primaryAction.icon}
                <Text
                  style={[
                    styles.actionButtonText,
                    {
                      fontFamily: dynamicTheme.typography.fontFamily.medium,
                      color: dynamicTheme.colors.background.primary,
                    },
                  ]}
                >
                  {primaryAction.label}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

/** Helper to create a danger/remove icon for secondary actions */
export function RemoveIcon({ color }: { color: string }) {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
    >
      <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
      <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: themeBase.spacing.lg,
    paddingBottom: themeBase.spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: themeBase.spacing.md,
  },
  title: {
    fontSize: 18,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: themeBase.spacing.sm,
    marginTop: themeBase.spacing.lg,
    paddingTop: themeBase.spacing.md,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
    gap: themeBase.spacing.sm,
  },
  primaryButton: {},
  secondaryButton: {},
  fullWidthButton: {
    flex: 1,
  },
  actionButtonText: {
    fontSize: 16,
  },
});
