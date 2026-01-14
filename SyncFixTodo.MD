# Sync Fix Todo

## Problem Summary

Sync works for **editing existing entries** but fails for:
1. **New entries** don't appear on other devices automatically
2. **Deleted entries** don't disappear from other devices
3. **Initial sync** doesn't happen when app opens (if already online)

## Current Sync Trigger Points

Understanding when sync ACTUALLY happens vs when you'd EXPECT it to happen:

| Event | Sync Triggered? | Why |
|-------|-----------------|-----|
| App cold start | **NO** | `initialize()` only sets up listeners, doesn't sync |
| App reload (hot reload) | **NO** | Same as above |
| App foreground (from background) | **NO** | No AppState listener exists |
| Network reconnect (offline → online) | **YES** | `handleReconnect()` calls `fullSync()` |
| Manual sync button | **YES** | User-triggered |
| Realtime event received | **YES** | `pullChanges()` after 2s debounce |

**This is the core problem:** The ONLY automatic sync triggers are:
1. Coming back online after being offline
2. Receiving a realtime event from another device

If you open the app while already online and no realtime events arrive, you see **stale local SQLite data forever**.

### Evidence from Logs

```
Network state changed {wasOffline: false}  ← Not a reconnect, no sync
Realtime subscription ACTIVE               ← Just listening, not syncing
[AttachmentApi] Getting attachments...     ← UI reading LOCAL data, not sync
```

Missing logs that WOULD indicate sync:
- `SYNC STARTED (app-foreground)`
- `PULLED X entries`
- `SYNC COMPLETE`

## Root Causes

### 1. Realtime INSERT Events Ignored for Lists

**File:** `apps/mobile/src/shared/sync/syncService.ts` lines 1749-1753

```typescript
const index = oldData.findIndex(e => e.entry_id === entryId);
if (index === -1) {
  // Entry not in this list - might be a new entry or filtered out
  // Don't add it here; let the next query fetch handle it
  return oldData;  // ← BUG: New entries are never added
}
```

**What happens:**
- Device B creates entry → pushed to Supabase
- Device A receives realtime INSERT event
- Entry saved to LocalDB ✓
- `setEntryQueryData()` tries to patch React Query cache
- Entry not found in cache → **silently ignored**
- UI never updates

**Fix:** Add new entries to the cache instead of ignoring them.

---

### 2. No App Start or Foreground Sync Trigger

**File:** `apps/mobile/src/shared/sync/syncService.ts` lines 64-87

```typescript
async initialize(queryClient?: QueryClient): Promise<void> {
  // Sets up realtime subscription ✓
  // Sets up network listener ✓
  // Does NOT call fullSync() ✗
  // Does NOT set up AppState listener ✗
}
```

**What happens on app start:**
1. User opens app (already online)
2. `initialize()` called
3. Realtime subscription connected (just listening)
4. Network listener set up (only triggers on offline→online transition)
5. **No sync triggered** → UI shows whatever was in local SQLite
6. User sees stale data until:
   - They manually sync, OR
   - Another device makes a change (realtime event), OR
   - They go offline then online again

**What happens on app foreground (from background):**
- Nothing. No AppState listener exists.
- Same stale data shown.

**Even app reload doesn't sync** - the logs show:
```
Network state changed {wasOffline: false}  ← false means no reconnect sync
```

**Fix:**
1. Call `fullSync()` at end of `initialize()`
2. Add AppState listener to sync when app returns to foreground

---

### 3. DELETE Events Don't Remove from Cache

**File:** `apps/mobile/src/shared/sync/syncService.ts` lines 1593-1597

```typescript
if (eventType === 'DELETE') {
  log.info('Entry DELETE event received', { entryId });
  this.handleRealtimeChange('entries', entryId);  // Just triggers a pull
  return;
}
```

The delete handler triggers a pull, but doesn't directly remove the entry from React Query cache. The pull will eventually update, but there's a delay.

**Fix:** Directly remove deleted entries from cache on DELETE event.

---

