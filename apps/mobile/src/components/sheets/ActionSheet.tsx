/**
 * ActionSheet - iOS-style bottom action sheet
 *
 * Reusable action sheet wrapping BottomSheet. Shows a list of actions
 * with icons, labels, and an optional danger section + cancel button.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { BottomSheet } from "./BottomSheet";
import { Icon, type IconName } from "../../shared/components";
import { useTheme } from "../../shared/contexts/ThemeContext";
import { themeBase } from "../../shared/theme/themeBase";

export interface ActionSheetItem {
  label: string;
  icon?: IconName;
  onPress: () => void;
  isDanger?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  items: ActionSheetItem[];
  title?: string;
}

export function ActionSheet({ visible, onClose, items, title }: ActionSheetProps) {
  const theme = useTheme();

  const normalItems = items.filter(item => !item.isDanger);
  const dangerItems = items.filter(item => item.isDanger);

  const handleItemPress = (item: ActionSheetItem) => {
    onClose();
    // Defer action so BottomSheet close animation can start before state changes
    requestAnimationFrame(() => item.onPress());
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      height="auto"
      showGrabber={true}
      swipeArea="full"
    >
      <View style={styles.container}>
        {/* Title */}
        {title && (
          <View style={[styles.titleContainer, { borderBottomColor: theme.colors.border.light }]}>
            <Text
              style={[styles.title, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>
        )}

        {/* Normal items */}
        {normalItems.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            style={[
              styles.item,
              index < normalItems.length - 1 && {
                borderBottomWidth: 1,
                borderBottomColor: theme.colors.border.light,
              },
            ]}
            onPress={() => handleItemPress(item)}
            activeOpacity={0.6}
          >
            {item.icon && (
              <Icon
                name={item.icon!}
                size={20}
                color={theme.colors.text.secondary}
              />
            )}
            <Text style={[
              styles.itemLabel,
              {
                color: theme.colors.text.primary,
                fontFamily: theme.typography.fontFamily.semibold,
              },
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Danger items */}
        {dangerItems.length > 0 && (
          <View style={[styles.dangerSection, { borderTopColor: theme.colors.border.medium }]}>
            {dangerItems.map((item) => (
              <TouchableOpacity
                key={item.label}
                style={styles.item}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.6}
              >
                {item.icon && (
                  <Icon
                    name={item.icon!}
                    size={20}
                    color={theme.colors.functional.overdue}
                  />
                )}
                <Text style={[
                  styles.itemLabel,
                  {
                    color: theme.colors.functional.overdue,
                    fontFamily: theme.typography.fontFamily.semibold,
                  },
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Cancel button */}
        <View style={[styles.cancelSection, { borderTopColor: theme.colors.border.medium }]}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.6}
          >
            <Text style={[
              styles.cancelLabel,
              {
                color: theme.colors.text.secondary,
                fontFamily: theme.typography.fontFamily.medium,
              },
            ]}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: themeBase.spacing.lg,
  },
  titleContainer: {
    paddingHorizontal: themeBase.spacing.xl,
    paddingVertical: themeBase.spacing.md,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: themeBase.typography.fontSize.sm,
    textAlign: "center",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: themeBase.spacing.lg,
    paddingHorizontal: themeBase.spacing.xl,
    gap: themeBase.spacing.md,
  },
  itemLabel: {
    fontSize: themeBase.typography.fontSize.base,
  },
  dangerSection: {
    marginTop: themeBase.spacing.sm,
    borderTopWidth: 1,
  },
  cancelSection: {
    marginTop: themeBase.spacing.sm,
    borderTopWidth: 1,
  },
  cancelButton: {
    paddingVertical: themeBase.spacing.lg,
    alignItems: "center",
  },
  cancelLabel: {
    fontSize: themeBase.typography.fontSize.base,
  },
});
