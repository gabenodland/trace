/**
 * Sync Trigger - Decoupled sync trigger for API modules
 *
 * Breaks circular dependency: API modules need to trigger sync after writes,
 * but sync imports API modules for push/pull operations.
 *
 * Pattern: syncApi registers its functions at init time.
 * API modules call the registered functions without importing syncApi.
 */

type PushSyncFn = () => void;
type RefreshEntryFn = (entryId: string) => Promise<boolean>;

let _triggerPushSync: PushSyncFn | null = null;
let _refreshEntryFromServer: RefreshEntryFn | null = null;

/**
 * Register sync functions. Called by syncApi on module load.
 */
export function registerSyncTriggers(fns: {
  triggerPushSync: PushSyncFn;
  refreshEntryFromServer: RefreshEntryFn;
}): void {
  _triggerPushSync = fns.triggerPushSync;
  _refreshEntryFromServer = fns.refreshEntryFromServer;
}

/**
 * Trigger a push sync after a local write operation.
 * Non-blocking — returns immediately, sync happens in background.
 */
export function triggerPushSync(): void {
  if (_triggerPushSync) {
    _triggerPushSync();
  }
}

/**
 * Pull a single entry from server (for edit screen).
 * Blocking — waits for pull to complete. Returns true if entry was updated.
 */
export async function refreshEntryFromServer(entryId: string): Promise<boolean> {
  if (_refreshEntryFromServer) {
    return _refreshEntryFromServer(entryId);
  }
  return false;
}
