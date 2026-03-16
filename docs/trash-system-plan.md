# Trash System Overhaul — Plan

## Goal

Unify soft-delete, restore, and hard-delete into a fully offline-capable, multi-device-consistent system. All data (entries, attachments) follows the same lifecycle and syncs across devices in every state.

## Entry Lifecycle

```
LIVE → SOFT-DELETED (trash) → HARD-DELETED (tombstone) → PURGED
       (deleted_at set)        (row removed,               (tombstone row removed
                                tombstone created)           after retention period)
```

## Current State vs Target

| Behavior | Current (entries) | Current (attachments) | Target (both) |
|----------|-------------------|----------------------|----------------|
| After push soft-delete | `markSynced` hard-deletes local row | Local row kept with `deleted_at` | Keep local row |
| Pull sync | Fetches soft-deleted → hard-deletes locally | Fetches soft-deleted → mirrors locally | Mirror locally |
| Trash queries | Server RPCs only | N/A | Local SQLite |
| Restore | Server RPC only | Via entry restore RPC | Local + sync |
| Hard delete | Server RPC, row deleted | Via entry hard-delete | Local + tombstone + sync |
| Offline support | None | Partial | Full |

---

## Phase 1: Keep Soft-Deleted Entries Locally

**Goal:** Stop destroying local entry rows after sync push. Align entries with how attachments already work.

### 1A. Change `markSynced` in localDB.ts
- Current: `DELETE FROM entries WHERE entry_id = ? AND sync_action = 'delete'`
- New: `UPDATE entries SET synced = 1, sync_action = NULL WHERE entry_id = ? AND sync_action = 'delete'`
- Entry row stays in SQLite with `deleted_at` set

