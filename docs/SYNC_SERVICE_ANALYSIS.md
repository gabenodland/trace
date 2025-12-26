# SyncService Analysis

## Overview

The sync system is spread across 6 files with a total of ~2200 lines:

```
sync/
├── index.ts          (~30 lines)  - Re-exports public API
├── syncApi.ts        (~100 lines) - Public functions (wrapper around syncService)
├── syncHooks.ts      (~140 lines) - React Query hooks for components
├── syncService.ts    (~1900 lines) - The actual sync logic
└── localDB.ts        (separate)    - SQLite operations
```

---

## External Usage Map

### 1. App Lifecycle (App.tsx)

```typescript
import { initializeSync, destroySync } from './shared/sync';

// On auth + DB ready:
await initializeSync(queryClient);

// On unmount:
destroySync();
```

### 2. After Local Writes (API modules)

Called by: `mobileEntryApi.ts`, `mobileStreamApi.ts`, `mobilePhotoApi.ts`, `mobileLocationApi.ts`

```typescript
import { triggerPushSync } from '../../shared/sync';

// After saving to LocalDB:
triggerPushSync();  // Non-blocking, fire-and-forget
```

### 3. Before Read (when fresh data needed)

Called by: `mobileEntryApi.ts`

```typescript
import { refreshEntryFromServer } from '../../shared/sync';

// Before editing an entry:
await refreshEntryFromServer(entryId);
```

### 4. UI Controls (ProfileScreen, DatabaseInfoScreen)

```typescript
import { useSync } from '../shared/sync';

const {
  sync,           // Trigger full sync
  forcePull,      // Force pull (ignore timestamps)
  unsyncedCount,  // For UI badge
  isSyncing,      // For loading indicator
} = useSync();
```

---

## SyncService Public Methods

| Method | Called By | Purpose |
|--------|-----------|---------|
| `initialize(queryClient)` | App.tsx via syncApi | Set up realtime, network listener |
| `destroy()` | App.tsx via syncApi | Cleanup on logout/unmount |
| `fullSync(trigger)` | useSync hook, reconnect handler | Push + Pull everything |
| `pushChanges(trigger)` | triggerPushSync | Push local changes only |
| `pullChanges(trigger)` | Internal only | Pull server changes only |
| `pullEntry(entryId)` | refreshEntryFromServer | Refresh single entry |
| `forcePull()` | useSync hook | Full pull ignoring timestamps |
| `getStatus()` | useSync hook | Get isSyncing, unsyncedCount |

---

## SyncService Private Methods (Internal)

### Core Sync Logic
- `executeSync(trigger, options)` - Main sync orchestration

### Push Methods (~350 lines)
- `pushStreams()` - Push unsynced streams
- `pushLocations()` - Push unsynced locations
- `pushEntries()` - Push unsynced entries
- `pushEntryDeletes()` - Push deleted entries
- `pushPhotos()` - Push photos + upload files

### Pull Methods (~400 lines)
- `pullStreams(forceFullPull)` - Pull streams from server
- `pullLocations(forceFullPull)` - Pull locations
- `pullEntries(forceFullPull, pullStartTime)` - Pull entries
- `pullPhotos(forceFullPull)` - Pull photo metadata

### Individual Item Sync (~300 lines)
- `syncEntry(entry)` - Push single entry with conflict detection + cache update
- `syncStream(stream)` - Push single stream
- `syncLocation(location)` - Push single location

### Realtime Handlers (~300 lines)
- `setupRealtimeSubscription()` - Subscribe to Supabase changes
- `processEntryRealtimeEvent(payload)` - Handle entry changes with version filtering
- `processStreamRealtimeEvent(payload)` - Handle stream changes
- `updateEntryFromPayload(entryId, data)` - Update LocalDB from realtime
- `updateStreamFromPayload(streamId, data)` - Update LocalDB from realtime
- `handleRealtimeChange(table, entryId)` - Debounced handler

### Network Handling (~100 lines)
- `setupNetworkListener()` - Listen for online/offline
- `handleReconnect()` - Full sync when back online
- `canSync()` - Check if online + authenticated

### Utilities (~150 lines)
- `getLocalOnlyStreamIds()` - Get private streams
- `cleanupWrongUserData()` - Remove other users' data
- `getLastPullTimestamp()` - For incremental sync
- `saveLastPullTimestamp(timestamp)` - Save last pull time
- `invalidateQueryCache(entryIds)` - Refresh React Query
- `setEntryQueryData(entryId, entry)` - Update single entry cache
- `startBackgroundPhotoDownload()` - Download photos in background
- `logSyncResult(trigger, result)` - Log to sync_logs table

