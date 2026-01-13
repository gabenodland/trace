import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import Svg, { Path } from "react-native-svg";
import { type ThemeContextValue } from "../../shared/contexts/ThemeContext";
import { themeBase } from "../../shared/theme/themeBase";
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
  theme: ThemeContextValue;
}

export function Breadcrumb({ segments, onSegmentPress, badge, theme }: BreadcrumbProps) {
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
              onPress={() => onSegmentPress(segment)}
              activeOpacity={0.7}
              style={styles.segment}
            >
              {/* Icon for last segment (if provided) */}
              {index === segments.length - 1 && segment.icon}
              <Text style={[
                styles.segmentText,
                { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium },
                index === segments.length - 1 && [styles.segmentTextLast, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]
              ]}>
                {segment.label}
              </Text>

              {/* Badge on last segment */}
              {index === segments.length - 1 && badge !== undefined && (
                <View style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
                  <Text style={[styles.badgeText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.semibold }]}>{badge}</Text>
                </View>
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
    paddingRight: themeBase.spacing.md,
  },
  segmentContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  separator: {
    marginHorizontal: themeBase.spacing.xs,
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.xs,
    paddingVertical: themeBase.spacing.xs,
  },
  segmentText: {
    fontSize: themeBase.typography.fontSize.base,
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
  segmentTextLast: {
    fontSize: 20,
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
  badge: {
    borderRadius: themeBase.borderRadius.full,
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    fontSize: themeBase.typography.fontSize.sm,
    // Note: fontWeight removed - use fontFamily with weight variant instead
  },
});