## Proposed Fixes

### Fix 1: Handle New Entries in Realtime Cache Updates

**Location:** `setEntryQueryData()` method

**Before:**
```typescript
if (index === -1) {
  return oldData;  // Ignore new entries
}
```

**After:**
```typescript
if (index === -1) {
  // New entry - add to list if it belongs in this query's filter
  // For now, add to all entry lists and let React Query refetch filter correctly
  return [entry, ...oldData];
}
```

**Consideration:** Need to handle filtered lists properly. A new entry might not belong in the current filter (e.g., different stream). Options:
- A) Always add, let next refetch correct it (simple, might cause flash)
- B) Check if entry matches filter before adding (complex, need filter context)
- C) Invalidate instead of patch for new entries (causes refetch)

**Recommended:** Option C - invalidate queries for INSERTs, patch for UPDATEs.

---

### Fix 2: Add Initial Sync + App-Foreground Sync Trigger

This fix has two parts:
1. **Initial sync** - Call `fullSync()` when app starts
2. **Foreground sync** - Call `fullSync()` when app returns from background

**Location:** `apps/mobile/src/shared/sync/syncService.ts`

**Part A: Add new properties and AppState listener method:**
```typescript
import { AppState, AppStateStatus } from 'react-native';

// Add to class properties (around line 45):
private appStateSubscription: any = null;
private lastForegroundTime: number = 0;
private readonly MIN_FOREGROUND_SYNC_INTERVAL_MS = 30000; // 30 seconds

// Add new method:
private setupAppStateListener(): void {
  this.appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (nextState === 'active') {
      const now = Date.now();
      // Only sync if it's been more than 30 seconds since last foreground
      if (now - this.lastForegroundTime > this.MIN_FOREGROUND_SYNC_INTERVAL_MS) {
        this.lastForegroundTime = now;
        log.info('App came to foreground, triggering sync');
        this.fullSync('app-foreground').catch(err => {
          log.error('Foreground sync failed', err);
        });
      }
    }
  });
  log.debug('AppState listener set up');
}
```

**Part B: Update initialize() to trigger initial sync:**
```typescript
async initialize(queryClient?: QueryClient): Promise<void> {
  if (this.isInitialized) {
    log.debug('Already initialized, skipping');
    return;
  }

  this.isInitialized = true;
  if (queryClient) {
    this.queryClient = queryClient;
  }

  log.debug('Initializing sync service');

  // Clean up data from previous users
  await this.cleanupWrongUserData();

  // Set up realtime subscription for server changes
  await this.setupRealtimeSubscription();

  // Set up network reconnect listener
  this.setupNetworkListener();

  // NEW: Set up app state listener for foreground sync
  this.setupAppStateListener();

  log.debug('Sync service initialized');

  // NEW: Trigger initial sync on app start (non-blocking)
  // This ensures we pull any changes made while app was closed
  this.lastForegroundTime = Date.now();
  this.fullSync('app-foreground').catch(err => {
    log.error('Initial sync failed', err);
  });
}
```

**Part C: Update destroy() to clean up AppState listener:**
```typescript
destroy(): void {
  if (this.realtimeDebounceTimer) {
    clearTimeout(this.realtimeDebounceTimer);
  }
  if (this.realtimeReconnectTimer) {
    clearTimeout(this.realtimeReconnectTimer);
    this.realtimeReconnectTimer = null;
  }
  if (this.realtimeChannel) {
    supabase.removeChannel(this.realtimeChannel);
    log.debug('Realtime subscription removed');
  }
  if (this.networkUnsubscribe) {
    this.networkUnsubscribe();
    this.networkUnsubscribe = null;
    log.debug('Network listener removed');
  }
  // NEW: Clean up AppState listener
  if (this.appStateSubscription) {
    this.appStateSubscription.remove();
    this.appStateSubscription = null;
    log.debug('AppState listener removed');
  }
  this.realtimeReconnectAttempts = 0;
  this.isInitialized = false;
  log.debug('Sync service destroyed');
}
```

