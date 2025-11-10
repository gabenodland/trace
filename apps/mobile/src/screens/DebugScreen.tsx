/**
 * Debug Screen - View SQLite database contents
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { localDB } from '../shared/db/localDB';
import { syncQueue } from '../shared/sync/syncQueue';

export function DebugScreen() {
  const [entries, setEntries] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadDebugInfo();
  }, [refreshKey]);

  const loadDebugInfo = async () => {
    try {
      // Get all entries from SQLite
      const allEntries = await localDB.getAllEntries();
      setEntries(allEntries);

      // Get sync status
      const status = await syncQueue.getSyncStatus();
      setSyncStatus(status);
    } catch (error) {
      console.error('Failed to load debug info:', error);
    }
  };

  const handleManualSync = async () => {
    try {
      await syncQueue.syncNow();
      Alert.alert('Sync', 'Manual sync triggered');
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      Alert.alert('Error', `Sync failed: ${error}`);
    }
  };

  const handleForcePull = async () => {
    Alert.alert(
      'Force Pull from Supabase',
      'This will download all entries from Supabase and merge with local data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Pull',
          onPress: async () => {
            try {
              await syncQueue.forcePull();
              Alert.alert('Success', 'Pulled all entries from Supabase');
              setRefreshKey(prev => prev + 1);
            } catch (error) {
              Alert.alert('Error', `Pull failed: ${error}`);
            }
          },
        },
      ]
    );
  };

  const handleClearLocalEntries = () => {
    Alert.alert(
      'Clear Local Entries',
      'This will delete all entries from local SQLite. They will automatically re-sync on next app restart or manual sync.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Entries',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete all entries
              await localDB.runCustomQuery('DELETE FROM entries');

              // Clear sync metadata so next sync does full pull
              await localDB.runCustomQuery('DELETE FROM sync_metadata WHERE key IN (?, ?)',
                ['last_pull_timestamp', 'initial_pull_completed']
              );

              setRefreshKey(prev => prev + 1);
              Alert.alert('Success', 'All local entries cleared. Next sync will re-download from Supabase.');
            } catch (error) {
              Alert.alert('Error', `Failed to clear entries: ${error}`);
            }
          },
        },
      ]
    );
  };

  const handleClearDatabase = () => {
    Alert.alert(
      'Clear Database',
      'Are you sure? This will delete ALL local data (entries, categories, metadata)!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await localDB.clearAllData();
            setRefreshKey(prev => prev + 1);
            Alert.alert('Success', 'Database cleared');
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Debug: SQLite Database</Text>
        <TouchableOpacity onPress={() => setRefreshKey(prev => prev + 1)} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>🔄 Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Sync Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync Status</Text>
        {syncStatus && (
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Unsynced entries: {syncStatus.unsyncedCount}
            </Text>
            <Text style={styles.infoText}>
              Is syncing: {syncStatus.isSyncing ? 'Yes' : 'No'}
            </Text>
          </View>
        )}
        <TouchableOpacity onPress={handleManualSync} style={styles.button}>
          <Text style={styles.buttonText}>🔄 Trigger Manual Sync</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleForcePull} style={[styles.button, styles.pullButton]}>
          <Text style={styles.buttonText}>📥 Force Pull from Supabase</Text>
        </TouchableOpacity>
      </View>

      {/* Database Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Database Stats</Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>Total entries: {entries.length}</Text>
          <Text style={styles.infoText}>
            Synced: {entries.filter(e => e.synced).length}
          </Text>
          <Text style={styles.infoText}>
            Unsynced: {entries.filter(e => !e.synced).length}
          </Text>
          <Text style={styles.infoText}>
            Local-only: {entries.filter(e => e.local_only).length}
          </Text>
        </View>
      </View>

      {/* Entries List */}
      <View style={[styles.section, { flex: 1 }]}>
        <Text style={styles.sectionTitle}>All Entries ({entries.length})</Text>
        <ScrollView style={styles.entriesList}>
          {entries.map((entry, index) => (
            <View key={entry.entry_id} style={styles.entryCard}>
              <Text style={styles.entryTitle}>
                {index + 1}. {entry.title || '(No title)'}
              </Text>
              <Text style={styles.entryContent} numberOfLines={2}>
                {entry.content.replace(/<[^>]*>/g, '')}
              </Text>
              <View style={styles.entryMeta}>
                <Text style={[styles.badge, entry.synced ? styles.syncedBadge : styles.unsyncedBadge]}>
                  {entry.synced ? '✅ Synced' : '⏳ Unsynced'}
                </Text>
                {entry.local_only ? (
                  <Text style={[styles.badge, styles.localBadge]}>🔒 Local</Text>
                ) : null}
                {entry.sync_action && (
                  <Text style={styles.badge}>📝 {entry.sync_action}</Text>
                )}
                {entry.sync_error && (
                  <Text style={[styles.badge, styles.errorBadge]}>❌ Error</Text>
                )}
              </View>
              <Text style={styles.entryId}>ID: {entry.entry_id.slice(0, 8)}...</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Danger Zone */}
      <View style={styles.dangerZone}>
        <TouchableOpacity onPress={handleClearLocalEntries} style={[styles.dangerButton, styles.warningButton]}>
          <Text style={styles.dangerButtonText}>🗑️ Clear Local Entries</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleClearDatabase} style={styles.dangerButton}>
          <Text style={styles.dangerButtonText}>💀 Clear All Database</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  refreshButton: {
    padding: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  infoBox: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  pullButton: {
    backgroundColor: '#10b981',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  entriesList: {
    flex: 1,
  },
  entryCard: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  entryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  entryContent: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  entryMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 4,
  },
  badge: {
    fontSize: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
    color: '#374151',
    overflow: 'hidden',
  },
  syncedBadge: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
  },
  unsyncedBadge: {
    backgroundColor: '#fef3c7',
    color: '#92400e',
  },
  localBadge: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
  },
  errorBadge: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
  },
  entryId: {
    fontSize: 10,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
  dangerZone: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  warningButton: {
    backgroundColor: '#f97316', // Orange instead of red
  },
  dangerButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
