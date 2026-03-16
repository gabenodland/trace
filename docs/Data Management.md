# Data Management Screen

Replaces the developer-only `DatabaseInfoScreen.tsx` with a user-facing data management experience. Designed for non-technical users to understand their storage usage, privacy posture, and deleted data — with future pricing tiers in mind.

**Navigation:** Profile Picture > Manage > Data (below Streams, Places, Devices)
**Backlog:** "Data Management" entry in Trace Backlog (stream `4ccd4c59`)

---

## Storage Tiers

Uses the existing subscription infrastructure — no new payment/IAP work needed.

**Existing system:**
- `profiles.subscription_tier` — `'free'` | `'pro'` (default: `'free'`)
- `profiles.is_dev_mode` — `true` grants pro access unconditionally
- `getEffectiveTier()` in `packages/core/src/shared/featureGates.ts` — handles dev mode + expiry
- `useSubscription()` hook — exposes `isPro`, `isDevMode`, `getLimit()`, `isLimitReached()`
- `FEATURE_LIMITS` map — add `storage_limit_mb` here

**Tier limits (single combined total — data + attachments):**

| Tier | Storage Limit | Roughly Means |
|------|--------------|---------------|
| Free | **200 MB** | ~400 photos + unlimited text |
| Pro ($3.50/mo) | **2 GB** | ~4,000 photos + unlimited text |
| Developer (`is_dev_mode`) | **Unlimited** | Pro limits, no enforcement |

Text data (entries, streams, places) is negligible — a user would need 50,000+ entries to reach even 250 MB of pure text. The limit is effectively an attachment limit, but presented as one simple combined number.

**Enforcement:**
- Storage bar shows usage against tier limit: "87 MB of 200 MB"
- When approaching limit (>80%): warning indicator
- When at limit: block new attachment uploads, allow text entries
- Upgrade prompt shown when limit reached or approaching

**Work required:**
- [ ] Add `storage_limit_mb: { free: 200, pro: 2048 }` to `FEATURE_LIMITS` in `featureGates.ts`
- [ ] Enforcement check in attachment upload path (block upload if over limit)
- [ ] `isStorageLimitReached()` helper for UI gating

**Store commission context (for pricing reference):**
- Apple: 15% (Small Business Program, under $1M revenue — enroll via App Store Connect)
- Google Play: 15% (automatic for subscriptions)
- Net per user at $3.50/mo: ~$2.91 after store cut, ~$2.85 after Supabase

---

## Existing Screen Reference

`apps/mobile/src/screens/DatabaseInfoScreen.tsx` (~1600 lines, 6 tabs). This screen remains available as a hidden dev tool but is no longer user-facing. The new screen is built from scratch.

---

## Screen Mockups

### Full Screen (scrollable)

