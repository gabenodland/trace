# Sync Code Review - Issues Found

**Reviewed:** 2025-12-02
**Files Reviewed:**
- `apps/mobile/src/shared/sync/syncQueue.ts`
- `apps/mobile/src/shared/db/localDB.ts`
- `apps/mobile/src/modules/entries/mobileEntryApi.ts`
- `apps/mobile/src/modules/photos/mobilePhotoApi.ts`

---

## Critical Issues

### 1. No Conflict Resolution for Categories/Locations
**Location:** `syncQueue.ts:831-952`

Entry sync has version-based conflict detection (lines 703-759), but category and location sync do not, despite having conflict resolution fields in the database schema:

```typescript
// Category sync just does upsert without version check
const { error } = await supabase
  .from('categories')
  .upsert(supabaseData, { onConflict: 'category_id' });
```

**Impact:** Potential data loss if category/location edited on multiple devices simultaneously.

---

## Medium Severity Issues

### 2. No Error Recording for Location Sync Errors
**Location:** `syncQueue.ts:333-345`

Unlike entries and categories, when location sync fails, the error is NOT recorded in the database:

```typescript
} catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`❌ Failed to push location ${location.location_id}:`, errorMessage);
  locationPushErrorCount++;
  // Will retry on next sync trigger ← No recordLocationSyncError() call
}
```

Compare to entries (line 368) which calls `localDB.recordSyncError()`.

**Impact:** Location sync errors are lost; no visibility for debugging.

---

### 3. Missing Incremental Sync for Categories
**Location:** `syncQueue.ts:1210-1308`

`pullCategoriesFromSupabase()` accepts `forceFullPull` and `pullStartTime` parameters but doesn't use them:

```typescript
private async pullCategoriesFromSupabase(forceFullPull: boolean, pullStartTime: Date): Promise<void> {
  // For categories, we always do a full pull since they're small and rarely change
```

**Impact:** Performance degradation if category count grows large.

---

### 4. Missing Incremental Sync for Locations
**Location:** `syncQueue.ts:1313-1417`

Same issue as categories - `pullLocationsFromSupabase()` ignores incremental sync parameters.

---

### 5. Photo Sync Log Fields Missing
**Location:** `localDB.ts:1455-1471`

The `addSyncLog` function INSERT statement is missing `photos_pushed` and `photos_errors` columns:

