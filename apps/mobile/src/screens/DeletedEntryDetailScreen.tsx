/**
 * DeletedEntryDetailScreen — View a soft-deleted entry's full content and storage info
 *
 * Shows storage breakdown, metadata, entry content, all attachments (including deleted),
 * version history count. Actions: Restore entry, Permanently delete.
 *
 * Navigation: Data Management > Deleted Entries > Entry Detail
 */

import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useMemo } from "react";
import { Icon } from "../shared/components";
import { useNavigate } from "../shared/navigation";
import { useTheme } from "../shared/contexts/ThemeContext";
import { getNavParams } from "../shared/navigation/NavigationService";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { CollapsibleEntryCard } from "../components/layout/CollapsibleEntryCard";
import { HtmlRenderProvider } from "../modules/entries/components/HtmlRenderProvider";
import { PhotoGallery } from "../modules/photos/components/PhotoGallery";
import { themeBase } from "../shared/theme/themeBase";
import {
  formatBytes,
  type Attachment,
} from "@trace/core";
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

export function DeletedEntryDetailScreen() {
  const theme = useTheme();
  const navigate = useNavigate();
  const params = getNavParams();
  const entryId = (params.entryId as string) || null;

  const { data: entry, isLoading, error } = useDeletedEntryDetail(entryId);
  const { data: rawAttachments } = useAllAttachments(entryId);
  const { data: versionInfo } = useVersionCount(entryId);
  const { data: streamName } = useStreamName(entry?.stream_id ?? null);
  const { restoreEntry, isRestoring, hardDeleteEntry, isDeletingEntry } = useLocalTrash();

  // Split attachments into live and deleted
  const { liveAttachments, deletedAttachments, allAttachmentBytes } = useMemo(() => {
    if (!rawAttachments || !entry) return { liveAttachments: [] as Attachment[], deletedAttachments: [] as any[], allAttachmentBytes: 0 };

    const entryDeletedAt = typeof entry.deleted_at === 'string'
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
      // Individually deleted before the entry was trashed
      const attachmentDeletedAt = typeof a.deleted_at === 'string' ? Date.parse(a.deleted_at) : (a.deleted_at ?? 0);
      if (a.deleted_at && attachmentDeletedAt < entryDeletedAt) {
        deleted.push({ ...mapped, deleted_at: a.deleted_at });
      } else {
        live.push(mapped);
      }
    }

    return { liveAttachments: live, deletedAttachments: deleted, allAttachmentBytes: totalBytes };
  }, [rawAttachments, entry, entryId]);

  const handleRestore = async () => {
    const streamStatus = await getStreamStatusForRestore(entry?.stream_id ?? null);

    const message = streamStatus.deleted || !entry?.stream_id
      ? "The entry and its attachments will be restored to Inbox."
      : `The entry and its attachments will be restored to "${streamStatus.name || 'its stream'}".`;

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
              const toastMsg = result.restored_to_inbox
                ? "Entry restored to Inbox"
                : "Entry restored";
              navigate("deleted-entries", { restoredMessage: toastMsg });
            } catch (err) {
              Alert.alert("Error", "Failed to restore entry. Please try again.");
            }
          },
        },
      ]
    );
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
              navigate("deleted-entries");
            } catch (err) {
              Alert.alert("Error", "Failed to delete entry. Please try again.");
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        <SecondaryHeader title="Deleted Entry" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.text.tertiary} />
        </View>
      </View>
    );
  }

  if (error || !entry) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        <SecondaryHeader title="Deleted Entry" />
        <View style={styles.centered}>
          <Text style={[styles.errorText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
            Failed to load entry.
          </Text>
        </View>
      </View>
    );
  }

  // Format dates
  const deletedAtStr = typeof entry.deleted_at === 'number'
    ? new Date(entry.deleted_at).toISOString()
    : (entry.deleted_at ?? '');
  const createdAtStr = typeof entry.created_at === 'number'
    ? new Date(entry.created_at).toISOString()
    : (entry.created_at ?? '');
  const updatedAtStr = typeof entry.updated_at === 'number'
    ? new Date(entry.updated_at).toISOString()
    : (entry.updated_at ?? '');
  const entryDateStr = typeof entry.entry_date === 'number'
    ? new Date(entry.entry_date).toISOString()
    : entry.entry_date;

  // Size breakdown
  const contentBytes = (entry.content?.length ?? 0) + (entry.title?.length ?? 0);
  const versionBytes = versionInfo?.bytes ?? 0;
  const totalBytes = contentBytes + allAttachmentBytes + versionBytes;

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title="Deleted Entry" />

      <HtmlRenderProvider>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Deletion info */}
        <View style={[styles.card, { backgroundColor: theme.colors.functional.overdue + '10' }, theme.shadows.sm]}>
          <View style={styles.deletedRow}>
            <Icon name="Trash2" size={16} color={theme.colors.functional.overdue} />
            <Text style={[styles.deletedText, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.medium }]}>
              Deleted {formatDateTime(deletedAtStr)}
            </Text>
          </View>
        </View>

        {/* Size & storage info */}
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
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
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
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
          <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
            <View style={styles.infoHeader}>
              <Icon name="Paperclip" size={16} color={theme.colors.text.secondary} />
              <Text style={[styles.infoHeaderText, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
                Attachments ({liveAttachments.length})
              </Text>
            </View>
            <PhotoGallery
              entryId={entryId!}
              attachments={liveAttachments}
              photoSize={80}
            />
          </View>
        )}

        {/* Deleted attachments */}
        {deletedAttachments.length > 0 && (
          <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
            <View style={styles.infoHeader}>
              <Icon name="Trash2" size={16} color={theme.colors.functional.overdue} />
              <Text style={[styles.infoHeaderText, { color: theme.colors.functional.overdue, fontFamily: theme.typography.fontFamily.semibold }]}>
                Deleted Attachments ({deletedAttachments.length})
              </Text>
            </View>
            <PhotoGallery
              entryId={entryId!}
              attachments={deletedAttachments}
              photoSize={80}
            />
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
      </HtmlRenderProvider>

      {/* Fixed footer — always visible */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.colors.functional.accent, opacity: isRestoring ? 0.6 : 1 }]}
          onPress={handleRestore}
          activeOpacity={0.8}
          disabled={isRestoring || isDeletingEntry}
        >
          {isRestoring ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Icon name="RotateCcw" size={16} color="#fff" />
          )}
          <Text style={[styles.actionButtonText, { fontFamily: theme.typography.fontFamily.semibold }]}>
            {isRestoring ? "Restoring..." : "Restore Entry"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: theme.colors.functional.overdue + "15", opacity: isDeletingEntry ? 0.6 : 1 }]}
          onPress={handlePermanentDelete}
          activeOpacity={0.8}
          disabled={isRestoring || isDeletingEntry}
        >
          {isDeletingEntry ? (
            <ActivityIndicator size="small" color={theme.colors.functional.overdue} />
          ) : (
            <Icon name="Trash2" size={16} color={theme.colors.functional.overdue} />
          )}
          <Text style={[styles.actionButtonText, { fontFamily: theme.typography.fontFamily.semibold, color: theme.colors.functional.overdue }]}>
            {isDeletingEntry ? "Deleting..." : "Delete Forever"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1, padding: themeBase.spacing.lg },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { fontSize: 15 },

  // Cards
  card: {
    borderRadius: 12,
    marginBottom: themeBase.spacing.lg,
    padding: themeBase.spacing.lg,
    overflow: "hidden",
  },

  // Deletion info
  deletedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deletedText: { fontSize: 14 },

  // Info header
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  infoHeaderText: {
    fontSize: 15,
  },

  // Info grid
  infoGrid: {
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 13,
  },
  infoValue: {
    fontSize: 13,
  },

  // Action buttons
  actionButtons: {
    gap: themeBase.spacing.sm,
    paddingHorizontal: themeBase.spacing.lg,
    paddingTop: themeBase.spacing.md,
    paddingBottom: themeBase.spacing.lg,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 16,
  },
});
