# Sync Architecture Plan

## Overview

This document defines the sync architecture for the Trace mobile app. The design prioritizes:
- **Speed**: LocalDB-first for instant reads/writes
- **Offline-first**: Full functionality without network
- **Invisible sync**: UI is sync-agnostic
- **Future-proof**: Supports local-only mode (no login)

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                              UI                                  │
│  (Components, Screens - sync agnostic)                          │
│  - Calls saveEntry(), getEntries()                              │
│  - Receives saveStatus: 'saved' | 'saving' | 'offline'          │
│  - Shows offline indicator when disconnected                    │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Hooks Layer                              │
│  useEntry(), useEntries()                                        │
│  - Returns data from API                                         │
│  - Provides saveStatus for UI                                    │
│  - Manages autosave (3s debounce / 15s max)                     │
│  - React Query for caching & invalidation                        │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          API Layer                               │
│  entryApi.ts, streamApi.ts, locationApi.ts, photoApi.ts         │
│  - ALL reads from LocalDB                                        │
│  - ALL writes to LocalDB                                         │
│  - NO direct Supabase calls                                      │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          LocalDB                                 │
│  (SQLite - Source of Truth for Mobile App)                      │
│  - All data stored here                                          │
│  - Works 100% offline                                            │
│  - Tracks sync status per record (synced, sync_action)          │
└─────────────────────────────┬───────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────────┐
│      Sync Service           │ │     Realtime Listener           │
│  (Push changes)             │ │  (Pull changes)                 │
│  - Watches LocalDB writes   │ │  - WebSocket per open entry     │
│  - Pushes to Supabase       │ │  - Updates LocalDB on change    │
│  - Handles offline queue    │ │  - Invalidates React Query      │
└─────────────┬───────────────┘ └───────────────┬─────────────────┘
              │                                 │
              └────────────┬────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Supabase                                 │
│  (Remote Database - Optional)                                    │
│  - Only accessed by Sync Service                                 │
│  - Not required for app to function                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Principles

| Principle | Implementation |
|-----------|----------------|
| UI is sync-agnostic | Components never call Supabase, only use hooks |
| API always hits LocalDB | Never bypass LocalDB for reads or writes |
| LocalDB is source of truth | App works 100% with just LocalDB |
| Sync is a side-effect | Happens invisibly in background |
| Supabase is optional | App runs fully without it (local-only mode) |

---

## Data Flow

### Read Flow
```
UI Component
    │
    ▼
useEntries() hook
    │
    ▼
getEntries() API ──► LocalDB ──► Return data
                         │
                         ▼
              (Sync Service may update LocalDB
               from Supabase in background)
```

### Write Flow (with Autosave)
```
User edits entry
    │
    ▼
3s debounce timer starts (resets on each edit)
    │
    ├── User keeps editing ──► Reset timer
    │
    └── 15s max reached OR 3s inactivity
            │
            ▼
      saveEntry() API
            │
            ▼
        LocalDB write ──► UI shows "Saved"
            │
            ▼
    Sync Service detects change
            │
            ├── Online ──► Push to Supabase
            │
            └── Offline ──► Queue for later
```

---

## Autosave Behavior

| Setting | Value |
|---------|-------|
| Debounce | 3 seconds of inactivity |
| Max interval | 15 seconds (force save even if still typing) |
| Trigger | Any change to entry record |
| Cancel | None - changes always autosave |

### Save Status Display

| Status | UI Display | Condition |
|--------|------------|-----------|
| `saved` | "Saved" or "Saved ✓" | After successful LocalDB write |
| `saving` | "Saving..." | During debounce or write |
| `offline` | "Offline" (with icon) | No network connection |

**Note**: Status reflects LocalDB save, not Supabase sync. User's data is always safe locally.

---

## Sync Triggers

| Event | Action |
|-------|--------|
| Entry saved to LocalDB | Push that entry to Supabase |
| Stream saved to LocalDB | Push that stream to Supabase |
| Location saved to LocalDB | Push that location to Supabase |
| Photo added to LocalDB | Upload to Storage + push metadata |
| Entry opened in editor | Subscribe to realtime for that entry |
| Entry editor closed | Unsubscribe from realtime |
| Realtime change received | Update LocalDB → Invalidate React Query |
| App comes to foreground | Pull all changes since lastSyncTime |
| Network reconnects | Pull missed changes → Push queued items |
| Local-only stream | No sync, no subscription |