**Expected logs after fix:**
```
Sync service initialized
SYNC STARTED (app-foreground)        ← NEW
PULLED 5 entries                     ← NEW (if any new data)
SYNC COMPLETE in 1.2s                ← NEW
```

---

### Fix 3: Handle DELETE Events Directly

**Location:** `processEntryRealtimeEvent()` method

**Add direct cache removal for DELETEs:**
```typescript
if (eventType === 'DELETE') {
  log.info('Entry DELETE event received', { entryId });

  // Remove from LocalDB
  await localDB.deleteEntry(entryId);

  // Remove from React Query cache directly
  this.removeEntryFromCache(entryId);

  return;
}
```

**New method:**
```typescript
private removeEntryFromCache(entryId: string): void {
  if (!this.queryClient) return;

  // Remove single entry cache
  this.queryClient.removeQueries({ queryKey: ['entry', entryId] });

  // Remove from all entry lists
  this.queryClient.setQueriesData(
    { queryKey: ['entries'] },
    (oldData: Entry[] | undefined) => {
      if (!oldData) return oldData;
      return oldData.filter(e => e.entry_id !== entryId);
    }
  );

  log.debug('Removed entry from cache', { entryId });
}
```

---

## Implementation Order

1. **Fix 2 (App-Foreground Sync)** - Highest impact, easiest to implement
   - Solves the "open app and data is stale" problem
   - Low risk of breaking existing functionality

2. **Fix 3 (DELETE Handling)** - Medium impact, easy to implement
   - Makes deletes appear instantly on other devices
   - Low risk

3. **Fix 1 (INSERT Handling)** - Highest complexity
   - Need to decide on approach (A, B, or C)
   - Risk of breaking filtered list behavior
   - Consider invalidation vs patching tradeoffs

---

## Testing Plan

### Test 1: App Foreground Sync
1. Open app on Device A, create entry
2. Close app on Device A (background)
3. Open app on Device B, verify entry appears
4. Create entry on Device B
5. Bring Device A to foreground
6. **Expected:** Entry from Device B appears within 5 seconds

### Test 2: Realtime New Entry
1. Open app on Device A and Device B (same stream view)
2. Create entry on Device A
3. **Expected:** Entry appears on Device B within 3 seconds (without refreshing)

### Test 3: Realtime Delete
1. Open app on Device A and Device B (same stream view)
2. Delete entry on Device A
3. **Expected:** Entry disappears from Device B within 3 seconds

### Test 4: Offline → Online Sync
1. Put Device A in airplane mode
2. Create 3 entries on Device A
3. Turn off airplane mode
4. **Expected:** All 3 entries sync to server and appear on Device B

---

## Code Quality Improvements (Optional)

These aren't required for the fix but would improve maintainability:

1. **Split SyncService into smaller modules:**
   - `PushSyncService` - handles push operations
   - `PullSyncService` - handles pull operations
   - `RealtimeService` - handles realtime subscriptions
   - `SyncOrchestrator` - coordinates the above

2. **Remove debug logs from production:**
   - Lines 1074-1079, 1155-1163, 531-541, 596-600
   - Use `log.debug()` instead of `log.info()` for verbose logging

3. **Add sync status events:**
   - Emit events when sync starts/completes
   - Allow UI to show sync indicator

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/mobile/src/shared/sync/syncService.ts` | All three fixes |
| `apps/mobile/App.tsx` | None (sync already initialized there) |

---

## Risk Assessment

| Fix | Risk | Mitigation |
|-----|------|------------|
| App-Foreground Sync | Low | Add minimum interval to prevent excessive syncing |
| DELETE Handling | Low | Already have local delete logic, just adding cache removal |
| INSERT Handling | Medium | Test thoroughly with filtered lists, consider invalidation fallback |

---

## Estimated Effort

- Fix 1 (INSERT): 2-3 hours (including testing with filters)
- Fix 2 (Foreground): 1 hour
- Fix 3 (DELETE): 30 minutes

**Total: ~4-5 hours**