### 1B. Change `pullEntries` in pullSyncOperations.ts
- Current: when remote entry has `deleted_at`, calls `localDB.deleteEntry()` which cascades
- New: when remote entry has `deleted_at`, soft-delete locally by setting `deleted_at` + `synced = 1` + `sync_action = NULL` (mirror, don't cascade — attachments come separately in pull)
- For entries that exist locally but are missing from server response AND have no tombstone: leave as-is (could be a server-side hard delete — handled by tombstones in Phase 3)

### 1C. Update entry read queries
- Verify all entry queries (getAllEntries, getEntriesByStream, search, etc.) filter `deleted_at IS NULL`
- Most already filter `sync_action != 'delete'`, but we need explicit `deleted_at IS NULL` since rows now persist

---

## Phase 2: Local Trash Operations

**Goal:** All trash UI operations work from local SQLite. No server round-trips for read operations.

### 2A. New local queries in mobileDataManagementApi.ts

```typescript
// Get all soft-deleted entries from local SQLite
getLocalDeletedEntries(): Promise<TrashEntry[]>
// SELECT entry_id, title, stream_id, deleted_at, ...
// FROM entries WHERE deleted_at IS NOT NULL
// JOIN streams for stream_name
// With attachment count subquery

// Get full detail of a soft-deleted entry
getLocalDeletedEntryDetail(entryId: string): Promise<DeletedEntryDetail>
// Same shape as current server query but from SQLite
// Include soft-deleted attachments that were cascade-deleted with the entry
```

### 2B. New local mutations

```typescript
// Restore: clear deleted_at, mark for sync
localRestoreEntry(entryId: string): void
// UPDATE entries SET deleted_at = NULL, synced = 0, sync_action = 'update' WHERE entry_id = ?
// UPDATE attachments SET deleted_at = NULL, synced = 0, sync_action = 'update'
//   WHERE entry_id = ? AND deleted_at >= entry.deleted_at
//   (only restore attachments cascade-deleted with the entry, not individually deleted ones)

// Hard delete: remove locally, mark tombstone for sync
localHardDeleteEntry(entryId: string): void
// DELETE FROM attachments WHERE entry_id = ?
// DELETE FROM entry_versions WHERE entry_id = ?
// DELETE FROM entries WHERE entry_id = ?
// INSERT INTO entry_tombstones (entry_id, user_id, deleted_at)
// Mark tombstone for sync push
```

### 2C. Wire into mobile hooks
- Replace server-based `useDeletedEntriesQuery` with local SQLite query
- Replace server-based `useDeletedEntryDetail` with local SQLite query
- Replace `restoreEntry` mutation: local operation + trigger sync
- Replace `hardDeleteEntry` mutation: local operation + sync tombstone
- Keep React Query for cache/invalidation but data source is SQLite

### 2D. Restore attachment timestamp fix
- Current `restore_entry` RPC restores ALL soft-deleted attachments
- Fix: only restore attachments where `attachment.deleted_at >= entry.deleted_at`
- This preserves individually-deleted attachments that the user removed before trashing the entry
- Apply same logic in local restore (2B)

---

## Phase 3: Tombstones

**Goal:** Hard-deleted entries leave a lightweight marker so other devices know to remove them.

### 3A. Supabase migration: `entry_tombstones` table

```sql
CREATE TABLE entry_tombstones (
  entry_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  hard_deleted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE entry_tombstones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own tombstones"
  ON entry_tombstones FOR ALL USING (user_id = auth.uid());
```

### 3B. Local SQLite: `entry_tombstones` table

```sql
CREATE TABLE IF NOT EXISTS entry_tombstones (
  entry_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  hard_deleted_at INTEGER NOT NULL,
  synced INTEGER DEFAULT 0
);
```

### 3C. Update `hard_delete_entry` RPC
- Current: `DELETE FROM entries`, `DELETE FROM attachments`, returns file_paths
- New: same deletes + `INSERT INTO entry_tombstones (entry_id, user_id)`
- Storage file cleanup still happens (client deletes files from Supabase Storage on RPC response)

### 3D. Sync: push tombstones
- New push function: `pushTombstones()`
- For local hard-deletes: push tombstone to server, then call `hard_delete_entry` RPC for server-side cleanup (attachments, storage files, versions)
- Mark tombstone as synced

### 3E. Sync: pull tombstones
- New pull function: `pullTombstones()`
- Fetch tombstones from server where `hard_deleted_at > last_pull_timestamp`
- For each: hard-delete local entry + attachments + versions, insert local tombstone
- This handles Device B coming online after Device A hard-deleted

---

## Phase 4: Local-Only Entry Support

**Goal:** Entries in local-only streams get the same trash experience without sync.

### 4A. Soft-delete local-only entries (not hard-delete)
- Current: `localDB.deleteEntry()` immediately hard-deletes local-only entries
- New: soft-delete with `deleted_at` (same as synced entries), skip sync flags
- Entry appears in trash like any other

### 4B. Restore local-only entries
- Clear `deleted_at` locally, no sync needed

### 4C. Hard-delete local-only entries
- Delete row from SQLite + attachments + versions
- No tombstone needed (no sync = no conflict)
- Delete local attachment files from disk

### 4D. Client-side 30-day cleanup for local-only
- On app launch: find local-only entries where `deleted_at < now - 30 days`
- Hard-delete them (same as 4C)

---

## Phase 5: 30-Day Auto-Purge

**Goal:** Soft-deleted entries are automatically hard-deleted after 30 days.

### 5A. Server-side scheduled job
- pg_cron or Supabase Edge Function, runs daily
- Find entries where `deleted_at < now() - INTERVAL '30 days'`
- For each: delete attachments (DB rows + storage files), delete versions, delete entry, create tombstone
- Next sync propagates tombstones to all devices

### 5B. Client-side cleanup (belt + suspenders)
- On app launch: check local entries where `deleted_at < now - 30 days` AND `synced = 1`
- Hard-delete locally (server job should have already cleaned up, this catches stragglers)
- Don't create tombstones — server is authoritative for synced entries

### 5C. UI: show remaining days in trash
- In Deleted Entries list and detail: "X days until permanent deletion"
- Calculated from `deleted_at + 30 days - now`

---

## Phase 6: Remove Server-Only Trash RPCs

**Goal:** Clean up now-unused server RPCs.

### 6A. Remove or deprecate
- `get_deleted_entries` RPC — replaced by local SQLite query
- `get_deleted_streams` RPC — streams don't have trash (user decision)
- `get_deleted_locations` RPC — locations don't have trash (user decision)
- `restore_entry` RPC — restore is now local + sync (but keep for server-side auto-purge reversal?)

### 6B. Keep
- `hard_delete_entry` RPC — still needed for server-side cleanup when tombstone syncs
- `hard_delete_stream` RPC — still useful
- `hard_delete_location` RPC — still useful

---

## Implementation Order

1. **Phase 1** (foundation) — keep entries locally, fix sync
2. **Phase 3** (tombstones) — need this before Phase 2's hard-delete works correctly
3. **Phase 2** (local operations) — wire up the UI to local data
4. **Phase 4** (local-only) — extend to non-synced entries
5. **Phase 5** (auto-purge) — 30-day cleanup
6. **Phase 6** (cleanup) — remove dead server code

## Risk Notes

- **First sync after Phase 1 deploy:** All server-side soft-deleted entries will pull down to the device. One-time cost, could be noticeable if there are many deleted entries. Consider showing a progress indicator.
- **Tombstone table growth:** Tombstones accumulate forever unless purged. Add a retention period (6 months?) after which tombstones are deleted. Any device offline longer than that would need a full re-sync.
- **Attachment file cleanup timing:** When hard-deleting, local attachment files should be deleted from disk. Ensure this happens even if the app crashes mid-operation.
- **Migration safety:** Phase 1 changes `markSynced` behavior — entries that were previously purged will now persist. No data loss risk, but SQLite size will grow. Monitor.