```
┌─────────────────────────────────────┐
│  ←  Data Management                 │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────┬────────────────┐ │
│  │ THIS DEVICE   │ CLOUD          │ │
│  │               │                │ │
│  │   142 MB      │  138 MB        │ │
│  │               │  of 200 MB     │ │
│  │               │                │ │
│  │ ██▒▒▒▒▒▒▒▒▒▒▒ │ █▒▒▒▒▒▒▒░░░░░ │ │
│  │ ██ Data    3MB│ █ Data     2MB │ │
│  │ ▒▒ Attach 139M│ ▒ Attach 136MB │ │
│  │               │ ░ Avail   62MB │ │
│  └───────────────┴────────────────┘ │
│                                     │
│  YOUR DATA                          │
│  ┌────────────────┬───────────────┐ │
│  │  Entries       │  Streams      │ │
│  │  342           │  8            │ │
│  │  340 in cloud  │  7 in cloud   │ │
│  │  2 private     │  1 private    │ │
│  │  5 in trash    │               │ │
│  └────────────────┴───────────────┘ │
│  ┌────────────────┬───────────────┐ │
│  │  Places        │  Attachments  │ │
│  │  24            │  89           │ │
│  │  24 in cloud   │  87 in cloud  │ │
│  │  1 in trash    │  2 private    │ │
│  │                │  3 in trash   │ │
│  └────────────────┴───────────────┘ │
│                                     │
│  PRIVACY                            │
│  ┌─────────────────────────────────┐│
│  │ 🔒 Journal                    > ││
│  │ 2 entries, 2 attachments         ││
│  │ Device only — never leaves      ││
│  │ this device                     ││
│  └─────────────────────────────────┘│
│                                     │
│  TRASH                          5 > │
│  ┌─────────────────────────────────┐│
│  │ Deleted items on the server     ││
│  │ that can be restored.           ││
│  │                                 ││
│  │ 5 entries · 1 place · 3 attach. ││
│  │                                 ││
│  │       [ View Trash ]            ││
│  └─────────────────────────────────┘│
│                                     │
│  TOOLS                              │
│  ┌─────────────────────────────────┐│
│  │ ↻  Sync Now              Done ↗││
│  │    Last synced 2 min ago        ││
│  ├─────────────────────────────────┤│
│  │ 📍 Fill Place Details       3 >││
│  │    3 places missing details     ││
│  ├─────────────────────────────────┤│
│  │ 🔀 Merge Duplicate Places   2 >││
│  │    2 sets of duplicates found   ││
│  ├─────────────────────────────────┤│
│  │ 🧹 Clean Up Unused Places  1 > ││
│  │    1 place with no entries      ││
│  └─────────────────────────────────┘│
│                                     │
│  ▸ Advanced                         │
│                                     │
└─────────────────────────────────────┘
```

### Trash Screen (separate screen, online only)

```
┌─────────────────────────────────────┐
│  ←  Trash                           │
├──────────┬──────────┬───────────────┤
│ Entries  │ Streams  │ Places        │
│ (5)      │ (1)      │ (1)           │
├──────────┴──────────┴───────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │ Morning thoughts                ││
│  │ Daily Log · Mar 10 · 2 attach. ││
│  │              [Restore]  [Delete]││
│  ├─────────────────────────────────┤│
│  │ Meeting notes                   ││
│  │ Work · Mar 8 · 0 attach.       ││
│  │              [Restore]  [Delete]││
│  ├─────────────────────────────────┤│
│  │ Quick reminder                  ││
│  │ Inbox · Mar 7 · 1 attach.      ││
│  │              [Restore]  [Delete]││
│  ├─────────────────────────────────┤│
│  │ ··· 2 more                      ││
│  └─────────────────────────────────┘│
│                                     │
└─────────────────────────────────────┘
```

### Trash — Streams Tab (delete only)

```
├──────────┬──────────┬───────────────┤
│ Entries  │ Streams  │ Places        │
│ (5)      │ (1)      │ (1)           │
├──────────┴──────────┴───────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │ Old Project                     ││
│  │ Deleted Mar 5                   ││
│  │                         [Delete]││
│  └─────────────────────────────────┘│
│                                     │
│  These streams can be permanently   │
│  deleted. Entries from deleted      │
│  streams appear in the Entries tab. │
```

### Trash — Places Tab (delete only)

```
├──────────┬──────────┬───────────────┤
│ Entries  │ Streams  │ Places        │
│ (5)      │ (1)      │ (1)           │
├──────────┴──────────┴───────────────┤
│                                     │
│  ┌─────────────────────────────────┐│
│  │ Blue Bottle Coffee              ││
│  │ Deleted Mar 12                  ││
│  │                         [Delete]││
│  └─────────────────────────────────┘│
```

### Advanced Section (expanded)

```
│  ▾ Advanced                         │
│  ┌─────────────────────────────────┐│
│  │ ☁️  Force Sync from Cloud       ││
│  │    Re-download all data from    ││
│  │    the server. Local changes    ││
│  │    will be overwritten.         ││
│  ├─────────────────────────────────┤│
│  │ 🧹 Clear Sync Errors       0   ││
│  │    No stale errors found        ││
│  ├─────────────────────────────────┤│
│  │ 🗑  Clear Version History       ││
│  │    142 snapshots · ~2 MB        ││
│  └─────────────────────────────────┘│
```

