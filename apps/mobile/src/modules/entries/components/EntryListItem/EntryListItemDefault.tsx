/**
 * EntryListItemDefault - All display modes (title/flow/cards/smashed)
 * - Title mode: Just title + metadata badges
 * - Flow/cards/smashed: Title, date row (flow only), photos (flow only), content, and metadata
 */

import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import type { EntryDisplayMode } from "@trace/core";
import { Icon } from "../../../../shared/components";
import { getFirstLineOfText, getFormattedContent, getDisplayModeLines, formatEntryDateOnly } from "@trace/core";
import { useTheme } from "../../../../shared/contexts/ThemeContext";
import { themeBase } from "../../../../shared/theme/themeBase";
import { DropdownMenu, type DropdownMenuItem } from "../../../../components/layout/DropdownMenu";
import { WebViewHtmlRenderer } from "../../helpers/webViewHtmlRenderer";
import { PhotoGallery } from "../../../photos/components/PhotoGallery";
import { EntryListItemMetadata } from "./EntryListItemMetadata";
import type { EntryListItemCommonProps } from "./types";

interface DefaultProps extends EntryListItemCommonProps {
  displayMode: EntryDisplayMode;
  menuPosition?: { x: number; y: number };
  menuItems: DropdownMenuItem[];
  photoCount?: number;
  photosCollapsed?: boolean;
  onMenuPress: (e: any) => void;
  onPhotoCountChange?: (count: number) => void;
  onPhotosCollapsedChange?: (collapsed: boolean) => void;
  onOpenPhotoViewer?: () => void;
}

