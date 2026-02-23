/**
 * ActionSheet - Bottom action sheet using PickerBottomSheet
 *
 * Reusable action menu with icons, labels, and optional danger items.
 * Uses PickerBottomSheet for consistent header (X close) and swipe-to-dismiss.
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { PickerBottomSheet } from "./PickerBottomSheet";
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
  subtitle?: string;
  /** Warning/info notices shown as a banner above the action items */
  notices?: string[];
}

export function ActionSheet({ visible, onClose, items, title, subtitle, notices }: ActionSheetProps) {
  const theme = useTheme();

  const normalItems = items.filter(item => !item.isDanger);
  const dangerItems = items.filter(item => item.isDanger);

  const handleItemPress = (item: ActionSheetItem) => {
    onClose();
    // Defer action so close animation can start before state changes
    requestAnimationFrame(() => item.onPress());
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title={title || "Actions"}
      subtitle={subtitle}
      height="auto"
      swipeArea="full"
    >
      {/* Notices banner */}
      {notices && notices.length > 0 && (
        <View style={[styles.noticesBanner, { backgroundColor: theme.colors.functional.overdue + '14' }]}>
          <Icon name="AlertCircle" size={16} color={theme.colors.functional.overdue} />
          <View style={styles.noticesTextContainer}>
            {notices.map((notice, i) => (
              <Text
                key={i}
                style={[styles.noticeText, {
                  color: theme.colors.text.primary,
                  fontFamily: theme.typography.fontFamily.regular,
                }]}
              >
                {notice}
              </Text>
            ))}
          </View>
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
              name={item.icon}
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
                  name={item.icon}
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
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: themeBase.spacing.lg,
    gap: themeBase.spacing.md,
  },
  itemLabel: {
    fontSize: themeBase.typography.fontSize.base,
  },
  dangerSection: {
    marginTop: themeBase.spacing.sm,
    borderTopWidth: 1,
  },
  noticesBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  noticesTextContainer: {
    flex: 1,
    gap: 2,
  },
  noticeText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
