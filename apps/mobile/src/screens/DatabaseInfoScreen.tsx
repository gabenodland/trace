/**
 * Database Info Screen - View SQLite database contents
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, Clipboard, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@trace/core';
import { useNavigation } from '../shared/contexts/NavigationContext';
import { useNavigationMenu } from '../shared/hooks/useNavigationMenu';
import { TopBar } from '../components/layout/TopBar';
import { localDB } from '../shared/db/localDB';
import { syncQueue } from '../shared/sync/syncQueue';
import { deletePhotoFromLocalStorage } from '../modules/photos/mobilePhotoApi';
import Svg, { Path } from 'react-native-svg';

type TabType = 'status' | 'entries' | 'categories' | 'locations' | 'photos' | 'logs';
type SyncFilter = 'all' | 'synced' | 'unsynced' | 'errors';

interface CloudCounts {
  entries: number;
  categories: number;
  locations: number;
  photos: number;
}

export function DatabaseInfoScreen() {
  const { navigate } = useNavigation();
  const { menuItems, userEmail, onProfilePress } = useNavigationMenu();
  const [activeTab, setActiveTab] = useState<TabType>('status');
  const [entries, setEntries] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [cloudCounts, setCloudCounts] = useState<CloudCounts>({ entries: 0, categories: 0, locations: 0, photos: 0 });
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [entrySyncFilter, setEntrySyncFilter] = useState<SyncFilter>('all');
  const [categorySyncFilter, setCategorySyncFilter] = useState<SyncFilter>('all');
  const [locationSyncFilter, setLocationSyncFilter] = useState<SyncFilter>('all');
  const [photoSyncFilter, setPhotoSyncFilter] = useState<SyncFilter>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [jsonModalVisible, setJsonModalVisible] = useState(false);
  const [jsonModalContent, setJsonModalContent] = useState<string>('');
  const [jsonModalTitle, setJsonModalTitle] = useState<string>('');
  const [schemaVersion, setSchemaVersion] = useState<number>(0);
  const [photoFilesExist, setPhotoFilesExist] = useState<Record<string, boolean>>({});

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

      // Get all photos from SQLite
      const allPhotos = await localDB.runCustomQuery('SELECT * FROM photos ORDER BY created_at DESC');
      setPhotos(allPhotos);

      // Get all locations from SQLite
      const allLocations = await localDB.runCustomQuery('SELECT * FROM locations ORDER BY name');
      setLocations(allLocations);

      // Check which photo files exist locally
      const fileExistenceMap: Record<string, boolean> = {};
      for (const photo of allPhotos) {
        if (photo.local_path) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(photo.local_path);
            fileExistenceMap[photo.photo_id] = fileInfo.exists;
          } catch (error) {
            fileExistenceMap[photo.photo_id] = false;
          }
        } else {
          fileExistenceMap[photo.photo_id] = false;
        }
      }
      setPhotoFilesExist(fileExistenceMap);

      // Get sync logs from SQLite
      const logs = await localDB.getSyncLogs(50); // Get last 50 logs
      setSyncLogs(logs);

      // Get sync status
      const status = await syncQueue.getSyncStatus();
      setSyncStatus(status);

      // Get schema version
      const versionResult = await localDB.runCustomQuery(
        'SELECT value FROM sync_metadata WHERE key = ?',
        ['schema_version']
      );
      setSchemaVersion(versionResult.length > 0 ? parseInt(versionResult[0].value) : 0);

      // Get counts from Cloud
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [entriesCount, categoriesCount, locationsCount, photosCount] = await Promise.all([
          supabase
            .from('entries')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('categories')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('locations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('photos')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
        ]);

        setCloudCounts({
          entries: entriesCount.count || 0,
          categories: categoriesCount.count || 0,
          locations: locationsCount.count || 0,
          photos: photosCount.count || 0,
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

  // Filter photos based on sync filter
  const filteredPhotos = photos.filter(photo => {
    switch (photoSyncFilter) {
      case 'synced':
        return photo.synced;
      case 'unsynced':
        return !photo.synced;
      case 'errors':
        return photo.sync_error;
      default:
        return true;
    }
  });

  // Filter locations based on sync filter
  const filteredLocations = locations.filter(location => {
    switch (locationSyncFilter) {
      case 'synced':
        return location.synced;
      case 'unsynced':
        return !location.synced;
      case 'errors':
        return location.sync_error;
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

  const handleClearLocalLocations = () => {
    Alert.alert(
      'Clear Local Locations',
      'This will delete all locations from local SQLite. They will automatically re-sync on next sync.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Locations',
          style: 'destructive',
          onPress: async () => {
            try {
              await localDB.runCustomQuery('DELETE FROM locations');
              setRefreshKey(prev => prev + 1);
              Alert.alert('Success', 'All local locations cleared. Next sync will re-download from Cloud.');
            } catch (error) {
              Alert.alert('Error', `Failed to clear locations: ${error}`);
            }
          },
        },
      ]
    );
  };

  const handleDeleteUnusedLocations = async () => {
    try {
      // Find locations that are not referenced by any entry
      const unusedLocations = await localDB.runCustomQuery(`
        SELECT l.location_id, l.name
        FROM locations l
        LEFT JOIN entries e ON l.location_id = e.location_id
        WHERE e.entry_id IS NULL
      `);

      if (unusedLocations.length === 0) {
        Alert.alert('All Good', 'No unused locations found. All locations are referenced by entries.');
        return;
      }

      Alert.alert(
        'Delete Unused Locations',
        `Found ${unusedLocations.length} location${unusedLocations.length === 1 ? '' : 's'} not referenced by any entry. Delete them?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                // Delete unused locations and mark for sync deletion
                for (const loc of unusedLocations) {
                  await localDB.runCustomQuery(
                    'UPDATE locations SET deleted_at = ?, synced = 0, sync_action = ? WHERE location_id = ?',
                    [new Date().toISOString(), 'delete', loc.location_id]
                  );
                }

                setRefreshKey(prev => prev + 1);
                Alert.alert('Success', `Marked ${unusedLocations.length} unused location${unusedLocations.length === 1 ? '' : 's'} for deletion.`);
              } catch (error) {
                Alert.alert('Error', `Failed to delete unused locations: ${error}`);
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', `Failed to find unused locations: ${error}`);
    }
  };

  const handleMergeDuplicateLocations = async () => {
    try {
      // Find duplicate locations (same name AND address, case insensitive)
      // Only consider locations with an address
      const duplicates = await localDB.runCustomQuery(`
        SELECT
          LOWER(name) as name_lower,
          LOWER(address) as address_lower,
          COUNT(*) as count
        FROM locations
        WHERE address IS NOT NULL AND address != '' AND deleted_at IS NULL
        GROUP BY LOWER(name), LOWER(address)
        HAVING COUNT(*) > 1
        LIMIT 1
      `);

      if (duplicates.length === 0) {
        Alert.alert('All Good', 'No duplicate locations found.');
        return;
      }

      const duplicate = duplicates[0];

      // Get all locations matching this name/address
      const matchingLocations = await localDB.runCustomQuery(`
        SELECT l.location_id, l.name, l.address,
          (SELECT COUNT(*) FROM entries e WHERE e.location_id = l.location_id) as entry_count
        FROM locations l
        WHERE LOWER(l.name) = ? AND LOWER(l.address) = ? AND l.deleted_at IS NULL
        ORDER BY entry_count DESC
      `, [duplicate.name_lower, duplicate.address_lower]);

      if (matchingLocations.length < 2) {
        Alert.alert('All Good', 'No duplicate locations found.');
        return;
      }

      // Winner is the one with most entries
      const winner = matchingLocations[0];
      const losers = matchingLocations.slice(1);
      const totalEntriesToMove = losers.reduce((sum: number, loc: any) => sum + loc.entry_count, 0);

      Alert.alert(
        'Merge Duplicate Locations',
        `Found ${matchingLocations.length} locations named "${winner.name}" at "${winner.address}".\n\n` +
        `Winner: ${winner.entry_count} entries\n` +
        `Losers: ${losers.length} location(s) with ${totalEntriesToMove} entries\n\n` +
        `Merge all entries to the winner and delete the duplicates?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Merge',
            style: 'destructive',
            onPress: async () => {
              try {
                // Move all entries from losers to winner
                for (const loser of losers) {
                  // Update entries to point to winner
                  await localDB.runCustomQuery(
                    'UPDATE entries SET location_id = ?, synced = 0, sync_action = CASE WHEN sync_action = "create" THEN "create" ELSE "update" END WHERE location_id = ?',
                    [winner.location_id, loser.location_id]
                  );

                  // Mark loser location for deletion
                  await localDB.runCustomQuery(
                    'UPDATE locations SET deleted_at = ?, synced = 0, sync_action = ? WHERE location_id = ?',
                    [new Date().toISOString(), 'delete', loser.location_id]
                  );
                }

                setRefreshKey(prev => prev + 1);
                Alert.alert(
                  'Success',
                  `Merged ${losers.length} duplicate location(s). ${totalEntriesToMove} entries moved to "${winner.name}".`
                );
              } catch (error) {
                Alert.alert('Error', `Failed to merge locations: ${error}`);
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', `Failed to find duplicate locations: ${error}`);
    }
  };

  const handleClearLocalPhotos = () => {
    Alert.alert(
      'Clear Local Photos',
      'This will delete all photo files and database records. Photos will re-download from Cloud on next sync if they were uploaded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Photos',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get all photos
              const allPhotos = await localDB.runCustomQuery('SELECT * FROM photos');

              // Delete all local photo files
              let deletedCount = 0;
              for (const photo of allPhotos) {
                if (photo.local_path) {
                  try {
                    await deletePhotoFromLocalStorage(photo.local_path);
                    deletedCount++;
                  } catch (err) {
                    console.warn(`Failed to delete photo file: ${photo.local_path}`, err);
                  }
                }
              }

              // Delete all photo records from database
              await localDB.runCustomQuery('DELETE FROM photos');

              setRefreshKey(prev => prev + 1);
              Alert.alert('Success', `Cleared ${allPhotos.length} photo records and deleted ${deletedCount} local files. Uploaded photos will re-download from Cloud on next sync.`);
            } catch (error) {
              Alert.alert('Error', `Failed to clear photos: ${error}`);
            }
          },
        },
      ]
    );
  };

  const handleCleanupOrphanedPhotos = async () => {
    try {
      const orphanCount = await localDB.cleanupOrphanedPhotos();
      setRefreshKey(prev => prev + 1);

      if (orphanCount > 0) {
        Alert.alert('Success', `Found and marked ${orphanCount} orphaned photo${orphanCount === 1 ? '' : 's'} for deletion. They will be removed on next sync.`);
      } else {
        Alert.alert('All Good', 'No orphaned photos found.');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to cleanup orphaned photos: ${error}`);
    }
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScrollContainer}
        contentContainerStyle={styles.tabContainer}
      >
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
        <TouchableOpacity
          style={[styles.tab, activeTab === 'locations' && styles.tabActive]}
          onPress={() => setActiveTab('locations')}
        >
          <Text style={[styles.tabText, activeTab === 'locations' && styles.tabTextActive]}>
            Locations
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'photos' && styles.tabActive]}
          onPress={() => setActiveTab('photos')}
        >
          <Text style={[styles.tabText, activeTab === 'photos' && styles.tabTextActive]}>
            Photos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'logs' && styles.tabActive]}
          onPress={() => setActiveTab('logs')}
        >
          <Text style={[styles.tabText, activeTab === 'logs' && styles.tabTextActive]}>
            Logs
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView style={styles.content}>
        {/* STATUS TAB */}
        {activeTab === 'status' && (
          <>
            {/* Database Schema Version */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Database</Text>
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Schema Version: <Text style={styles.versionNumber}>{schemaVersion}</Text>
                </Text>
                <Text style={styles.infoTextSmall}>
                  {schemaVersion === 7 ? '✅ Latest version (includes photos table)' :
                   schemaVersion < 7 ? '⚠️ Old version - clear app data to upgrade' :
                   '❓ Unknown version'}
                </Text>
              </View>
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

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Locations</Text>
              <View style={styles.statsRow}>
                <View style={[styles.infoBox, styles.statsBox]}>
                  <Text style={styles.statsLabel}>Local</Text>
                  <Text style={styles.statsCount}>{locations.length}</Text>
                  <Text style={styles.infoText}>
                    Synced: {locations.filter(l => l.synced).length}
                  </Text>
                  <Text style={styles.infoText}>
                    Unsynced: {locations.filter(l => !l.synced).length}
                  </Text>
                  <Text style={styles.infoText}>
                    Errors: {locations.filter(l => l.sync_error).length}
                  </Text>
                  <TouchableOpacity onPress={handleClearLocalLocations} style={styles.smallClearButton}>
                    <Text style={styles.smallClearButtonText}>Clear Local</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.infoBox, styles.statsBox]}>
                  <Text style={styles.statsLabel}>Cloud</Text>
                  <Text style={styles.statsCount}>{cloudCounts.locations}</Text>
                  <Text style={styles.infoText}>
                    Diff: {cloudCounts.locations - locations.length}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Photos</Text>
              <View style={styles.statsRow}>
                <View style={[styles.infoBox, styles.statsBox]}>
                  <Text style={styles.statsLabel}>Local</Text>
                  <Text style={styles.statsCount}>{photos.length}</Text>
                  <Text style={styles.infoText}>
                    Synced: {photos.filter(p => p.synced).length}
                  </Text>
                  <Text style={styles.infoText}>
                    Unsynced: {photos.filter(p => !p.synced).length}
                  </Text>
                  <Text style={styles.infoText}>
                    Uploaded: {photos.filter(p => p.uploaded).length}
                  </Text>
                  <Text style={styles.infoText}>
                    Errors: {photos.filter(p => p.sync_error).length}
                  </Text>
                  <TouchableOpacity onPress={handleClearLocalPhotos} style={styles.smallClearButton}>
                    <Text style={styles.smallClearButtonText}>Clear Local Photos</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCleanupOrphanedPhotos} style={styles.cleanupButton}>
                    <Text style={styles.cleanupButtonText}>🧹 Cleanup Orphans</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.infoBox, styles.statsBox]}>
                  <Text style={styles.statsLabel}>Cloud</Text>
                  <Text style={styles.statsCount}>{cloudCounts.photos}</Text>
                  <Text style={styles.infoText}>
                    Diff: {cloudCounts.photos - photos.length}
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
              {entry.sync_error && (
                <Text style={styles.errorMessage}>{entry.sync_error}</Text>
              )}
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
                  {category.sync_error && (
                    <Text style={styles.errorMessage}>{category.sync_error}</Text>
                  )}
                  <Text style={styles.categoryId}>ID: {category.category_id.slice(0, 8)}...</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* LOCATIONS TAB */}
        {activeTab === 'locations' && (
          <>
            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={[styles.filterTab, locationSyncFilter === 'all' && styles.filterTabActive]}
                onPress={() => setLocationSyncFilter('all')}
              >
                <Text style={[styles.filterTabText, locationSyncFilter === 'all' && styles.filterTabTextActive]}>
                  All ({locations.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, locationSyncFilter === 'synced' && styles.filterTabActive]}
                onPress={() => setLocationSyncFilter('synced')}
              >
                <Text style={[styles.filterTabText, locationSyncFilter === 'synced' && styles.filterTabTextActive]}>
                  Synced ({locations.filter(l => l.synced).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, locationSyncFilter === 'unsynced' && styles.filterTabActive]}
                onPress={() => setLocationSyncFilter('unsynced')}
              >
                <Text style={[styles.filterTabText, locationSyncFilter === 'unsynced' && styles.filterTabTextActive]}>
                  Unsynced ({locations.filter(l => !l.synced).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, locationSyncFilter === 'errors' && styles.filterTabActive]}
                onPress={() => setLocationSyncFilter('errors')}
              >
                <Text style={[styles.filterTabText, locationSyncFilter === 'errors' && styles.filterTabTextActive]}>
                  Errors ({locations.filter(l => l.sync_error).length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Actions */}
            <View style={styles.section}>
              <TouchableOpacity style={styles.dangerButton} onPress={handleMergeDuplicateLocations}>
                <Text style={styles.dangerButtonText}>🔀 Merge Duplicate Locations</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dangerButton, { marginTop: 8 }]} onPress={handleDeleteUnusedLocations}>
                <Text style={styles.dangerButtonText}>🗑️ Delete Unused Locations</Text>
              </TouchableOpacity>
            </View>

            {/* Locations List */}
            <View style={styles.section}>
              {filteredLocations.length === 0 ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>No locations found</Text>
                </View>
              ) : (
                filteredLocations.map((location, index) => (
                  <TouchableOpacity
                    key={location.location_id}
                    style={styles.locationCard}
                    onLongPress={() => showJsonModal(location, `Location: ${location.name}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.locationTitle}>
                      {index + 1}. {location.name}
                    </Text>
                    <View style={styles.locationMetaContainer}>
                      {location.city && (
                        <Text style={styles.locationMeta}>
                          City: {location.city}
                        </Text>
                      )}
                      {location.region && (
                        <Text style={styles.locationMeta}>
                          Region: {location.region}
                        </Text>
                      )}
                      {/* Country hidden for now but still captured in data */}
                      <Text style={styles.locationMeta}>
                        Coords: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                      </Text>
                      {location.source && (
                        <Text style={styles.locationMeta}>
                          Source: {location.source}
                        </Text>
                      )}
                    </View>
                    <View style={styles.entryMeta}>
                      <Text style={[styles.badge, location.synced ? styles.syncedBadge : styles.unsyncedBadge]}>
                        {location.synced ? '✅ Synced' : '⏳ Unsynced'}
                      </Text>
                      {location.sync_action && (
                        <Text style={styles.badge}>📝 {location.sync_action}</Text>
                      )}
                      {location.sync_error && (
                        <Text style={[styles.badge, styles.errorBadge]}>❌ Error</Text>
                      )}
                    </View>
                    {location.sync_error && (
                      <Text style={styles.errorMessage}>{location.sync_error}</Text>
                    )}
                    <Text style={styles.locationId}>ID: {location.location_id.slice(0, 8)}...</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}

        {/* PHOTOS TAB */}
        {activeTab === 'photos' && (
          <>
            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={[styles.filterTab, photoSyncFilter === 'all' && styles.filterTabActive]}
                onPress={() => setPhotoSyncFilter('all')}
              >
                <Text style={[styles.filterTabText, photoSyncFilter === 'all' && styles.filterTabTextActive]}>
                  All ({photos.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, photoSyncFilter === 'synced' && styles.filterTabActive]}
                onPress={() => setPhotoSyncFilter('synced')}
              >
                <Text style={[styles.filterTabText, photoSyncFilter === 'synced' && styles.filterTabTextActive]}>
                  Synced ({photos.filter(p => p.synced).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, photoSyncFilter === 'unsynced' && styles.filterTabActive]}
                onPress={() => setPhotoSyncFilter('unsynced')}
              >
                <Text style={[styles.filterTabText, photoSyncFilter === 'unsynced' && styles.filterTabTextActive]}>
                  Unsynced ({photos.filter(p => !p.synced).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, photoSyncFilter === 'errors' && styles.filterTabActive]}
                onPress={() => setPhotoSyncFilter('errors')}
              >
                <Text style={[styles.filterTabText, photoSyncFilter === 'errors' && styles.filterTabTextActive]}>
                  Errors ({photos.filter(p => p.sync_error).length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Photos List */}
            <View style={styles.section}>
              {filteredPhotos.length === 0 ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>No photos found</Text>
                </View>
              ) : (
                filteredPhotos.map((photo, index) => (
                  <TouchableOpacity
                    key={photo.photo_id}
                    style={styles.photoCard}
                    onLongPress={() => showJsonModal(photo, `Photo: ${photo.photo_id.slice(0, 8)}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.photoTitle}>
                      {index + 1}. Photo {photo.photo_id.slice(0, 8)}...
                    </Text>
                    <View style={styles.photoMetaContainer}>
                      <Text style={styles.photoMeta}>
                        Entry: {photo.entry_id.slice(0, 8)}...
                      </Text>
                      <Text style={styles.photoMeta}>
                        File: {photo.file_path}
                      </Text>
                      <Text style={styles.photoMeta}>
                        MIME: {photo.mime_type}
                      </Text>
                      <Text style={styles.photoMeta}>
                        Position: {photo.position}
                      </Text>
                      {photo.local_path && (
                        <Text style={[styles.photoMeta, !photoFilesExist[photo.photo_id] && styles.errorText]}>
                          Local: {photoFilesExist[photo.photo_id] ? '✓ File exists' : '⚠️ File missing'}
                        </Text>
                      )}
                    </View>
                    <View style={styles.entryMeta}>
                      <Text style={[styles.badge, photo.uploaded ? styles.syncedBadge : styles.unsyncedBadge]}>
                        {photo.uploaded ? '☁️ Uploaded' : '📱 Local Only'}
                      </Text>
                      <Text style={[styles.badge, photo.synced ? styles.syncedBadge : styles.unsyncedBadge]}>
                        {photo.synced ? '✅ Synced' : '⏳ Unsynced'}
                      </Text>
                      {photo.sync_action && (
                        <Text style={styles.badge}>📝 {photo.sync_action}</Text>
                      )}
                      {photo.sync_error && (
                        <Text style={[styles.badge, styles.errorBadge]}>❌ Error</Text>
                      )}
                    </View>
                    {photo.sync_error && (
                      <Text style={styles.errorMessage}>{photo.sync_error}</Text>
                    )}
                    <Text style={styles.photoId}>ID: {photo.photo_id}</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sync Logs (Last 50)</Text>
              <Text style={styles.subtitle}>Logs older than 7 days are automatically deleted</Text>

              {syncLogs.length === 0 ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>No sync logs found</Text>
                </View>
              ) : (
                syncLogs.map((log) => {
                  const date = new Date(log.timestamp);
                  const levelColor = log.log_level === 'error' ? '#dc2626' : log.log_level === 'warning' ? '#f59e0b' : '#3b82f6';
                  const levelBg = log.log_level === 'error' ? '#fef2f2' : log.log_level === 'warning' ? '#fffbeb' : '#eff6ff';

                  return (
                    <View key={log.id} style={[styles.logCard, { borderLeftColor: levelColor }]}>
                      <View style={styles.logHeader}>
                        <Text style={[styles.logLevel, { backgroundColor: levelBg, color: levelColor }]}>
                          {log.log_level.toUpperCase()}
                        </Text>
                        <Text style={styles.logTimestamp}>
                          {date.toLocaleString()}
                        </Text>
                      </View>
                      <Text style={styles.logOperation}>{log.operation}</Text>
                      <Text style={styles.logMessage}>{log.message}</Text>

                      {(log.entries_pushed > 0 || log.entries_errors > 0 || log.categories_pushed > 0 || log.categories_errors > 0) && (
                        <View style={styles.logStats}>
                          {log.entries_pushed > 0 && (
                            <Text style={styles.logStat}>📤 Entries: {log.entries_pushed}</Text>
                          )}
                          {log.entries_errors > 0 && (
                            <Text style={[styles.logStat, styles.logStatError]}>❌ Entry Errors: {log.entries_errors}</Text>
                          )}
                          {log.categories_pushed > 0 && (
                            <Text style={styles.logStat}>📁 Categories: {log.categories_pushed}</Text>
                          )}
                          {log.categories_errors > 0 && (
                            <Text style={[styles.logStat, styles.logStatError]}>❌ Category Errors: {log.categories_errors}</Text>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })
              )}
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
  tabScrollContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexGrow: 0,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  tab: {
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
  infoTextSmall: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  versionNumber: {
    fontWeight: '700',
    fontSize: 16,
    color: '#3b82f6',
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
  cleanupButton: {
    backgroundColor: '#10b981',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    marginTop: 8,
    alignItems: 'center',
  },
  cleanupButtonText: {
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
  errorMessage: {
    fontSize: 11,
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
    marginBottom: 4,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  errorText: {
    color: '#dc2626',
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
  locationCard: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  locationMetaContainer: {
    marginBottom: 8,
  },
  locationMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 3,
  },
  locationId: {
    fontSize: 10,
    color: '#9ca3af',
    fontFamily: 'monospace',
    marginTop: 4,
  },
  photoCard: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  photoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  photoMetaContainer: {
    marginBottom: 8,
  },
  photoMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 3,
  },
  photoId: {
    fontSize: 10,
    color: '#9ca3af',
    fontFamily: 'monospace',
    marginTop: 4,
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
  // Log styles
  logCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logLevel: {
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  logTimestamp: {
    fontSize: 11,
    color: '#9ca3af',
  },
  logOperation: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  logMessage: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 8,
    lineHeight: 20,
  },
  logStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  logStat: {
    fontSize: 12,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  logStatError: {
    color: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  subtitle: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 12,
  },
});
