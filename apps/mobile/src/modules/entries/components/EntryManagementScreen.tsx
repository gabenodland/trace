/**
 * EntryManagementScreen - Refactored entry editor
 *
 * Phase 1: Load entry + display as JSON
 * Single source of truth: EntryWithRelations
 */

import { useRef, useImperativeHandle, forwardRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SecondaryHeader } from '../../../components/layout/SecondaryHeader';
import { getEntryWithRelations } from '../mobileEntryApi';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { createScopedLogger } from '../../../shared/utils/logger';
import type { EntryWithRelations } from '../EntryWithRelationsTypes';

const log = createScopedLogger('EntryManagement', '📝');

/**
 * Options for creating a new entry
 */
export interface NewEntryOptions {
  streamId?: string | null;
  streamName?: string;
  content?: string;
  date?: string;
}

/**
 * Ref interface for EntryManagementScreen singleton pattern
 * Navigation calls methods to control the screen
 */
export interface EntryManagementScreenRef {
  /** Load and display an existing entry by ID */
  setEntry: (entryId: string) => void;

  /** Create and display a new entry with optional pre-fill values */
  createNewEntry: (options?: NewEntryOptions) => void;

  /** Clear and hide the screen, resetting all state */
  clearEntry: () => void;
}

interface EntryManagementScreenProps {
  isVisible?: boolean;
}

/**
 * Build a new entry object with defaults
 */
function buildNewEntry(options?: NewEntryOptions, userId?: string): EntryWithRelations {
  const now = new Date().toISOString();
  return {
    entry_id: `temp-${Math.random().toString(36).substring(7)}`,
    user_id: userId || '',
    title: null,
    content: options?.content || '',
    tags: [],
    mentions: [],
    stream_id: options?.streamId || null,
    stream: undefined,
    attachments: [],
    status: 'none',
    type: null,
    entry_date: options?.date || now.split('T')[0], // YYYY-MM-DD format
    created_at: now,
    updated_at: now,
    entry_latitude: null,
    entry_longitude: null,
    location_radius: null,
    location_id: null,
    place_name: null,
    address: null,
    neighborhood: null,
    postal_code: null,
    city: null,
    subdivision: null,
    region: null,
    country: null,
    geocode_status: null,
    due_date: null,
    completed_at: null,
    priority: 0,
    rating: 0,
    is_pinned: false,
    is_archived: false,
    local_only: 1,
    synced: 0,
    sync_action: 'create',
    version: 1,
    base_version: 1,
    conflict_status: null,
    conflict_backup: null,
    last_edited_by: null,
    last_edited_device: null,
  } as EntryWithRelations;
}

/**
 * EntryManagementScreen - Persistent entry editor
 *
 * PERSISTENT SCREEN PATTERN:
 * - Mounts once and stays mounted
 * - Navigation calls ref methods to control what's displayed:
 *   - setEntry(entryId) to edit existing entry
 *   - createNewEntry(options) to create new entry
 *   - clearEntry() to hide and reset
 * - Screen fetches entry data itself via getEntryWithRelations
 */
export const EntryManagementScreen = forwardRef<EntryManagementScreenRef, EntryManagementScreenProps>(
  ({ isVisible = true }, ref) => {
    const theme = useTheme();
    const [entryId, setEntryIdState] = useState<string | null>(null);
    const [isNewEntry, setIsNewEntry] = useState(false);
    const [entry, setEntry] = useState<EntryWithRelations | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load entry when entryId changes (existing entry)
    useEffect(() => {
      if (!entryId || isNewEntry) {
        return;
      }

      const loadEntry = async () => {
        setIsLoading(true);
        setError(null);

        try {
          log.debug('Loading entry', { entryId: entryId.substring(0, 8) });
          const data = await getEntryWithRelations(entryId);

          if (!data) {
            setError('Entry not found');
            setEntry(null);
            return;
          }

          setEntry(data);
          log.info('Entry loaded', {
            entryId: entryId.substring(0, 8),
            hasStream: !!data.stream,
            attachmentCount: data.attachments?.length || 0,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          setError(message);
          log.error('Failed to load entry', err);
        } finally {
          setIsLoading(false);
        }
      };

      loadEntry();
    }, [entryId, isNewEntry]);

    // Expose ref API for navigation
    useImperativeHandle(ref, () => ({
      setEntry: (id: string) => {
        log.info('setEntry: loading existing entry', { entryId: id.substring(0, 8) });
        setIsNewEntry(false);
        setEntryIdState(id);
        setError(null);
      },
      createNewEntry: (options?: NewEntryOptions) => {
        log.info('createNewEntry: creating new entry', { streamId: options?.streamId });
        setIsNewEntry(true);
        setEntryIdState(null);
        setError(null);
        setEntry(buildNewEntry(options));
        setIsLoading(false);
      },
      clearEntry: () => {
        log.info('clearEntry: hiding and resetting screen');
        setEntryIdState(null);
        setIsNewEntry(false);
        setEntry(null);
        setError(null);
      },
    }));

    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background.secondary }]}>
        <SecondaryHeader title="Entry Management" />

        {isLoading && (
          <View style={styles.centerContainer}>
            <Text style={[styles.text, { color: theme.colors.text.secondary }]}>Loading...</Text>
          </View>
        )}

        {error && (
          <View style={styles.centerContainer}>
            <Text style={[styles.errorText, { color: theme.colors.functional.error }]}>{error}</Text>
          </View>
        )}

        {!isLoading && !error && !entry && (
          <View style={styles.centerContainer}>
            <Text style={[styles.text, { color: theme.colors.text.tertiary }]}>No entry selected</Text>
          </View>
        )}

        {entry && (
          <ScrollView style={styles.content}>
            <View style={[styles.jsonContainer, { backgroundColor: theme.colors.background.primary }]}>
              <Text style={[styles.jsonText, { color: theme.colors.text.secondary }]}>
                {JSON.stringify(entry, null, 2)}
              </Text>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    );
  }
);

EntryManagementScreen.displayName = 'EntryManagementScreen';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  jsonContainer: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  jsonText: {
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
});