### Privacy — No Private Streams State

```
│  PRIVACY                            │
│  ┌─────────────────────────────────┐│
│  │ All your data syncs across      ││
│  │ devices via the cloud.          ││
│  │                                 ││
│  │ You can make any stream private ││
│  │ in its settings — private data  ││
│  │ stays on this device only.      ││
│  └─────────────────────────────────┘│
```

### Trash — Empty State

```
│  TRASH                              │
│  ┌─────────────────────────────────┐│
│  │ No deleted data.                ││
│  │                                 ││
│  │ Items you delete are kept on    ││
│  │ the server until you remove     ││
│  │ them permanently here.          ││
│  └─────────────────────────────────┘│
```

### Storage — Near Limit (upgrade prompt)

```
│  ┌───────────────┬────────────────┐ │
│  │ THIS DEVICE   │ CLOUD          │ │
│  │               │                │ │
│  │   142 MB      │  1.8 GB        │ │
│  │   of 2 GB     │  of 2 GB       │ │
│  │               │                │ │
│  │ █▒▒░░░░░░░░░░ │ █▒▒▒▒▒▒▒▒▒▒░░ │ │
│  │ █ Data    3MB │ █ Data     4MB │ │
│  │ ▒ Attach 139M │ ▒ Attach 1.8GB │ │
│  │ ░ Avail 1.9GB │ ░ Avail  196MB │ │
│  │               │  ⚠ 90% used   │ │
│  │               │ [ Upgrade → ]  │ │
│  └───────────────┴────────────────┘ │
```

---

## Views

### 1. Storage Dashboard (hero)

Visual summary of how much space the user is consuming, locally and in the cloud.

**Device Storage (informational only, no limit):**
- SQLite database file size (`FileSystem.getInfoAsync` on `SQLite/trace.db`)
- Local attachment files total (`SUM(file_size) FROM attachments WHERE local_path IS NOT NULL`)
- Combined total displayed prominently (e.g. "142 MB on this device")
- Breakdown: "Data" (SQLite database = entries, streams, places, metadata) vs "Attachments" (photos, future: documents)
- No progress bar limit — just shows the segmented bar with data vs attachments

**Cloud Storage (limit enforced):**
- Total cloud attachment bytes (new RPC: `get_user_storage_usage()`)
- Display as "X MB of Y MB" where Y comes from `getLimit('storage_limit_mb')`
- Segmented bar shows data + attachments + available against tier limit
- Cloud record counts per entity type

**Design notes:**
- Segmented progress bar: dark fill (██) = Data, medium fill (▒▒) = Attachments, empty (░░) = Available
- Bar is relative to the user's tier limit (200 MB free, 2 GB pro) via `getLimit('storage_limit_mb')`
- "On this device" and "In the cloud" as two clear columns or cards
- Show "X MB of Y MB" with tier limit from `FEATURE_LIMITS`
- Warning indicator when >80% used, upgrade prompt when >90% or at limit
- Friendly size formatting: bytes → KB → MB → GB as appropriate

**Work required:**
- [ ] `@trace/core`: Supabase RPC `get_user_storage_usage()` + TypeScript wrapper + React Query hook
- [ ] `@trace/core`: Friendly byte formatter utility (`formatBytes`) with vitest tests
- [ ] `apps/mobile`: Local storage calculation helper (SQLite file size + local attachment file sizes)
- [ ] `apps/mobile`: Segmented storage bar component (data / attachments / available)
- [ ] `apps/mobile`: Tier-aware limit display using existing `useSubscription().getLimit('storage_limit_mb')`

---

### 2. Data Inventory (entity cards)

Four cards in a 2x2 grid, one per entity type. Each card shows:

| Row | Entries | Streams | Places | Attachments |
|-----|---------|---------|--------|-------------|
| On this device | 342 | 8 | 24 | 89 |
| In the cloud | 340 | 7 | 24 | 87 |
| Private (device only) | 2 | 1 | — | 2 |
| In trash (restorable) | 5 | 0 | 1 | 3 |