---

## Sync Order (Foreign Key Dependencies)

### Push Order
```
1. Streams      (entries depend on stream_id)
2. Locations    (entries depend on location_id)
3. Entries
4. Photos       (photos depend on entry_id)
```

### Pull Order
```
1. Streams
2. Locations
3. Entries
4. Photos       (then download image files)
```

---

## Realtime Subscriptions

Realtime is used **only** for entries currently being edited:

```typescript
// When user opens entry editor
subscribeToEntry(entryId) {
  supabase.channel(`entry-${entryId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      table: 'entries',
      filter: `entry_id=eq.${entryId}`
    }, (payload) => {
      // Update LocalDB
      localDB.upsertEntry(payload.new);
      // Notify UI
      queryClient.invalidateQueries(['entry', entryId]);
      // Show toast
      showToast("Entry updated by another device");
    })
    .subscribe();
}

// When user closes entry editor
unsubscribeFromEntry(entryId) {
  channel.unsubscribe();
}
```

---

## Conflict Resolution

**Strategy**: Last write wins with notification

```
Device A saves → Push to Supabase (version 2)
Device B saves (based on version 1):
  1. Check server version
  2. Server version (2) > local base version (1)
  3. Pull server version → Overwrite local
  4. Show toast: "Entry updated by another device"
  5. User sees fresh data, can re-apply their changes
```

With autosave every 3-15 seconds, the conflict window is very small.

---

## Offline Behavior

| State | LocalDB | Supabase | UI Shows |
|-------|---------|----------|----------|
| Online | ✅ Read/Write | ✅ Push/Pull | "Saved" |
| Offline | ✅ Read/Write | ❌ Queued | "Offline" |
| Reconnect | ✅ | ✅ Pull then Push | "Saving..." → "Saved" |
| Local-only stream | ✅ Read/Write | ❌ Never | "Saved" |

### Offline Queue
- Entries marked with `synced: 0` and `sync_action: 'create'|'update'|'delete'`
- On reconnect, push all queued items in order
- If conflict, server wins (pull first, then re-push if needed)

---

## Photos Sync

Photos have both metadata (database) and binary data (storage):

### Add Photo Flow
```
1. Save image to local filesystem
2. Insert photo record in LocalDB (local_uri set, storage_path null)
3. Sync Service detects new photo
4. Upload image to Supabase Storage → get storage_path
5. Update Supabase photos table (with storage_path)
6. Update LocalDB with storage_path
```

### Pull Photo Flow (from another device)
```
1. Pull photo record from Supabase (has storage_path, no local_uri)
2. Insert to LocalDB
3. Download image from Supabase Storage
4. Save to local filesystem
5. Update LocalDB with local_uri
```

### Photo Download Strategy
- Download ALL photos on sync (eager)
- Ensures offline access to all photos

---

## Locations Sync

### Delete Behavior
When a location is deleted:
- Set `entry.location_id = null` for all entries referencing it
- Entries still have GPS coordinates (`entry_latitude`, `entry_longitude`)

---

## Streams Sync

Streams follow the same pattern as locations:
- Push before entries (entries depend on stream_id)
- Pull before entries
- Respect `local_only` flag on streams

### Local-Only Streams
When `stream.local_only = true`:
- Entries in this stream are NEVER synced
- No realtime subscription for these entries
- Data stays only on this device

---

## Entry Deletion

**Strategy**: Soft delete

```typescript
// On delete
entry.deleted_at = new Date().toISOString();
entry.sync_action = 'delete';