```typescript
await this.db.runAsync(
  `INSERT INTO sync_logs (
    timestamp, log_level, operation, message,
    entries_pushed, entries_errors, categories_pushed, categories_errors, entries_pulled
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,  // Missing photos_pushed, photos_errors
```

But the `details` object in `processQueue()` passes those fields.

**Impact:** Photo sync stats are silently discarded.

---

### 6. Inconsistent Timestamp Handling
**Location:** `syncQueue.ts:686-693` vs `syncQueue.ts:914-916`

Entry sync converts Unix timestamps to ISO strings:
```typescript
created_at: typeof entry.created_at === 'number'
  ? new Date(entry.created_at).toISOString()
  : entry.created_at,
```

But location sync passes timestamps directly:
```typescript
created_at: location.created_at,
updated_at: location.updated_at,
```

**Impact:** Potential type mismatch if timestamps are stored differently in SQLite vs Supabase.

---

### 7. No Retry Limit for Failed Syncs
**Location:** `syncQueue.ts:359-371`

Failed entries keep retrying indefinitely. While `sync_retry_count` is incremented in `localDB`, it's never checked:

```typescript
await localDB.recordSyncError(entry.entry_id, errorMessage);
pushErrorCount++;
// Will retry on next sync trigger ← No max retry check
```

**Impact:** Permanently broken entries will retry forever, wasting resources.

---

### 8. Singleton Class Pattern Violates Architecture
**Location:** `syncQueue.ts:14-1576` & `localDB.ts:12-1961`

Both `SyncQueue` and `LocalDatabase` use class-based singleton patterns, violating the project's stated architectural principle from CLAUDE.md: **"Functions Over Classes"**.

---

### 9. Potential Memory Issue in Photo Download
**Location:** `mobilePhotoApi.ts:476-523`

`downloadPhotosInBackground` loads all photos into memory:
```typescript
const allPhotos = await localDB.getAllPhotos();
```

**Impact:** For users with thousands of photos, this could cause memory issues.

---

## Low Severity Issues

### 10. Step Numbering Inconsistency
**Location:** `syncQueue.ts:295-625`

The step comments in `processQueue()` are out of order and have duplicates:
- STEP 1: Categories (line 295)
- STEP 1.5: Locations (line 325)
- STEP 2: Entries create/update (line 350)
- STEP 3: Photos upload (line 379)
- STEP 4: Entry deletes (line 549)
- STEP 5: Pull from Supabase (line 574)
- STEP 5: Background photo download (line 580) **duplicate**
- STEP 4: Cache invalidation (line 588) **duplicate/out of order**
- STEP 5: Log sync summary (line 599) **duplicate**

---

### 11. Excessive Debug Logging
**Location:** `syncQueue.ts:1423-1571`

`pullPhotosFromSupabase()` contains extensive verbose debug logging that should be reduced for production:

```typescript
console.log('📸 ========================================');
console.log('📸 STARTING PHOTO PULL SYNC');
console.log('📸 ========================================');
```

---

### 12. Pull Stats Never Tracked
**Location:** `syncQueue.ts:615-625`

The sync log records `entries_pulled: 0` hardcoded:
```typescript
entries_pulled: 0, // Pull stats not tracked yet
```

---

### 13. Race Condition in Realtime Handler
**Location:** `syncQueue.ts:138-155`

The debounce timer check doesn't account for syncs triggered by other means. If a sync finishes just as the debounce completes, changes might be missed.

---

### 14. Missing Location Cleanup
**Location:** `syncQueue.ts:177-235`

`cleanupWrongUserData()` cleans entries, categories, and photos, but not locations when switching users.

---

### 15. Hardcoded Upload Params
**Location:** `mobilePhotoApi.ts:349-353`

Photo uploads always use `contentType: 'image/jpeg'` even if original is PNG/HEIC, and `upsert: false` which will fail if re-uploading.

---

## Summary Table

| # | Issue | Severity | File | Lines |
|---|-------|----------|------|-------|
| 1 | No conflict resolution (categories/locations) | **High** | syncQueue.ts | 831-952 |
| 2 | No error recording (locations) | Medium | syncQueue.ts | 333-345 |
| 3 | No incremental sync (categories) | Medium | syncQueue.ts | 1210-1308 |
| 4 | No incremental sync (locations) | Medium | syncQueue.ts | 1313-1417 |
| 5 | Photo sync log fields missing | Medium | localDB.ts | 1455-1471 |
| 6 | Inconsistent timestamp handling | Medium | syncQueue.ts | 686-693, 914-916 |
| 7 | No retry limit | Medium | syncQueue.ts | 359-371 |
| 8 | Singleton class pattern | Medium | Both files | N/A |
| 9 | Memory issue in photo download | Medium | mobilePhotoApi.ts | 476-523 |
| 10 | Step numbering inconsistency | Low | syncQueue.ts | 295-625 |
| 11 | Excessive debug logging | Low | syncQueue.ts | 1423-1571 |
| 12 | Pull stats never tracked | Low | syncQueue.ts | 615-625 |
| 13 | Race condition in realtime | Low | syncQueue.ts | 138-155 |
| 14 | Missing location cleanup | Low | syncQueue.ts | 177-235 |
| 15 | Hardcoded upload params | Low | mobilePhotoApi.ts | 349-353 |

---

## Recommendations

1. **Implement conflict resolution for categories and locations** - Apply the same version-based approach used for entries
2. **Add `recordLocationSyncError()` function** - Parity with entries/categories
3. **Add retry limits** - Skip items after N failed attempts (e.g., 5)
4. **Fix sync log INSERT** - Add missing photo columns
5. **Clean up step comments** - Renumber consistently
6. **Add incremental sync for categories/locations** - Use `updated_at > last_pull_timestamp`
7. **Add location cleanup** - Include locations in `cleanupWrongUserData()`
8. **Consider refactoring to functions** - Align with architecture principles (lower priority)
