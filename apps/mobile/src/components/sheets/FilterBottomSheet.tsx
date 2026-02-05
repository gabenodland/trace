/**
 * FilterBottomSheet - Unified filter sheet with collapsible sections
 *
 * Airbnb-style filter experience with:
 * - All filters in one scrollable sheet
 * - Collapsible sections (start collapsed)
 * - Clear button at bottom when filters are active
 * - Immediate filter application (no apply button)
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { Icon } from '../../shared/components';
import { useSettings } from '../../shared/contexts/SettingsContext';
import { useDrawer } from '../../shared/contexts/DrawerContext';
import { themeBase } from '../../shared/theme/themeBase';
import { useStream } from '../../modules/streams/mobileStreamHooks';
import { CollapsibleSection } from '../layout/CollapsibleSection';
import { PickerBottomSheet } from './PickerBottomSheet';
import {
  ALL_STATUSES,
  ALL_PRIORITIES,
  DUE_DATE_PRESETS,
  RATING_OPERATORS,
  DEFAULT_STREAM_VIEW_FILTER,
  extractAttachmentIds,
  getActiveFilterInfo,
  type Entry,
  type PriorityLevel,
  type PriorityCategory,
  type DueDatePreset,
  type PhotosFilter,
  type EntryStatus,
  type StreamViewFilter,
  type RatingOperator,
} from '@trace/core';

interface FilterBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called when Apply is pressed - syncs filters and closes sheet */
  onApply?: () => void;
  /** Entries to calculate live filter count */
  entries?: Entry[];
}

// NO debounce - sync only on close for maximum performance
// This completely eliminates lag from checkbox clicks

