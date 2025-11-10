/**
 * Database Info Screen - View SQLite database contents
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, Clipboard } from 'react-native';
import { supabase } from '@trace/core';
import { useNavigation } from '../shared/contexts/NavigationContext';
import { useNavigationMenu } from '../shared/hooks/useNavigationMenu';
import { TopBar } from '../components/layout/TopBar';
import { localDB } from '../shared/db/localDB';
import { syncQueue } from '../shared/sync/syncQueue';
import Svg, { Path } from 'react-native-svg';

type TabType = 'status' | 'entries' | 'categories';
type SyncFilter = 'all' | 'synced' | 'unsynced' | 'errors';

interface CloudCounts {
  entries: number;
  categories: number;
}

export function DatabaseInfoScreen() {
  const { navigate } = useNavigation();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const [activeTab, setActiveTab] = useState<TabType>('status');
  const [entries, setEntries] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [cloudCounts, setCloudCounts] = useState<CloudCounts>({ entries: 0, categories: 0 });
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [entrySyncFilter, setEntrySyncFilter] = useState<SyncFilter>('all');
  const [categorySyncFilter, setCategorySyncFilter] = useState<SyncFilter>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [jsonModalVisible, setJsonModalVisible] = useState(false);
  const [jsonModalContent, setJsonModalContent] = useState<string>('');
  const [jsonModalTitle, setJsonModalTitle] = useState<string>('');

  useEffect(() => {
    loadDebugInfo();
  }, [refreshKey]);

  const loadDebugInfo = async () => {
    try {
      // Get all entries from SQLite
      const allEntries = await localDB.getAllEntries();
      setEntries(allEntries);

      // Get all categories from SQLite
      const allCategories = await localDB.runCustomQuery('SELECT * FROM categories ORDER BY name');
      setCategories(allCategories);

      // Get sync status
      const status = await syncQueue.getSyncStatus();
      setSyncStatus(status);

      // Get counts from Cloud
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [entriesCount, categoriesCount] = await Promise.all([
          supabase
            .from('entries')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('categories')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
        ]);

        setCloudCounts({
          entries: entriesCount.count || 0,
          categories: categoriesCount.count || 0,
        });
      }
    } catch (error) {
      console.error('Failed to load debug info:', error);
    }
  };

  // Filter entries based on sync filter
  const filteredEntries = entries.filter(entry => {
    switch (entrySyncFilter) {
      case 'synced':
        return entry.synced;
      case 'unsynced':
        return !entry.synced;
      case 'errors':
        return entry.sync_error;
      default:
        return true;
    }
  });

  // Filter categories based on sync filter
  const filteredCategories = categories.filter(category => {
    switch (categorySyncFilter) {
      case 'synced':
        return category.synced;
      case 'unsynced':
        return !category.synced;
      case 'errors':
        return category.sync_error;
      default:
        return true;
    }
  });

  const handleSync = async () => {
    Alert.alert(
      'Sync Database',
      'Choose sync action:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Normal Sync',
          onPress: async () => {
            try {
              await syncQueue.syncNow();
              Alert.alert('Success', 'Manual sync triggered');
              setRefreshKey(prev => prev + 1);
            } catch (error) {
              Alert.alert('Error', `Sync failed: ${error}`);
            }
          },
        },
        {
          text: 'Force Pull',
          onPress: async () => {
            try {
              await syncQueue.forcePull();
              Alert.alert('Success', 'Pulled all data from Cloud');
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
              Alert.alert('Success', 'All local entries cleared. Next sync will re-download from Cloud.');
            } catch (error) {
              Alert.alert('Error', `Failed to clear entries: ${error}`);
            }
          },
        },
      ]
    );
  };

  const handleClearLocalCategories = () => {
    Alert.alert(
      'Clear Local Categories',
      'This will delete all categories from local SQLite. They will automatically re-sync on next sync.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Categories',
          style: 'destructive',
          onPress: async () => {
            try {
              await localDB.runCustomQuery('DELETE FROM categories');
              setRefreshKey(prev => prev + 1);
              Alert.alert('Success', 'All local categories cleared. Next sync will re-download from Cloud.');
            } catch (error) {
              Alert.alert('Error', `Failed to clear categories: ${error}`);
            }
          },
        },
      ]
    );
  };

  const showJsonModal = (obj: any, title: string) => {
    setJsonModalTitle(title);
    setJsonModalContent(JSON.stringify(obj, null, 2));
    setJsonModalVisible(true);
  };

  const copyToClipboard = () => {
    Clipboard.setString(jsonModalContent);
    Alert.alert('Copied', 'JSON copied to clipboard');
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
      <TopBar
        title="Database Info"
        menuItems={menuItems}
        userEmail={userEmail}
        onProfilePress={onProfilePress}
      >
        <TouchableOpacity onPress={() => setRefreshKey(prev => prev + 1)} style={styles.refreshButton}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2}>
            <Path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0118.8-4.3M22 12.5a10 10 0 01-18.8 4.2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      </TopBar>

      {/* Tab Menu */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'status' && styles.tabActive]}
          onPress={() => setActiveTab('status')}
        >
          <Text style={[styles.tabText, activeTab === 'status' && styles.tabTextActive]}>
            Status
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'entries' && styles.tabActive]}
          onPress={() => setActiveTab('entries')}
        >
          <Text style={[styles.tabText, activeTab === 'entries' && styles.tabTextActive]}>
            Entries
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'categories' && styles.tabActive]}
          onPress={() => setActiveTab('categories')}
        >
          <Text style={[styles.tabText, activeTab === 'categories' && styles.tabTextActive]}>
            Categories
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* STATUS TAB */}
        {activeTab === 'status' && (
          <>
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
              <TouchableOpacity onPress={handleSync} style={styles.button}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth={2} style={styles.buttonIcon}>
                  <Path d="M12 2v6m0 0L8 4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M12 22v-6m0 0l4 4m-4-4l-4 4" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d="M2 12h6m0 0L4 8m4 4l-4 4m14-4h6m0 0l-4-4m4 4l-4 4" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
                <Text style={styles.buttonText}>Sync Database</Text>
              </TouchableOpacity>
            </View>

            {/* Database Stats */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Entries</Text>
              <View style={styles.statsRow}>
                <View style={[styles.infoBox, styles.statsBox]}>
                  <Text style={styles.statsLabel}>Local</Text>
                  <Text style={styles.statsCount}>{entries.length}</Text>
                  <Text style={styles.infoText}>
                    Synced: {entries.filter(e => e.synced).length}
                  </Text>
                  <Text style={styles.infoText}>
                    Unsynced: {entries.filter(e => !e.synced).length}
                  </Text>
                  <Text style={styles.infoText}>
                    Errors: {entries.filter(e => e.sync_error).length}
                  </Text>
                  <TouchableOpacity onPress={handleClearLocalEntries} style={styles.smallClearButton}>
                    <Text style={styles.smallClearButtonText}>Clear Local</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.infoBox, styles.statsBox]}>
                  <Text style={styles.statsLabel}>Cloud</Text>
                  <Text style={styles.statsCount}>{cloudCounts.entries}</Text>
                  <Text style={styles.infoText}>
                    Diff: {cloudCounts.entries - entries.length}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Categories</Text>
              <View style={styles.statsRow}>
                <View style={[styles.infoBox, styles.statsBox]}>
                  <Text style={styles.statsLabel}>Local</Text>
                  <Text style={styles.statsCount}>{categories.length}</Text>
                  <Text style={styles.infoText}>
                    Synced: {categories.filter(c => c.synced).length}
                  </Text>
                  <Text style={styles.infoText}>
                    Unsynced: {categories.filter(c => !c.synced).length}
                  </Text>
                  <Text style={styles.infoText}>
                    Errors: {categories.filter(c => c.sync_error).length}
                  </Text>
                  <TouchableOpacity onPress={handleClearLocalCategories} style={styles.smallClearButton}>
                    <Text style={styles.smallClearButtonText}>Clear Local</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.infoBox, styles.statsBox]}>
                  <Text style={styles.statsLabel}>Cloud</Text>
                  <Text style={styles.statsCount}>{cloudCounts.categories}</Text>
                  <Text style={styles.infoText}>
                    Diff: {cloudCounts.categories - categories.length}
                  </Text>
                </View>
              </View>
            </View>

            {/* Danger Zone */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Danger Zone</Text>
              <TouchableOpacity onPress={handleClearDatabase} style={styles.dangerButton}>
                <Text style={styles.dangerButtonText}>💀 Delete All Local Data</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ENTRIES TAB */}
        {activeTab === 'entries' && (
          <>
            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={[styles.filterTab, entrySyncFilter === 'all' && styles.filterTabActive]}
                onPress={() => setEntrySyncFilter('all')}
              >
                <Text style={[styles.filterTabText, entrySyncFilter === 'all' && styles.filterTabTextActive]}>
                  All ({entries.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, entrySyncFilter === 'synced' && styles.filterTabActive]}
                onPress={() => setEntrySyncFilter('synced')}
              >
                <Text style={[styles.filterTabText, entrySyncFilter === 'synced' && styles.filterTabTextActive]}>
                  Synced ({entries.filter(e => e.synced).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, entrySyncFilter === 'unsynced' && styles.filterTabActive]}
                onPress={() => setEntrySyncFilter('unsynced')}
              >
                <Text style={[styles.filterTabText, entrySyncFilter === 'unsynced' && styles.filterTabTextActive]}>
                  Unsynced ({entries.filter(e => !e.synced).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, entrySyncFilter === 'errors' && styles.filterTabActive]}
                onPress={() => setEntrySyncFilter('errors')}
              >
                <Text style={[styles.filterTabText, entrySyncFilter === 'errors' && styles.filterTabTextActive]}>
                  Errors ({entries.filter(e => e.sync_error).length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Entries List */}
            <View style={styles.section}>
              {filteredEntries.map((entry, index) => (
            <TouchableOpacity
              key={entry.entry_id}
              style={styles.entryCard}
              onLongPress={() => showJsonModal(entry, `Entry: ${entry.title || 'No title'}`)}
              activeOpacity={0.7}
            >
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
            </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* CATEGORIES TAB */}
        {activeTab === 'categories' && (
          <>
            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={[styles.filterTab, categorySyncFilter === 'all' && styles.filterTabActive]}
                onPress={() => setCategorySyncFilter('all')}
              >
                <Text style={[styles.filterTabText, categorySyncFilter === 'all' && styles.filterTabTextActive]}>
                  All ({categories.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, categorySyncFilter === 'synced' && styles.filterTabActive]}
                onPress={() => setCategorySyncFilter('synced')}
              >
                <Text style={[styles.filterTabText, categorySyncFilter === 'synced' && styles.filterTabTextActive]}>
                  Synced ({categories.filter(c => c.synced).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, categorySyncFilter === 'unsynced' && styles.filterTabActive]}
                onPress={() => setCategorySyncFilter('unsynced')}
              >
                <Text style={[styles.filterTabText, categorySyncFilter === 'unsynced' && styles.filterTabTextActive]}>
                  Unsynced ({categories.filter(c => !c.synced).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, categorySyncFilter === 'errors' && styles.filterTabActive]}
                onPress={() => setCategorySyncFilter('errors')}
              >
                <Text style={[styles.filterTabText, categorySyncFilter === 'errors' && styles.filterTabTextActive]}>
                  Errors ({categories.filter(c => c.sync_error).length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Categories List */}
            <View style={styles.section}>
              {filteredCategories.map((category, index) => (
                <TouchableOpacity
                  key={category.category_id}
                  style={styles.categoryCard}
                  onLongPress={() => showJsonModal(category, `Category: ${category.name}`)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.categoryName}>
                    {index + 1}. {category.name}
                  </Text>
                  {category.parent_id && (
                    <Text style={styles.categoryMeta}>
                      Parent ID: {category.parent_id.slice(0, 8)}...
                    </Text>
                  )}
                  <View style={styles.entryMeta}>
                    <Text style={[styles.badge, category.synced ? styles.syncedBadge : styles.unsyncedBadge]}>
                      {category.synced ? '✅ Synced' : '⏳ Unsynced'}
                    </Text>
                    {category.local_only ? (
                      <Text style={[styles.badge, styles.localBadge]}>🔒 Local</Text>
                    ) : null}
                    {category.sync_action && (
                      <Text style={styles.badge}>📝 {category.sync_action}</Text>
                    )}
                    {category.sync_error && (
                      <Text style={[styles.badge, styles.errorBadge]}>❌ Error</Text>
                    )}
                  </View>
                  <Text style={styles.categoryId}>ID: {category.category_id.slice(0, 8)}...</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* JSON Modal */}
      <Modal
        visible={jsonModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setJsonModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{jsonModalTitle}</Text>
              <View style={styles.modalHeaderButtons}>
                <TouchableOpacity onPress={copyToClipboard} style={styles.modalCopyButton}>
                  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth={2}>
                    <Path d="M8 4v12a2 2 0 002 2h8a2 2 0 002-2V7.242a2 2 0 00-.602-1.43L16.083 2.57A2 2 0 0014.685 2H10a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M16 18v2a2 2 0 01-2 2H6a2 2 0 01-2-2V9a2 2 0 012-2h2" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setJsonModalVisible(false)} style={styles.modalCloseButton}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={2}>
                    <Path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </TouchableOpacity>
              </View>
            </View>
            <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
              <Text style={styles.jsonText}>{jsonModalContent}</Text>
              <View style={styles.jsonSpacer} />
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
    backgroundColor: '#f9fafb',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  refreshButton: {
    padding: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  filterTabActive: {
    backgroundColor: '#3b82f6',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterTabTextActive: {
    color: '#ffffff',
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statsBox: {
    flex: 1,
  },
  statsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  statsCount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  buttonIcon: {
    marginRight: 4,
  },
  pullButton: {
    backgroundColor: '#10b981',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  smallClearButton: {
    backgroundColor: '#f97316',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  smallClearButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
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
  categoryCard: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  categoryMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  categoryId: {
    fontSize: 10,
    color: '#9ca3af',
    fontFamily: 'monospace',
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '100%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  modalHeaderButtons: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  modalCopyButton: {
    padding: 4,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalContent: {
    padding: 16,
  },
  modalContentContainer: {
    paddingBottom: 40,
  },
  jsonText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#1f2937',
    lineHeight: 18,
  },
  jsonSpacer: {
    height: 100,
  },
});
