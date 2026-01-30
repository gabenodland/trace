/**
 * AttributeGridSheet - Combined attribute editor in a grid layout
 *
 * Allows editing multiple entry attributes from a single sheet:
 * Status, Type, Due Date, Rating, Priority
 *
 * Designed as a 2-column grid with inline editing where possible.
 */

import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import Svg, { Path, Line, Circle } from "react-native-svg";
import { PickerBottomSheet, RemoveIcon } from "../../../../components/sheets";
import { DatePickerSheet } from "../../../../components/sheets/DatePickerSheet";
import { useTheme } from "../../../../shared/contexts/ThemeContext";
import { themeBase } from "../../../../shared/theme/themeBase";
import { StatusIcon } from "../../../../shared/components/StatusIcon";
import {
  type EntryStatus,
  type PriorityCategory,
  ALL_STATUSES,
  ALL_PRIORITIES,
  DEFAULT_STREAM_STATUSES,
  getStatusLabel,
  starsToDecimal,
  decimalToStars,
  getPriorityInfo,
  sortTypes,
} from "@trace/core";

interface AttributeGridSheetProps {
  visible: boolean;
  onClose: () => void;
  // Current values
  status: EntryStatus;
  type: string | null;
  dueDate: string | null;
  rating: number;
  priority: number;
  // Visibility flags from stream config
  showStatus: boolean;
  showType: boolean;
  showDueDate: boolean;
  showRating: boolean;
  showPriority: boolean;
  // Stream configuration
  allowedStatuses?: EntryStatus[];
  availableTypes: string[];
  // Callbacks
  onStatusChange: (status: EntryStatus) => void;
  onTypeChange: (type: string | null) => void;
  onDueDateChange: (dueDate: string | null) => void;
  onRatingChange: (rating: number) => void;
  onPriorityChange: (priority: number) => void;
  onSnackbar: (message: string) => void;
  // Delete action (for editing existing entries)
  onDelete?: () => void;
  isEditing: boolean;
}

