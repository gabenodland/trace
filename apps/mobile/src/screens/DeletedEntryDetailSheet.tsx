/**
 * DeletedEntryDetailSheet — Bottom sheet showing a soft-deleted entry's content and storage info
 *
 * Shows storage breakdown, metadata, entry content, all attachments (including deleted),
 * version history count. Actions: Restore entry, Permanently delete.
 *
 * Opened inline from DeletedEntriesScreen — no navigation needed.
 */

import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useMemo } from "react";
import { Icon } from "../shared/components";
import { useTheme } from "../shared/contexts/ThemeContext";
import { PickerBottomSheet } from "../components/sheets/PickerBottomSheet";
import { SheetActionBar } from "../components/sheets/SheetActionBar";
import { CollapsibleEntryCard } from "../components/layout/CollapsibleEntryCard";
import { HtmlRenderProvider } from "../modules/entries/components/HtmlRenderProvider";
import { PhotoGallery } from "../modules/photos/components/PhotoGallery";
import { themeBase } from "../shared/theme/themeBase";
import { formatBytes, type Attachment } from "@trace/core";
import { useLocalTrash } from "../modules/dataManagement";
import { localDB } from "../shared/db/localDB";
import { useQuery } from "@tanstack/react-query";
import { triggerPushSync } from "../shared/sync/syncApi";
import { getStreamStatusForRestore } from "../modules/dataManagement/mobileDataManagementApi";

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

function useDeletedEntryDetail(entryId: string | null) {
  return useQuery({
    queryKey: ["dataManagement", "deletedEntryDetail", entryId] as const,
    queryFn: async () => {
      const entry = await localDB.getEntry(entryId!);
      if (!entry || !entry.deleted_at) return null;
      return entry;
    },
    enabled: !!entryId,
  });
}

function useAllAttachments(entryId: string | null) {
  return useQuery({
    queryKey: ["dataManagement", "deletedEntryAllAttachments", entryId] as const,
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
    queryKey: ["dataManagement", "deletedEntryVersionCount", entryId] as const,
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
    queryKey: ["dataManagement", "deletedEntryStreamName", streamId] as const,
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

interface DeletedEntryDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  entryId: string | null;
  onRestored?: (message: string) => void;
}

export function DeletedEntryDetailSheet({ visible, onClose, entryId, onRestored }: DeletedEntryDetailSheetProps) {
  const theme = useTheme();

  const { data: entry, isLoading } = useDeletedEntryDetail(entryId);
  const { data: rawAttachments } = useAllAttachments(entryId);
  const { data: versionInfo } = useVersionCount(entryId);
  const { data: streamName } = useStreamName(entry?.stream_id ?? null);
  const { restoreEntry, isRestoring, hardDeleteEntry, isDeletingEntry } = useLocalTrash();

  const { liveAttachments, deletedAttachments, allAttachmentBytes } = useMemo(() => {
    if (!rawAttachments || !entry) return { liveAttachments: [] as Attachment[], deletedAttachments: [] as any[], allAttachmentBytes: 0 };

    const entryDeletedAt = typeof entry.deleted_at === "string"
      ? Date.parse(entry.deleted_at)
      : (entry.deleted_at ?? 0);

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
      const attachmentDeletedAt = typeof a.deleted_at === "string" ? Date.parse(a.deleted_at) : (a.deleted_at ?? 0);
      if (a.deleted_at && attachmentDeletedAt < entryDeletedAt) {
        deleted.push({ ...mapped, deleted_at: a.deleted_at });
      } else {
        live.push(mapped);
      }
    }

    return { liveAttachments: live, deletedAttachments: deleted, allAttachmentBytes: totalBytes };
  }, [rawAttachments, entry, entryId]);

  const handleRestore = async () => {
    try {
      const streamStatus = await getStreamStatusForRestore(entry?.stream_id ?? null);
      const message = streamStatus.deleted || !entry?.stream_id
        ? "The entry and its attachments will be restored to Inbox."
        : `The entry and its attachments will be restored to "${streamStatus.name || "its stream"}".`;

      Alert.alert(
        "Restore this entry?",
        message,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Restore",
            onPress: async () => {
              try {
                const result = await restoreEntry(entryId!);
                triggerPushSync();
                const toastMsg = result.restored_to_inbox ? "Entry restored to Inbox" : "Entry restored";
                onRestored?.(toastMsg);
                onClose();
              } catch {
                Alert.alert("Error", "Failed to restore entry. Please try again.");
              }
            },
          },
        ]
      );
    } catch {
      Alert.alert("Error", "Failed to restore entry. Please try again.");
    }
  };

  const handlePermanentDelete = () => {
    Alert.alert(
      "Permanently delete?",
      "This entry and all its attachments will be permanently deleted. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            try {
              await hardDeleteEntry(entryId!);
              onClose();
            } catch {
              Alert.alert("Error", "Failed to delete entry. Please try again.");
            }
          },
        },
      ]
    );
  };

  const deletedAtStr = entry
    ? typeof entry.deleted_at === "number"
      ? new Date(entry.deleted_at).toISOString()
      : (entry.deleted_at ?? "")
    : "";
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

  const contentBytes = (entry?.content?.length ?? 0) + (entry?.title?.length ?? 0);
  const versionBytes = versionInfo?.bytes ?? 0;
  const totalBytes = contentBytes + allAttachmentBytes + versionBytes;

  const cardStyle = [styles.card, {
    backgroundColor: theme.colors.background.primary,
    borderColor: theme.colors.border.medium,
    borderWidth: 1,
  }, theme.shadows.sm];

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={onClose}
      title="Deleted Entry"
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
        <>
        <HtmlRenderProvider>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Deletion info banner */}
            <View style={[styles.card, { backgroundColor: theme.colors.functional.overdue + "10", borderColor: theme.colors.functional.overdue + "30", borderWidth: 1 }]}>
              <View style={styles.deletedRow}>
                <Icon name="Trash2" size={16} color={theme.colors.functional.overdue} />
                <Text style={[styles.deletedText, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.medium }]}>
                  Deleted {formatDateTime(deletedAtStr)}
                </Text>
              </View>
            </View>

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

            <View style={{ height: themeBase.spacing.sm }} />
          </ScrollView>

        </HtmlRenderProvider>
        <SheetActionBar actions={[
          {
            label: isRestoring ? "Restoring..." : "Restore Entry",
            icon: "RotateCcw",
            onPress: handleRestore,
            backgroundColor: theme.colors.functional.accent,
            isLoading: isRestoring,
            disabled: isDeletingEntry,
          },
          {
            label: isDeletingEntry ? "Deleting..." : "Delete Forever",
            icon: "Trash2",
            onPress: handlePermanentDelete,
            backgroundColor: theme.colors.functional.overdue + "15",
            textColor: theme.colors.functional.overdue,
            isLoading: isDeletingEntry,
            disabled: isRestoring,
          },
        ]} />
        </>
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
  deletedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deletedText: { fontSize: 14 },
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
});
