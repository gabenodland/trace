/**
 * DataManagementScreen — User-facing data management
 *
 * Layout: 4 full-width data panels (Streams, Entries, Attachments, Places),
 * Tools section, Advanced section.
 *
 * Navigation: Profile > Manage > Data
 */

import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { Icon } from "../shared/components";
import { useNavigate } from "../shared/navigation";
import { useTheme } from "../shared/contexts/ThemeContext";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { themeBase } from "../shared/theme/themeBase";
import { formatBytes } from "@trace/core";
import {
  useDeviceStorageUsage,
  useDataInventory,
  useCloudStorageUsage,
  useTrash,
} from "../modules/dataManagement";
import { fullSync } from "../shared/sync/syncApi";
import { createScopedLogger } from "../shared/utils/logger";

const log = createScopedLogger("DataMgmt");

// ============================================================================
// DATA PANEL COMPONENT
// ============================================================================

interface DetailLine {
  label: string;
  value: string | number;
  color?: string;
  onPress?: () => void;
}

interface DataPanelProps {
  icon: string;
  label: string;
  count: number;
  details: DetailLine[];
}

function DataPanel({ icon, label, count, details }: DataPanelProps) {
  const theme = useTheme();

  return (
    <View style={[panelStyles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
      <View style={panelStyles.header}>
        <Icon name={icon as any} size={20} color={theme.colors.text.secondary} />
        <Text style={[panelStyles.label, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
          {label}
        </Text>
        <Text style={[panelStyles.count, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}>
          {count}
        </Text>
      </View>
      {details.length > 0 && (
        <View style={panelStyles.details}>
          {details.map((d, i) => {
            const content = (
              <View style={panelStyles.detailRow}>
                <Text style={[panelStyles.detailLabel, { color: d.color ?? theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                  {d.label}
                </Text>
                <View style={panelStyles.detailRight}>
                  <Text style={[panelStyles.detailValue, { color: d.color ?? theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
                    {d.value}
                  </Text>
                  {d.onPress && (
                    <Icon name="ChevronRight" size={14} color={d.color ?? theme.colors.text.tertiary} />
                  )}
                </View>
              </View>
            );
            if (d.onPress) {
              return (
                <TouchableOpacity key={d.label} onPress={d.onPress} activeOpacity={0.7}>
                  {content}
                </TouchableOpacity>
              );
            }
            return <View key={d.label}>{content}</View>;
          })}
        </View>
      )}
    </View>
  );
}

const panelStyles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginBottom: themeBase.spacing.sm,
    padding: themeBase.spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  label: {
    flex: 1,
    fontSize: 16,
  },
  count: {
    fontSize: 20,
  },
  details: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.06)",
    gap: 4,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailLabel: {
    fontSize: 13,
  },
  detailRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailValue: {
    fontSize: 13,
  },
});

// ============================================================================
// TOOL ROW COMPONENT
// ============================================================================

interface ToolRowProps {
  icon: string;
  label: string;
  detail?: string;
  onPress: () => void;
  isLast?: boolean;
  loading?: boolean;
}

function ToolRow({ icon, label, detail, onPress, isLast, loading }: ToolRowProps) {
  const theme = useTheme();

  return (
    <>
      <TouchableOpacity style={toolStyles.row} onPress={onPress} activeOpacity={0.7} disabled={loading}>
        <Icon name={icon as any} size={20} color={theme.colors.text.secondary} />
        <View style={toolStyles.rowContent}>
          <Text style={[toolStyles.rowLabel, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
            {label}
          </Text>
          {detail && (
            <Text style={[toolStyles.rowDetail, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
              {detail}
            </Text>
          )}
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.text.tertiary} />
        ) : (
          <Icon name="ChevronRight" size={18} color={theme.colors.text.tertiary} />
        )}
      </TouchableOpacity>
      {!isLast && <View style={[toolStyles.divider, { backgroundColor: theme.colors.border.light }]} />}
    </>
  );
}

const toolStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15 },
  rowDetail: { fontSize: 12, marginTop: 1 },
  divider: { height: 1, marginLeft: 48 },
});

// ============================================================================
// MAIN SCREEN
// ============================================================================

export function DataManagementScreen() {
  const theme = useTheme();
  const navigate = useNavigate();

  // Data hooks
  const { deviceStorage, isLoading: deviceLoading, refetch: refetchDevice } = useDeviceStorageUsage();
  const { storageUsage: cloudStorage, isLoading: cloudLoading, refetch: refetchCloud } = useCloudStorageUsage();
  const { localCounts, privateCounts, versionCount, trashedAttachmentCount, isLoading: inventoryLoading, refetch: refetchInventory } = useDataInventory();
  const { counts: trashCounts, refetchAll: refetchTrash } = useTrash();

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await fullSync();
    } catch (error) {
      log.error("Sync failed", error as Error);
    } finally {
      setSyncing(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchDevice(), refetchCloud(), refetchInventory()]);
      refetchTrash();
    } catch (error) {
      log.warn("Refresh failed", error as Error);
    } finally {
      setRefreshing(false);
    }
  }, [refetchDevice, refetchCloud, refetchInventory, refetchTrash]);

  // Build detail lines for each panel
  const streamDetails: DetailLine[] = [];
  if ((privateCounts?.streams ?? 0) > 0) {
    streamDetails.push({ label: "On this device only", value: privateCounts!.streams });
  }

  const entryDetails: DetailLine[] = [];
  if (versionCount > 0) {
    entryDetails.push({ label: "History snapshots", value: versionCount });
  }
  if ((privateCounts?.entries ?? 0) > 0) {
    entryDetails.push({ label: "On this device only", value: privateCounts!.entries });
  }
  if (trashCounts.entries > 0) {
    entryDetails.push({
      label: "Deleted entries",
      value: trashCounts.entries,
    });
  }

  const attachmentDetails: DetailLine[] = [];
  if (deviceStorage) {
    attachmentDetails.push({ label: "Local disk", value: formatBytes(deviceStorage.attachment_bytes) });
  }
  if (cloudStorage) {
    attachmentDetails.push({ label: "Cloud storage", value: formatBytes(cloudStorage.attachment_bytes) });
  }
  if ((privateCounts?.attachments ?? 0) > 0) {
    attachmentDetails.push({ label: "On this device only", value: privateCounts!.attachments });
  }
  if (trashedAttachmentCount > 0) {
    attachmentDetails.push({ label: "From deleted entries", value: trashedAttachmentCount });
  }

  const placeDetails: DetailLine[] = [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title="Data Management" />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.text.tertiary} />
        }
      >
        {/* ── DATA PANELS ──────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.semibold }]}>
          YOUR DATA
        </Text>

        <DataPanel
          icon="Layers"
          label="Streams"
          count={localCounts?.streams ?? 0}
          details={streamDetails}
        />
        <DataPanel
          icon="FileText"
          label="Entries"
          count={localCounts?.entries ?? 0}
          details={entryDetails}
        />
        <DataPanel
          icon="Paperclip"
          label="Attachments"
          count={localCounts?.attachments ?? 0}
          details={attachmentDetails}
        />
        <DataPanel
          icon="MapPin"
          label="Places"
          count={localCounts?.places ?? 0}
          details={placeDetails}
        />

        {/* ── TOOLS ───────────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.semibold, marginTop: themeBase.spacing.md }]}>
          TOOLS
        </Text>
        <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
          <ToolRow
            icon="RefreshCw"
            label="Sync Now"
            detail={syncing ? "Syncing..." : "Sync data with the cloud"}
            onPress={handleSync}
            loading={syncing}
          />
        </View>

        {/* ── ADVANCED ────────────────────────────────────────────── */}
        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={() => setAdvancedOpen(!advancedOpen)}
          activeOpacity={0.7}
        >
          <Icon name={advancedOpen ? "ChevronDown" : "ChevronRight"} size={16} color={theme.colors.text.tertiary} />
          <Text style={[styles.advancedToggleText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
            Advanced
          </Text>
        </TouchableOpacity>
        {advancedOpen && (
          <View style={[styles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
            <ToolRow
              icon="Database"
              label="Developer Info"
              detail="Raw database debug screen"
              onPress={() => navigate("debug")}
              isLast
            />
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: themeBase.spacing.lg },

  // Cards
  card: { borderRadius: 12, marginBottom: themeBase.spacing.lg, overflow: "hidden" },
  sectionTitle: { fontSize: 12, letterSpacing: 1, marginBottom: themeBase.spacing.sm, marginLeft: themeBase.spacing.xs },

  // Advanced
  advancedToggle: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: themeBase.spacing.sm, marginLeft: themeBase.spacing.xs },
  advancedToggleText: { fontSize: 13 },
});