export function FilterBottomSheet({ visible, onClose, onApply, entries = [] }: FilterBottomSheetProps) {
  const theme = useTheme();
  const { selectedStreamId } = useDrawer();
  const { getStreamFilter, setStreamFilter, resetStreamFilter } = useSettings();

  // Capture initial filter value when sheet opens (not on every render)
  const initialFilterRef = useRef<StreamViewFilter | null>(null);

  // Get stream data for filter visibility
  const { stream } = useStream(selectedStreamId ?? null);
  // Special views (all, tag:, mention:, location:, geo:) should show rating filter
  const isAllEntriesView = !selectedStreamId ||
                           selectedStreamId === 'all' ||
                           (typeof selectedStreamId === 'string' && selectedStreamId.includes(':'));

  // LOCAL filter state - this is the ONLY state that changes on checkbox clicks
  // Global context is NEVER updated until the sheet closes
  const [localFilter, setLocalFilter] = useState<StreamViewFilter>(
    () => getStreamFilter(selectedStreamId)
  );

  // Reset local filter and collapse sections when sheet opens
  useEffect(() => {
    if (visible) {
      const currentGlobalFilter = getStreamFilter(selectedStreamId);
      initialFilterRef.current = currentGlobalFilter;
      setLocalFilter(currentGlobalFilter);
      // Collapse all sections when opening
      setExpandedSections({});
    }
  }, [visible, selectedStreamId, getStreamFilter]);

  // Update local filter ONLY - no sync while sheet is open
  const updateLocalFilter = useCallback((updates: Partial<StreamViewFilter>) => {
    setLocalFilter(prev => ({ ...prev, ...updates }));
  }, []);

  // Handle close - discard changes (don't sync)
  const handleClose = useCallback(() => {
    // Just close without syncing - discard changes
    onClose();
  }, [onClose]);

  // Handle apply - sync to global and close
  const handleApply = useCallback(() => {
    // Sync to global context
    setStreamFilter(selectedStreamId, localFilter);
    onClose();
    // Call onApply callback (e.g., to scroll list to top)
    onApply?.();
  }, [localFilter, selectedStreamId, setStreamFilter, onClose, onApply]);

  // Use localFilter for all UI rendering (instant updates)
  const currentFilter = localFilter;

  // Track which sections are expanded
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Which date field is being edited in inline calendar ('from' or 'to')
  const [entryDateMode, setEntryDateMode] = useState<'from' | 'to'>('from');
  const [dueDateMode, setDueDateMode] = useState<'from' | 'to'>('from');

  // Calendar theme based on app theme
  const calendarTheme = useMemo(() => ({
    backgroundColor: theme.colors.background.primary,
    calendarBackground: theme.colors.background.primary,
    textSectionTitleColor: theme.colors.text.tertiary,
    selectedDayBackgroundColor: theme.colors.interactive.primary,
    selectedDayTextColor: theme.colors.background.primary,
    todayTextColor: theme.colors.interactive.primary,
    dayTextColor: theme.colors.text.primary,
    textDisabledColor: theme.colors.text.tertiary,
    arrowColor: theme.colors.interactive.primary,
    monthTextColor: theme.colors.text.primary,
    textDayFontFamily: theme.typography.fontFamily.regular,
    textMonthFontFamily: theme.typography.fontFamily.semibold,
    textDayHeaderFontFamily: theme.typography.fontFamily.medium,
    textDayFontSize: 14,
    textMonthFontSize: 16,
    textDayHeaderFontSize: 12,
  }), [theme]);

  // Determine which filters to show based on stream settings
  // Priority and Due Date are common filters - always show them
  const showStatusFilter = isAllEntriesView || stream?.entry_use_status !== false;
  const showPriorityFilter = true; // Common filter - always available
  const showTypeFilter = !isAllEntriesView && stream?.entry_use_type === true && (stream?.entry_types?.length ?? 0) > 0;
  const showRatingFilter = isAllEntriesView || stream?.entry_use_rating === true;
  const showPhotosFilter = isAllEntriesView || stream?.entry_use_photos !== false;
  const showDueDateFilter = true; // Common filter - always available


  // When viewing a specific stream, only show its allowed statuses
  const allowedStatuses = selectedStreamId && stream?.entry_statuses
    ? stream.entry_statuses
    : undefined;
  const availableStatusValues = (allowedStatuses ?? ALL_STATUSES.map(s => s.value)) as string[];
  const availableTypes = stream?.entry_types ?? [];
  const ratingType = stream?.entry_rating_type || 'decimal_whole';

  // Calculate active filter info using shared helper
  const filterInfo = useMemo(() => {
    return getActiveFilterInfo(currentFilter, {
      availableStatuses: availableStatusValues,
      availableTypes: availableTypes,
      ratingType: ratingType,
    });
  }, [currentFilter, availableStatusValues, availableTypes, ratingType]);

  // Destructure for easier use
  const { hasActiveFilters } = filterInfo;

  // Calculate live filter count for header display
  // This runs the same filter logic as useFilteredEntries but on local state
  const { filteredCount, totalCount } = useMemo(() => {
    if (entries.length === 0) return { filteredCount: 0, totalCount: 0 };

    const total = entries.length;
    const statuses = currentFilter.statuses ?? [];
    const priorities = currentFilter.priorities ?? [];
    const types = currentFilter.types ?? [];

    const filtered = entries.filter(entry => {
      // Archive filter (default: hide archived)
      if (!currentFilter.showArchived && entry.is_archived) return false;

      // Status filter (empty = show all)
      if (statuses.length > 0 && !statuses.includes(entry.status)) return false;

      // Priority filter (empty = show all)
      if (priorities.length > 0) {
        if (!priorities.includes(entry.priority as 0 | 1 | 2 | 3 | 4)) return false;
      }

      // Type filter (empty = show all)
      if (types.length > 0) {
        if (entry.type === null || !types.includes(entry.type)) return false;
      }

      // Rating filter
      if (currentFilter.ratingOperator && currentFilter.ratingValue !== null) {
        const op = currentFilter.ratingOperator;
        const uiValue = currentFilter.ratingValue;

        // Determine max rating based on context
        const maxRating = ratingType === 'stars' ? 5 : 10;

        // Skip filter if it's the "no filter" combination: >= 1 or <= max
        const isNoFilter = (op === '>=' && uiValue === 1) || (op === '<=' && uiValue === maxRating);

        if (!isNoFilter) {
          // Convert UI value to database scale (0-10)
          // 5-star: multiply by 2 (1 star = 2, 5 stars = 10)
          // 10-point: use as-is
          const dbValue = ratingType === 'stars' ? uiValue * 2 : uiValue;

          if (op === '>=' && entry.rating < dbValue) return false;
          if (op === '<=' && entry.rating > dbValue) return false;
          if (op === '=' && entry.rating !== dbValue) return false;
        }
      }

      // Photos filter
      if (currentFilter.hasPhotos !== null) {
        const hasPhotos = entry.photo_count !== undefined
          ? entry.photo_count > 0
          : extractAttachmentIds(entry.content).length > 0;
        if (currentFilter.hasPhotos && !hasPhotos) return false;
        if (!currentFilter.hasPhotos && hasPhotos) return false;
      }

      // Due date filter
      if (currentFilter.dueDatePreset !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        switch (currentFilter.dueDatePreset) {
          case 'overdue':
            if (!entry.due_date || new Date(entry.due_date) >= today) return false;
            break;
          case 'today': {
            if (!entry.due_date) return false;
            const due = new Date(entry.due_date);
            due.setHours(0, 0, 0, 0);
            if (due.getTime() !== today.getTime()) return false;
            break;
          }
          case 'this_week': {
            if (!entry.due_date) return false;
            const due = new Date(entry.due_date);
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() - today.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);
            if (due < weekStart || due > weekEnd) return false;
            break;
          }
          case 'next_week': {
            if (!entry.due_date) return false;
            const due = new Date(entry.due_date);
            const nextWeekStart = new Date(today);
            nextWeekStart.setDate(today.getDate() + (7 - today.getDay()));
            const nextWeekEnd = new Date(nextWeekStart);
            nextWeekEnd.setDate(nextWeekStart.getDate() + 6);
            nextWeekEnd.setHours(23, 59, 59, 999);
            if (due < nextWeekStart || due > nextWeekEnd) return false;
            break;
          }
          case 'has_due_date':
            if (entry.due_date === null) return false;
            break;
          case 'no_due_date':
            if (entry.due_date !== null) return false;
            break;
          case 'custom': {
            if (currentFilter.dueDateStart || currentFilter.dueDateEnd) {
              if (!entry.due_date) return false;
              const due = new Date(entry.due_date);
              if (currentFilter.dueDateStart && due < new Date(currentFilter.dueDateStart)) return false;
              if (currentFilter.dueDateEnd && due > new Date(currentFilter.dueDateEnd)) return false;
            }
            break;
          }
        }
      }

      // Entry date filter
      if (currentFilter.entryDateStart || currentFilter.entryDateEnd) {
        if (!entry.entry_date) return false;
        const date = new Date(entry.entry_date);
        if (currentFilter.entryDateStart && date < new Date(currentFilter.entryDateStart)) return false;
        if (currentFilter.entryDateEnd && date > new Date(currentFilter.entryDateEnd)) return false;
      }

      return true;
    }).length;

    return { filteredCount: filtered, totalCount: total };
  }, [entries, currentFilter]);

  // Build subtitle for header
  const filterSubtitle = useMemo(() => {
    if (totalCount === 0) return undefined;
    if (filteredCount === totalCount) return `${totalCount} entries`;
    return `${filteredCount} of ${totalCount} entries`;
  }, [filteredCount, totalCount]);

  // Count archived entries for Show Archived toggle
  const archivedCount = useMemo(() => {
    return entries.filter(e => e.is_archived).length;
  }, [entries]);

  // Section toggle handler
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  // Filter handlers - update LOCAL state instantly, sync to global with debounce
  const handleShowArchivedChange = (value: boolean) => {
    updateLocalFilter({ showArchived: value });
  };

  const handleStatusToggle = (status: string) => {
    const statuses = currentFilter.statuses ?? [];
    const isSelected = statuses.includes(status);
    const newStatuses = isSelected
      ? statuses.filter(s => s !== status)
      : [...statuses, status];
    updateLocalFilter({ statuses: newStatuses });
  };

  const handlePriorityToggle = (priority: PriorityLevel) => {
    const priorities = currentFilter.priorities ?? [];
    const isSelected = priorities.includes(priority);
    const newPriorities = isSelected
      ? priorities.filter(p => p !== priority)
      : [...priorities, priority];
    updateLocalFilter({ priorities: newPriorities });
  };

  const handleTypeToggle = (type: string) => {
    const types = currentFilter.types ?? [];
    const isSelected = types.includes(type);
    const newTypes = isSelected
      ? types.filter(t => t !== type)
      : [...types, type];
    updateLocalFilter({ types: newTypes });
  };

  const handleRatingOperatorChange = (operator: RatingOperator | null) => {
    updateLocalFilter({ ratingOperator: operator });
  };

  const handleRatingValueChange = (value: number | null) => {
    updateLocalFilter({ ratingValue: value });
  };

  const handleClearRating = () => {
    updateLocalFilter({ ratingOperator: null, ratingValue: null });
  };

  const handlePhotosFilterChange = (hasPhotos: PhotosFilter) => {
    updateLocalFilter({ hasPhotos });
  };

  const handleDueDatePresetChange = (preset: DueDatePreset) => {
    updateLocalFilter({
      dueDatePreset: preset,
      // Clear custom dates when switching to non-custom preset
      dueDateStart: preset === 'custom' ? currentFilter.dueDateStart : null,
      dueDateEnd: preset === 'custom' ? currentFilter.dueDateEnd : null,
    });
  };

  // Inline calendar date selection handlers
  const handleDueDateSelect = (day: DateData) => {
    if (dueDateMode === 'from') {
      updateLocalFilter({
        dueDatePreset: 'custom',
        dueDateStart: day.dateString,
      });
    } else {
      updateLocalFilter({
        dueDatePreset: 'custom',
        dueDateEnd: day.dateString,
      });
    }
  };

  const handleEntryDateSelect = (day: DateData) => {
    if (entryDateMode === 'from') {
      updateLocalFilter({ entryDateStart: day.dateString });
    } else {
      updateLocalFilter({ entryDateEnd: day.dateString });
    }
  };

  const handleClearEntryDates = () => {
    updateLocalFilter({ entryDateStart: null, entryDateEnd: null });
  };

  const handleClearDueDates = () => {
    updateLocalFilter({ dueDateStart: null, dueDateEnd: null, dueDatePreset: 'all' });
  };

  // Build marked dates for calendars
  const getEntryDateMarkedDates = () => {
    const marked: Record<string, { selected?: boolean; startingDay?: boolean; endingDay?: boolean; color?: string; textColor?: string }> = {};
    const startDate = currentFilter.entryDateStart;
    const endDate = currentFilter.entryDateEnd;

    if (startDate) {
      marked[startDate] = {
        selected: true,
        startingDay: true,
        color: theme.colors.interactive.primary,
        textColor: theme.colors.background.primary,
      };
    }
    if (endDate) {
      marked[endDate] = {
        ...marked[endDate],
        selected: true,
        endingDay: true,
        color: theme.colors.interactive.primary,
        textColor: theme.colors.background.primary,
      };
    }
    return marked;
  };

  const getDueDateMarkedDates = () => {
    const marked: Record<string, { selected?: boolean; startingDay?: boolean; endingDay?: boolean; color?: string; textColor?: string }> = {};
    const startDate = currentFilter.dueDateStart;
    const endDate = currentFilter.dueDateEnd;

    if (startDate) {
      marked[startDate] = {
        selected: true,
        startingDay: true,
        color: theme.colors.interactive.primary,
        textColor: theme.colors.background.primary,
      };
    }
    if (endDate) {
      marked[endDate] = {
        ...marked[endDate],
        selected: true,
        endingDay: true,
        color: theme.colors.interactive.primary,
        textColor: theme.colors.background.primary,
      };
    }
    return marked;
  };

  const handleClearAll = () => {
    // Reset to defaults, sync to global, and close
    resetStreamFilter(selectedStreamId);
    onClose();
    onApply?.();
  };

  // Badge labels from shared helper - no duplicate logic!
  const getStatusBadge = () => filterInfo.status.badge;
  const getPriorityBadge = () => filterInfo.priority.badge;
  const getTypeBadge = () => filterInfo.type.badge;
  const getRatingBadge = () => filterInfo.rating.badge;
  const getPhotosBadge = () => filterInfo.photos.badge;
  const getDueDateBadge = () => filterInfo.dueDate.badge;
  const getEntryDateBadge = () => filterInfo.entryDate.badge;

  // Format date for display
  const formatDateDisplay = (isoDate: string | null) => {
    if (!isoDate) return 'Select date';
    return new Date(isoDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Get selected status names for display
  const getSelectedStatusNames = () => {
    const selectedStatuses = currentFilter.statuses ?? [];
    return ALL_STATUSES
      .filter(s => selectedStatuses.includes(s.value) && availableStatusValues.includes(s.value))
      .map(s => s.label);
  };

  // Get selected priority names for display
  const getSelectedPriorityNames = () => {
    const selectedPriorities = currentFilter.priorities ?? [];
    return ALL_PRIORITIES
      .filter(p => selectedPriorities.includes(p.value))
      .map(p => p.label);
  };

  // Get selected type names for display
  const getSelectedTypeNames = () => {
    const selectedTypes = currentFilter.types ?? [];
    return availableTypes.filter(t => selectedTypes.includes(t));
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={handleClose}
      title="Filters"
      subtitle={filterSubtitle}
      height={0.85}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Show Archived Toggle - Always at top, not collapsible */}
        <View style={[styles.toggleRow, { borderBottomColor: theme.colors.border.light }]}>
          <View style={styles.toggleLabelRow}>
            <Text style={[styles.toggleLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
              Show Archived
            </Text>
            {archivedCount > 0 && (
              <Text style={[styles.archivedCount, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                ({archivedCount})
              </Text>
            )}
          </View>
          <Switch
            value={currentFilter.showArchived}
            onValueChange={handleShowArchivedChange}
            trackColor={{ false: theme.colors.background.tertiary, true: theme.colors.functional.accentLight }}
            thumbColor={currentFilter.showArchived ? theme.colors.interactive.primary : theme.colors.text.tertiary}
          />
        </View>

        {/* Status Filter Section */}
        {showStatusFilter && (
          <CollapsibleSection
            title="Status"
            expanded={expandedSections['status']}
            onToggle={() => toggleSection('status')}
            badge={getStatusBadge()}
            isFiltering={!!getStatusBadge()}
            onClearBadge={getStatusBadge() ? () => updateLocalFilter({ statuses: [] }) : undefined}
            selectedItems={getSelectedStatusNames()}
          >
            {/* Status Options */}
            <View style={styles.optionsGrid}>
              {ALL_STATUSES.filter(s => availableStatusValues.includes(s.value)).map(status => {
                const isSelected = (currentFilter.statuses ?? []).includes(status.value);
                return (
                  <TouchableOpacity
                    key={status.value}
                    style={[
                      styles.optionChip,
                      { backgroundColor: theme.colors.background.secondary },
                      isSelected && { backgroundColor: theme.colors.interactive.primary + '20', borderColor: theme.colors.interactive.primary, borderWidth: 1 },
                    ]}
                    onPress={() => handleStatusToggle(status.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                    <Text style={[
                      styles.optionText,
                      { color: isSelected ? theme.colors.interactive.primary : theme.colors.text.primary },
                      { fontFamily: isSelected ? theme.typography.fontFamily.semibold : theme.typography.fontFamily.medium },
                    ]}>
                      {status.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </CollapsibleSection>
        )}

        {/* Priority Filter Section */}
        {showPriorityFilter && (
          <CollapsibleSection
            title="Priority"
            expanded={expandedSections['priority']}
            onToggle={() => toggleSection('priority')}
            badge={getPriorityBadge()}
            isFiltering={!!getPriorityBadge()}
            onClearBadge={getPriorityBadge() ? () => updateLocalFilter({ priorities: [] }) : undefined}
            selectedItems={getSelectedPriorityNames()}
          >
            {/* Priority Options */}
            <View style={styles.optionsGrid}>
              {ALL_PRIORITIES.map(priority => {
                const isSelected = (currentFilter.priorities ?? []).includes(priority.value);
                const priorityColor = theme.colors.priority[priority.category as PriorityCategory];
                return (
                  <TouchableOpacity
                    key={priority.value}
                    style={[
                      styles.optionChip,
                      { backgroundColor: theme.colors.background.secondary },
                      isSelected && { backgroundColor: priorityColor + '20', borderColor: priorityColor, borderWidth: 1 },
                    ]}
                    onPress={() => handlePriorityToggle(priority.value)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
                    <Text style={[
                      styles.optionText,
                      { color: isSelected ? priorityColor : theme.colors.text.primary },
                      { fontFamily: isSelected ? theme.typography.fontFamily.semibold : theme.typography.fontFamily.medium },
                    ]}>
                      {priority.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </CollapsibleSection>
        )}

        {/* Type Filter Section */}
        {showTypeFilter && (
          <CollapsibleSection
            title="Type"
            expanded={expandedSections['type']}
            onToggle={() => toggleSection('type')}
            badge={getTypeBadge()}
            isFiltering={!!getTypeBadge()}
            onClearBadge={getTypeBadge() ? () => updateLocalFilter({ types: [] }) : undefined}
            selectedItems={getSelectedTypeNames()}
          >
            {/* Type Options */}
            <View style={styles.optionsGrid}>
              {availableTypes.map(type => {
                const isSelected = (currentFilter.types ?? []).includes(type);
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.optionChip,
                      { backgroundColor: theme.colors.background.secondary },
                      isSelected && { backgroundColor: theme.colors.interactive.primary + '20', borderColor: theme.colors.interactive.primary, borderWidth: 1 },
                    ]}
                    onPress={() => handleTypeToggle(type)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.optionText,
                      { color: isSelected ? theme.colors.interactive.primary : theme.colors.text.primary },
                      { fontFamily: isSelected ? theme.typography.fontFamily.semibold : theme.typography.fontFamily.medium },
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </CollapsibleSection>
        )}

        {/* Rating Filter Section */}
        {showRatingFilter && (
          <CollapsibleSection
            title="Rating"
            expanded={expandedSections['rating']}
            onToggle={() => toggleSection('rating')}
            badge={getRatingBadge()}
            isFiltering={!!getRatingBadge()}
            onClearBadge={getRatingBadge() ? handleClearRating : undefined}
          >
            {/* Operator Selection */}
            <Text style={[styles.customLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
              Comparison
            </Text>
            <View style={styles.segmentedControl}>
              {RATING_OPERATORS.map(op => {
                const isSelected = currentFilter.ratingOperator === op.value;
                return (
                  <TouchableOpacity
                    key={op.value}
                    style={[
                      styles.segmentButton,
                      { backgroundColor: theme.colors.background.secondary },
                      isSelected && { backgroundColor: theme.colors.interactive.primary },
                    ]}
                    onPress={() => handleRatingOperatorChange(op.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.segmentText,
                      { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular },
                      isSelected && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
                    ]}>
                      {op.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Value Selection - Adapts to 5-star or 10-point based on stream */}
            <Text style={[styles.customLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
              Value
            </Text>
            <View style={styles.ratingValuesContainer}>
              {(() => {
                // Determine max value based on context
                const maxValue = ratingType === 'stars' ? 5 : 10;
                const values = Array.from({ length: maxValue }, (_, i) => i + 1);

                // Group into rows of 5
                const rows: number[][] = [];
                for (let i = 0; i < values.length; i += 5) {
                  rows.push(values.slice(i, i + 5));
                }

                return rows.map((row, rowIndex) => (
                  <View key={rowIndex} style={styles.ratingValuesRow}>
                    {row.map(value => {
                      const isSelected = currentFilter.ratingValue === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[
                            styles.ratingValueButton,
                            { backgroundColor: theme.colors.background.secondary },
                            isSelected && { backgroundColor: theme.colors.interactive.primary + '20', borderColor: theme.colors.interactive.primary, borderWidth: 1.5 },
                          ]}
                          onPress={() => handleRatingValueChange(value)}
                          activeOpacity={0.7}
                        >
                          <Text style={[
                            styles.ratingValueText,
                            { color: isSelected ? theme.colors.interactive.primary : theme.colors.text.primary },
                            { fontFamily: isSelected ? theme.typography.fontFamily.semibold : theme.typography.fontFamily.medium },
                          ]}>
                            {value}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ));
              })()}
            </View>
          </CollapsibleSection>
        )}

        {/* Photos Filter Section */}
        {showPhotosFilter && (
          <CollapsibleSection
            title="Photos"
            expanded={expandedSections['photos']}
            onToggle={() => toggleSection('photos')}
            badge={getPhotosBadge()}
            isFiltering={!!getPhotosBadge()}
            onClearBadge={getPhotosBadge() ? () => updateLocalFilter({ hasPhotos: null }) : undefined}
          >
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  { backgroundColor: theme.colors.background.secondary },
                  currentFilter.hasPhotos === null && { backgroundColor: theme.colors.interactive.primary },
                ]}
                onPress={() => handlePhotosFilterChange(null)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.segmentText,
                  { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular },
                  currentFilter.hasPhotos === null && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
                ]}>
                  All
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  { backgroundColor: theme.colors.background.secondary },
                  currentFilter.hasPhotos === true && { backgroundColor: theme.colors.interactive.primary },
                ]}
                onPress={() => handlePhotosFilterChange(true)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.segmentText,
                  { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular },
                  currentFilter.hasPhotos === true && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
                ]}>
                  With photos
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentButton,
                  { backgroundColor: theme.colors.background.secondary },
                  currentFilter.hasPhotos === false && { backgroundColor: theme.colors.interactive.primary },
                ]}
                onPress={() => handlePhotosFilterChange(false)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.segmentText,
                  { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular },
                  currentFilter.hasPhotos === false && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
                ]}>
                  Without
                </Text>
              </TouchableOpacity>
            </View>
          </CollapsibleSection>
        )}

        {/* Due Date Filter Section */}
        {showDueDateFilter && (
          <CollapsibleSection
            title="Due Date"
            expanded={expandedSections['dueDate']}
            onToggle={() => toggleSection('dueDate')}
            badge={getDueDateBadge()}
            isFiltering={!!getDueDateBadge()}
            onClearBadge={getDueDateBadge() ? handleClearDueDates : undefined}
          >
            {/* Preset chips */}
            <View style={styles.optionsGrid}>
              {DUE_DATE_PRESETS.filter(p => p.value !== 'custom').map(preset => {
                const isSelected = currentFilter.dueDatePreset === preset.value;
                return (
                  <TouchableOpacity
                    key={preset.value}
                    style={[
                      styles.optionChip,
                      { backgroundColor: theme.colors.background.secondary },
                      isSelected && { backgroundColor: theme.colors.interactive.primary + '20', borderColor: theme.colors.interactive.primary, borderWidth: 1 },
                    ]}
                    onPress={() => handleDueDatePresetChange(preset.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.optionText,
                      { color: isSelected ? theme.colors.interactive.primary : theme.colors.text.primary },
                      { fontFamily: isSelected ? theme.typography.fontFamily.semibold : theme.typography.fontFamily.medium },
                    ]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom range section */}
            <Text style={[styles.customLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
              Custom range
            </Text>

            {/* From/To toggle buttons */}
            <View style={styles.dateToggleRow}>
              <TouchableOpacity
                style={[
                  styles.dateToggleButton,
                  { backgroundColor: theme.colors.background.secondary },
                  dueDateMode === 'from' && { backgroundColor: theme.colors.interactive.primary },
                ]}
                onPress={() => setDueDateMode('from')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dateToggleText,
                  { color: theme.colors.text.secondary },
                  dueDateMode === 'from' && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
                ]}>
                  From: {currentFilter.dueDateStart ? formatDateDisplay(currentFilter.dueDateStart) : 'Any'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dateToggleButton,
                  { backgroundColor: theme.colors.background.secondary },
                  dueDateMode === 'to' && { backgroundColor: theme.colors.interactive.primary },
                ]}
                onPress={() => setDueDateMode('to')}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dateToggleText,
                  { color: theme.colors.text.secondary },
                  dueDateMode === 'to' && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
                ]}>
                  To: {currentFilter.dueDateEnd ? formatDateDisplay(currentFilter.dueDateEnd) : 'Any'}
                </Text>
              </TouchableOpacity>
              {(currentFilter.dueDateStart || currentFilter.dueDateEnd) && (
                <TouchableOpacity onPress={handleClearDueDates} style={styles.clearDateButton}>
                  <Icon name="X" size={18} color={theme.colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Inline Calendar */}
            <View style={styles.calendarContainer}>
              <Calendar
                theme={calendarTheme}
                onDayPress={handleDueDateSelect}
                markedDates={getDueDateMarkedDates()}
                markingType="period"
                enableSwipeMonths
              />
            </View>
          </CollapsibleSection>
        )}

        {/* Entry Date Filter Section */}
        <CollapsibleSection
          title="Entry Date"
          expanded={expandedSections['entryDate']}
          onToggle={() => toggleSection('entryDate')}
          badge={getEntryDateBadge()}
          isFiltering={!!getEntryDateBadge()}
          onClearBadge={getEntryDateBadge() ? handleClearEntryDates : undefined}
        >
          {/* From/To toggle buttons */}
          <View style={styles.dateToggleRow}>
            <TouchableOpacity
              style={[
                styles.dateToggleButton,
                { backgroundColor: theme.colors.background.secondary },
                entryDateMode === 'from' && { backgroundColor: theme.colors.interactive.primary },
              ]}
              onPress={() => setEntryDateMode('from')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dateToggleText,
                { color: theme.colors.text.secondary },
                entryDateMode === 'from' && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
              ]}>
                From: {currentFilter.entryDateStart ? formatDateDisplay(currentFilter.entryDateStart) : 'Any'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dateToggleButton,
                { backgroundColor: theme.colors.background.secondary },
                entryDateMode === 'to' && { backgroundColor: theme.colors.interactive.primary },
              ]}
              onPress={() => setEntryDateMode('to')}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.dateToggleText,
                { color: theme.colors.text.secondary },
                entryDateMode === 'to' && { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold },
              ]}>
                To: {currentFilter.entryDateEnd ? formatDateDisplay(currentFilter.entryDateEnd) : 'Any'}
              </Text>
            </TouchableOpacity>
            {(currentFilter.entryDateStart || currentFilter.entryDateEnd) && (
              <TouchableOpacity onPress={handleClearEntryDates} style={styles.clearDateButton}>
                <Icon name="X" size={18} color={theme.colors.text.tertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Inline Calendar */}
          <View style={styles.calendarContainer}>
            <Calendar
              theme={calendarTheme}
              onDayPress={handleEntryDateSelect}
              markedDates={getEntryDateMarkedDates()}
              markingType="period"
              enableSwipeMonths
            />
          </View>
        </CollapsibleSection>

        {/* Bottom padding */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer - Clear All + Apply buttons */}
      <View style={[styles.footerContainer, { backgroundColor: theme.colors.background.primary, borderTopColor: theme.colors.border.light }]}>
        <TouchableOpacity
          style={[styles.clearAllButton, { backgroundColor: theme.colors.background.secondary }]}
          onPress={handleClearAll}
          activeOpacity={0.7}
        >
          <Text style={[styles.clearAllButtonText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
            Clear All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.applyButton, { backgroundColor: theme.colors.interactive.primary }]}
          onPress={handleApply}
          activeOpacity={0.7}
        >
          <Text style={[styles.applyButtonText, { color: theme.colors.background.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
            Apply ({filteredCount})
          </Text>
        </TouchableOpacity>
      </View>
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.lg,
    borderBottomWidth: 1,
  },
  toggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: themeBase.spacing.xs,
  },
  toggleLabel: {
    fontSize: themeBase.typography.fontSize.base,
  },
  archivedCount: {
    fontSize: themeBase.typography.fontSize.base,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: themeBase.spacing.sm,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: themeBase.spacing.sm,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
    gap: themeBase.spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent', // Prevents size change when selected border is added
  },
  optionText: {
    fontSize: themeBase.typography.fontSize.sm,
  },
  ratingValuesContainer: {
    gap: themeBase.spacing.sm,
  },
  ratingValuesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: themeBase.spacing.sm,
  },
  ratingValueButton: {
    flex: 1,
    paddingVertical: themeBase.spacing.sm,
    paddingHorizontal: themeBase.spacing.xs,
    borderRadius: themeBase.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  ratingValueText: {
    fontSize: themeBase.typography.fontSize.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: themeBase.spacing.xs,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: themeBase.spacing.sm,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
    alignItems: 'center',
  },
  segmentText: {
    fontSize: themeBase.typography.fontSize.sm,
  },
  customLabel: {
    fontSize: themeBase.typography.fontSize.xs,
    marginTop: themeBase.spacing.lg,
    marginBottom: themeBase.spacing.sm,
  },
  dateToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: themeBase.spacing.sm,
    marginBottom: themeBase.spacing.md,
  },
  dateToggleButton: {
    flex: 1,
    paddingVertical: themeBase.spacing.sm,
    paddingHorizontal: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
    alignItems: 'center',
  },
  dateToggleText: {
    fontSize: themeBase.typography.fontSize.sm,
  },
  clearDateButton: {
    padding: themeBase.spacing.xs,
  },
  calendarContainer: {
    borderRadius: themeBase.borderRadius.md,
    overflow: 'hidden',
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: themeBase.spacing.lg,
    paddingVertical: themeBase.spacing.md,
    borderTopWidth: 1,
    gap: themeBase.spacing.md,
  },
  clearAllButton: {
    paddingVertical: themeBase.spacing.md,
    paddingHorizontal: themeBase.spacing.lg,
    borderRadius: themeBase.borderRadius.md,
    alignItems: 'center',
  },
  clearAllButtonText: {
    fontSize: themeBase.typography.fontSize.base,
  },
  applyButton: {
    flex: 1,
    paddingVertical: themeBase.spacing.md,
    borderRadius: themeBase.borderRadius.md,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: themeBase.typography.fontSize.base,
  },
});
