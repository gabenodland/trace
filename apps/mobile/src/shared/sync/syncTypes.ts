/**
 * Sync Types - Type definitions for sync operations
 */

export interface SyncResult {
  success: boolean;
  pushed: {
    entries: number;
    streams: number;
    locations: number;
    attachments: number;
  };
  pulled: {
    entries: number;
    streams: number;
    locations: number;
    attachments: number;
  };
  errors: {
    entries: number;
    streams: number;
    locations: number;
    attachments: number;
  };
  duration: number;
}

export interface SyncStatus {
  unsyncedCount: number;
  isSyncing: boolean;
  lastSyncTime: number | null;
}

export type SyncTrigger = 'manual' | 'post-save' | 'realtime' | 'app-foreground' | 'initialization';

export interface PushResult {
  success: number;
  errors: number;
}

export interface PullResult {
  new: number;
  updated: number;
  deleted?: number;
}

/**
 * Context passed to sync operations that need access to shared state
 */
export interface SyncContext {
  currentlyPushingEntryIds: Set<string>;
  setEntryQueryData: (entryId: string, entry: any) => void;
  invalidateQueryCache: (entryIds?: string[]) => void;
}

/**
 * Default empty sync result
 */
export function createEmptySyncResult(): SyncResult {
  return {
    success: false,
    pushed: { entries: 0, streams: 0, locations: 0, attachments: 0 },
    pulled: { entries: 0, streams: 0, locations: 0, attachments: 0 },
    errors: { entries: 0, streams: 0, locations: 0, attachments: 0 },
    duration: 0,
  };
}
