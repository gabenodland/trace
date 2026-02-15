/**
 * PickerBottomSheet - Standardized picker container using bottom sheet
 *
 * Provides consistent layout for all pickers:
 * - Header with title and close button
 * - Main content area
 * - Optional action buttons at bottom (Save/Remove)
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Icon } from "../../shared/components/Icon";
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
  /** Optional subtitle shown below title (e.g., "125 of 348 entries") */
  subtitle?: string;
  children: React.ReactNode;
  /** Height preset - defaults to "auto" */
  height?: SheetHeight;
  /** Primary action button (right side, e.g., "Done", "Save") */
  primaryAction?: PickerAction;
  /** Secondary action button (left side, e.g., "Remove", "Clear") */
  secondaryAction?: PickerAction;
  /** Dismiss keyboard when opening (default: false for pickers). Set to true to dismiss keyboard */
  dismissKeyboard?: boolean;
  /** Where swipe gesture is active: "grabber" or "full" sheet. Use "grabber" when content has scrollable areas. Default: "full" */
  swipeArea?: "grabber" | "full";
}

export function PickerBottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  height = "auto",
  primaryAction,
  secondaryAction,
  dismissKeyboard = false,
  swipeArea = "full",
}: PickerBottomSheetProps) {
  const dynamicTheme = useTheme();

  const hasActions = primaryAction || secondaryAction;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height={height}
      swipeArea={swipeArea}
      showGrabber={true}
      swipeToDismiss={true}
      dismissKeyboard={dismissKeyboard}
      useModal={true}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
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
            {subtitle && (
              <Text
                style={[
                  styles.subtitle,
                  {
                    fontFamily: dynamicTheme.typography.fontFamily.medium,
                    color: dynamicTheme.colors.interactive.primary,
                  },
                ]}
              >
                {subtitle}
              </Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={onClose}
            hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
          >
            <Icon name="X" size={22} color={dynamicTheme.colors.text.secondary} />
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
    <Icon name="X" size={16} color={color} />
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
  titleContainer: {
    flexDirection: "column",
  },
  title: {
    fontSize: 18,
  },
  subtitle: {
    fontSize: themeBase.typography.fontSize.sm,
    marginTop: 2,
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
