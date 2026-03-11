/**
 * VersionHistorySheet — Bottom sheet with two panels:
 *   1. List view: timeline of versions grouped by date
 *   2. Detail view: snapshot preview with restore/copy actions
 *
 * Tapping a version slides to detail view within the same sheet.
 * Back arrow returns to the list. No external screen navigation needed.
 */

import { View, Text, SectionList, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '../../../shared/components';
import { StatusIcon } from '../../../shared/components/StatusIcon';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { themeBase } from '../../../shared/theme/themeBase';
import { PickerBottomSheet } from '../../../components/sheets/PickerBottomSheet';
import { HtmlRenderProvider } from '../../entries/components/HtmlRenderProvider';
import { WebViewHtmlRenderer } from '../../entries/helpers/webViewHtmlRenderer';
import { useVersions, useRestoreVersion, useCopyFromSnapshot } from '../versionHooks';
import { useDevices } from '../../devices';
import { useNavigate } from '../../../shared/navigation';
import { localDB } from '../../../shared/db/localDB';
import { PhotoGallery } from '../../photos/components/PhotoGallery';
import { getDeviceId } from '../../../config/appVersionService';
import { createScopedLogger } from '../../../shared/utils/logger';
import { fixMalformedClosingTags } from '../../../shared/utils/htmlUtils';
import type { Attachment } from '@trace/core';

const log = createScopedLogger('VersionSheet');

// Palette for distinguishing versions from different devices.
// Index 0 is reserved for the current device (uses theme accent).
// Other devices get assigned from this palette in order of first appearance.
const DEVICE_COLORS = [
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#84cc16', // lime
  '#e11d48', // rose
  '#0ea5e9', // sky
];
import {
  getStatusLabel,
  getStatusColor,
  getPriorityInfo,
  getLocationLabel,
  formatRatingDisplay,
} from '@trace/core';
import type { PriorityCategory, RatingType } from '@trace/core';
import type { EntryVersion } from '../VersionTypes';
import type { EntrySnapshot } from '../VersionTypes';

/**
 * Sanitize snapshot HTML for RNRH rendering.
 * - Strip <label>...</label> blocks (TipTap task list checkbox wrappers)
 * - Fix malformed closing tags from TipTap serialization
 */
function sanitizeSnapshotHtml(html: string): string {
  // Strip <label>...</label> entirely — content is redundant with data-checked on <li>
  let result = html.replace(/<label>[\s\S]*?<\/label>/g, '');
  result = fixMalformedClosingTags(result);
  return result;
}

// --- Date grouping helpers ---

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (target.getTime() === today.getTime()) return 'TODAY';
  if (target.getTime() === yesterday.getTime()) return 'YESTERDAY';

  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  }).toUpperCase();
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const monthDay = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${monthDay}, ${time}`;
}

interface VersionSection {
  title: string;
  data: EntryVersion[];
}

function groupByDate(versions: EntryVersion[]): VersionSection[] {
  const groups = new Map<string, EntryVersion[]>();

  for (const v of versions) {
    const dateKey = v.device_created_at || v.created_at;
    const label = getDateLabel(dateKey);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(v);
  }

  return Array.from(groups.entries()).map(([title, data]) => ({ title, data }));
}

// --- Component ---

interface VersionHistorySheetProps {
  visible: boolean;
  onClose: () => void;
  entryId: string;
}

export function VersionHistorySheet({ visible, onClose, entryId }: VersionHistorySheetProps) {
  const theme = useTheme();
  const navigate = useNavigate();

  const { data: versions, isLoading, error } = useVersions(entryId);
  const { data: devices } = useDevices();
  const restoreMutation = useRestoreVersion();
  const copyMutation = useCopyFromSnapshot();

  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [versionAttachments, setVersionAttachments] = useState<Attachment[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);

  // Load current device ID once
  useEffect(() => {
    getDeviceId().then(setCurrentDeviceId);
  }, []);

  const deviceMap = useMemo(() => {
    const map = new Map<string, string>();
    if (devices) {
      for (const d of devices) {
        map.set(d.device_id, d.custom_name || d.device_name || 'Unknown device');
      }
    }
    return map;
  }, [devices]);

  /** Resolve device_id to display name. MCP device IDs use "MCP:{keyName}" format. */
  const resolveDeviceName = useCallback((deviceId: string | null): string => {
    if (!deviceId) return 'Unknown device';
    if (deviceId.startsWith('MCP:')) return deviceId.slice(4);
    return deviceMap.get(deviceId) || 'Unknown device';
  }, [deviceMap]);

  // Build a stable color mapping: current device → accent, others → palette
  const deviceColorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!versions) return map;
    let colorIdx = 0;
    for (const v of versions) {
      if (!v.device_id || map.has(v.device_id)) continue;
      if (v.device_id === currentDeviceId) {
        map.set(v.device_id, theme.colors.functional.accent);
      } else {
        map.set(v.device_id, DEVICE_COLORS[colorIdx % DEVICE_COLORS.length]);
        colorIdx++;
      }
    }
    return map;
  }, [versions, currentDeviceId, theme.colors.functional.accent]);

  const { sections, latestVersionId, sortedVersions } = useMemo(() => {
    if (!versions) return { sections: [] as VersionSection[], latestVersionId: null as string | null, sortedVersions: [] as EntryVersion[] };
    const sorted = [...versions].sort((a, b) => {
      const dateA = a.device_created_at || a.created_at;
      const dateB = b.device_created_at || b.created_at;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
    return {
      sections: groupByDate(sorted),
      latestVersionId: (sorted.find(v => v.trigger !== 'sync_overwrite') || sorted[0])?.version_id ?? null,
      sortedVersions: sorted,
    };
  }, [versions]);

  const selectedVersion = useMemo(() => {
    if (!selectedVersionId || !sortedVersions.length) return null;
    return sortedVersions.find(v => v.version_id === selectedVersionId) || null;
  }, [selectedVersionId, sortedVersions]);

  const isLatest = selectedVersion?.version_id === latestVersionId;

  // Load attachments for selected version (including soft-deleted)
  useEffect(() => {
    if (!selectedVersion?.attachment_ids?.length) {
      setVersionAttachments([]);
      return;
    }
    let cancelled = false;
    localDB.getAttachmentsByIds(selectedVersion.attachment_ids).then(attachments => {
      if (!cancelled) setVersionAttachments(attachments);
    });
    return () => { cancelled = true; };
  }, [selectedVersion?.version_id, selectedVersion?.attachment_ids]);

  // --- Handlers ---

  const handleVersionPress = (item: EntryVersion) => {
    setSelectedVersionId(item.version_id);
  };

  const handleBack = () => {
    setSelectedVersionId(null);
  };

  const handleClose = () => {
    setSelectedVersionId(null);
    onClose();
  };

  const handleRestore = () => {
    if (!selectedVersion?.snapshot) return;
    Alert.alert(
      'Restore this version?',
      'This will replace the current entry content with this version\'s snapshot. A new version will be created to preserve the current state.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          style: 'destructive',
          onPress: async () => {
            setIsRestoring(true);
            try {
              await restoreMutation.mutateAsync({
                entryId,
                snapshot: selectedVersion.snapshot!,
                userId: selectedVersion.user_id,
              });
              Alert.alert('Restored', 'Entry has been restored to this version.');
              setSelectedVersionId(null);
              onClose();
              navigate('entryManagement', { entryId });
            } catch (err) {
              Alert.alert('Error', 'Failed to restore version. Please try again.');
            } finally {
              setIsRestoring(false);
            }
          },
        },
      ]
    );
  };

  const handleCopy = () => {
    if (!selectedVersion?.snapshot) return;
    Alert.alert(
      'Create copy from this version?',
      'A new entry will be created with this version\'s content.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create Copy',
          onPress: async () => {
            setIsCopying(true);
            try {
              const newEntryId = await copyMutation.mutateAsync({
                snapshot: selectedVersion.snapshot!,
                userId: selectedVersion.user_id,
              });
              Alert.alert('Copied', 'New entry created from this version.');
              setSelectedVersionId(null);
              onClose();
              navigate('entryManagement', { entryId: newEntryId });
            } catch (err) {
              Alert.alert('Error', 'Failed to create copy. Please try again.');
            } finally {
              setIsCopying(false);
            }
          },
        },
      ]
    );
  };

  // --- Detail header title ---
  const detailDateStr = selectedVersion?.device_created_at || selectedVersion?.created_at || '';
  const detailTitle = detailDateStr ? `v${selectedVersion?.base_entry_version ?? '?'}.${selectedVersion?.version_number} — ${formatDateTime(detailDateStr)}` : 'Version Detail';

  // --- Header left back arrow for detail view ---
  const headerLeft = selectedVersionId ? (
    <TouchableOpacity onPress={handleBack} style={styles.backButton} activeOpacity={0.7}>
      <Icon name="ChevronLeft" size={22} color={theme.colors.text.primary} />
    </TouchableOpacity>
  ) : undefined;

  // --- Render ---

  const renderVersion = ({ item }: { item: EntryVersion }) => {
    const dateStr = item.device_created_at || item.created_at;
    const time = formatTime(dateStr);
    const isMcp = item.trigger === 'mcp_write';
    const deviceName = resolveDeviceName(item.device_id);
    const triggeredByName = item.triggered_by_device ? (deviceMap.get(item.triggered_by_device) || null) : null;
    const isConflict = item.trigger === 'conflict';
    const isRestore = item.trigger === 'restore';
    const isSyncOverwrite = item.trigger === 'sync_overwrite';
    const isItemLatest = item.version_id === latestVersionId;
    const triggerLabel = isConflict ? 'Conflict backup'
      : isRestore ? 'Restore'
      : isSyncOverwrite ? 'Before sync'
      : isMcp ? 'MCP'
      : 'Session end';
    const dotColor = isConflict
      ? '#f59e0b'
      : (item.device_id ? deviceColorMap.get(item.device_id) : null) || theme.colors.functional.accent;

    return (
      <TouchableOpacity
        style={[styles.versionRow, { backgroundColor: theme.colors.background.secondary }]}
        onPress={() => handleVersionPress(item)}
        activeOpacity={0.7}
      >
        {/* Timeline dot — colored per device */}
        <View style={styles.timelineColumn}>
          <View style={[
            styles.timelineDot,
            { backgroundColor: dotColor },
          ]} />
          <View style={[styles.timelineLine, { backgroundColor: theme.colors.border.light }]} />
        </View>

        {/* Content */}
        <View style={styles.versionContent}>
          <View style={styles.versionHeader}>
            <View style={styles.versionHeaderLeft}>
              <Text style={[styles.versionTime, {
                color: theme.colors.text.primary,
                fontFamily: theme.typography.fontFamily.semibold,
              }]}>
                {time}
              </Text>
              {isItemLatest && (
                <View style={[styles.currentBadge, { backgroundColor: theme.colors.functional.accent + '20' }]}>
                  <Text style={[styles.currentBadgeText, {
                    color: theme.colors.functional.accent,
                    fontFamily: theme.typography.fontFamily.semibold,
                  }]}>
                    Latest
                  </Text>
                </View>
              )}
            </View>
            <View style={[
              styles.triggerBadge,
              {
                backgroundColor: isConflict
                  ? '#f59e0b20'
                  : theme.colors.background.tertiary,
              },
            ]}>
              {isConflict && (
                <Icon name="AlertTriangle" size={11} color="#f59e0b" />
              )}
              <Text style={[styles.triggerText, {
                color: isConflict ? '#f59e0b' : theme.colors.text.tertiary,
                fontFamily: theme.typography.fontFamily.medium,
              }]}>
                {triggerLabel}
              </Text>
            </View>
          </View>

          <Text style={[styles.deviceName, {
            color: dotColor,
            fontFamily: theme.typography.fontFamily.regular,
          }]} numberOfLines={1}>
            {deviceName}
          </Text>

          {triggeredByName && (isConflict || isSyncOverwrite) ? (
            <Text style={[styles.changeSummary, {
              color: theme.colors.text.tertiary,
              fontFamily: theme.typography.fontFamily.regular,
            }]} numberOfLines={1}>
              overwritten by {triggeredByName}
            </Text>
          ) : null}

          {item.change_summary ? (
            <Text style={[styles.changeSummary, {
              color: theme.colors.text.tertiary,
              fontFamily: theme.typography.fontFamily.regular,
            }]} numberOfLines={2}>
              {item.change_summary}
            </Text>
          ) : null}

          <Text style={[styles.versionNumberText, {
            color: theme.colors.text.tertiary,
            fontFamily: theme.typography.fontFamily.regular,
          }]}>
            v{item.base_entry_version ?? '?'}.{item.version_number}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: VersionSection }) => (
    <Text style={[styles.sectionTitle, {
      color: theme.colors.text.tertiary,
      fontFamily: theme.typography.fontFamily.semibold,
    }]}>
      {section.title}
    </Text>
  );

  // --- Detail view content ---
  const renderDetail = () => {
    if (!selectedVersion) return null;
    const snapshot = selectedVersion.snapshot;

    if (!snapshot) return null;

    const isConflict = selectedVersion.trigger === 'conflict';
    const isRestore = selectedVersion.trigger === 'restore';
    const isSyncOverwrite = selectedVersion.trigger === 'sync_overwrite';
    const isMcp = selectedVersion.trigger === 'mcp_write';
    const deviceName = resolveDeviceName(selectedVersion.device_id);
    const triggeredByName = selectedVersion.triggered_by_device
      ? (deviceMap.get(selectedVersion.triggered_by_device) || null)
      : null;

    return (
      <HtmlRenderProvider>
        <ScrollView style={styles.detailScroll} showsVerticalScrollIndicator={false}>
          {/* Version metadata card */}
          <View style={[styles.metaCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
            <View style={styles.metaRow}>
              <View style={styles.metaRowLeft}>
                <View style={[
                  styles.detailTriggerBadge,
                  { backgroundColor: isConflict ? '#f59e0b20' : theme.colors.background.tertiary },
                ]}>
                  {isConflict && <Icon name="AlertTriangle" size={13} color="#f59e0b" />}
                  <Text style={[styles.detailTriggerText, {
                    color: isConflict ? '#f59e0b' : theme.colors.text.tertiary,
                    fontFamily: theme.typography.fontFamily.medium,
                  }]}>
                    {isConflict ? 'Conflict backup' : isRestore ? 'Restore' : isSyncOverwrite ? 'Before sync' : isMcp ? 'MCP edit' : 'Session end'}
                  </Text>
                </View>
                {isLatest && (
                  <View style={[styles.currentBadge, { backgroundColor: theme.colors.functional.accent + '20' }]}>
                    <Text style={[styles.currentBadgeText, {
                      color: theme.colors.functional.accent,
                      fontFamily: theme.typography.fontFamily.semibold,
                    }]}>
                      Latest
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.detailVersionNumber, {
                color: theme.colors.text.tertiary,
                fontFamily: theme.typography.fontFamily.regular,
              }]}>
                v{selectedVersion.base_entry_version ?? '?'}.{selectedVersion.version_number}
              </Text>
            </View>

            <View style={styles.metaDetail}>
              <Icon name="Smartphone" size={14} color={theme.colors.text.tertiary} />
              <Text style={[styles.metaText, {
                color: theme.colors.text.secondary,
                fontFamily: theme.typography.fontFamily.regular,
              }]}>
                {deviceName}
              </Text>
            </View>
            {triggeredByName && (isConflict || isSyncOverwrite) ? (
              <View style={styles.metaDetail}>
                <Icon name="RefreshCw" size={14} color={theme.colors.text.tertiary} />
                <Text style={[styles.metaText, {
                  color: theme.colors.text.secondary,
                  fontFamily: theme.typography.fontFamily.regular,
                }]}>
                  overwritten by {triggeredByName}
                </Text>
              </View>
            ) : null}
            <View style={styles.metaDetail}>
              <Icon name="Clock" size={14} color={theme.colors.text.tertiary} />
              <Text style={[styles.metaText, {
                color: theme.colors.text.secondary,
                fontFamily: theme.typography.fontFamily.regular,
              }]}>
                {formatDateTime(detailDateStr)}
              </Text>
            </View>

            {selectedVersion.change_summary ? (
              <View style={[styles.changeSummaryBox, { backgroundColor: theme.colors.background.secondary }]}>
                <Text style={[styles.changeSummaryLabel, {
                  color: theme.colors.text.tertiary,
                  fontFamily: theme.typography.fontFamily.semibold,
                }]}>
                  CHANGES
                </Text>
                <Text style={[styles.changeSummaryBoxText, {
                  color: theme.colors.text.primary,
                  fontFamily: theme.typography.fontFamily.regular,
                }]}>
                  {selectedVersion.change_summary}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Entry preview card */}
          <View style={[styles.entryCard, { backgroundColor: theme.colors.background.primary }, theme.shadows.sm]}>
            {snapshot.title ? (
              <Text style={[styles.entryTitle, {
                color: theme.colors.text.primary,
                fontFamily: theme.typography.fontFamily.semibold,
              }]}>
                {snapshot.title}
              </Text>
            ) : null}

            {snapshot.entry_date ? (
              <Text style={[styles.entryDate, {
                color: theme.colors.text.tertiary,
                fontFamily: theme.typography.fontFamily.regular,
              }]}>
                {new Date(snapshot.entry_date).toLocaleDateString(undefined, {
                  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
                })}
              </Text>
            ) : null}

            <SnapshotBadges snapshot={snapshot} theme={theme} />

            {snapshot.content ? (
              <View style={styles.contentContainer}>
                <WebViewHtmlRenderer html={sanitizeSnapshotHtml(snapshot.content)} />
              </View>
            ) : null}

            {versionAttachments.length > 0 && (
              <View style={styles.attachmentsContainer}>
                <PhotoGallery
                  entryId={selectedVersion!.entry_id}
                  attachments={versionAttachments}
                  photoSize={80}
                />
              </View>
            )}

            {snapshot.is_pinned && (
              <View style={styles.flagsRow}>
                <View style={[styles.flagBadge, { backgroundColor: theme.colors.background.tertiary }]}>
                  <Icon name="Pin" size={10} color={theme.colors.text.tertiary} />
                  <Text style={[styles.flagText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>Pinned</Text>
                </View>
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, {
                backgroundColor: theme.colors.functional.accent,
                opacity: isRestoring ? 0.6 : 1,
              }]}
              onPress={handleRestore}
              activeOpacity={0.8}
              disabled={isRestoring || isCopying}
            >
              {isRestoring ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Icon name="RotateCcw" size={16} color="#fff" />
              )}
              <Text style={[styles.actionButtonText, { fontFamily: theme.typography.fontFamily.semibold }]}>
                {isRestoring ? 'Restoring...' : 'Restore this version'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, {
                backgroundColor: theme.colors.background.tertiary,
                opacity: isCopying ? 0.6 : 1,
              }]}
              onPress={handleCopy}
              activeOpacity={0.8}
              disabled={isRestoring || isCopying}
            >
              {isCopying ? (
                <ActivityIndicator size="small" color={theme.colors.text.primary} />
              ) : (
                <Icon name="Copy" size={16} color={theme.colors.text.primary} />
              )}
              <Text style={[styles.actionButtonText, {
                fontFamily: theme.typography.fontFamily.semibold,
                color: theme.colors.text.primary,
              }]}>
                {isCopying ? 'Creating copy...' : 'Create copy from version'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </HtmlRenderProvider>
    );
  };

  return (
    <PickerBottomSheet
      visible={visible}
      onClose={handleClose}
      title={selectedVersionId ? detailTitle : 'Version History'}
      height="full"
      swipeArea="grabber"
      dismissKeyboard
      headerLeft={headerLeft}
    >
      {selectedVersionId ? (
        // Detail view
        renderDetail()
      ) : (
        // List view
        isLoading && !versions ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.colors.text.tertiary} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={[styles.emptyText, {
              color: theme.colors.text.tertiary,
              fontFamily: theme.typography.fontFamily.regular,
            }]}>
              Failed to load version history.
            </Text>
          </View>
        ) : versions && versions.length === 0 ? (
          <View style={styles.centered}>
            <Icon name="Clock" size={48} color={theme.colors.text.tertiary} />
            <Text style={[styles.emptyTitle, {
              color: theme.colors.text.secondary,
              fontFamily: theme.typography.fontFamily.semibold,
            }]}>
              No version history yet
            </Text>
            <Text style={[styles.emptySubtitle, {
              color: theme.colors.text.tertiary,
              fontFamily: theme.typography.fontFamily.regular,
            }]}>
              Versions are created automatically when you finish editing an entry.
            </Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.version_id}
            renderItem={renderVersion}
            renderSectionHeader={renderSectionHeader}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
          />
        )
      )}
    </PickerBottomSheet>
  );
}

// --- Snapshot Badges ---

function SnapshotBadges({ snapshot, theme }: { snapshot: EntrySnapshot; theme: any }) {
  const hasBadges =
    (snapshot.status && snapshot.status !== 'none') ||
    snapshot.type ||
    (snapshot.priority && snapshot.priority > 0) ||
    (snapshot.rating && snapshot.rating > 0) ||
    snapshot.place_name || snapshot.city ||
    snapshot.due_date ||
    (snapshot.tags && snapshot.tags.length > 0) ||
    (snapshot.mentions && snapshot.mentions.length > 0);

  if (!hasBadges) return null;

  const locationLabel = snapshot.place_name
    ? getLocationLabel({
        name: snapshot.place_name,
        city: snapshot.city,
        neighborhood: snapshot.neighborhood,
        region: snapshot.region,
        country: snapshot.country,
      })
    : snapshot.city || null;

  return (
    <View style={styles.badgesContainer}>
      {locationLabel ? (
        <View style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
          <Icon name={snapshot.location_id ? 'MapPinFavoriteLine' : snapshot.place_name ? 'MapPin' : 'MapPinEmpty'} size={10} color={theme.colors.text.tertiary} />
          <Text style={[styles.badgeText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>{locationLabel}</Text>
        </View>
      ) : null}

      {snapshot.type ? (
        <View style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
          <Icon name="Bookmark" size={10} color={theme.colors.text.secondary} />
          <Text style={[styles.badgeText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>{snapshot.type}</Text>
        </View>
      ) : null}

      {snapshot.status && snapshot.status !== 'none' ? (
        <View style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
          <StatusIcon status={snapshot.status as any} size={10} />
          <Text style={[styles.badgeText, { color: getStatusColor(snapshot.status as any), fontFamily: theme.typography.fontFamily.medium }]}>
            {getStatusLabel(snapshot.status as any)}
          </Text>
        </View>
      ) : null}

      {snapshot.priority != null && snapshot.priority > 0 && (() => {
        const info = getPriorityInfo(snapshot.priority);
        const color = theme.colors.priority[info?.category as PriorityCategory || 'none'];
        return (
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Icon name="Flag" size={10} color={color} />
            <Text style={[styles.badgeText, { color, fontFamily: theme.typography.fontFamily.medium }]}>{info?.label || `P${snapshot.priority}`}</Text>
          </View>
        );
      })()}

      {snapshot.rating != null && snapshot.rating > 0 && (
        <View style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
          <Icon name="Star" size={10} color={theme.colors.text.secondary} />
          <Text style={[styles.badgeText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
            {formatRatingDisplay(snapshot.rating, 'numeric' as RatingType)}
          </Text>
        </View>
      )}

      {snapshot.due_date ? (
        <View style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
          <Icon name="CalendarClock" size={10} color={theme.colors.text.secondary} />
          <Text style={[styles.badgeText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>
            {new Date(snapshot.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </Text>
        </View>
      ) : null}

      {snapshot.tags && snapshot.tags.length > 0 ? snapshot.tags.map(tag => (
        <View key={tag} style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
          <Text style={[styles.badgeText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>#{tag}</Text>
        </View>
      )) : null}

      {snapshot.mentions && snapshot.mentions.length > 0 ? snapshot.mentions.map(mention => (
        <View key={mention} style={[styles.badge, { backgroundColor: theme.colors.background.tertiary }]}>
          <Text style={[styles.badgeText, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.medium }]}>@{mention}</Text>
        </View>
      )) : null}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  // Shared
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: themeBase.spacing.xl,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },

  // List view
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: themeBase.spacing.sm,
    marginTop: themeBase.spacing.md,
    marginLeft: themeBase.spacing.xs,
  },
  versionRow: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: themeBase.spacing.sm,
    overflow: 'hidden',
  },
  timelineColumn: {
    width: 32,
    alignItems: 'center',
    paddingTop: themeBase.spacing.lg,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
  },
  versionContent: {
    flex: 1,
    paddingVertical: themeBase.spacing.md,
    paddingRight: themeBase.spacing.lg,
    paddingLeft: themeBase.spacing.xs,
  },
  versionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  versionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  versionTime: {
    fontSize: 15,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 11,
  },
  triggerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  triggerText: {
    fontSize: 11,
  },
  deviceName: {
    fontSize: 13,
    marginBottom: 2,
  },
  changeSummary: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  versionNumberText: {
    fontSize: 11,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 15,
  },
  emptyTitle: {
    fontSize: 17,
    marginTop: themeBase.spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: themeBase.spacing.sm,
    lineHeight: 20,
  },

  // Detail view
  detailScroll: {
    flex: 1,
  },
  metaCard: {
    borderRadius: 12,
    marginBottom: themeBase.spacing.lg,
    padding: themeBase.spacing.lg,
    overflow: 'hidden',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: themeBase.spacing.md,
  },
  metaRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailTriggerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 5,
  },
  detailTriggerText: {
    fontSize: 12,
  },
  detailVersionNumber: {
    fontSize: 12,
  },
  metaDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 14,
  },
  changeSummaryBox: {
    marginTop: themeBase.spacing.md,
    padding: themeBase.spacing.md,
    borderRadius: 8,
  },
  changeSummaryLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  changeSummaryBoxText: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Entry preview card
  entryCard: {
    borderRadius: 12,
    marginBottom: themeBase.spacing.lg,
    padding: themeBase.spacing.lg,
    overflow: 'hidden',
  },
  entryTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginBottom: 4,
  },
  entryDate: {
    fontSize: 12,
    marginBottom: themeBase.spacing.sm,
  },

  // Badges
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: themeBase.spacing.md,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: themeBase.spacing.xs - 2,
    borderRadius: themeBase.borderRadius.full,
  },
  badgeText: {
    fontSize: themeBase.typography.fontSize.xs,
  },

  // Content
  contentContainer: {
    marginTop: themeBase.spacing.xs,
  },

  attachmentsContainer: {
    marginTop: themeBase.spacing.sm,
  },

  // Flags
  flagsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: themeBase.spacing.md,
  },
  flagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: themeBase.spacing.sm,
    paddingVertical: themeBase.spacing.xs - 2,
    borderRadius: themeBase.borderRadius.full,
  },
  flagText: {
    fontSize: themeBase.typography.fontSize.xs,
  },

  // Action buttons
  actionButtons: {
    gap: themeBase.spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});