export function AttributeGridSheet({
  visible,
  onClose,
  status,
  type,
  dueDate,
  rating,
  priority,
  showStatus,
  showType,
  showDueDate,
  showRating,
  showPriority,
  allowedStatuses,
  availableTypes,
  onStatusChange,
  onTypeChange,
  onDueDateChange,
  onRatingChange,
  onPriorityChange,
  onSnackbar,
  onDelete,
  isEditing,
}: AttributeGridSheetProps) {
  const theme = useTheme();

  // Expanded section state
  const [expandedSection, setExpandedSection] = useState<"status" | "type" | "dueDate" | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Use provided statuses or fall back to defaults
  const statuses = allowedStatuses ?? DEFAULT_STREAM_STATUSES;
  const statusOptions = statuses
    .filter(s => s !== "none")
    .map(s => ALL_STATUSES.find(info => info.value === s))
    .filter((info): info is NonNullable<typeof info> => info !== undefined);

  // Sorted types
  const sortedTypes = sortTypes(availableTypes);

  // Current stars for rating display
  const currentStars = decimalToStars(rating);

  // Priority info
  const currentPriority = ALL_PRIORITIES.find(p => p.value === priority) || ALL_PRIORITIES[4];

  // Toggle section expansion
  const toggleSection = (section: "status" | "type" | "dueDate") => {
    if (section === "dueDate") {
      setShowDatePicker(true);
      return;
    }
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Handle status selection
  const handleStatusSelect = (newStatus: EntryStatus) => {
    onStatusChange(newStatus);
    onSnackbar(`Status: ${getStatusLabel(newStatus)}`);
    setExpandedSection(null);
  };

  // Handle type selection
  const handleTypeSelect = (newType: string | null) => {
    onTypeChange(newType);
    onSnackbar(newType ? `Type: ${newType}` : "Type cleared");
    setExpandedSection(null);
  };

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    onDueDateChange(date.toISOString());
    onSnackbar(`Due: ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`);
    setShowDatePicker(false);
  };

  // Handle rating
  const handleRating = (starValue: number) => {
    const decimalValue = starsToDecimal(starValue);
    onRatingChange(decimalValue);
    onSnackbar(`Rating: ${starValue}/5`);
  };

  // Handle priority
  const handlePriority = (value: number) => {
    onPriorityChange(value);
    const info = ALL_PRIORITIES.find(p => p.value === value);
    onSnackbar(value > 0 && info ? `Priority: ${info.label}` : "Priority cleared");
  };

  // Count visible attributes
  const visibleCount = [showStatus, showType, showDueDate, showRating, showPriority].filter(Boolean).length;

  if (visibleCount === 0) {
    return (
      <PickerBottomSheet
        visible={visible}
        onClose={onClose}
        title="Entry Attributes"
      >
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>
            No attributes enabled for this stream
          </Text>
        </View>
      </PickerBottomSheet>
    );
  }

  return (
    <>
      <PickerBottomSheet
        visible={visible && !showDatePicker}
        onClose={onClose}
        title="Entry Attributes"
        height={0.7}
        secondaryAction={
          isEditing && onDelete
            ? {
                label: "Delete Entry",
                variant: "danger",
                icon: <RemoveIcon color={theme.colors.functional.overdue} />,
                onPress: onDelete,
              }
            : undefined
        }
      >
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
          {/* Status Section */}
          {showStatus && (
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.sectionHeader, { backgroundColor: theme.colors.background.secondary }]}
                onPress={() => toggleSection("status")}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <StatusIcon status={status} size={18} />
                  <Text style={[styles.sectionLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                    Status
                  </Text>
                </View>
                <View style={styles.sectionHeaderRight}>
                  <Text style={[styles.sectionValue, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                    {getStatusLabel(status)}
                  </Text>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                    <Path d={expandedSection === "status" ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
              </TouchableOpacity>

              {expandedSection === "status" && (
                <View style={[styles.expandedContent, { backgroundColor: theme.colors.background.tertiary }]}>
                  {statusOptions.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.option, status === opt.value && styles.optionSelected]}
                      onPress={() => handleStatusSelect(opt.value)}
                    >
                      <StatusIcon status={opt.value} size={16} color={opt.color} />
                      <Text style={[
                        styles.optionText,
                        { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular },
                        status === opt.value && { color: opt.color, fontFamily: theme.typography.fontFamily.semibold }
                      ]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {status !== "none" && statuses.includes("none") && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => handleStatusSelect("none")}
                    >
                      <Text style={[styles.clearText, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.medium }]}>
                        Clear Status
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Type Section */}
          {showType && sortedTypes.length > 0 && (
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.sectionHeader, { backgroundColor: theme.colors.background.secondary }]}
                onPress={() => toggleSection("type")}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
                    <Path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={[styles.sectionLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                    Type
                  </Text>
                </View>
                <View style={styles.sectionHeaderRight}>
                  <Text style={[styles.sectionValue, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                    {type || "None"}
                  </Text>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                    <Path d={expandedSection === "type" ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
              </TouchableOpacity>

              {expandedSection === "type" && (
                <View style={[styles.expandedContent, { backgroundColor: theme.colors.background.tertiary }]}>
                  {sortedTypes.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.option, type === t && styles.optionSelected]}
                      onPress={() => handleTypeSelect(t)}
                    >
                      <Text style={[
                        styles.optionText,
                        { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular },
                        type === t && { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.semibold }
                      ]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {type && (
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => handleTypeSelect(null)}
                    >
                      <Text style={[styles.clearText, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.medium }]}>
                        Clear Type
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Due Date Section */}
          {showDueDate && (
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.sectionHeader, { backgroundColor: theme.colors.background.secondary }]}
                onPress={() => toggleSection("dueDate")}
                activeOpacity={0.7}
              >
                <View style={styles.sectionHeaderLeft}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
                    <Path d="M3 4a2 2 0 012-2h14a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2V4z" strokeLinecap="round" strokeLinejoin="round" />
                    <Line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
                    <Line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
                    <Line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
                  </Svg>
                  <Text style={[styles.sectionLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                    Due Date
                  </Text>
                </View>
                <View style={styles.sectionHeaderRight}>
                  <Text style={[styles.sectionValue, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                    {dueDate ? new Date(dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "None"}
                  </Text>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2}>
                    <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Rating Section - Inline stars */}
          {showRating && (
            <View style={styles.section}>
              <View style={[styles.sectionHeader, { backgroundColor: theme.colors.background.secondary }]}>
                <View style={styles.sectionHeaderLeft}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill={rating > 0 ? theme.colors.status.blocked : "none"} stroke={theme.colors.text.primary} strokeWidth={2}>
                    <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={[styles.sectionLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                    Rating
                  </Text>
                </View>
              </View>
              <View style={[styles.inlineContent, { backgroundColor: theme.colors.background.tertiary }]}>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <TouchableOpacity
                      key={star}
                      style={styles.starButton}
                      onPress={() => handleRating(star)}
                    >
                      <Text style={[
                        styles.starIcon,
                        { color: theme.colors.border.medium },
                        currentStars >= star && { color: theme.colors.status.blocked }
                      ]}>
                        ★
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {rating > 0 && (
                    <TouchableOpacity
                      style={styles.clearStarButton}
                      onPress={() => { onRatingChange(0); onSnackbar("Rating cleared"); }}
                    >
                      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={theme.colors.functional.overdue} strokeWidth={2}>
                        <Line x1={18} y1={6} x2={6} y2={18} strokeLinecap="round" />
                        <Line x1={6} y1={6} x2={18} y2={18} strokeLinecap="round" />
                      </Svg>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          )}

          {/* Priority Section - Inline buttons */}
          {showPriority && (
            <View style={styles.section}>
              <View style={[styles.sectionHeader, { backgroundColor: theme.colors.background.secondary }]}>
                <View style={styles.sectionHeaderLeft}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill={priority > 0 ? theme.colors.priority[currentPriority.category] : "none"} stroke={theme.colors.text.primary} strokeWidth={2}>
                    <Path d="M5 3v18" strokeLinecap="round" />
                    <Path d="M5 3h13l-4 5 4 5H5z" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                  <Text style={[styles.sectionLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                    Priority
                  </Text>
                </View>
              </View>
              <View style={[styles.inlineContent, { backgroundColor: theme.colors.background.tertiary }]}>
                <View style={styles.priorityRow}>
                  {ALL_PRIORITIES.map(p => {
                    const color = theme.colors.priority[p.category as PriorityCategory];
                    const isSelected = priority === p.value;
                    return (
                      <TouchableOpacity
                        key={p.value}
                        style={[
                          styles.priorityButton,
                          { backgroundColor: theme.colors.background.secondary },
                          isSelected && { backgroundColor: color + "30", borderColor: color, borderWidth: 1 }
                        ]}
                        onPress={() => handlePriority(p.value)}
                      >
                        <View style={[styles.priorityDot, { backgroundColor: color }]} />
                        <Text style={[
                          styles.priorityText,
                          { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular },
                          isSelected && { color, fontFamily: theme.typography.fontFamily.semibold }
                        ]}>
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* Bottom padding */}
          <View style={{ height: themeBase.spacing.xl }} />
        </ScrollView>
      </PickerBottomSheet>

      {/* Date Picker (separate sheet) */}
      <DatePickerSheet
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={handleDateSelect}
        value={dueDate ? new Date(dueDate) : null}
        title="Set Due Date"
      />
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: themeBase.spacing.xl,
  },
  emptyText: {
    fontSize: 15,
  },
  section: {
    marginBottom: themeBase.spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.sm,
  },
  sectionHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.sm,
  },
  sectionLabel: {
    fontSize: 15,
  },
  sectionValue: {
    fontSize: 14,
  },
  expandedContent: {
    marginTop: 2,
    borderRadius: themeBase.borderRadius.md,
    padding: themeBase.spacing.sm,
  },
  inlineContent: {
    marginTop: 2,
    borderRadius: themeBase.borderRadius.md,
    padding: themeBase.spacing.md,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: themeBase.spacing.sm,
    paddingHorizontal: themeBase.spacing.sm,
    borderRadius: themeBase.borderRadius.sm,
    gap: themeBase.spacing.sm,
  },
  optionSelected: {
    // Background handled inline
  },
  optionText: {
    fontSize: 14,
  },
  clearButton: {
    paddingVertical: themeBase.spacing.sm,
    paddingHorizontal: themeBase.spacing.sm,
    marginTop: themeBase.spacing.xs,
  },
  clearText: {
    fontSize: 13,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: themeBase.spacing.xs,
  },
  starButton: {
    padding: themeBase.spacing.xs,
  },
  starIcon: {
    fontSize: 32,
  },
  clearStarButton: {
    padding: themeBase.spacing.sm,
    marginLeft: themeBase.spacing.md,
  },
  priorityRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: themeBase.spacing.sm,
  },
  priorityButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: themeBase.spacing.sm,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
    gap: themeBase.spacing.xs,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 13,
  },
});