**"Private"** = data that never leaves the device:
- Streams: `is_localonly = 1`
- Entries: entries belonging to local-only streams (`local_only = 1`)
- Attachments: attachments belonging to entries in local-only streams
- Places: N/A (places are always synced)

**"In trash"** = soft-deleted on the server (`deleted_at IS NOT NULL`):
- Requires querying the server since deleted records are removed from local DB

**Work required:**
- [ ] `@trace/core`: Cloud entity counts (Supabase `select count`) + cloud deleted counts (`deleted_at IS NOT NULL`)
- [ ] `apps/mobile`: Local counts (`SELECT COUNT(*)` per SQLite table)
- [ ] `apps/mobile`: Local private counts (`COUNT(*) WHERE is_localonly = 1` / `local_only = 1`)
- [ ] `apps/mobile`: Entity card component

---

### 3. Privacy Summary

A dedicated section making the user's privacy posture immediately clear. One callout per private stream:

> **Journal** — 2 entries, 2 attachments — Device only, never synced to the cloud.

- Lists each `is_localonly` stream by name
- Shows entry count and attachment count per private stream
- "Device only" badge with lock icon
- Tapping a stream navigates to its Stream Properties screen

If no private streams exist, show an informational note:
> All your data syncs across devices via the cloud. You can make any stream private in its settings.

**Work required:**
- [ ] `apps/mobile`: Query local-only streams with entry/attachment counts (SQLite JOIN or subqueries)
- [ ] `apps/mobile`: Privacy summary component
- [ ] `apps/mobile`: Navigation to StreamPropertiesScreen on tap

---

### 4. Trash (separate screen)

Separate screen navigated from "View Trash" on the Data Management screen. **Online-only** — requires network connection since all trash data lives on the server (soft-deleted records are hard-deleted locally).

Tabbed interface at the top to switch between entity types:

**Entries tab (default):**
- Formatted like the main entry list view — familiar layout
- Each row shows: title, stream name, deleted date, attachment count
- Two actions per row: **Restore** (copies entry + its attachments back) and **Delete** (permanent hard delete)
- Restoring an entry restores its attachments automatically
- If the entry's original stream is also deleted, restore to Inbox (default stream)

**Streams tab:**
- Stream name, deleted date
- **Delete only** — permanent hard delete. No restore.
- Lets users see what's lingering on the server and clean it up

**Places tab:**
- Place name, deleted date
- **Delete only** — permanent hard delete. No restore.
- Same purpose: visibility and cleanup

**Empty state:** "No deleted data. Items you delete are kept on the server until you permanently remove them here."

**No auto-expiry for now.** Deleted items persist until the user manually deletes them from trash.

**Work required:**
- [ ] `@trace/core`: Supabase RPCs — `get_deleted_entries()`, `get_deleted_streams()`, `get_deleted_locations()` (migrations + TypeScript wrappers)
- [ ] `@trace/core`: Supabase RPCs — `restore_entry(id)`, `hard_delete_entry(id)`, `hard_delete_stream(id)`, `hard_delete_location(id)` (migrations + TypeScript wrappers)
- [ ] `@trace/core`: React Query hooks — `useDeletedEntries()`, `useDeletedStreams()`, `useDeletedLocations()`, mutation hooks for restore/delete
- [ ] `@trace/core`: Guard in `restore_entry` RPC — check if target stream is deleted, fall back to Inbox
- [ ] `apps/mobile`: `TrashScreen.tsx` with tabbed interface (Entries / Streams / Places)
- [ ] `apps/mobile`: Pull sync after restore to bring data back to local device
- [ ] `apps/mobile`: Online-only gate — show message if offline
- [ ] `apps/mobile`: Navigation route + link from Data Management screen

---

### 5. Tools

Useful data hygiene actions carried over from the old DBInfo screen. Presented as a clean list of actions with descriptions.

**Sync Now**
- Single button, runs normal sync
- Shows last sync timestamp and current sync state

