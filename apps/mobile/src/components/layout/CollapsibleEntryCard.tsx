/**
 * CollapsibleEntryCard — Shared collapsible content card for entry detail sheets.
 *
 * Shows title + chevron, badges, body content (collapsed by default), and pinned flag.
 * Tap to expand/collapse. Used by EntryDetailSheet, DeletedEntryDetailSheet, and VersionHistorySheet.
 */

import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useState, useEffect, type ReactNode } from "react";
import { InteractionManager } from "react-native";
import { Icon } from "../../shared/components";
import { StatusIcon } from "../../shared/components/StatusIcon";
import { WebViewHtmlRenderer } from "../../modules/entries/helpers/webViewHtmlRenderer";
import { themeBase } from "../../shared/theme/themeBase";
import {
  getLocationLabel,
  getStatusLabel,
  getStatusColor,
  getPriorityInfo,
  formatRatingDisplay,
  type PriorityCategory,
} from "@trace/core";
import type { ThemeContextValue } from "../../shared/contexts/ThemeContext";
import { fixMalformedClosingTags } from "../../shared/utils/htmlUtils";

function sanitizeHtml(html: string): string {
  let result = html.replace(/<label>[\s\S]*?<\/label>/g, "");
  result = fixMalformedClosingTags(result);
  return result;
}

interface CollapsibleEntryCardProps {
  /** Extra content rendered after the body when expanded (e.g. attachments gallery) */
  children?: ReactNode;
  /** Override card background color (e.g. for dark-mode sheets where primary blends in) */
  cardBackground?: string;
  entry: {
    title?: string | null;
    content?: string | null;
    status?: string | null;
    type?: string | null;
    priority?: number | null;
    rating?: number | null;
    due_date?: string | number | null;
    is_pinned?: boolean | number | null;
    place_name?: string | null;
    city?: string | null;
    neighborhood?: string | null;
    region?: string | null;
    country?: string | null;
    location_id?: string | null;
    tags?: string[] | null;
    mentions?: string[] | null;
  };
  theme: ThemeContextValue;
}

export function CollapsibleEntryCard({ entry, theme, children, cardBackground }: CollapsibleEntryCardProps) {
  const [expanded, setExpanded] = useState(false);
  // Defer heavy HTML render until after initial paint
  const [contentReady, setContentReady] = useState(false);
  useEffect(() => {
    const handle = InteractionManager.runAfterInteractions(() => setContentReady(true));
    return () => handle.cancel();
  }, []);

  const locationLabel = entry.place_name
    ? getLocationLabel({
        name: entry.place_name,
        city: entry.city ?? undefined,
        neighborhood: entry.neighborhood ?? undefined,
        region: entry.region ?? undefined,
        country: entry.country ?? undefined,
      })
    : entry.city || null;

  const hasBadges =
    (entry.status && entry.status !== "none") ||
    entry.type ||
    (entry.priority != null && entry.priority > 0) ||
    (entry.rating != null && entry.rating > 0) ||
    locationLabel ||
    entry.due_date ||
    (entry.tags && entry.tags.length > 0) ||
    (entry.mentions && entry.mentions.length > 0);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBackground || theme.colors.background.primary, borderColor: theme.colors.border.medium, borderWidth: 1 }, theme.shadows.sm]}
      onPress={() => setExpanded(prev => !prev)}
      activeOpacity={0.8}
    >
        <View style={styles.header}>
          {entry.title ? (
            <Text style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
              {entry.title}
            </Text>
          ) : (
            <Text style={[styles.title, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
              Untitled
            </Text>
          )}
          <Icon name={expanded ? "ChevronUp" : "ChevronDown"} size={18} color={theme.colors.text.tertiary} />
        </View>

        {hasBadges && (
        <View style={styles.badgesContainer}>
          {locationLabel && (
            <View style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
              <Icon name={entry.location_id ? "MapPinFavoriteLine" : entry.place_name ? "MapPin" : "MapPinEmpty"} size={10} color={theme.colors.text.tertiary} />
              <Text style={[styles.badgeText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>{locationLabel}</Text>
            </View>
          )}
          {entry.type && (
            <View style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
              <Icon name="Bookmark" size={10} color={theme.colors.text.secondary} />
              <Text style={[styles.badgeText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>{entry.type}</Text>
            </View>
          )}
          {entry.status && entry.status !== "none" && (
            <View style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
              <StatusIcon status={entry.status as any} size={10} />
              <Text style={[styles.badgeText, { color: getStatusColor(entry.status as any), fontFamily: theme.typography.fontFamily.medium }]}>
                {getStatusLabel(entry.status as any)}
              </Text>
            </View>
          )}
          {entry.priority != null && entry.priority > 0 && (() => {
            const info = getPriorityInfo(entry.priority!);
            const color = theme.colors.priority[info?.category as PriorityCategory || "none"];
            return (
              <View style={[styles.badge, { backgroundColor: color + "20" }]}>
                <Icon name="Flag" size={10} color={color} />
                <Text style={[styles.badgeText, { color, fontFamily: theme.typography.fontFamily.medium }]}>{info?.label || `P${entry.priority}`}</Text>
              </View>
            );
          })()}
          {entry.rating != null && entry.rating > 0 && (
            <View style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
              <Icon name="Star" size={10} color={theme.colors.text.secondary} />
              <Text style={[styles.badgeText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
                {formatRatingDisplay(entry.rating)}
              </Text>
            </View>
          )}
          {entry.due_date && !isNaN(new Date(entry.due_date).getTime()) && (
            <View style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
              <Icon name="CalendarClock" size={10} color={theme.colors.text.secondary} />
              <Text style={[styles.badgeText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
                {new Date(entry.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              </Text>
            </View>
          )}
          {entry.tags?.map(tag => (
            <View key={tag} style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
              <Text style={[styles.badgeText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>#{tag}</Text>
            </View>
          ))}
          {entry.mentions?.map(mention => (
            <View key={mention} style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
              <Text style={[styles.badgeText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>@{mention}</Text>
            </View>
          ))}
        </View>
      )}

      {entry.content && !contentReady && (
        <Text style={[styles.loadingText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
          Loading content...
        </Text>
      )}
      {entry.content && contentReady && (
        <View style={!expanded && styles.collapsed} pointerEvents={expanded ? "auto" : "none"}>
          <View style={styles.contentContainer}>
            <WebViewHtmlRenderer html={sanitizeHtml(entry.content)} />
          </View>
        </View>
      )}

      {expanded && children}

      {entry.is_pinned && (
        <View style={styles.flagsRow}>
          <View style={[styles.flagBadge, { backgroundColor: theme.colors.background.tertiary }]}>
            <Icon name="Pin" size={10} color={theme.colors.text.tertiary} />
            <Text style={[styles.flagText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>Pinned</Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginBottom: themeBase.spacing.lg,
    padding: themeBase.spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    marginBottom: 4,
  },
  badgesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: themeBase.spacing.md,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: themeBase.spacing.xs - 2,
    borderRadius: themeBase.borderRadius.full,
  },
  badgeText: {
    fontSize: themeBase.typography.fontSize.xs,
  },
  loadingText: {
    fontSize: 13,
    marginTop: 8,
  },
  collapsed: {
    maxHeight: 120,
    overflow: "hidden",
  },
  contentContainer: {
    marginTop: themeBase.spacing.xs,
  },
  flagsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: themeBase.spacing.md,
  },
  flagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: themeBase.spacing.xs - 2,
    borderRadius: themeBase.borderRadius.full,
  },
  flagText: {
    fontSize: themeBase.typography.fontSize.xs,
  },
});
