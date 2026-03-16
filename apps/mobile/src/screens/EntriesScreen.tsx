/**
 * EntriesScreen — List of all live entries with sizes
 *
 * Features: search by title/content, sort by stream/date/size.
 * Shows all non-deleted entries from local SQLite.
 *
 * Navigation: Data Management > Entries
 */

import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView } from "react-native";
import { useState, useCallback, useMemo } from "react";
import { Icon } from "../shared/components";
import { useNavigate } from "../shared/navigation";
import { useTheme } from "../shared/contexts/ThemeContext";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { SearchBar } from "../components/layout/SearchBar";
import { SortBar, type SortOption } from "../shared/components/SortBar";
import { formatBytes } from "@trace/core";
import { EmptyState, LoadingState } from "../shared/components";
import { useEntryList } from "../modules/dataManagement";
import type { EntryListItem } from "../modules/dataManagement/mobileDataManagementApi";
import { CardRowWrapper, useCardListProps, managementCardStyles as mcStyles } from "../components/layout/ManagementCard";

type SortKey = "stream" | "modified" | "size";

const SORT_OPTIONS: SortOption<SortKey>[] = [
  { key: "stream", label: "Stream" },
  { key: "modified", label: "Modified" },
  { key: "size", label: "Size" },
];

export function EntriesScreen() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { entries, isLoading } = useEntryList();
  const cardListProps = useCardListProps(theme);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("modified");
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
    let items = entries;

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
      } else if (sortKey === "modified") {
        cmp = (b.updated_at || "").localeCompare(a.updated_at || "");
      } else {
        const aTotal = a.content_bytes + a.attachment_bytes;
        const bTotal = b.content_bytes + b.attachment_bytes;
        cmp = bTotal - aTotal;
      }
      return ascending ? -cmp : cmp;
    });

    return sorted;
  }, [entries, search, sortKey, ascending]);

  const renderItem = useCallback(({ item }: { item: EntryListItem }) => {
    const modifiedDate = item.updated_at
      ? new Date(item.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : '';
    const totalBytes = item.content_bytes + item.attachment_bytes;

    return (
      <CardRowWrapper theme={theme}>
        <TouchableOpacity
          style={mcStyles.row}
          onPress={() => navigate("entry-detail", { entryId: item.id })}
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
              {modifiedDate ? (
                <Text style={[styles.metaText, styles.dateCol, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                  {modifiedDate}
                </Text>
              ) : null}
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
  }, [theme, navigate]);

  const keyExtractor = useCallback((item: EntryListItem) => item.id, []);

  const searchButton = (
    <TouchableOpacity onPress={() => setIsSearchOpen(!isSearchOpen)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
      <Icon name="Search" size={20} color={isSearchOpen ? theme.colors.functional.accent : theme.colors.text.primary} />
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView style={[mcStyles.container, { backgroundColor: theme.colors.background.secondary }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <SecondaryHeader title={`Entries (${entries.length})`} rightAction={searchButton} />

      {isSearchOpen && (
        <SearchBar
          value={search}
          onChangeText={setSearch}
          onClose={() => { setIsSearchOpen(false); setSearch(""); }}
          placeholder="Search title or content..."
        />
      )}

      {isLoading ? (
        <LoadingState message="Loading entries..." />
      ) : entries.length === 0 && !search ? (
        <EmptyState
          icon="FileText"
          title="No Entries"
          subtitle="Entries you create will appear here."
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
              // Intentional: remount on sort change avoids expensive FlatList reconciliation.
              // Fresh mount is faster than diffing 280+ items. Scroll resets to top — correct UX for sort.
              key={`${sortKey}-${ascending}`}
              {...cardListProps}
              data={filteredEntries}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
            />
          )}
        </View>
      )}
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
    width: 60,
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
});