**Fill Place Details**
- Enriches places missing city/region/country via Mapbox reverse geocode
- Shows count of places that need enrichment before running

**Merge Duplicate Places**
- Finds places with matching name + address and merges them
- Shows count of duplicates found before running

**Clean Up Unused Places**
- Deletes saved places with 0 linked entries
- Shows count of unused places before running

**Design notes:**
- Each tool shows a brief description of what it does in plain language
- Show a preview count ("3 places can be merged") before the user taps
- Confirmation alert before any destructive action

**Work required:**
- [ ] `apps/mobile`: Tools section component
- [ ] `apps/mobile`: Pre-action count queries (unused places count, duplicate count, unenriched count)
- [ ] `apps/mobile`: Reuse existing `mobileLocationApi` functions: `deleteUnusedLocations`, `mergeDuplicateLocations`, `enrichLocationHierarchy`

---

### 6. Advanced (collapsible)

Hidden behind a "Show Advanced" toggle. Small text, clearly marked as power-user territory.

**Force Sync from Cloud**
- Pulls all data from cloud, overwriting local state
- Destructive warning before running

**Clear Stale Sync Errors**
- Removes error flags from records that have since synced successfully
- Shows count of stale errors before running

**Clear Version History**
- Deletes local entry version snapshots to reclaim space
- Shows count of versions and estimated space before running

**Work required:**
- [ ] `apps/mobile`: Collapsible advanced section component
- [ ] `apps/mobile`: Reuse existing handlers from `DatabaseInfoScreen`

---

## What Gets Cut from Old Screen

These features from `DatabaseInfoScreen` are NOT carried over:

| Feature | Reason |
|---------|--------|
| Raw entity list tabs (entries, streams, locations, attachments) | Developer data dump, not useful for users |
| JSON modal / raw record inspection | Developer tool |
| Per-entity "Clear Local" buttons | Too destructive, no clear user benefit |
| Danger Zone (clear all data, reset schema) | Nuclear options, kept in dev screen only |
| Sync logs tab | Developer debugging |
| Cloud storage orphan comparison | Developer maintenance |
| Schema version display | Internal implementation detail |

---

## Module Structure

### `@trace/core` — Shared (mobile + web)

All Supabase interactions live here so both platforms reuse the same API layer.

```
packages/core/src/modules/dataManagement/
├── dataManagementApi.ts          # Supabase RPCs (internal, NOT exported)
│   ├── getCloudStorageUsage()    # RPC get_user_storage_usage
│   ├── getDeletedEntries()       # RPC get_deleted_entries
│   ├── getDeletedStreams()       # RPC get_deleted_streams
│   ├── getDeletedLocations()    # RPC get_deleted_locations
│   ├── restoreEntry(id)          # RPC restore_entry
│   ├── hardDeleteEntry(id)       # RPC hard_delete_entry
│   ├── hardDeleteStream(id)      # RPC hard_delete_stream
│   └── hardDeleteLocation(id)    # RPC hard_delete_location
├── dataManagementHooks.ts        # React Query hooks wrapping the RPCs
│   ├── useCloudStorageUsage()
│   ├── useDeletedEntries()
│   ├── useDeletedStreams()
│   ├── useDeletedLocations()
│   ├── useRestoreEntryMutation()
│   ├── useHardDeleteEntryMutation()
│   ├── useHardDeleteStreamMutation()
│   └── useHardDeleteLocationMutation()
├── DataManagementTypes.ts        # Shared types (StorageUsage, TrashEntry, etc.)
├── dataManagementHelpers.ts      # Byte formatter, threshold calcs (pure)
├── dataManagementHelpers.test.ts # Vitest unit tests
└── index.ts                      # Exports: hooks, types, helpers (NOT api)
```

### `apps/mobile` — Device-local only

SQLite queries and filesystem operations that only make sense on-device.

