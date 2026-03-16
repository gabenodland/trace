/**
 * DeletedEntriesScreen — List of soft-deleted entries
 *
 * Features: search by title/content, sort by stream/date/size, empty trash.
 * Shows all deleted entries from local SQLite with size info.
 *
 * Navigation: Data Management > Deleted Entries
 */

import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform, KeyboardAvoidingView } from "react-native";
import { useState, useCallback, useMemo } from "react";
import { Icon, Snackbar, useSnackbar, EmptyState, LoadingState } from "../shared/components";
import { useTheme } from "../shared/contexts/ThemeContext";
import { DeletedEntryDetailSheet } from "./DeletedEntryDetailSheet";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { SearchBar } from "../components/layout/SearchBar";
import { SortBar, type SortOption } from "../shared/components/SortBar";
import { formatBytes } from "@trace/core";
import { useLocalTrash } from "../modules/dataManagement";
import { CardRowWrapper, useCardListProps, managementCardStyles as mcStyles } from "../components/layout/ManagementCard";

interface DeletedEntryItem {
  id: string;
  title: string | null;
  content: string | null;
  stream_name: string | null;
  stream_id: string | null;
  deleted_at: string;
  content_bytes: number;
  attachment_count: number;
  attachment_bytes: number;
}

const RETENTION_DAYS = 30;

type SortKey = "stream" | "date" | "size";

const SORT_OPTIONS: SortOption<SortKey>[] = [
  { key: "stream", label: "Stream" },
  { key: "date", label: "Date Deleted" },
  { key: "size", label: "Size" },
];