export function EntryListItemDefault({
  entry,
  streamName,
  locationName,
  currentStreamId,
  displayMode,
  showMenu,
  onMenuToggle,
  onSelectOnMap,
  onStreamPress,
  onTagPress,
  onMentionPress,
  showStatus,
  showType,
  showDueDate,
  showRating,
  showPriority,
  showLocation,
  ratingType,
  entryDateStr,
  updatedDateStr,
  dueDateStr,
  isOverdue,
  menuPosition,
  menuItems,
  photoCount = 0,
  photosCollapsed = false,
  onMenuPress,
  onPhotoCountChange,
  onPhotosCollapsedChange,
  onOpenPhotoViewer,
}: DefaultProps) {
  const theme = useTheme();

  // Format content based on display mode (title mode doesn't need content formatting)
  const formattedContent = displayMode !== 'title' ? getFormattedContent(entry.content || '', displayMode) : null;
  const maxLines = displayMode !== 'title' ? getDisplayModeLines(displayMode) : 0;

  return (
    <>
      {/* First line row: title + menu */}
      <View style={styles.firstLineRow}>
        {/* Pin Icon inline */}
        {entry.is_pinned && (
          <View style={styles.firstLinePinIcon}>
            <Icon name="Pin" size={displayMode === 'title' ? 12 : 14} color="#3b82f6" />
          </View>
        )}

        {/* Title or first line of content */}
        <Text style={[
          displayMode === 'title' ? styles.titleOnlyText : (entry.title ? styles.title : styles.contentFirstLine),
          {
            color: theme.colors.text.primary,
            fontFamily: displayMode === 'title'
              ? theme.typography.fontFamily.semibold
              : (entry.title ? theme.typography.fontFamily.bold : theme.typography.fontFamily.semibold)
          },
          styles.firstLineText
        ]} numberOfLines={displayMode === 'title' || !entry.title ? 1 : undefined}>
          {entry.title || getFirstLineOfText(entry.content || '')}
        </Text>

        {/* Map Pin Button - only shown when onSelectOnMap is provided (MapScreen) */}
        {onSelectOnMap && (
          <TouchableOpacity
            style={styles.mapPinButton}
            onPress={(e) => {
              e.stopPropagation();
              onSelectOnMap(entry.entry_id);
            }}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="MapPin" size={18} color={theme.colors.text.tertiary} />
          </TouchableOpacity>
        )}

        {/* Menu Button - fixed width reserved area */}
        <TouchableOpacity
          style={styles.menuButton}
          onPress={onMenuPress}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="MoreVertical" size={20} color={showMenu ? theme.colors.text.primary : theme.colors.text.tertiary} />
        </TouchableOpacity>
      </View>

      {/* Dropdown menu modal */}
      <DropdownMenu
        visible={showMenu}
        onClose={() => onMenuToggle?.()}
        items={menuItems}
        anchorPosition={menuPosition}
      />

      {/* Rest of content - full width (hidden for title-only mode) */}
      {displayMode !== 'title' && (
        entry.title ? (
          /* Has title - show remaining content */
          <>
            {displayMode === 'flow' && (
              <>
                <Text style={[styles.flowDate, { color: theme.colors.text.tertiary }]}>{entryDateStr}</Text>
                <View style={styles.flowAttributesRow}>
                  <EntryListItemMetadata
                    entry={entry}
                    streamName={streamName}
                    locationName={locationName}
                    currentStreamId={currentStreamId}
                    displayMode={displayMode}
                    photoCount={photoCount}
                    photosCollapsed={photosCollapsed}
                    onPhotoPress={onPhotosCollapsedChange ? () => onPhotosCollapsedChange(false) : undefined}
                    onStreamPress={onStreamPress}
                    onTagPress={onTagPress}
                    onMentionPress={onMentionPress}
                    updatedDateStr={updatedDateStr}
                    dueDateStr={dueDateStr}
                    isOverdue={isOverdue}
                    showLocation={showLocation}
                    showType={showType}
                    showStatus={showStatus}
                    showDueDate={showDueDate}
                    showRating={showRating}
                    showPriority={showPriority}
                    ratingType={ratingType}
                  />
                </View>
              </>
            )}
            {displayMode === 'flow' && onPhotosCollapsedChange && onPhotoCountChange && (
              <PhotoGallery
                entryId={entry.entry_id}
                attachments={entry.attachments}
                collapsible={false}
                isCollapsed={photosCollapsed}
                onCollapsedChange={onPhotosCollapsedChange}
                onPhotoCountChange={onPhotoCountChange}
              />
            )}
            {displayMode === 'short' && onPhotoCountChange && (
              <PhotoGallery
                entryId={entry.entry_id}
                attachments={entry.attachments}
                collapsible={false}
                isCollapsed={false}
                onPhotoCountChange={onPhotoCountChange}
                photoSize={70}
              />
            )}
            {displayMode === 'flow' ? (
              <WebViewHtmlRenderer
                html={entry.content || ''}
                style={[
                  styles.preview,
                  { color: theme.colors.text.secondary },
                ]}
              />
            ) : (
              formattedContent && (
                <Text style={[
                  styles.preview,
                  { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular },
                ]} numberOfLines={maxLines}>
                  {formattedContent}
                </Text>
              )
            )}
          </>
        ) : (
          /* No title - show content after first line */
          displayMode === 'flow' ? (
            <>
              <Text style={[styles.flowDate, { color: theme.colors.text.tertiary }]}>{entryDateStr}</Text>
              <View style={styles.flowAttributesRow}>
                <EntryListItemMetadata
                  entry={entry}
                  streamName={streamName}
                  locationName={locationName}
                  currentStreamId={currentStreamId}
                  displayMode={displayMode}
                  photoCount={photoCount}
                  photosCollapsed={photosCollapsed}
                  onPhotoPress={onPhotosCollapsedChange ? () => onPhotosCollapsedChange(false) : undefined}
                  onStreamPress={onStreamPress}
                  onTagPress={onTagPress}
                  onMentionPress={onMentionPress}
                  updatedDateStr={updatedDateStr}
                  dueDateStr={dueDateStr}
                  isOverdue={isOverdue}
                  showLocation={showLocation}
                  showType={showType}
                  showStatus={showStatus}
                  showDueDate={showDueDate}
                  showRating={showRating}
                  showPriority={showPriority}
                  ratingType={ratingType}
                />
              </View>
              {onPhotosCollapsedChange && onPhotoCountChange && (
                <PhotoGallery
                  entryId={entry.entry_id}
                  attachments={entry.attachments}
                  collapsible={false}
                  isCollapsed={photosCollapsed}
                  onCollapsedChange={onPhotosCollapsedChange}
                  onPhotoCountChange={onPhotoCountChange}
                />
              )}
              <WebViewHtmlRenderer
                html={entry.content || ''}
                style={[
                  styles.content,
                  { color: theme.colors.text.primary },
                ]}
              />
            </>
          ) : (
            /* Show remaining lines after first line was shown above */
            <>
              {displayMode === 'short' && onPhotoCountChange && (
                <PhotoGallery
                  entryId={entry.entry_id}
                  attachments={entry.attachments}
                  collapsible={false}
                  isCollapsed={false}
                  onPhotoCountChange={onPhotoCountChange}
                  photoSize={70}
                />
              )}
              {formattedContent && formattedContent.includes('\n') && (
                <Text style={[
                  styles.content,
                  { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.regular },
                ]} numberOfLines={maxLines ? maxLines - 1 : undefined}>
                  {formattedContent.substring(formattedContent.indexOf('\n') + 1)}
                </Text>
              )}
            </>
          )
        )
      )}

      {/* Metadata - hidden for flow mode (metadata shown inline with date at top) */}
      {displayMode !== 'flow' && (
        <View style={styles.metadata}>
          <Text style={[styles.date, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
            {formatEntryDateOnly(entry.entry_date || entry.updated_at)}
          </Text>

          {/* Use shared metadata component */}
          <EntryListItemMetadata
            entry={entry}
            streamName={streamName}
            locationName={locationName}
            currentStreamId={currentStreamId}
            displayMode={displayMode}
            photoCount={photoCount}
            photosCollapsed={photosCollapsed}
            onPhotoPress={onOpenPhotoViewer}
            onStreamPress={onStreamPress}
            onTagPress={onTagPress}
            onMentionPress={onMentionPress}
            updatedDateStr={updatedDateStr}
            dueDateStr={dueDateStr}
            isOverdue={isOverdue}
            showLocation={showLocation}
            showType={showType}
            showStatus={showStatus}
            showDueDate={showDueDate}
            showRating={showRating}
            showPriority={showPriority}
            ratingType={ratingType}
          />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  firstLineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.sm,
  },
  firstLinePinIcon: {
    flexShrink: 0,
  },
  firstLineText: {
    flex: 1,
  },
  menuButton: {
    flexShrink: 0,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: themeBase.spacing.xs,
  },
  mapPinButton: {
    flexShrink: 0,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: themeBase.spacing.xs,
  },
  statusIcon: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  contentFirstLine: {
    fontSize: themeBase.typography.fontSize.base,
    lineHeight: themeBase.typography.fontSize.base * themeBase.typography.lineHeight.tight,
  },
  title: {
    fontSize: themeBase.typography.fontSize.lg,
    lineHeight: themeBase.typography.fontSize.lg * themeBase.typography.lineHeight.tight,
  },
  titleOnlyText: {
    fontSize: themeBase.typography.fontSize.base,
    lineHeight: themeBase.typography.fontSize.base * themeBase.typography.lineHeight.tight,
  },
  dateSmall: {
    fontSize: themeBase.typography.fontSize.xs,
  },
  flowDate: {
    fontSize: themeBase.typography.fontSize.xs,
    marginTop: themeBase.spacing.sm,
  },
  flowAttributesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.sm,
    marginTop: themeBase.spacing.xs,
    marginBottom: themeBase.spacing.md,
    flexWrap: "wrap",
  },
  flowDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.sm,
    marginTop: themeBase.spacing.sm,
    marginBottom: themeBase.spacing.md,
    flexWrap: "wrap",
  },
  preview: {
    fontSize: themeBase.typography.fontSize.sm,
    lineHeight: themeBase.typography.fontSize.sm * themeBase.typography.lineHeight.relaxed,
    marginTop: themeBase.spacing.sm,
  },
  content: {
    fontSize: themeBase.typography.fontSize.base,
    lineHeight: themeBase.typography.fontSize.base * themeBase.typography.lineHeight.relaxed,
    marginTop: themeBase.spacing.sm,
  },
  metadata: {
    flexDirection: "row",
    alignItems: "center",
    gap: themeBase.spacing.sm,
    marginTop: themeBase.spacing.lg,
    flexWrap: "wrap",
  },
  date: {
    fontSize: themeBase.typography.fontSize.xs,
  },
});
