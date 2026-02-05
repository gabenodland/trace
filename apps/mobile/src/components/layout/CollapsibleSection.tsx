/**
 * CollapsibleSection - Animated collapsible panel for filter sections
 *
 * Features:
 * - Animated expand/collapse with smooth height transition
 * - Chevron rotation indicator
 * - Optional badge showing active filter count
 * - Customizable header styling
 */

import { useState, useRef, useEffect, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useTheme } from '../../shared/contexts/ThemeContext';
import { Icon } from '../../shared/components';
import { themeBase } from '../../shared/theme/themeBase';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  /** Whether the section is expanded */
  expanded?: boolean;
  /** Callback when expansion state changes */
  onToggle?: (expanded: boolean) => void;
  /** Optional badge text (e.g., "3 selected" or active filter indicator) */
  badge?: string;
  /** Whether the filter is actively filtering (shows badge in accent color) */
  isFiltering?: boolean;
  /** Start expanded by default */
  defaultExpanded?: boolean;
  /** Callback to clear the badge/filter - shows X button when provided and badge is present */
  onClearBadge?: () => void;
  /** Selected item names to display inline when collapsed (e.g., ["Urgent", "High"]) */
  selectedItems?: string[];
}

export function CollapsibleSection({
  title,
  children,
  expanded: controlledExpanded,
  onToggle,
  badge,
  isFiltering = false,
  defaultExpanded = false,
  onClearBadge,
  selectedItems,
}: CollapsibleSectionProps) {
  const theme = useTheme();

  // Support both controlled and uncontrolled modes
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;

  // Animation values
  const rotateAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  // Update rotation animation when expanded changes
  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [expanded, rotateAnim]);

  const handleToggle = () => {
    // Animate layout change
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    if (isControlled) {
      onToggle?.(!expanded);
    } else {
      setInternalExpanded(!expanded);
      onToggle?.(!expanded);
    }
  };

  // Rotate chevron from pointing down (collapsed) to pointing up (expanded)
  const chevronRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // Format selected items for display
  const getItemsDisplay = () => {
    if (!selectedItems || selectedItems.length === 0) return null;

    // When expanded: show "N items selected" in badge
    if (expanded) {
      return `${selectedItems.length} items selected`;
    }

    // When collapsed: return items array for pill rendering (no truncation, let them wrap)
    return selectedItems;
  };

  // Determine which display to use: inline pills or badge
  const displayItems = getItemsDisplay();
  const shouldShowInlinePills = displayItems && Array.isArray(displayItems) && !expanded;
  const shouldShowBadge = (badge || (displayItems && !Array.isArray(displayItems))) && expanded;

  return (
    <View style={styles.container}>
      {/* Header - always visible */}
      <TouchableOpacity
        style={styles.header}
        onPress={handleToggle}
        activeOpacity={0.7}
      >
        <View style={styles.titleRow}>
          <Text style={[
            styles.title,
            { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }
          ]}>
            {title}
          </Text>
          {/* When collapsed: show selected items as pills that wrap */}
          {shouldShowInlinePills && (
            <View style={styles.pillsContainer}>
              {displayItems.map((item, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.pill,
                    { backgroundColor: theme.colors.background.tertiary }
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }
                    ]}
                  >
                    {item}
                  </Text>
                </View>
              ))}
              {onClearBadge && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onClearBadge();
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.clearButton}
                >
                  <Icon name="X" size={16} color={theme.colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>
          )}
          {/* When expanded: show badge with "N items selected" */}
          {shouldShowBadge && (
            <View style={styles.badgeContainer}>
              <View style={[
                styles.badge,
                { backgroundColor: isFiltering ? theme.colors.interactive.primary + '20' : theme.colors.background.tertiary }
              ]}>
                <Text style={[
                  styles.badgeText,
                  {
                    color: isFiltering ? theme.colors.interactive.primary : theme.colors.text.secondary,
                    fontFamily: theme.typography.fontFamily.medium
                  }
                ]}>
                  {displayItems || badge}
                </Text>
              </View>
              {onClearBadge && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onClearBadge();
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.clearButton}
                >
                  <Icon name="X" size={16} color={theme.colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>
          )}
          {/* Fallback: show original badge when no selected items */}
          {!shouldShowInlinePills && !shouldShowBadge && badge && (
            <View style={styles.badgeContainer}>
              <View style={[
                styles.badge,
                { backgroundColor: isFiltering ? theme.colors.interactive.primary + '20' : theme.colors.background.tertiary }
              ]}>
                <Text style={[
                  styles.badgeText,
                  {
                    color: isFiltering ? theme.colors.interactive.primary : theme.colors.text.secondary,
                    fontFamily: theme.typography.fontFamily.medium
                  }
                ]}>
                  {badge}
                </Text>
              </View>
              {onClearBadge && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation?.();
                    onClearBadge();
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.clearButton}
                >
                  <Icon name="X" size={16} color={theme.colors.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
          <Icon name="ChevronDown" size={20} color={theme.colors.text.tertiary} />
        </Animated.View>
      </TouchableOpacity>

      {/* Content - conditionally rendered */}
      {expanded && (
        <View style={styles.content}>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: themeBase.spacing.lg,
    paddingHorizontal: themeBase.spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: themeBase.spacing.sm,
    flex: 1,
  },
  title: {
    fontSize: themeBase.typography.fontSize.base,
  },
  badge: {
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: 2,
    borderRadius: themeBase.borderRadius.full,
  },
  badgeText: {
    fontSize: themeBase.typography.fontSize.xs,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: themeBase.spacing.xs,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: themeBase.spacing.xs,
    flex: 1,
    alignItems: 'center',
  },
  pill: {
    paddingVertical: 4,
    paddingHorizontal: themeBase.spacing.sm,
    borderRadius: themeBase.borderRadius.full,
  },
  pillText: {
    fontSize: themeBase.typography.fontSize.xs,
  },
  clearButton: {
    padding: 2,
  },
  content: {
    paddingHorizontal: themeBase.spacing.lg,
    paddingBottom: themeBase.spacing.lg,
  },
});