function getDaysRemaining(dateStr: string): number {
  const deletedAt = new Date(dateStr);
  const expiresAt = new Date(deletedAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const now = new Date();
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

function formatDeletedDate(dateStr: string, remaining: number): string {
  const date = new Date(dateStr);
  const datePart = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (remaining <= 0) return `${datePart} (expiring)`;
  if (remaining === 1) return `${datePart} (1 day left)`;
  return `${datePart} (${remaining}d left)`;
}

export function DeletedEntriesScreen() {
  const theme = useTheme();
  const { deletedEntries, isLoading, emptyTrash, isEmptyingTrash } = useLocalTrash();
  const { message: snackbarMessage, opacity: snackbarOpacity, showSnackbar } = useSnackbar();
  const cardListProps = useCardListProps(theme, { bottomSpacerHeight: 20 });
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [ascending, setAscending] = useState(false);

  const handleSortPress = useCallback((key: SortKey) => {
    setSortKey(prev => {
      if (prev === key) {
        setAscending(a => !a);
        return key;
      }
      setAscending(key === "stream");
      return key;
    });
  }, []);

  const filteredEntries = useMemo(() => {
    let items = deletedEntries as DeletedEntryItem[];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(e =>
        (e.title ?? "").toLowerCase().includes(q) ||
        (e.stream_name ?? "").toLowerCase().includes(q) ||
        (e.content ?? "").toLowerCase().includes(q)
      );
    }

    const sorted = [...items].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "stream") {
        cmp = (a.stream_name || "Inbox").localeCompare(b.stream_name || "Inbox");
      } else if (sortKey === "date") {
        cmp = (b.deleted_at || "").localeCompare(a.deleted_at || "");
      } else {
        const aTotal = a.content_bytes + a.attachment_bytes;
        const bTotal = b.content_bytes + b.attachment_bytes;
        cmp = bTotal - aTotal;
      }
      return ascending ? -cmp : cmp;
    });

    return sorted;
  }, [deletedEntries, search, sortKey, ascending]);

  const handleEmptyTrash = useCallback(() => {
    Alert.alert(
      "Empty Trash",
      "This will permanently delete all trashed entries. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Empty Trash",
          style: "destructive",
          onPress: () => emptyTrash(),
        },
      ]
    );
  }, [emptyTrash]);

  const renderItem = useCallback(({ item }: { item: DeletedEntryItem }) => {
    const remaining = getDaysRemaining(item.deleted_at);
    const totalBytes = item.content_bytes + item.attachment_bytes;

    return (
      <CardRowWrapper theme={theme}>
        <TouchableOpacity
          style={mcStyles.row}
          onPress={() => setSelectedEntryId(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.rowContent}>
            <Text
              style={[styles.title, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}
              numberOfLines={1}
            >
              {item.title || "Untitled"}
            </Text>
            <View style={styles.meta}>
              <Text
                style={[styles.metaText, styles.streamCol, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}
                numberOfLines={1}
              >
                {item.stream_name || "Inbox"}
              </Text>
              <Text style={[styles.metaText, styles.dateCol, {
                color: remaining <= 3 ? theme.colors.functional.overdue : theme.colors.text.tertiary,
                fontFamily: theme.typography.fontFamily.regular,
              }]}>
                {formatDeletedDate(item.deleted_at, remaining)}
              </Text>
              <View style={styles.sizeCol}>
                {item.attachment_count > 0 && (
                  <Icon name="Paperclip" size={12} color={theme.colors.text.tertiary} />
                )}
                <Text style={[styles.metaText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                  {item.attachment_count > 0
                    ? `${item.attachment_count} · ${formatBytes(totalBytes)}`
                    : formatBytes(totalBytes)}
                </Text>
              </View>
            </View>
          </View>
          <Icon name="ChevronRight" size={18} color={theme.colors.text.primary} />
        </TouchableOpacity>
      </CardRowWrapper>
    );
  }, [theme, setSelectedEntryId]);

  const keyExtractor = useCallback((item: DeletedEntryItem) => item.id, []);

  return (
    <KeyboardAvoidingView style={[mcStyles.container, { backgroundColor: theme.colors.background.secondary }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SecondaryHeader
        title="Deleted Entries"
        count={isLoading ? undefined : { total: deletedEntries.length, filtered: search.trim() ? filteredEntries.length : undefined }}
        rightAction={
          <TouchableOpacity onPress={() => setIsSearchOpen(!isSearchOpen)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Icon name="Search" size={20} color={isSearchOpen ? theme.colors.functional.accent : theme.colors.text.primary} />
          </TouchableOpacity>
        }
      />
      <Snackbar message={snackbarMessage} opacity={snackbarOpacity} />

      {isSearchOpen && (
        <SearchBar
          value={search}
          onChangeText={setSearch}
          onClose={() => { setIsSearchOpen(false); setSearch(""); }}
          placeholder="Search title or content..."
        />
      )}

      {isLoading ? (
        <LoadingState message="Loading deleted entries..." />
      ) : deletedEntries.length === 0 && !search ? (
        <EmptyState
          icon="Trash2"
          title="No Deleted Entries"
          subtitle="Entries you delete will appear here for 30 days before being permanently removed."
        />
      ) : (
        <View style={mcStyles.content}>
          <View style={[mcStyles.fixedControls, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
            <SortBar
              options={SORT_OPTIONS}
              activeKey={sortKey}
              ascending={ascending}
              onPress={handleSortPress}
            />
          </View>

          {filteredEntries.length === 0 ? (
            <View style={mcStyles.noResultsContainer}>
              <Text style={[mcStyles.noResultsText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                No entries match "{search}"
              </Text>
            </View>
          ) : (
            <FlatList
              // Intentional: remount on sort change — see EntriesScreen for rationale
              key={`${sortKey}-${ascending}`}
              {...cardListProps}
              data={filteredEntries}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
            />
          )}

          {/* Fixed footer — always visible */}
          <TouchableOpacity
            style={[styles.emptyTrashButton, { backgroundColor: theme.colors.functional.overdue }]}
            onPress={handleEmptyTrash}
            activeOpacity={0.7}
            disabled={isEmptyingTrash}
          >
            {isEmptyingTrash ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="Trash2" size={16} color="#fff" />
                <Text style={[styles.emptyTrashText, { fontFamily: theme.typography.fontFamily.semibold }]}>
                  Empty Trash
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
      <DeletedEntryDetailSheet
        visible={selectedEntryId != null}
        onClose={() => setSelectedEntryId(null)}
        entryId={selectedEntryId}
        onRestored={showSnackbar}
      />
    </KeyboardAvoidingView>
  );
}

// Screen-specific styles only — layout styles come from managementCardStyles
const styles = StyleSheet.create({
  rowContent: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    marginBottom: 4,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
  },
  streamCol: {
    width: 110,
  },
  dateCol: {
    width: 120,
    textAlign: "center",
  },
  sizeCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  emptyTrashButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  emptyTrashText: {
    fontSize: 15,
    color: "#fff",
  },
});
