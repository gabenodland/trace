/**
 * Sync API - Public API layer for sync operations
 *
 * This is the PUBLIC interface for sync operations.
 * Components should use syncHooks.ts, other API modules use this file.
 *
 * Architecture:
 * Components → Hooks → API (this file) → syncService (internal)
 */

import { syncService, SyncResult, SyncStatus } from './syncService';
import { createScopedLogger } from '../utils/logger';

const log = createScopedLogger('SyncApi');

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize sync service with query client for cache invalidation
 * Should be called once during app startup
 */
export async function initializeSync(queryClient?: any): Promise<void> {
  await syncService.initialize(queryClient);
}

/**
 * Clean up sync service
 * Should be called during app shutdown or logout
 */
export function destroySync(): void {
  syncService.destroy();
}

// ============================================================================
// SYNC OPERATIONS (for use by other API modules)
// ============================================================================

/**
 * Trigger a push sync after a local write operation
 * Non-blocking - returns immediately, sync happens in background
 *
 * Use this in API modules after saving to localDB:
 * @example
 * export async function createEntry(data) {
 *   const entry = await localDB.saveEntry(data);
 *   triggerPushSync(); // Non-blocking
 *   return entry;
 * }
 */
export function triggerPushSync(): void {
  log.debug('Push sync triggered');
  syncService.pushChanges('post-save').catch(error => {
    log.warn('Push sync failed', { error });
  });
}

/**
 * Trigger a pull sync before a read operation (optional)
 * Blocking - waits for sync to complete
 *
 * Use this for critical reads that need latest data:
 * @example
 * export async function getEntry(id, { refreshFirst }) {
 *   if (refreshFirst) {
 *     await triggerPullSync();
 *   }
 *   return await localDB.getEntry(id);
 * }
 */
export async function triggerPullSync(): Promise<SyncResult> {
  log.debug('Pull sync triggered');
  return await syncService.pullChanges('app-foreground');
}

/**
 * Pull a single entry from server (for edit screen)
 * Blocking - waits for pull to complete
 * Returns true if entry was updated
 */
export async function refreshEntryFromServer(entryId: string): Promise<boolean> {
  log.debug('Refreshing entry from server', { entryId });
  return await syncService.pullEntry(entryId);
}

// ============================================================================
// SYNC OPERATIONS (for use by hooks/components via useSync hook)
// ============================================================================

/**
 * Full bidirectional sync
 * Push local changes, then pull remote changes
 */
export async function fullSync(): Promise<SyncResult> {
  log.info('Full sync requested');
  return await syncService.fullSync('manual');
}

/**
 * Force full pull from server (ignores incremental timestamps)
 * Useful for debugging or recovering from sync issues
 */
export async function forcePull(): Promise<SyncResult> {
  log.info('Force pull requested');
  return await syncService.forcePull();
}

/**
 * Get current sync status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  return await syncService.getStatus();
}

// ============================================================================
// RE-EXPORTS for convenience
// ============================================================================

export type { SyncResult, SyncStatus } from './syncService';
