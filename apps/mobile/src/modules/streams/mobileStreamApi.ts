/**
 * Mobile Stream API - Offline-first stream operations
 *
 * All reads come from local SQLite.
 * Writes go to SQLite first, then sync in background.
 *
 * Architecture:
 * Components → Hooks → API (this file) → LocalDB
 *                                      ↓
 *                                  SyncService (background)
 */

import * as Crypto from 'expo-crypto';
import { localDB } from '../../shared/db/localDB';
import type { Stream, UpdateStreamInput } from '@trace/core';
import { triggerPushSync } from '../../shared/sync';
import { createScopedLogger } from '../../shared/utils/logger';

const log = createScopedLogger('StreamApi');

// ============================================================================
// READ OPERATIONS (always from local SQLite)
// ============================================================================

/**
 * Get all streams from local SQLite
 */
export async function getStreams(): Promise<Stream[]> {
  await localDB.init();
  log.debug('Getting streams');
  return await localDB.getAllStreams();
}

/**
 * Get a single stream by ID
 */
export async function getStream(streamId: string): Promise<Stream | null> {
  await localDB.init();
  log.debug('Getting stream', { streamId });
  return await localDB.getStream(streamId);
}

// ============================================================================
// WRITE OPERATIONS (local first, then sync)
// ============================================================================

/**
 * Create a stream (offline-first)
 */
export async function createStream(data: {
  name: string;
  color?: string | null;
  icon?: string | null;
}): Promise<Stream> {
  // Get user ID from LocalDB (cached from login)
  const userId = localDB.getCurrentUserId();
  if (!userId) throw new Error('Not authenticated');

  // Generate ID
  const stream_id = Crypto.randomUUID();

  const now = new Date().toISOString();

  const stream: Stream = {
    stream_id,
    user_id: userId,
    name: data.name,
    entry_count: 0,
    color: data.color || null,
    icon: data.icon || null,
    created_at: now,
    updated_at: now,
    // Default feature toggles
    entry_use_rating: false,
    entry_use_priority: false,
    entry_use_status: false,
    entry_use_duedates: false,
    entry_use_location: true,
    entry_use_photos: true,
    entry_content_type: 'text',
    is_private: false,
    is_localonly: false,
  };

  log.info('Creating stream', { streamId: stream_id, name: data.name });

  // Save to local SQLite
  await localDB.saveStream(stream);

  // Trigger sync in background (non-blocking)
  triggerPushSync();

  return stream;
}

/**
 * Update a stream (offline-first)
 */
export async function updateStream(
  streamId: string,
  data: UpdateStreamInput
): Promise<Stream> {
  const existing = await localDB.getStream(streamId);
  if (!existing) throw new Error('Stream not found');

  const updated = {
    ...existing,
    ...data,
    updated_at: new Date().toISOString(),
    // Mark as needing sync
    synced: 0,
    sync_action: (existing as any).sync_action === 'create' ? 'create' : 'update',
  };

  log.info('Updating stream', { streamId, name: updated.name });

  await localDB.updateStream(streamId, updated);

  // Trigger sync in background (non-blocking)
  triggerPushSync();

  return updated as Stream;
}

/**
 * Delete a stream (offline-first)
 */
export async function deleteStream(streamId: string): Promise<void> {
  log.info('Deleting stream', { streamId });

  await localDB.deleteStream(streamId);

  // Trigger sync in background (non-blocking)
  triggerPushSync();
}
