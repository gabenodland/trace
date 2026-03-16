/**
 * EntryDetailSheet — Bottom sheet showing a live entry's full content and storage info
 *
 * Shows entry content, metadata, all attachments (including deleted),
 * version history count, and total size breakdown.
 *
 * Opened inline from EntriesScreen — no navigation needed.
 */

import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useMemo } from "react";
import { Icon } from "../shared/components";
import { useTheme } from "../shared/contexts/ThemeContext";
import { PickerBottomSheet } from "../components/sheets/PickerBottomSheet";
import { CollapsibleEntryCard } from "../components/layout/CollapsibleEntryCard";
import { HtmlRenderProvider } from "../modules/entries/components/HtmlRenderProvider";
import { PhotoGallery } from "../modules/photos/components/PhotoGallery";
import { themeBase } from "../shared/theme/themeBase";
import { formatBytes, type Attachment } from "@trace/core";
import { localDB } from "../shared/db/localDB";
import { useQuery } from "@tanstack/react-query";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const datePart = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart} at ${timePart}`;
}

function useEntryDetail(entryId: string | null) {
  return useQuery({
    queryKey: ["dataManagement", "entryDetail", entryId] as const,
    queryFn: async () => {
      const entry = await localDB.getEntry(entryId!);
      if (!entry) return null;
      return entry;
    },
    enabled: !!entryId,
  });
}

function useAllAttachments(entryId: string | null) {
  return useQuery({
    queryKey: ["dataManagement", "entryAllAttachments", entryId] as const,
    queryFn: async () => {
      const rows = await localDB.runCustomQuery(
        `SELECT * FROM attachments WHERE entry_id = ? ORDER BY position ASC`,
        [entryId!]
      );
      return rows;
    },
    enabled: !!entryId,
  });
}

function useVersionCount(entryId: string | null) {
  return useQuery({
    queryKey: ["dataManagement", "entryVersionCount", entryId] as const,
    queryFn: async () => {
      const rows = await localDB.runCustomQuery(
        `SELECT COUNT(*) as count, COALESCE(SUM(LENGTH(snapshot)), 0) as bytes FROM entry_versions WHERE entry_id = ?`,
        [entryId!]
      );
      return { count: rows[0]?.count ?? 0, bytes: rows[0]?.bytes ?? 0 };
    },
    enabled: !!entryId,
  });
}

function useStreamName(streamId: string | null) {
  return useQuery({
    queryKey: ["dataManagement", "streamName", streamId] as const,
    queryFn: async () => {
      const rows = await localDB.runCustomQuery(
        `SELECT name FROM streams WHERE stream_id = ?`,
        [streamId!]
      );
      return rows[0]?.name ?? null;
    },
    enabled: !!streamId,
  });
}

interface EntryDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  entryId: string | null;
}

export function EntryDetailSheet({ visible, onClose, entryId }: EntryDetailSheetProps) {
  const theme = useTheme();

  const { data: entry, isLoading } = useEntryDetail(entryId);
  const { data: rawAttachments } = useAllAttachments(entryId);
  const { data: versionInfo } = useVersionCount(entryId);
  const { data: streamName } = useStreamName(entry?.stream_id ?? null);

  const { liveAttachments, deletedAttachments, allAttachmentBytes } = useMemo(() => {
    if (!rawAttachments) return { liveAttachments: [] as Attachment[], deletedAttachments: [] as any[], allAttachmentBytes: 0 };

    const live: Attachment[] = [];
    const deleted: any[] = [];
    let totalBytes = 0;

    for (const a of rawAttachments as any[]) {
      totalBytes += a.file_size ?? 0;
      const mapped: Attachment = {
        attachment_id: a.attachment_id,
        entry_id: entryId!,
        user_id: a.user_id || "",
        file_path: a.file_path,
        mime_type: a.mime_type,
        file_size: a.file_size,
        width: a.width,
        height: a.height,
        position: a.position,
        created_at: "",
        updated_at: "",
      };
      if (a.deleted_at) {
        deleted.push({ ...mapped, deleted_at: a.deleted_at });
      } else {
        live.push(mapped);
      }
    }

    return { liveAttachments: live, deletedAttachments: deleted, allAttachmentBytes: totalBytes };
  }, [rawAttachments, entryId]);

  const contentBytes = (entry?.content?.length ?? 0) + (entry?.title?.length ?? 0);
  const versionBytes = versionInfo?.bytes ?? 0;
  const totalBytes = contentBytes + allAttachmentBytes + versionBytes;

  const createdAtStr = entry
    ? typeof entry.created_at === "number"
      ? new Date(entry.created_at).toISOString()
      : (entry.created_at ?? "")
    : "";
  const updatedAtStr = entry
    ? typeof entry.updated_at === "number"
      ? new Date(entry.updated_at).toISOString()
      : (entry.updated_at ?? "")
    : "";
  const entryDateStr = entry
    ? typeof entry.entry_date === "number"
      ? new Date(entry.entry_date).toISOString()
      : entry.entry_date
    : null;

  const cardStyle = [styles.card, {
    backgroundColor: theme.colors.background.primary,
    borderColor: theme.colors.border.medium,
    borderWidth: 1,
  }, theme.shadows.sm];

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Entry Detail"
      subtitle={entry?.title ?? undefined}
      height={0.88}
      swipeArea="grabber"
      usesCards
    >
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.text.tertiary} />
        </View>
      ) : !entry ? (
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
            Entry not found.
          </Text>
        </View>
      ) : (
        <HtmlRenderProvider>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Size & storage info */}
            <View style={cardStyle}>
              <View style={styles.infoHeader}>
                <Icon name="HardDrive" size={16} color={theme.colors.text.secondary} />
                <Text style={[styles.infoHeaderText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
                  Storage — {formatBytes(totalBytes)}
                </Text>
              </View>
              <View style={styles.infoGrid}>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>Content</Text>
                  <Text style={[styles.infoValue, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>{formatBytes(contentBytes)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                    Attachments ({liveAttachments.length + deletedAttachments.length})
                  </Text>
                  <Text style={[styles.infoValue, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>{formatBytes(allAttachmentBytes)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                    Version history ({versionInfo?.count ?? 0})
                  </Text>
                  <Text style={[styles.infoValue, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>{formatBytes(versionBytes)}</Text>
                </View>
              </View>
              {deletedAttachments.length > 0 && (
                <View style={[styles.deletedNote, { backgroundColor: theme.colors.functional.overdue + "10" }]}>
                  <Icon name="Trash2" size={12} color={theme.colors.functional.overdue} />
                  <Text style={[styles.deletedNoteText, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.medium }]}>
                    {deletedAttachments.length} deleted attachment{deletedAttachments.length > 1 ? "s" : ""} still using space
                  </Text>
                </View>
              )}
            </View>

            {/* Dates & stream */}
            <View style={cardStyle}>
              <View style={styles.infoGrid}>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>Stream</Text>
                  <Text style={[styles.infoValue, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>{streamName || "Inbox"}</Text>
                </View>
                {entryDateStr && (
                  <View style={styles.infoRow}>
                    <Text style={[styles.infoLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>Entry date</Text>
                    <Text style={[styles.infoValue, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>{formatDate(entryDateStr)}</Text>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>Created</Text>
                  <Text style={[styles.infoValue, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>{formatDateTime(createdAtStr)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.infoLabel, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>Modified</Text>
                  <Text style={[styles.infoValue, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>{formatDateTime(updatedAtStr)}</Text>
                </View>
              </View>
            </View>

            {/* Entry content — collapsible */}
            <CollapsibleEntryCard entry={entry} theme={theme} />

            {/* Live attachments */}
            {liveAttachments.length > 0 && (
              <View style={cardStyle}>
                <View style={styles.infoHeader}>
                  <Icon name="Paperclip" size={16} color={theme.colors.text.secondary} />
                  <Text style={[styles.infoHeaderText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
                    Attachments ({liveAttachments.length})
                  </Text>
                </View>
                <PhotoGallery entryId={entryId!} attachments={liveAttachments} photoSize={80} />
              </View>
            )}

            {/* Deleted attachments */}
            {deletedAttachments.length > 0 && (
              <View style={cardStyle}>
                <View style={styles.infoHeader}>
                  <Icon name="Trash2" size={16} color={theme.colors.functional.overdue} />
                  <Text style={[styles.infoHeaderText, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.semibold }]}>
                    Deleted Attachments ({deletedAttachments.length})
                  </Text>
                </View>
                <PhotoGallery entryId={entryId!} attachments={deletedAttachments} photoSize={80} />
              </View>
            )}

            <View style={{ height: themeBase.spacing.xl }} />
          </ScrollView>
        </HtmlRenderProvider>
      )}
    </PickerBottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    paddingTop: themeBase.spacing.xs,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  errorText: { fontSize: 15 },
  card: {
    borderRadius: 12,
    marginBottom: themeBase.spacing.lg,
    padding: themeBase.spacing.lg,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  infoHeaderText: { fontSize: 15 },
  infoGrid: { gap: 8 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13 },
  deletedNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  deletedNoteText: { fontSize: 12 },
});
