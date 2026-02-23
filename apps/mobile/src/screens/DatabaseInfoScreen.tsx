/**
 * Database Info Screen - View SQLite database contents
 */

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, Clipboard, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@trace/core';
import * as locationCleanup from '../modules/locations/mobileLocationApi';
import { useNavigate } from '../shared/navigation';
import { SecondaryHeader } from '../components/layout/SecondaryHeader';
import { localDB } from '../shared/db/localDB';
import { useSync, getSyncStatus, triggerPushSync } from '../shared/sync';
import { deleteAttachmentFromLocalStorage } from '../modules/attachments/mobileAttachmentApi';
import { Icon } from '../shared/components';
import { createScopedLogger, LogScopes } from '../shared/utils/logger';

const log = createScopedLogger(LogScopes.Database);

type TabType = 'status' | 'entries' | 'streams' | 'locations' | 'attachments' | 'logs';
type SyncFilter = 'all' | 'synced' | 'unsynced' | 'errors';

interface CloudCounts {
  entries: number;
  streams: number;
  locations: number;
  attachments: number;
}

export function DatabaseInfoScreen() {
  const navigate = useNavigate();
  const { sync, forcePull } = useSync();
  const [activeTab, setActiveTab] = useState<TabType>('status');
  const [entries, setEntries] = useState<any[]>([]);
  const [streams, setStreams] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [cloudCounts, setCloudCounts] = useState<CloudCounts>({ entries: 0, streams: 0, locations: 0, attachments: 0 });
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [entrySyncFilter, setEntrySyncFilter] = useState<SyncFilter>('all');
  const [streamSyncFilter, setStreamSyncFilter] = useState<SyncFilter>('all');
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

      // Get all streams from SQLite
      const allStreams = await localDB.runCustomQuery('SELECT * FROM streams ORDER BY name');
      setStreams(allStreams);

      // Get all attachments from SQLite
      const allPhotos = await localDB.runCustomQuery('SELECT * FROM attachments ORDER BY created_at DESC');
      setPhotos(allPhotos);

      // Get all locations from SQLite
      const allLocations = await localDB.runCustomQuery('SELECT * FROM locations ORDER BY name');
      setLocations(allLocations);

      // Check which attachment files exist locally
      const fileExistenceMap: Record<string, boolean> = {};
      for (const photo of allPhotos) {
        if (photo.local_path) {
          try {
            const fileInfo = await FileSystem.getInfoAsync(photo.local_path);
            fileExistenceMap[photo.attachment_id] = fileInfo.exists;
          } catch (error) {
            fileExistenceMap[photo.attachment_id] = false;
          }
        } else {
          fileExistenceMap[photo.attachment_id] = false;
        }
      }
      setPhotoFilesExist(fileExistenceMap);

      // Get sync logs from SQLite
      const logs = await localDB.getSyncLogs(50); // Get last 50 logs
      setSyncLogs(logs);

      // Get sync status
      const status = await getSyncStatus();
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
        const [entriesCount, streamsCount, locationsCount, photosCount] = await Promise.all([
          supabase
            .from('entries')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('streams')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('locations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('attachments')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
        ]);

        setCloudCounts({
          entries: entriesCount.count || 0,
          streams: streamsCount.count || 0,
          locations: locationsCount.count || 0,
          attachments: photosCount.count || 0,
        });
      }
    } catch (error) {
      log.error('Failed to load debug info', error);
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

  // Filter streams based on sync filter
  const filteredStreams = streams.filter(stream => {
    switch (streamSyncFilter) {
      case 'synced':
        return stream.synced;
      case 'unsynced':
        return !stream.synced;
      case 'errors':
        return stream.sync_error;
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
              await sync();
              Alert.alert('Success', 'Sync completed successfully');
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
              await forcePull();
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

  const handleClearLocalStreams = () => {
    Alert.alert(
      'Clear Local Streams',
      'This will delete all streams from local SQLite. They will automatically re-sync on next sync.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Streams',
          style: 'destructive',
          onPress: async () => {
            try {
              await localDB.runCustomQuery('DELETE FROM streams');
              setRefreshKey(prev => prev + 1);
              Alert.alert('Success', 'All local streams cleared. Next sync will re-download from Cloud.');
            } catch (error) {
              Alert.alert('Error', `Failed to clear streams: ${error}`);
            }
          },
        },
      ]
    );
  };

  const handleClearLocalLocations = () => {
    Alert.alert(
      'Clear Local Places',
      'This will delete all places from local SQLite. They will automatically re-sync on next sync.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Places',
          style: 'destructive',
          onPress: async () => {
            try {
              await localDB.runCustomQuery('DELETE FROM locations');
              setRefreshKey(prev => prev + 1);
              Alert.alert('Success', 'All local places cleared. Next sync will re-download from Cloud.');
            } catch (error) {
              Alert.alert('Error', `Failed to clear places: ${error}`);
            }
          },
        },
      ]
    );
  };

  const handleDeleteUnusedLocations = async () => {
    Alert.alert('Delete Unused Places', 'Delete saved places with 0 entries?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await locationCleanup.deleteUnusedLocations();
            setRefreshKey(prev => prev + 1);
            Alert.alert('Success', `Deleted ${result.processed} unused place${result.processed === 1 ? '' : 's'}.`);
          } catch (error) {
            Alert.alert('Error', `Failed to delete unused places: ${error}`);
          }
        },
      },
    ]);
  };

  const handleMergeDuplicateLocations = async () => {
    Alert.alert('Merge Duplicate Places', 'Merge places with the same name and address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Merge',
        style: 'destructive',
        onPress: async () => {
          try {
            const result = await locationCleanup.mergeDuplicateLocations();
            setRefreshKey(prev => prev + 1);
            Alert.alert(
              result.errors > 0 ? 'Partial Success' : 'Success',
              `Merged ${result.processed} duplicate place${result.processed === 1 ? '' : 's'}.${result.errors > 0 ? ` ${result.errors} failed.` : ''}`
            );
          } catch (error) {
            Alert.alert('Error', `Failed to merge places: ${error}`);
          }
        },
      },
    ]);
  };

  const handleEnrichLocationHierarchy = async () => {
    Alert.alert('Fill Place Details', 'Use Mapbox to fill in missing city/region/country data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Enrich',
        onPress: async () => {
          try {
            const result = await locationCleanup.enrichLocationHierarchy();
            setRefreshKey(prev => prev + 1);
            Alert.alert(
              result.errors > 0 ? 'Partial Success' : 'Success',
              `Filled ${result.processed} place${result.processed === 1 ? '' : 's'}.${result.errors > 0 ? ` ${result.errors} failed.` : ''}`
            );
          } catch (error) {
            Alert.alert('Error', `Failed to fill place details: ${error}`);
          }
        },
      },
    ]);
  };

  const handleSnapAllEntries = async () => {
    Alert.alert('Snap All Entries', 'Snap unlinked entries to saved places or geocode via Mapbox?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Process All',
        onPress: async () => {
          try {
            const snapResult = await locationCleanup.snapEntriesToLocations();
            const geocodeResult = await locationCleanup.geocodeEntries();
            setRefreshKey(prev => prev + 1);
            const parts: string[] = [];
            if (snapResult.snapped > 0) parts.push(`${snapResult.snapped} snapped to saved places`);
            if (geocodeResult.geocoded > 0) parts.push(`${geocodeResult.geocoded} geocoded via API`);
            if (geocodeResult.noData > 0) parts.push(`${geocodeResult.noData} with no address data`);
            const totalErrors = snapResult.errors + geocodeResult.errors;
            if (totalErrors > 0) parts.push(`${totalErrors} failed`);
            Alert.alert(
              totalErrors > 0 ? 'Partial Success' : 'Success',
              parts.join('\n') || 'No entries to process.'
            );
          } catch (error) {
            Alert.alert('Error', `Failed to process entries: ${error}`);
          }
        },
      },
    ]);
  };

  const handleClearLocalPhotos = () => {
    Alert.alert(
      'Clear Local Attachments',
      'This will delete all attachment files and database records. Attachments will re-download from Cloud on next sync if they were uploaded.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Attachments',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get all attachments
              const allAttachments = await localDB.runCustomQuery('SELECT * FROM attachments');

              // Delete all local attachment files
              let deletedCount = 0;
              for (const attachment of allAttachments) {
                if (attachment.local_path) {
                  try {
                    await deleteAttachmentFromLocalStorage(attachment.local_path);
                    deletedCount++;
                  } catch (err) {
                    log.warn('Failed to delete attachment file', { path: attachment.local_path, error: err });
                  }
                }
              }

              // Delete all attachment records from database
              await localDB.runCustomQuery('DELETE FROM attachments');

              setRefreshKey(prev => prev + 1);
              Alert.alert('Success', `Cleared ${allAttachments.length} attachment records and deleted ${deletedCount} local files. Uploaded attachments will re-download from Cloud on next sync.`);
            } catch (error) {
              Alert.alert('Error', `Failed to clear attachments: ${error}`);
            }
          },
        },
      ]
    );
  };

  const handleCleanupOrphanedPhotos = async () => {
    try {
      const orphanCount = await localDB.cleanupOrphanedAttachments();
      setRefreshKey(prev => prev + 1);

      if (orphanCount > 0) {
        Alert.alert('Success', `Found and marked ${orphanCount} orphaned attachment${orphanCount === 1 ? '' : 's'} for deletion. They will be removed on next sync.`);
      } else {
        Alert.alert('All Good', 'No orphaned attachments found.');
      }
    } catch (error) {
      Alert.alert('Error', `Failed to cleanup orphaned attachments: ${error}`);
    }
  };

  const handleCompareCloudStorage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      // Get all attachment records from cloud database
      const { data: dbRecords, error: dbError } = await supabase
        .from('attachments')
        .select('attachment_id, file_path, entry_id')
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      // Get all files from attachments storage bucket
      const { data: storageFiles, error: storageError } = await supabase.storage
        .from('attachments')
        .list(user.id, { limit: 1000 });

      if (storageError) throw storageError;

      // Build set of file paths from DB records
      const dbFilePaths = new Set(dbRecords?.map(r => r.file_path) || []);

      // Build set of file paths from storage (format: user_id/entry_id/filename)
      // Storage list returns files in user_id folder, need to recursively get subfolders
      const storageFilePaths = new Set<string>();

      // List all entry folders under user
      for (const item of storageFiles || []) {
        if (item.id === null) {
          // It's a folder (entry_id folder)
          const { data: entryFiles } = await supabase.storage
            .from('attachments')
            .list(`${user.id}/${item.name}`, { limit: 1000 });

          for (const file of entryFiles || []) {
            if (file.id !== null) {
              storageFilePaths.add(`${user.id}/${item.name}/${file.name}`);
            }
          }
        } else {
          // It's a file directly in user folder
          storageFilePaths.add(`${user.id}/${item.name}`);
        }
      }

      // Find orphaned files (in storage but not in DB)
      const orphanedFiles: string[] = [];
      for (const path of storageFilePaths) {
        if (!dbFilePaths.has(path)) {
          orphanedFiles.push(path);
        }
      }

      // Find missing files (in DB but not in storage)
      const missingFiles: string[] = [];
      for (const path of dbFilePaths) {
        if (!storageFilePaths.has(path)) {
          missingFiles.push(path);
        }
      }

      // Show results
      const results = {
        dbRecords: dbRecords?.length || 0,
        storageFiles: storageFilePaths.size,
        orphanedFiles: orphanedFiles.length,
        missingFiles: missingFiles.length,
        orphanedList: orphanedFiles.slice(0, 10),
        missingList: missingFiles.slice(0, 10),
      };

      showJsonModal(results, 'Cloud Storage Comparison');

    } catch (error) {
      Alert.alert('Error', `Failed to compare: ${error}`);
    }
  };

  const handleCleanupCloudOrphans = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Not authenticated');
        return;
      }

      // Get all attachment records from cloud database
      const { data: dbRecords, error: dbError } = await supabase
        .from('attachments')
        .select('attachment_id, file_path')
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      // Build set of file paths from DB records
      const dbFilePaths = new Set(dbRecords?.map(r => r.file_path) || []);

      // Get all files from attachments storage bucket
      const { data: storageFiles, error: storageError } = await supabase.storage
        .from('attachments')
        .list(user.id, { limit: 1000 });

      if (storageError) throw storageError;

      // Find orphaned files (in storage but not in DB)
      const orphanedFiles: string[] = [];

      for (const item of storageFiles || []) {
        if (item.id === null) {
          // It's a folder (entry_id folder)
          const { data: entryFiles } = await supabase.storage
            .from('attachments')
            .list(`${user.id}/${item.name}`, { limit: 1000 });

          for (const file of entryFiles || []) {
            if (file.id !== null) {
              const fullPath = `${user.id}/${item.name}/${file.name}`;
              if (!dbFilePaths.has(fullPath)) {
                orphanedFiles.push(fullPath);
              }
            }
          }
        } else {
          const fullPath = `${user.id}/${item.name}`;
          if (!dbFilePaths.has(fullPath)) {
            orphanedFiles.push(fullPath);
          }
        }
      }

      if (orphanedFiles.length === 0) {
        Alert.alert('All Good', 'No orphaned files found in cloud storage.');
        return;
      }

      Alert.alert(
        'Delete Orphaned Files',
        `Found ${orphanedFiles.length} file${orphanedFiles.length === 1 ? '' : 's'} in storage without database records. Delete them?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                const { error: deleteError } = await supabase.storage
                  .from('attachments')
                  .remove(orphanedFiles);

                if (deleteError) throw deleteError;

                Alert.alert('Success', `Deleted ${orphanedFiles.length} orphaned file${orphanedFiles.length === 1 ? '' : 's'} from cloud storage.`);
                setRefreshKey(prev => prev + 1);
              } catch (err) {
                Alert.alert('Error', `Failed to delete files: ${err}`);
              }
            },
          },
        ]
      );

    } catch (error) {
      Alert.alert('Error', `Failed to find orphans: ${error}`);
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
      'Are you sure? This will delete ALL local data (entries, streams, metadata)!',
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

  const handleResetSchema = () => {
    Alert.alert(
      'Reset Database Schema',
      'This will DROP and RECREATE all database tables. Use this if you have schema errors like "no such column". ALL local data will be lost!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Schema',
          style: 'destructive',
          onPress: async () => {
            try {
              await localDB.resetSchema();
              setRefreshKey(prev => prev + 1);
              Alert.alert('Success', 'Database schema reset. You can now sync to pull data from the cloud.');
            } catch (error) {
              Alert.alert('Error', `Failed to reset schema: ${error instanceof Error ? error.message : String(error)}`);
            }
          },
        },
      ]
    );
  };

  const handleClearStaleSyncErrors = async () => {
    try {
      // Find all records that have sync_error but are marked as synced
      // This shouldn't happen in normal operation, but can occur after bug fixes
      const [entries, streams, locations, attachments] = await Promise.all([
        localDB.runCustomQuery('SELECT entry_id FROM entries WHERE synced = 1 AND sync_error IS NOT NULL'),
        localDB.runCustomQuery('SELECT stream_id FROM streams WHERE synced = 1 AND sync_error IS NOT NULL'),
        localDB.runCustomQuery('SELECT location_id FROM locations WHERE synced = 1 AND sync_error IS NOT NULL'),
        localDB.runCustomQuery('SELECT attachment_id FROM attachments WHERE synced = 1 AND sync_error IS NOT NULL'),
      ]);

      const totalStale = entries.length + streams.length + locations.length + attachments.length;

      if (totalStale === 0) {
        Alert.alert('All Good', 'No stale sync errors found.');
        return;
      }

      Alert.alert(
        'Clear Stale Sync Errors',
        `Found ${totalStale} stale sync error(s):\n\n` +
        `Entries: ${entries.length}\n` +
        `Streams: ${streams.length}\n` +
        `Locations: ${locations.length}\n` +
        `Attachments: ${attachments.length}\n\n` +
        `These records are marked as synced but have error messages from old failed syncs. Clear them?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Clear Errors',
            onPress: async () => {
              try {
                // Clear stale errors from all tables
                await Promise.all([
                  localDB.runCustomQuery('UPDATE entries SET sync_error = NULL WHERE synced = 1 AND sync_error IS NOT NULL'),
                  localDB.runCustomQuery('UPDATE streams SET sync_error = NULL WHERE synced = 1 AND sync_error IS NOT NULL'),
                  localDB.runCustomQuery('UPDATE locations SET sync_error = NULL WHERE synced = 1 AND sync_error IS NOT NULL'),
                  localDB.runCustomQuery('UPDATE attachments SET sync_error = NULL WHERE synced = 1 AND sync_error IS NOT NULL'),
                ]);

                setRefreshKey(prev => prev + 1);
                Alert.alert('Success', `Cleared ${totalStale} stale sync error(s).`);
              } catch (error) {
                Alert.alert('Error', `Failed to clear errors: ${error}`);
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', `Failed to check for stale errors: ${error}`);
    }
  };

  const refreshButton = (
    <TouchableOpacity onPress={() => setRefreshKey(prev => prev + 1)} style={styles.refreshButton}>
      <Icon name="RefreshCw" size={20} color="#3b82f6" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SecondaryHeader title="Database Info" rightAction={refreshButton} />

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
          style={[styles.tab, activeTab === 'streams' && styles.tabActive]}
          onPress={() => setActiveTab('streams')}
        >
          <Text style={[styles.tabText, activeTab === 'streams' && styles.tabTextActive]}>
            Streams
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
          style={[styles.tab, activeTab === 'attachments' && styles.tabActive]}
          onPress={() => setActiveTab('attachments')}
        >
          <Text style={[styles.tabText, activeTab === 'attachments' && styles.tabTextActive]}>
            Attachments
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
                  {schemaVersion === 7 ? '✅ Latest version (includes attachments table)' :
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
                <Icon name="RefreshCw" size={20} color="#ffffff" style={styles.buttonIcon} />
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
              <Text style={styles.sectionTitle}>Streams</Text>
              <View style={styles.statsRow}>
                <View style={[styles.infoBox, styles.statsBox]}>
                  <Text style={styles.statsLabel}>Local</Text>
                  <Text style={styles.statsCount}>{streams.length}</Text>
                  <Text style={styles.infoText}>
                    Synced: {streams.filter(s => s.synced).length}
                  </Text>
                  <Text style={styles.infoText}>
                    Unsynced: {streams.filter(s => !s.synced).length}
                  </Text>
                  <Text style={styles.infoText}>
                    Errors: {streams.filter(s => s.sync_error).length}
                  </Text>
                  <TouchableOpacity onPress={handleClearLocalStreams} style={styles.smallClearButton}>
                    <Text style={styles.smallClearButtonText}>Clear Local</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.infoBox, styles.statsBox]}>
                  <Text style={styles.statsLabel}>Cloud</Text>
                  <Text style={styles.statsCount}>{cloudCounts.streams}</Text>
                  <Text style={styles.infoText}>
                    Diff: {cloudCounts.streams - streams.length}
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
              <Text style={styles.sectionTitle}>Attachments</Text>
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
                    <Text style={styles.smallClearButtonText}>Clear Local Attachments</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCleanupOrphanedPhotos} style={styles.cleanupButton}>
                    <Text style={styles.cleanupButtonText}>🧹 Cleanup Orphans</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.infoBox, styles.statsBox]}>
                  <Text style={styles.statsLabel}>Cloud</Text>
                  <Text style={styles.statsCount}>{cloudCounts.attachments}</Text>
                  <Text style={styles.infoText}>
                    Diff: {cloudCounts.attachments - photos.length}
                  </Text>
                  <TouchableOpacity onPress={handleCompareCloudStorage} style={styles.cleanupButton}>
                    <Text style={styles.cleanupButtonText}>🔍 Compare DB vs Storage</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCleanupCloudOrphans} style={[styles.dangerButton, { marginTop: 8 }]}>
                    <Text style={styles.dangerButtonText}>🗑️ Delete Cloud Orphans</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Danger Zone */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Danger Zone</Text>
              <TouchableOpacity onPress={handleClearDatabase} style={styles.dangerButton}>
                <Text style={styles.dangerButtonText}>💀 Delete All Local Data</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleResetSchema} style={[styles.dangerButton, { marginTop: 8 }]}>
                <Text style={styles.dangerButtonText}>🔧 Reset Database Schema</Text>
              </TouchableOpacity>
              <Text style={styles.helperText}>
                Use "Reset Schema" if you see errors like "no such column"
              </Text>
            </View>

            {/* Cleanup Tools */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cleanup Tools</Text>
              <TouchableOpacity onPress={handleClearStaleSyncErrors} style={styles.cleanupButton}>
                <Text style={styles.cleanupButtonText}>🧹 Clear Stale Sync Errors</Text>
              </TouchableOpacity>
              <Text style={styles.helperText}>
                Remove error messages from successfully synced records. These can occur after bug fixes when old failed syncs left error flags behind.
              </Text>
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

        {/* STREAMS TAB */}
        {activeTab === 'streams' && (
          <>
            {/* Filter Tabs */}
            <View style={styles.filterContainer}>
              <TouchableOpacity
                style={[styles.filterTab, streamSyncFilter === 'all' && styles.filterTabActive]}
                onPress={() => setStreamSyncFilter('all')}
              >
                <Text style={[styles.filterTabText, streamSyncFilter === 'all' && styles.filterTabTextActive]}>
                  All ({streams.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, streamSyncFilter === 'synced' && styles.filterTabActive]}
                onPress={() => setStreamSyncFilter('synced')}
              >
                <Text style={[styles.filterTabText, streamSyncFilter === 'synced' && styles.filterTabTextActive]}>
                  Synced ({streams.filter(s => s.synced).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, streamSyncFilter === 'unsynced' && styles.filterTabActive]}
                onPress={() => setStreamSyncFilter('unsynced')}
              >
                <Text style={[styles.filterTabText, streamSyncFilter === 'unsynced' && styles.filterTabTextActive]}>
                  Unsynced ({streams.filter(s => !s.synced).length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterTab, streamSyncFilter === 'errors' && styles.filterTabActive]}
                onPress={() => setStreamSyncFilter('errors')}
              >
                <Text style={[styles.filterTabText, streamSyncFilter === 'errors' && styles.filterTabTextActive]}>
                  Errors ({streams.filter(s => s.sync_error).length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Streams List */}
            <View style={styles.section}>
              {filteredStreams.map((stream, index) => (
                <TouchableOpacity
                  key={stream.stream_id}
                  style={styles.streamCard}
                  onLongPress={() => showJsonModal(stream, `Stream: ${stream.name}`)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.streamName}>
                    {index + 1}. {stream.name}
                  </Text>
                  <View style={styles.entryMeta}>
                    <Text style={[styles.badge, stream.synced ? styles.syncedBadge : styles.unsyncedBadge]}>
                      {stream.synced ? '✅ Synced' : '⏳ Unsynced'}
                    </Text>
                    {stream.local_only ? (
                      <Text style={[styles.badge, styles.localBadge]}>🔒 Local</Text>
                    ) : null}
                    {stream.sync_action && (
                      <Text style={styles.badge}>📝 {stream.sync_action}</Text>
                    )}
                    {stream.sync_error && (
                      <Text style={[styles.badge, styles.errorBadge]}>❌ Error</Text>
                    )}
                  </View>
                  {stream.sync_error && (
                    <Text style={styles.errorMessage}>{stream.sync_error}</Text>
                  )}
                  <Text style={styles.streamId}>ID: {stream.stream_id.slice(0, 8)}...</Text>
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
              <TouchableOpacity style={styles.button} onPress={handleSnapAllEntries}>
                <Text style={styles.buttonText}>📍 Snap All Entries</Text>
              </TouchableOpacity>
              <Text style={styles.helperText}>
                Process old entries: snap to saved places or geocode via API
              </Text>
              <TouchableOpacity style={[styles.cleanupButton, { marginTop: 12 }]} onPress={handleEnrichLocationHierarchy}>
                <Text style={styles.cleanupButtonText}>🌍 Fill Place Details</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dangerButton, { marginTop: 8 }]} onPress={handleMergeDuplicateLocations}>
                <Text style={styles.dangerButtonText}>🔀 Merge Duplicate Places</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dangerButton, { marginTop: 8 }]} onPress={handleDeleteUnusedLocations}>
                <Text style={styles.dangerButtonText}>🗑️ Delete Unused Places</Text>
              </TouchableOpacity>
            </View>

            {/* Locations List */}
            <View style={styles.section}>
              {filteredLocations.length === 0 ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>No places found</Text>
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

        {/* ATTACHMENTS TAB */}
        {activeTab === 'attachments' && (
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

            {/* Attachments List */}
            <View style={styles.section}>
              {filteredPhotos.length === 0 ? (
                <View style={styles.infoBox}>
                  <Text style={styles.infoText}>No attachments found</Text>
                </View>
              ) : (
                filteredPhotos.map((photo, index) => (
                  <TouchableOpacity
                    key={photo.attachment_id}
                    style={styles.photoCard}
                    onLongPress={() => showJsonModal(photo, `Attachment: ${photo.attachment_id.slice(0, 8)}`)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.photoTitle}>
                      {index + 1}. Attachment {photo.attachment_id.slice(0, 8)}...
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
                        <Text style={[styles.photoMeta, !photoFilesExist[photo.attachment_id] && styles.errorText]}>
                          Local: {photoFilesExist[photo.attachment_id] ? '✓ File exists' : '⚠️ File missing'}
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
                    <Text style={styles.photoId}>ID: {photo.attachment_id}</Text>
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

                      {(log.entries_pushed > 0 || log.entries_errors > 0 || log.streams_pushed > 0 || log.streams_errors > 0) && (
                        <View style={styles.logStats}>
                          {log.entries_pushed > 0 && (
                            <Text style={styles.logStat}>📤 Entries: {log.entries_pushed}</Text>
                          )}
                          {log.entries_errors > 0 && (
                            <Text style={[styles.logStat, styles.logStatError]}>❌ Entry Errors: {log.entries_errors}</Text>
                          )}
                          {log.streams_pushed > 0 && (
                            <Text style={styles.logStat}>📁 Streams: {log.streams_pushed}</Text>
                          )}
                          {log.streams_errors > 0 && (
                            <Text style={[styles.logStat, styles.logStatError]}>❌ Stream Errors: {log.streams_errors}</Text>
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
                  <Icon name="Copy" size={20} color="#3b82f6" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setJsonModalVisible(false)} style={styles.modalCloseButton}>
                  <Icon name="X" size={24} color="#6b7280" />
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
  streamCard: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  streamName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  streamId: {
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
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    fontStyle: 'italic',
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