// Sync Service pushes soft delete to Supabase
// Entry remains in database with deleted_at set
```

---

## Initial Sync (New Device)

When user logs in on a new device with empty LocalDB:

```
1. Pull ALL streams from Supabase
2. Pull ALL locations from Supabase
3. Pull ALL entries from Supabase
4. Pull ALL photo metadata from Supabase
5. Download ALL photo files from Storage
6. Set lastSyncTime = now
```

No pagination needed for MVP. If datasets get large, add pagination later.

---

## Foreground Sync

When app comes to foreground after being backgrounded:

```typescript
async function onAppForeground() {
  if (isOffline) return;

  // Pull all changes since last sync (non-blocking, background)
  const changes = await supabase
    .from('entries')
    .select('*')
    .gt('updated_at', lastSyncTime)
    .eq('user_id', userId);

  // Update LocalDB
  for (const entry of changes) {
    await localDB.upsertEntry(entry);
  }

  // Invalidate React Query to refresh UI
  queryClient.invalidateQueries(['entries']);

  // Push any queued local changes
  await pushQueuedChanges();

  // Update timestamp
  lastSyncTime = new Date().toISOString();
}
```

**Note**: No background sync. Sync only happens when app is in foreground.

---

## Web App

Web app continues to use Supabase directly:
- No LocalDB (no SQLite in browser)
- Always online
- Future: Add realtime subscription for entry editing

No changes to web needed for this sync architecture.

---

## Implementation Phases

### Phase 1: Refactor Mobile API Layer ✅ COMPLETE
- [x] Create mobile-specific API that reads from LocalDB only
- [x] Create mobile-specific API that writes to LocalDB only
- [x] Remove direct Supabase calls from mobile API (now uses localDB.getCurrentUserId())
- [x] Ensure all existing functionality works with LocalDB

### Phase 2: Sync Service Refactor ✅ COMPLETE
- [x] Refactor to push single entries (not batch) - Already implemented
- [x] Add listener for LocalDB changes - triggerPushSync() called after writes
- [x] Implement offline queue with sync_action tracking - LocalDB tracks synced/sync_action fields
- [x] Handle reconnect: pull then push - Added NetInfo listener for network reconnect

### Phase 3: Realtime Subscriptions ✅ COMPLETE
- [x] Subscribe to entry on editor open - realtimeService.subscribeToEntry() via useEntryRealtime hook
- [x] Unsubscribe on editor close - automatic cleanup in useEntryRealtime useEffect
- [x] Update LocalDB on realtime change - realtimeService.handleEntryUpdate() updates LocalDB
- [x] Invalidate React Query cache - queryClient.invalidateQueries() called on external change
- [x] Show toast on external change - CaptureForm shows snackbar "Entry updated by {device}"

### Phase 4: Autosave Implementation
- [ ] Create useAutosave hook (3s debounce / 15s max)
- [ ] Integrate with entry editor
- [ ] Add saveStatus to hook return
- [ ] Update UI to show status indicator

### Phase 5: Offline Indicator
- [ ] Add network status detection
- [ ] Show offline indicator in entry editor
- [ ] Handle network reconnect

### Phase 6: Foreground Sync
- [ ] Detect app foreground event
- [ ] Pull all changes since lastSyncTime
- [ ] Push queued changes
- [ ] Update UI

---

## File Changes Summary

| File | Change |
|------|--------|
| `apps/mobile/src/shared/sync/syncService.ts` | Refactor to single-entry push, add LocalDB listener |
| `apps/mobile/src/shared/sync/syncApi.ts` | Simplify to internal use only |
| `apps/mobile/src/shared/sync/realtimeService.ts` | NEW: Manage per-entry subscriptions |
| `apps/mobile/src/modules/entries/mobileEntryApi.ts` | Ensure LocalDB-only reads/writes |
| `apps/mobile/src/modules/entries/hooks/useAutosave.ts` | NEW: Autosave hook |
| `apps/mobile/src/modules/entries/hooks/useEntryEditor.ts` | NEW: Combines autosave + realtime |
| `apps/mobile/src/screens/CaptureScreen.tsx` | Update to use autosave, show status |
| `apps/mobile/src/components/OfflineIndicator.tsx` | NEW: Offline status display |

---

## Success Criteria

- [ ] Reads are instant (always from LocalDB)
- [ ] Writes are instant (always to LocalDB)
- [ ] UI never waits for network
- [ ] Sync happens invisibly in background
- [ ] App works fully offline
- [ ] Changes from other devices appear when editing
- [ ] No merge UI needed
- [ ] Local-only streams never sync
