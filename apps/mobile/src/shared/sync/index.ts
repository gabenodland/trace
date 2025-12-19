/**
 * Sync Module - Public exports
 *
 * Import pattern:
 * - Components: import { useSync } from '../../shared/sync';
 * - API modules: import { triggerPushSync } from '../../shared/sync';
 * - App setup: import { initializeSync } from '../../shared/sync';
 * - Entry editor: import { useEntryRealtime } from '../../shared/sync';
 */

// Hooks (for components)
export { useSync, useSyncStatus } from './syncHooks';
export { useEntryRealtime } from './useEntryRealtime';

// Realtime service (for direct access if needed)
export { realtimeService } from './realtimeService';

// API functions (for other API modules and app setup)
export {
  initializeSync,
  destroySync,
  triggerPushSync,
  triggerPullSync,
  refreshEntryFromServer,
  fullSync,
  forcePull,
  getSyncStatus,
} from './syncApi';

// Types
export type { SyncResult, SyncStatus } from './syncApi';
export type { UseEntryRealtimeResult } from './useEntryRealtime';
export type { RealtimeSubscription, OnExternalChangeCallback } from './realtimeService';
