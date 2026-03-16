/**
 * DataManagementScreen — User-facing data management
 *
 * Layout:
 * - 2x2 grid: Streams, Places, Entries, Deleted Entries (all CountBlock style)
 * - Tools + Advanced
 *
 * Navigation: Profile > Manage > Data
 */

import { useState, useCallback, useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Icon } from "../shared/components";
import { useNavigate } from "../shared/navigation";
import { useTheme } from "../shared/contexts/ThemeContext";
import { SecondaryHeader } from "../components/layout/SecondaryHeader";
import { themeBase } from "../shared/theme/themeBase";
import {
  useCloudStorageUsage,
  formatMB,
  formatStorageUsage,
  getStoragePercentage,
  getStorageWarningLevel,
} from "@trace/core";
import {
  useTopLevelCounts,
  useEntrySummary,
  useDeletedEntrySummary,
  useDeviceStorageUsage,
  usePrivacySummary,
} from "../modules/dataManagement";
import { useAuth } from "../shared/contexts/AuthContext";
import { useSubscription } from "../shared/hooks/useSubscription";
import { fullSync } from "../shared/sync/syncApi";
import { createScopedLogger } from "../shared/utils/logger";

const log = createScopedLogger("DataMgmt");

// ============================================================================
// COUNT BLOCK
// ============================================================================

interface CountBlockProps {
  icon: string;
  label: string;
  count: number;
  limit?: number;
  onPress?: () => void;
}