---

## Data Flow

### Push Flow (Local → Server)

```
User Edit
    → mobileEntryApi.updateEntry()
    → localDB.updateEntry(synced=0, sync_action='update', version++)
    → triggerPushSync()
    → syncService.pushChanges()
    → pushEntries()
    → syncEntry()
        → Conflict check (serverVersion vs base_version)
        → If conflict: save backup, apply server data, update cache
        → If no conflict: supabase.upsert() → localDB.markSynced()
        → Supabase broadcasts realtime event
```

### Pull Flow (Server → Local)

```
syncService.pullChanges()
    → pullEntries()
    → supabase.select(updated_at > lastPull)
    → For each entry:
        → Check if local has unsynced changes
        → localDB.updateEntry(base_version=serverVersion)
    → invalidateQueryCache()
```

### Realtime Flow (Server → Local, triggered by other devices)

```
Supabase broadcasts change
    → processEntryRealtimeEvent(payload)
    → Skip if currently pushing this entry (race condition prevention)
    → Compare payload.version vs localDB.base_version
    → If remoteVersion <= localVersion: Skip (already have this)
    → If local has unsynced changes (synced=0): Skip
    → Otherwise: updateEntryFromPayload() → setEntryQueryData()
```

---

## Key Fixes Applied (December 2024)

### 1. External Update Baseline Fix (CaptureForm.tsx)

**Problem:** When external update detected and user had dirty changes, the baseline wasn't updated. This caused subsequent autosaves to conflict.

**Fix:** Always update baseline when external update detected, even if user has dirty changes. This ensures the next autosave uses the correct base_version.

```typescript
// External update - if user has unsaved changes
if (isFormDirty) {
  // CRITICAL FIX: Still update baseline even when dirty!
  setBaseline(newFormData);
  showSnackbar(`Entry updated by ${editingDevice} - your changes will be merged`);
  return;
}
```

### 2. Conflict Handling Cache Update (syncService.ts)

**Problem:** After conflict detection in syncEntry, the React Query cache wasn't updated. The form continued showing local changes that would conflict again.

**Fix:** Update React Query cache after conflict handling so CaptureForm sees the server data.

```typescript
// After conflict handling LocalDB update:
const updatedEntry = await localDB.getEntry(entry.entry_id);
if (updatedEntry) {
  this.setEntryQueryData(entry.entry_id, updatedEntry);
}
```

### 3. Dead Code Removed

- **`triggerPullSync()`** - Removed from syncApi.ts and index.ts (was never imported)
- **Duplicate `useSyncStatus()`** - Removed from mobileEntryHooks.ts (syncHooks.ts version is canonical)

---

## Architecture Patterns

### Version Tracking

- **`version`** - Local version, incremented on each user edit
- **`base_version`** - Server version that local was based on, updated after successful sync/pull
- **Conflict Detection:** `serverVersion > base_version` indicates changes on server we don't have

### Race Condition Prevention

1. **currentlyPushingEntryIds Set** - Tracks entries currently being pushed, realtime events for these are ignored
2. **synced=0 Check** - Realtime events skip entries with unsynced local changes

### Single Source of Truth (Future)

New `useEntryEditor` hook provides:
- Working data initialized from entry (React Query)
- Debounced saves directly to LocalDB
- External update detection with version comparison
- No separate formData state to get out of sync

---

## Remaining Issues

### 1. No Realtime Reconnection

If realtime subscription dies (CHANNEL_ERROR, TIMED_OUT), there's no automatic reconnection. The subscription is only set up once in `initialize()`.

**Recommendation:** Add reconnection logic with exponential backoff.

### 2. Conflict UI

Conflicts are detected and user's changes are saved to `conflict_backup`, but there's no UI to resolve conflicts.

**Recommendation:** Show conflict indicator in entry list, provide merge UI.

---

## File Structure After Cleanup

```
apps/mobile/src/
├── shared/
│   ├── sync/
│   │   ├── index.ts           - Public exports
│   │   ├── syncApi.ts         - Public API wrapper
│   │   ├── syncHooks.ts       - useSync, useSyncStatus
│   │   └── syncService.ts     - Internal sync logic
│   └── db/
│       └── localDB.ts         - SQLite operations
└── modules/
    └── entries/
        ├── hooks/
        │   ├── useAutosave.ts     - Debounced save timer
        │   └── useEntryEditor.ts  - NEW: Single source of truth hook
        ├── mobileEntryApi.ts      - Entry CRUD operations
        └── mobileEntryHooks.ts    - useEntries, useEntry hooks
```
