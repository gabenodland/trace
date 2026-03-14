/**
 * IconPickerModal - Grid picker for stream icons
 *
 * Displays curated Lucide icons grouped by category.
 * Tapping an icon selects it immediately and closes the picker.
 * Supports search filtering and pro/free tiers.
 */

import { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput } from "react-native";
import {
  type StreamIconCategory,
  STREAM_ICON_CATEGORIES,
  filterStreamIcons,
  isProStreamIcon,
  type StreamColorKey,
  isValidStreamColorKey,
} from "@trace/core";
import { Icon, type IconName } from "../../../shared/components";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { useSubscription } from "../../../shared/hooks/useSubscription";
import { PickerBottomSheet, RemoveIcon } from "../../../components/sheets/PickerBottomSheet";

interface IconPickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedIcon: string | null;
  selectedColor: string | null;
  onSave: (icon: string | null) => void;
}

const ICON_SIZE = 22;

export function IconPickerModal({
  visible,
  onClose,
  selectedIcon,
  selectedColor,
  onSave,
}: IconPickerModalProps) {
  const theme = useTheme();
  const { hasFeature } = useSubscription();
  const showProIcons = hasFeature('proStreamIcons');
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (visible) {
      setSearch("");
    }
  }, [visible]);

  const handleRemove = () => {
    onSave(null);
    onClose();
  };

  const tintColor = selectedColor && isValidStreamColorKey(selectedColor)
    ? theme.colors.stream[selectedColor as StreamColorKey]
    : theme.colors.functional.accent;

  // Filtered icons for search mode
  const filteredIcons = useMemo(() => {
    if (!search.trim()) return null;
    return filterStreamIcons(search, showProIcons);
  }, [search, showProIcons]);

  const renderIconCell = (iconName: string, isPro = false) => {
    const isSelected = selectedIcon === iconName;
    const isLocked = isPro && !showProIcons;
    return (
      <TouchableOpacity
        key={iconName}
        style={[
          styles.iconCell,
          { backgroundColor: theme.colors.background.tertiary },
          isSelected && { backgroundColor: tintColor + '20', borderColor: tintColor, borderWidth: 2 },
          isLocked && { opacity: 0.4 },
        ]}
        onPress={() => {
          if (!isLocked) {
            onSave(iconName);
            onClose();
          }
        }}
        activeOpacity={isLocked ? 1 : 0.6}
      >
        <Icon
          name={iconName as IconName}
          size={ICON_SIZE}
          color={isSelected ? tintColor : theme.colors.text.secondary}
        />
        {isLocked && (
          <View style={styles.lockBadge}>
            <Icon name="Lock" size={8} color={theme.colors.text.tertiary} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Choose Icon"
      height="large"
      swipeArea="grabber"
      secondaryAction={
        selectedIcon
          ? {
              label: "Remove Icon",
              variant: "danger",
              icon: <RemoveIcon color={theme.colors.functional.overdue} />,
              onPress: handleRemove,
            }
          : undefined
      }
    >
      {/* Search */}
      <View style={[styles.searchWrapper, { backgroundColor: theme.colors.background.tertiary }]}>
        <Icon name="Search" size={16} color={theme.colors.text.tertiary} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular }]}
          placeholder="Search icons..."
          placeholderTextColor={theme.colors.text.tertiary}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name="X" size={16} color={theme.colors.text.tertiary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {filteredIcons ? (
          // Search results — flat grid
          filteredIcons.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
              No icons match "{search}"
            </Text>
          ) : (
            <View style={styles.iconGrid}>
              {filteredIcons.map((name) => renderIconCell(name, isProStreamIcon(name)))}
            </View>
          )
        ) : (
          // Category sections
          STREAM_ICON_CATEGORIES.map((category: StreamIconCategory) => {
            const hasProIcons = showProIcons && category.proIcons && category.proIcons.length > 0;
            return (
              <View key={category.label} style={styles.categorySection}>
                <Text style={[styles.categoryLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
                  {category.label}
                </Text>
                <View style={styles.iconGrid}>
                  {category.icons.map((name) => renderIconCell(name))}
                  {hasProIcons && category.proIcons!.map((name) => renderIconCell(name))}
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 16,
    height: 40,
  },
  searchInput: {
    flex: 1,
    height: 40,
    fontSize: 15,
    paddingVertical: 0,
    textAlignVertical: "center",
  },
  scrollArea: {
    flex: 1,
  },
  categorySection: {
    marginBottom: 16,
  },
  categoryLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  iconGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  iconCell: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  lockBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
  },
  emptyText: {
    textAlign: "center",
    fontSize: 14,
    paddingVertical: 32,
  },
});