```
apps/mobile/src/modules/dataManagement/
├── mobileDataManagementApi.ts    # SQLite + filesystem queries (internal)
│   ├── getLocalStorageUsage()    # SQLite file size + local attachment sizes
│   ├── getLocalEntityCounts()    # SELECT COUNT(*) per table
│   ├── getPrivateCounts()        # Counts for is_localonly entries/streams/attachments
│   └── getPrivateStreams()       # Local-only streams with entry/attachment counts
├── mobileDataManagementHooks.ts  # Hooks composing core + local data
│   ├── useDeviceStorageUsage()   # Local-only storage numbers
│   ├── useDataInventory()        # Combines local counts + core cloud counts
│   └── usePrivacySummary()       # Local-only stream details
└── index.ts
```

### Screens (mobile only)

- `screens/DataManagementScreen.tsx` — main screen, delegates to section components
- `screens/TrashScreen.tsx` — separate screen, tabbed (Entries / Streams / Places), online-only

Section components (inside screen file or extracted as needed):
- `StorageDashboard` — hero storage visual with segmented bar
- `DataInventory` — 4 entity cards
- `PrivacySummary` — private streams callout
- `TrashSummary` — trash preview card with "View Trash" navigation
- `DataTools` — place hygiene tools + sync
- `AdvancedSection` — collapsible power-user tools

---

## New Supabase Migrations

| Migration | Purpose |
|-----------|---------|
| `get_user_storage_usage()` | Returns total cloud data + attachment bytes for user |
| `get_deleted_entries()` | Returns soft-deleted entries with title, stream name, attachment count |
| `get_deleted_streams()` | Returns soft-deleted streams with name, deleted_at |
| `get_deleted_locations()` | Returns soft-deleted places with name, deleted_at |
| `restore_entry(entry_id)` | Clears `deleted_at` on entry + its attachments; falls back to Inbox if stream is deleted |
| `hard_delete_entry(entry_id)` | Permanently deletes entry, attachments (DB + storage files) |
| `hard_delete_stream(stream_id)` | Permanently deletes stream record |
| `hard_delete_location(location_id)` | Permanently deletes place record |

---

## Implementation Order

### Phase A: Core library (`@trace/core`)

1. **Feature gate** — add `storage_limit_mb: { free: 200, pro: 2048 }` to `FEATURE_LIMITS` in `featureGates.ts`
2. **Types** — `DataManagementTypes.ts`: `StorageUsage`, `TrashEntry`, `TrashStream`, `TrashLocation`, `DataInventoryCounts`
3. **Helpers + tests** — `dataManagementHelpers.ts`: byte formatter (`formatBytes`), storage percentage, threshold warnings. Vitest tests.
4. **Supabase migration: storage** — `get_user_storage_usage()` RPC
5. **Supabase migration: trash queries** — `get_deleted_entries()`, `get_deleted_streams()`, `get_deleted_locations()` RPCs
6. **Supabase migration: trash actions** — `restore_entry()`, `hard_delete_entry()`, `hard_delete_stream()`, `hard_delete_location()` RPCs
7. **Core API** — `dataManagementApi.ts`: TypeScript wrappers for all RPCs above
8. **Core hooks** — `dataManagementHooks.ts`: React Query hooks wrapping the API (`useCloudStorageUsage`, `useDeletedEntries`, mutations, etc.)
9. **Core exports** — `index.ts` + add to `packages/core/src/index.ts`

### Phase B: Mobile device-local layer (`apps/mobile`)

10. **Mobile API** — `mobileDataManagementApi.ts`: SQLite file size, local counts, private counts
11. **Mobile hooks** — `mobileDataManagementHooks.ts`: compose core hooks + local queries

### Phase C: Mobile UI

12. **Storage Dashboard + Data Inventory** — sections 1-2 of the screen
13. **Privacy Summary** — section 3
14. **Trash screen** — tabbed trash with restore (entries) and delete (all types) — section 4
15. **Tools + Advanced** — carry over from old screen — sections 5-6
16. **Navigation** — add "Data" row to Profile > Manage menu, route to Data Management screen

### Phase D: Enforcement

17. **Upload gate** — block attachment uploads when cloud storage exceeds tier limit (in core, enforced by mobile + web)
