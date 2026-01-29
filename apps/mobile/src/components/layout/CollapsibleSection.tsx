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
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../../shared/contexts/ThemeContext';
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
          {badge && (
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
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M18 6L6 18M6 6l12 12"
                      stroke={theme.colors.text.tertiary}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M6 9l6 6 6-6"
              stroke={theme.colors.text.tertiary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: themeBase.spacing.lg,
    paddingHorizontal: themeBase.spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  clearButton: {
    padding: 2,
  },
  content: {
    paddingHorizontal: themeBase.spacing.lg,
    paddingBottom: themeBase.spacing.lg,
  },
});