function CountBlock({ icon, label, count, limit, onPress }: CountBlockProps) {
  const theme = useTheme();
  const hasLimit = limit != null && isFinite(limit);
  const overLimit = hasLimit && count >= limit!;

  const content = (
    <View style={[blockStyles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
      <Icon name={icon as any} size={22} color={theme.colors.text.secondary} />
      <View style={blockStyles.countRow}>
        <Text style={[blockStyles.count, { color: overLimit ? theme.colors.functional.overdue : theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}>
          {count}
        </Text>
        {hasLimit && (
          <Text style={[blockStyles.countLimit, { color: overLimit ? theme.colors.functional.overdue : theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
            {` / ${limit}`}
          </Text>
        )}
      </View>
      <Text style={[blockStyles.label, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
        {label}
      </Text>
      {onPress && (
        <Icon name="ChevronRight" size={14} color={theme.colors.text.tertiary} style={blockStyles.chevron} />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={blockStyles.touchable} onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={blockStyles.touchable}>{content}</View>;
}

const blockStyles = StyleSheet.create({
  touchable: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: 12,
    padding: themeBase.spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    position: "relative",
  },
  countRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  count: {
    fontSize: 28,
    lineHeight: 34,
  },
  countLimit: {
    fontSize: 16,
    lineHeight: 34,
  },
  label: {
    fontSize: 13,
  },
  chevron: {
    position: "absolute",
    top: 10,
    right: 10,
  },
});

// ============================================================================
// STORAGE DONUT
// ============================================================================

const DONUT_SIZE = 80;
const DONUT_STROKE = 8;
const DONUT_RADIUS = (DONUT_SIZE - DONUT_STROKE) / 2;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

interface StorageCardProps {
  activeContentBytes: number;
  activeAttachmentBytes: number;
  trashContentBytes: number;
  trashAttachmentBytes: number;
  localTotalBytes: number;
  localDbBytes: number;
  localAttachmentBytes: number;
  limitMb: number;
  offline?: boolean;
}

function StorageCard({ activeContentBytes, activeAttachmentBytes, trashContentBytes, trashAttachmentBytes, localTotalBytes, localDbBytes, localAttachmentBytes, limitMb, offline }: StorageCardProps) {
  const theme = useTheme();

  if (offline) {
    return (
      <View style={[storageStyles.card, { backgroundColor: theme.colors.background.primary, opacity: 0.5 }, theme.shadows.sm]}>
        <View style={storageStyles.donutWrap}>
          <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
            <Circle
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={DONUT_RADIUS}
              stroke={theme.colors.border.light}
              strokeWidth={DONUT_STROKE}
              fill="none"
            />
          </Svg>
          <Icon name="WifiOff" size={20} color={theme.colors.text.tertiary} style={storageStyles.donutIcon} />
        </View>
        <View style={storageStyles.labels}>
          <Text style={[storageStyles.labelTitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>
            Cloud storage unavailable offline
          </Text>
          <View style={{ height: 6 }} />
          <View style={storageStyles.labelRow}>
            <Icon name="Smartphone" size={14} color={theme.colors.text.tertiary} />
            <Text style={[storageStyles.labelTitle, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>
              Local
            </Text>
            <Text style={[storageStyles.labelValue, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
              {formatMB(localTotalBytes)}
            </Text>
          </View>
          <Text style={[storageStyles.breakdown, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
            DB {formatMB(localDbBytes)} · Files {formatMB(localAttachmentBytes)}
          </Text>
        </View>
      </View>
    );
  }

  const trashTotal = trashContentBytes + trashAttachmentBytes;
  const totalCloud = activeContentBytes + activeAttachmentBytes + trashTotal;
  const pct = getStoragePercentage(totalCloud, limitMb);
  const level = getStorageWarningLevel(totalCloud, limitMb);

  // Three arcs stacked: entries (content), attachments, trash
  // Drawn outermost first so inner arcs overlay
  const limitBytes = limitMb * 1024 * 1024;
  const entriesPct = limitBytes > 0 ? Math.min((activeContentBytes / limitBytes) * 100, 100) : 0;
  const entriesAndAttPct = limitBytes > 0 ? Math.min(((activeContentBytes + activeAttachmentBytes) / limitBytes) * 100, 100) : 0;
  const totalPct = limitBytes > 0 ? Math.min((totalCloud / limitBytes) * 100, 100) : 0;

  const entriesDashOffset = DONUT_CIRCUMFERENCE * (1 - entriesPct / 100);
  const entriesAndAttDashOffset = DONUT_CIRCUMFERENCE * (1 - entriesAndAttPct / 100);
  const totalDashOffset = DONUT_CIRCUMFERENCE * (1 - totalPct / 100);

  const entriesColor = theme.colors.functional.accent;
  const attachmentColor = '#8B5CF6'; // purple — visually distinct from accent blue
  const trashColor =
    level === 'exceeded' || level === 'critical'
      ? theme.colors.functional.overdue
      : level === 'warning'
        ? '#F59E0B'
        : theme.colors.functional.overdue + '99';

  return (
    <View style={[storageStyles.card, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
      {/* Donut */}
      <View style={storageStyles.donutWrap}>
        <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
          {/* Background track */}
          <Circle
            cx={DONUT_SIZE / 2}
            cy={DONUT_SIZE / 2}
            r={DONUT_RADIUS}
            stroke={theme.colors.border.light}
            strokeWidth={DONUT_STROKE}
            fill="none"
          />
          {/* Trash arc (outermost — drawn first) */}
          {trashTotal > 0 && (
            <Circle
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={DONUT_RADIUS}
              stroke={trashColor}
              strokeWidth={DONUT_STROKE}
              fill="none"
              strokeDasharray={DONUT_CIRCUMFERENCE}
              strokeDashoffset={totalDashOffset}
              strokeLinecap="round"
              rotation={-90}
              origin={`${DONUT_SIZE / 2}, ${DONUT_SIZE / 2}`}
            />
          )}
          {/* Attachments arc (middle) */}
          {activeAttachmentBytes > 0 && (
            <Circle
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={DONUT_RADIUS}
              stroke={attachmentColor}
              strokeWidth={DONUT_STROKE}
              fill="none"
              strokeDasharray={DONUT_CIRCUMFERENCE}
              strokeDashoffset={entriesAndAttDashOffset}
              strokeLinecap="round"
              rotation={-90}
              origin={`${DONUT_SIZE / 2}, ${DONUT_SIZE / 2}`}
            />
          )}
          {/* Entries arc (innermost — drawn last, overlays others) */}
          {activeContentBytes > 0 && (
            <Circle
              cx={DONUT_SIZE / 2}
              cy={DONUT_SIZE / 2}
              r={DONUT_RADIUS}
              stroke={entriesColor}
              strokeWidth={DONUT_STROKE}
              fill="none"
              strokeDasharray={DONUT_CIRCUMFERENCE}
              strokeDashoffset={entriesDashOffset}
              strokeLinecap="round"
              rotation={-90}
              origin={`${DONUT_SIZE / 2}, ${DONUT_SIZE / 2}`}
            />
          )}
        </Svg>
        <Text style={[storageStyles.donutPct, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.bold }]}>
          {Math.round(pct)}%
        </Text>
      </View>

      {/* Labels */}
      <View style={storageStyles.labels}>
        <View style={storageStyles.labelRow}>
          <View style={[storageStyles.legendDot, { backgroundColor: entriesColor }]} />
          <Text style={[storageStyles.labelTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
            Entries
          </Text>
          <Text style={[storageStyles.labelValue, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
            {formatMB(activeContentBytes)}
          </Text>
        </View>

        <View style={storageStyles.labelRow}>
          <View style={[storageStyles.legendDot, { backgroundColor: attachmentColor }]} />
          <Text style={[storageStyles.labelTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
            Attachments
          </Text>
          <Text style={[storageStyles.labelValue, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
            {formatMB(activeAttachmentBytes)}
          </Text>
        </View>

        <View style={storageStyles.labelRow}>
          <View style={[storageStyles.legendDot, { backgroundColor: theme.colors.functional.overdue }]} />
          <Text style={[storageStyles.labelTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
            Trash
          </Text>
          <Text style={[storageStyles.labelValue, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
            {formatMB(trashTotal)}
          </Text>
        </View>

        <View style={[storageStyles.divider, { backgroundColor: theme.colors.border.light }]} />

        <View style={storageStyles.labelRow}>
          <Icon name="Cloud" size={14} color={theme.colors.text.secondary} />
          <Text style={[storageStyles.labelTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
            Total
          </Text>
          <Text style={[storageStyles.labelValue, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
            {formatStorageUsage(totalCloud, limitMb)}
          </Text>
        </View>

        <View style={storageStyles.labelRow}>
          <Icon name="Smartphone" size={14} color={theme.colors.text.secondary} />
          <Text style={[storageStyles.labelTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
            Local
          </Text>
          <Text style={[storageStyles.labelValue, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
            {formatMB(localTotalBytes)}
          </Text>
        </View>

        <Text style={[storageStyles.breakdown, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
          DB {formatMB(localDbBytes)} · Files {formatMB(localAttachmentBytes)}
        </Text>
      </View>
    </View>
  );
}

const storageStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: themeBase.spacing.lg,
    gap: themeBase.spacing.lg,
    marginBottom: themeBase.spacing.lg,
  },
  donutWrap: {
    width: DONUT_SIZE,
    height: DONUT_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  donutPct: {
    position: "absolute",
    fontSize: 16,
  },
  donutIcon: {
    position: "absolute",
  },
  labels: {
    flex: 1,
    gap: 6,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  labelTitle: {
    fontSize: 14,
  },
  labelValue: {
    fontSize: 13,
    marginLeft: "auto",
  },
  divider: {
    height: 1,
  },
  breakdown: {
    fontSize: 11,
    marginLeft: 22,
  },
});

// ============================================================================
// TOOL ROW
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

  const { isOffline } = useAuth();
  const { counts, refetch: refetchCounts } = useTopLevelCounts();
  const { summary: entrySummary, refetch: refetchEntries } = useEntrySummary();
  const { summary: deletedSummary, refetch: refetchDeleted } = useDeletedEntrySummary();
  const { storageUsage: cloudStorage, refetch: refetchCloud } = useCloudStorageUsage();
  const { deviceStorage, refetch: refetchDevice } = useDeviceStorageUsage();
  const { privateStreams, refetch: refetchPrivacy } = usePrivacySummary();
  const { getLimit } = useSubscription();

  const storageLimitMb = getLimit('maxStorageMB');
  const streamLimit = getLimit('maxStreams');
  const entryLimit = getLimit('maxEntries');
  const placeLimit = getLimit('maxPlaces');

  // Synced counts (exclude local-only streams and their entries)
  const privateStreamCount = privateStreams.length;
  const privateEntryCount = useMemo(
    () => privateStreams.reduce((sum, s) => sum + s.entry_count, 0),
    [privateStreams]
  );
  const syncedStreams = counts.streams - privateStreamCount;
  const syncedEntries = entrySummary.entryCount - privateEntryCount;

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
      await Promise.all([refetchCounts(), refetchEntries(), refetchDeleted(), refetchCloud(), refetchDevice(), refetchPrivacy()]);
    } catch (error) {
      log.warn("Refresh failed", error as Error);
    } finally {
      setRefreshing(false);
    }
  }, [refetchCounts, refetchEntries, refetchDeleted, refetchCloud, refetchDevice, refetchPrivacy]);

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
        {/* ── STORAGE ──────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.semibold }]}>
          STORAGE
        </Text>
        <StorageCard
          activeContentBytes={cloudStorage?.active_content_bytes ?? 0}
          activeAttachmentBytes={cloudStorage?.active_attachment_bytes ?? 0}
          trashContentBytes={cloudStorage?.trash_content_bytes ?? 0}
          trashAttachmentBytes={cloudStorage?.trash_attachment_bytes ?? 0}
          localTotalBytes={deviceStorage?.total_bytes ?? 0}
          localDbBytes={deviceStorage?.database_bytes ?? 0}
          localAttachmentBytes={deviceStorage?.attachment_bytes ?? 0}
          limitMb={storageLimitMb}
          offline={isOffline}
        />

        {/* ── 2x2 GRID ─────────────────────────────────────────── */}
        <Text style={[styles.sectionTitle, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.semibold }]}>
          YOUR DATA
        </Text>

        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <CountBlock icon="Layers" label="Streams" count={syncedStreams} limit={streamLimit} />
            <CountBlock icon="MapPin" label="Places" count={counts.places} limit={placeLimit} />
          </View>
          <View style={styles.gridRow}>
            <CountBlock icon="FileText" label="Entries" count={syncedEntries} limit={entryLimit} onPress={() => navigate("entries-list")} />
            <CountBlock icon="Trash2" label="Deleted" count={deletedSummary.entryCount} onPress={() => navigate("deleted-entries")} />
          </View>
        </View>

        {/* ── TOOLS ─────────────────────────────────────────────── */}
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
            isLast
          />
        </View>


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
  grid: { gap: themeBase.spacing.sm, marginBottom: themeBase.spacing.sm },
  gridRow: { flexDirection: "row", gap: themeBase.spacing.sm },

  card: { borderRadius: 12, marginBottom: themeBase.spacing.lg, overflow: "hidden" },
  sectionTitle: { fontSize: 12, letterSpacing: 1, marginBottom: themeBase.spacing.sm, marginLeft: themeBase.spacing.xs },

});
