/**
 * DataFetchTestScreen - Test data fetching performance
 * Shows timing information for SQLite queries and React Query
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Platform } from 'react-native';
import { SecondaryHeader } from '../components/layout/SecondaryHeader';
import { localDB } from '../shared/db/localDB';
import { getEntry } from '../modules/entries/mobileEntryApi';
import { Icon } from '../shared/components';
import { useTheme } from '../shared/contexts/ThemeContext';
import type { Entry } from '@trace/core';

interface TimingResult {
  step: string;
  elapsed: number;
}

interface FetchResult {
  entry: Entry | null;
  timings: TimingResult[];
  totalMs: number;
  error?: string;
}

export function DataFetchTestScreen() {
  const theme = useTheme();
  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<FetchResult | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load entries list on mount
  useEffect(() => {
    loadEntries();
  }, [refreshKey]);

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const t0 = performance.now();
      const allEntries = await localDB.getAllEntries();
      const elapsed = Math.round(performance.now() - t0);
      console.log(`[DataFetchTest] Loaded ${allEntries.length} entries in ${elapsed}ms`);
      setEntries(allEntries);
    } catch (error) {
      console.error('[DataFetchTest] Failed to load entries', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEntryPress = async (entryId: string) => {
    const timings: TimingResult[] = [];
    const t0 = performance.now();

    const logTiming = (step: string) => {
      const elapsed = Math.round(performance.now() - t0);
      timings.push({ step, elapsed });
      console.log(`[DataFetchTest] ⏱️ ${step}: ${elapsed}ms`);
    };

    logTiming('Start fetch');

    try {
      // This uses the same getEntry that EntryScreen uses
      // which goes through mobileEntryApi -> localDB.getEntry
      const entry = await getEntry(entryId);
      logTiming('getEntry returned');

      const totalMs = Math.round(performance.now() - t0);

      setSelectedEntry({
        entry,
        timings,
        totalMs,
      });
      setModalVisible(true);
    } catch (error) {
      const totalMs = Math.round(performance.now() - t0);
      setSelectedEntry({
        entry: null,
        timings,
        totalMs,
        error: error instanceof Error ? error.message : String(error),
      });
      setModalVisible(true);
    }
  };

  const refreshButton = (
    <TouchableOpacity onPress={() => setRefreshKey(prev => prev + 1)} style={styles.refreshButton}>
      <Icon name="RefreshCw" size={20} color={theme.colors.functional.accent} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
      <SecondaryHeader title="Data Fetch Test" rightAction={refreshButton} />

      <View style={[styles.statsBar, { backgroundColor: theme.colors.background.primary, borderBottomColor: theme.colors.border.light }]}>
        <Text style={[styles.statsText, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.medium }]}>
          {entries.length} entries loaded • Tap to fetch by ID
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: theme.colors.text.secondary }]}>Loading entries...</Text>
          </View>
        ) : entries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: theme.colors.text.secondary }]}>No entries found</Text>
          </View>
        ) : (
          entries.map((entry, index) => (
            <TouchableOpacity
              key={entry.entry_id}
              style={[styles.entryCard, { backgroundColor: theme.colors.background.primary, borderColor: theme.colors.border.light }]}
              onPress={() => handleEntryPress(entry.entry_id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.entryIndex, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                {index + 1}
              </Text>
              <View style={styles.entryContent}>
                <Text style={[styles.entryTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]} numberOfLines={1}>
                  {entry.title || '(No title)'}
                </Text>
                <Text style={[styles.entryId, { color: theme.colors.text.tertiary, fontFamily: theme.typography.fontFamily.regular }]}>
                  {entry.entry_id.substring(0, 8)}...
                </Text>
              </View>
              <Icon name="ChevronRight" size={16} color={theme.colors.text.tertiary} />
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Result Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalContainer, { backgroundColor: theme.colors.background.primary }]}>
            <View style={[styles.modalHeader, { borderBottomColor: theme.colors.border.light }]}>
              <Text style={[styles.modalTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
                Fetch Result
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseButton}>
                <Icon name="X" size={24} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {selectedEntry && (
                <>
                  {/* Timing Section */}
                  <View style={[styles.section, { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border.light }]}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
                      Timing
                    </Text>
                    {selectedEntry.timings.map((timing, index) => (
                      <View key={index} style={styles.timingRow}>
                        <Text style={[styles.timingStep, { color: theme.colors.text.secondary, fontFamily: theme.typography.fontFamily.regular }]}>
                          {timing.step}
                        </Text>
                        <Text style={[styles.timingValue, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.medium }]}>
                          {timing.elapsed}ms
                        </Text>
                      </View>
                    ))}
                    <View style={[styles.timingRow, styles.totalRow, { borderTopColor: theme.colors.border.light }]}>
                      <Text style={[styles.timingStep, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
                        Total
                      </Text>
                      <Text style={[styles.timingTotal, { color: theme.colors.functional.accent, fontFamily: theme.typography.fontFamily.bold }]}>
                        {selectedEntry.totalMs}ms
                      </Text>
                    </View>
                  </View>

                  {/* Error Section */}
                  {selectedEntry.error && (
                    <View style={[styles.section, styles.errorSection, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                      <Text style={[styles.sectionTitle, { color: '#dc2626', fontFamily: theme.typography.fontFamily.semibold }]}>
                        Error
                      </Text>
                      <Text style={[styles.errorText, { fontFamily: theme.typography.fontFamily.regular }]}>
                        {selectedEntry.error}
                      </Text>
                    </View>
                  )}

                  {/* Entry JSON Section */}
                  {selectedEntry.entry && (
                    <View style={[styles.section, { backgroundColor: theme.colors.background.secondary, borderColor: theme.colors.border.light }]}>
                      <Text style={[styles.sectionTitle, { color: theme.colors.text.primary, fontFamily: theme.typography.fontFamily.semibold }]}>
                        Entry Data
                      </Text>
                      <Text style={[styles.jsonText, { color: theme.colors.text.secondary }]}>
                        {JSON.stringify(selectedEntry.entry, null, 2)}
                      </Text>
                    </View>
                  )}
                </>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  statsText: {
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  refreshButton: {
    padding: 8,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  entryIndex: {
    fontSize: 12,
    width: 30,
    textAlign: 'center',
  },
  entryContent: {
    flex: 1,
    marginLeft: 8,
  },
  entryTitle: {
    fontSize: 14,
    marginBottom: 2,
  },
  entryId: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // Modal styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    borderRadius: 12,
    width: '100%',
    maxHeight: '85%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 16,
  },
  section: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  timingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  timingStep: {
    fontSize: 13,
  },
  timingValue: {
    fontSize: 13,
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  timingTotal: {
    fontSize: 16,
  },
  errorSection: {
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 13,
    color: '#dc2626',
  },
  jsonText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
});
