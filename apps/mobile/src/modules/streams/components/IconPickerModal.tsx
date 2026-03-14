/**
 * IconPickerModal - Grid picker for stream icons
 *
 * Displays curated Lucide icons grouped by category.
 * Tapping an icon selects it immediately and closes the picker.
 * Supports search filtering and pro/free tiers.
 *
 * Performance: Categories render progressively (2 per frame) to avoid
 * blocking the JS thread with 91+ SVG components at once.
 */

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import {
  type StreamIconCategory,
  STREAM_ICON_CATEGORIES,
  filterStreamIcons,
  isProStreamIcon,
  type StreamColorKey,
  isValidStreamColorKey,
} from "@trace/core";
import { Icon, type IconName, SearchInput } from "../../../shared/components";
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
/** Number of categories to render per frame during progressive load */
const CATEGORIES_PER_FRAME = 2;

// ── Memoized icon cell ─────────────────────────────────────────────────
interface IconCellProps {
  iconName: string;
  isSelected: boolean;
  isLocked: boolean;
  tintColor: string;
  bgColor: string;
  textColor: string;
  onSelect: (name: string) => void;
}

const IconCell = memo(function IconCell({
  iconName,
  isSelected,
  isLocked,
  tintColor,
  bgColor,
  textColor,
  onSelect,
}: IconCellProps) {
  return (
    <TouchableOpacity
      style={[
        styles.iconCell,
        { backgroundColor: bgColor },
        isSelected && { backgroundColor: tintColor + '20', borderColor: tintColor, borderWidth: 2 },
        isLocked && { opacity: 0.4 },
      ]}
      onPress={() => { if (!isLocked) onSelect(iconName); }}
      activeOpacity={isLocked ? 1 : 0.6}
    >
      <Icon
        name={iconName as IconName}
        size={ICON_SIZE}
        color={isSelected ? tintColor : textColor}
      />
      {isLocked && (
        <View style={styles.lockBadge}>
          <Icon name="Lock" size={8} color={textColor} />
        </View>
      )}
    </TouchableOpacity>
  );
});

// ── Main component ──────────────────────────────────────────────────────
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
  // Progressive rendering: how many categories are visible so far
  const [visibleCount, setVisibleCount] = useState(0);

  // Progressive category reveal — render CATEGORIES_PER_FRAME per animation frame
  useEffect(() => {
    if (!visible) {
      setVisibleCount(0);
      setSearch("");
      return;
    }
    // Start with first batch immediately
    setVisibleCount(CATEGORIES_PER_FRAME);

    let cancelled = false;
    let frame: number;
    let current = CATEGORIES_PER_FRAME;
    const total = STREAM_ICON_CATEGORIES.length;

    const renderNext = () => {
      if (cancelled) return;
      current += CATEGORIES_PER_FRAME;
      if (current >= total) {
        setVisibleCount(total);
        return;
      }
      setVisibleCount(current);
      frame = requestAnimationFrame(renderNext);
    };

    frame = requestAnimationFrame(renderNext);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [visible]);

  const handleRemove = () => {
    onSave(null);
    onClose();
  };

  const handleSelect = useCallback((iconName: string) => {
    onSave(iconName);
    onClose();
  }, [onSave, onClose]);

  const tintColor = selectedColor && isValidStreamColorKey(selectedColor)
    ? theme.colors.stream[selectedColor as StreamColorKey]
    : theme.colors.functional.accent;

  const bgColor = theme.colors.background.tertiary;
  const textColor = theme.colors.text.secondary;

  // Filtered icons for search mode
  const filteredIcons = useMemo(() => {
    if (!search.trim()) return null;
    return filterStreamIcons(search, showProIcons);
  }, [search, showProIcons]);

  const isReady = visibleCount > 0;

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Choose Icon"
      height="full"
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
      <SearchInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search icons..."
        containerStyle={styles.searchWrapper}
      />

      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {filteredIcons ? (
          // Search results — flat grid (all at once, already filtered to a small set)
          filteredIcons.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
              No icons match "{search}"
            </Text>
          ) : (
            <View style={styles.iconGrid}>
              {filteredIcons.map((name) => (
                <IconCell
                  key={name}
                  iconName={name}
                  isSelected={selectedIcon === name}
                  isLocked={isProStreamIcon(name) && !showProIcons}
                  tintColor={tintColor}
                  bgColor={bgColor}
                  textColor={textColor}
                  onSelect={handleSelect}
                />
              ))}
            </View>
          )
        ) : (
          // Category sections — rendered progressively
          STREAM_ICON_CATEGORIES.slice(0, visibleCount).map((category: StreamIconCategory) => {
            const hasProIcons = showProIcons && category.proIcons && category.proIcons.length > 0;
            return (
              <View key={category.label} style={styles.categorySection}>
                <Text style={[styles.categoryLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
                  {category.label}
                </Text>
                <View style={styles.iconGrid}>
                  {category.icons.map((name) => (
                    <IconCell
                      key={name}
                      iconName={name}
                      isSelected={selectedIcon === name}
                      isLocked={false}
                      tintColor={tintColor}
                      bgColor={bgColor}
                      textColor={textColor}
                      onSelect={handleSelect}
                    />
                  ))}
                  {hasProIcons && category.proIcons!.map((name) => (
                    <IconCell
                      key={name}
                      iconName={name}
                      isSelected={selectedIcon === name}
                      isLocked={!showProIcons}
                      tintColor={tintColor}
                      bgColor={bgColor}
                      textColor={textColor}
                      onSelect={handleSelect}
                    />
                  ))}
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
    marginBottom: 16,
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
