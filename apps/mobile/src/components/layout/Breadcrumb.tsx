import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import Svg, { Path } from "react-native-svg";
import { theme } from "../../shared/theme/theme";
import { ReactNode } from "react";

export interface BreadcrumbSegment {
  id: string | null; // null for "Uncategorized", "all" for "Home"
  label: string;
  icon?: ReactNode; // Optional icon to display before the label
}

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
  onSegmentPress: (segment: BreadcrumbSegment) => void;
  badge?: number;
  onDropdownPress?: () => void;
}

export function Breadcrumb({ segments, onSegmentPress, badge, onDropdownPress }: BreadcrumbProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {segments.map((segment, index) => (
          <View key={segment.id || 'uncategorized'} style={styles.segmentContainer}>
            {/* Separator */}
            {index > 0 && (
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.tertiary} strokeWidth={2} style={styles.separator}>
                <Path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            )}

            {/* Segment */}
            <TouchableOpacity
              onPress={() => index === segments.length - 1 && onDropdownPress ? onDropdownPress() : onSegmentPress(segment)}
              activeOpacity={0.7}
              style={styles.segment}
            >
              {/* Home Icon (first segment only when not last) */}
              {index === 0 && index !== segments.length - 1 ? (
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.primary} strokeWidth={2}>
                  <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M9 22V12h6v10" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              ) : (
                <>
                  {/* Icon for last segment (if provided) */}
                  {index === segments.length - 1 && segment.icon}
                  <Text style={[
                    styles.segmentText,
                    index === segments.length - 1 && styles.segmentTextLast
                  ]}>
                    {segment.label}
                  </Text>
                </>
              )}

              {/* Badge on last segment */}
              {index === segments.length - 1 && badge !== undefined && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              )}

              {/* Dropdown arrow on last segment */}
              {index === segments.length - 1 && onDropdownPress && (
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={theme.colors.text.secondary} strokeWidth={2} style={styles.dropdownArrowInline}>
                  <Path d="M19 9l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  scrollContent: {
    alignItems: "center",
    paddingRight: theme.spacing.md,
  },
  segmentContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  separator: {
    marginHorizontal: theme.spacing.xs,
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xs,
  },
  segmentText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text.tertiary,
  },
  segmentTextLast: {
    fontSize: 20,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  badge: {
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: theme.borderRadius.full,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  dropdownArrowInline: {
    marginLeft: theme.spacing.xs,
  },
});
