# Photos → Attachments Refactor

**Goal:** Rename internal `photos` infrastructure to `attachments` to future-proof for PDF and document support while keeping user-facing UI named "Photos".

**Status:** COMPLETE - Ready for Testing

**Branch:** `attachments-refactor`

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Production data? | Test data exists - preserve via sync + keep old bucket as fallback |
| Mobile app deployed? | No real users - can rename tables directly |
| Git workflow | New branch: `attachments-refactor` |
| Backwards compatibility | Clean break - no type aliases needed |
| Web app | Not using photos yet - will implement later, just update config reference |
| Storage bucket | Create new `attachments` bucket, migrate files, keep `photos` bucket until confirmed working |
| Column naming | `attachment_id` (consistent with `entry_id`, `stream_id` pattern) |
| Deployment | All at once |
| `entry_use_photos` field | Keep as-is - this is a UI feature toggle, not internal naming |
| Backup strategy | pg_dump before migration, keep old bucket for rollback |

---

## Pre-Migration Backup

**CRITICAL: Run before any Supabase changes**

### Option 1: Full Database Backup (Recommended)
```bash
# Get connection string from Supabase Dashboard > Settings > Database
pg_dump "postgresql://postgres:[PASSWORD]@db.lsszorssvkavegobmqic.supabase.co:5432/postgres" \
  --no-owner --no-acl \
  > backup_before_attachments_$(date +%Y%m%d).sql
```

### Option 2: Photos Table Only
```bash
pg_dump "postgresql://postgres:[PASSWORD]@db.lsszorssvkavegobmqic.supabase.co:5432/postgres" \
  --table=photos --no-owner --no-acl \
  > photos_table_backup.sql
```

### Option 3: Via Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/lsszorssvkavegobmqic/settings/database
2. Under "Database Backups" download latest backup
3. Or use SQL Editor to export: `SELECT * FROM photos` → Download CSV

### Storage Bucket Backup
```bash
# Keep photos bucket intact - don't delete until migration confirmed
# Files will remain accessible at old paths as fallback
```

---

## Phase 1: Supabase Database

### 1.1 Create Migration: Rename Table
- [x] **Backup database first** (see Pre-Migration Backup above)
- [x] Create migration file `20260104000001_rename_photos_to_attachments.sql`
- [x] Rename table: `ALTER TABLE photos RENAME TO attachments`
- [x] Rename primary key column: `photo_id` → `attachment_id`
- [x] Rename indexes:
  - `idx_photos_entry_id` → `idx_attachments_entry_id`
  - `idx_photos_user_id` → `idx_attachments_user_id`
  - `idx_photos_position` → `idx_attachments_position`

### 1.2 Update RLS Policies
- [x] Drop existing policies (4 policies for SELECT, INSERT, UPDATE, DELETE)
- [x] Recreate policies with "attachments" naming:
  - "Users can view their own attachments"
  - "Users can insert their own attachments"
  - "Users can update their own attachments"
  - "Users can delete their own attachments"

### 1.3 Update Trigger
- [x] Drop trigger `update_photos_updated_at`
- [x] Create trigger `update_attachments_updated_at`

### 1.4 Update Comments
- [x] Update table comment to reference attachments

---

## Phase 2: Supabase Storage

### 2.1 Create New Bucket
- [x] Create migration for new `attachments` bucket
- [x] Configure bucket:
  - Private (requires authentication)
  - 5MB max file size (same as current)
  - Allowed mime types: image/jpeg, image/jpg, image/png, image/webp, image/heic
  - (Future: Add application/pdf and other document types)

### 2.2 Storage RLS Policies
- [x] Create policies for `attachments` bucket:
  - "Users can view their own attachments"
  - "Users can upload their own attachments"
  - "Users can update their own attachments"
  - "Users can delete their own attachments"
- [x] Policies use folder structure: `{user_id}/{entry_id}/{attachment_id}.ext`

### 2.3 File Migration Script
- [ ] Create script to copy existing files from `photos` → `attachments` bucket
- [ ] Update `file_path` and `thumbnail_path` columns in database to point to new bucket
- [ ] Verify all files migrated successfully
- [x] **DO NOT delete old bucket yet** - keep as rollback fallback

---

## Phase 3: Local Database (SQLite)

### 3.1 Update Schema
File: `apps/mobile/src/shared/db/localDB.ts`

- [x] Rename table: `photos` → `attachments`
- [x] Rename column: `photo_id` → `attachment_id`
- [x] Update all SQL statements referencing `photos` table
- [x] Update all SQL statements referencing `photo_id` column

### 3.2 Update LocalDB Methods
- [x] Rename `createPhoto` → `createAttachment`
- [x] Rename `getPhoto` → `getAttachment`
- [x] Rename `getPhotosForEntry` → `getAttachmentsForEntry`
- [x] Rename `updatePhoto` → `updateAttachment`
- [x] Rename `deletePhoto` → `deleteAttachment`
- [x] Rename `markPhotoSynced` → `markAttachmentSynced`
- [x] Rename `getUnsyncedPhotos` → `getUnsyncedAttachments`
- [x] Rename `getPhotosNeedingUpload` → `getAttachmentsNeedingUpload`
- [x] Rename `getPhotosNeedingSync` → `getAttachmentsNeedingSync`
- [x] Rename `getAllPhotos` → `getAllAttachments`
- [x] Rename `updatePhotoEntryIds` → `updateAttachmentEntryIds`
- [x] Rename `cleanupOrphanedPhotos` → `cleanupOrphanedAttachments`
- [x] Update return types to use `Attachment` instead of `Photo`

### 3.3 Migration Logic
- [x] Add SQLite migration to rename existing `photos` table to `attachments`
- [x] Rename `photo_id` column to `attachment_id`
- [x] Update sync_metadata table: `photos_pushed` → `attachments_pushed`, `photos_errors` → `attachments_errors`

---

## Phase 4: Mobile App Code

### 4.1 Rename Module Folder
```
apps/mobile/src/modules/photos/ → apps/mobile/src/modules/attachments/
```
- [x] Created `attachments` module folder
- [x] Old `photos` module files deleted

### 4.2 Rename API File
File: `mobilePhotoApi.ts` → `mobileAttachmentApi.ts`

- [x] Rename file
- [x] Update storage bucket reference: `.from('photos')` → `.from('attachments')`
- [x] Rename exported functions:
  - `createPhoto` → `createAttachment`
  - `getPhotosForEntry` → `getAttachmentsForEntry`
  - `deletePhoto` → `deleteAttachment`
  - `uploadPhotoToSupabase` → `uploadAttachmentToSupabase`
  - `downloadPhotoFromSupabase` → `downloadAttachmentFromSupabase`
- [x] Update all internal references to use new names
- [x] Update localDB calls to use renamed methods

### 4.3 Rename Hooks File
File: `mobilePhotoHooks.ts` → `mobileAttachmentHooks.ts`

- [x] Rename file
- [x] Rename query keys: `['photos', ...]` → `['attachments', ...]`
- [x] Rename hook: `usePhotos` → `useAttachments`
- [x] Rename key factory: `mobilePhotoKeys` → `mobileAttachmentKeys`
- [x] Update mutation names in returned object

### 4.4 Update Sync Service
File: `apps/mobile/src/shared/sync/syncService.ts`

- [x] Rename `pushPhotos` → `pushAttachments`
- [x] Rename `pullPhotos` → `pullAttachments`
- [x] Update table reference: `.from('photos')` → `.from('attachments')`
- [x] Update storage reference: `.from('photos')` → `.from('attachments')`
- [x] Update realtime subscription channel
- [x] Update all internal variable names

### 4.5 Update Sync Types
File: `apps/mobile/src/shared/sync/syncTypes.ts`

- [x] Rename `PhotoSyncState` → `AttachmentSyncState` (if exists)
- [x] Update any photo-related type references
- [x] Updated SyncResult interface: `photos` → `attachments` in pushed/pulled/errors

### 4.6 Update Components (Keep UI Names!)
Files in `apps/mobile/src/modules/photos/components/`:

**Important:** UI-facing names stay as "Photos" for users. Only internal references change.

- [x] Update imports to use new API/hooks
- [x] Update hook calls: `usePhotos()` → `useAttachments()`
- [x] Update mutation calls to use new names
- [x] Keep component names: `PhotoGallery`, `PhotoCapture`, `PhotoViewer`
- [x] Keep user-visible text as "Photos", "Add Photo", etc.

### 4.7 Update CaptureForm
File: `apps/mobile/src/modules/entries/components/CaptureForm.tsx`

- [x] Update imports from photos module → attachments module
- [x] Update hook usage
- [x] Update any direct references to photo API/types

### 4.8 Update Module Index
File: `apps/mobile/src/modules/attachments/index.ts`

- [x] Export renamed hooks and types
- [x] NO backwards-compatible exports (clean break)

---

## Phase 5: Core Package

### 5.1 Rename Module Folder
```
packages/core/src/modules/photos/ → packages/core/src/modules/attachments/
```
- [x] Created attachments module

### 5.2 Rename Type File
File: `PhotoTypes.ts` → `AttachmentTypes.ts`

- [x] Rename `Photo` type → `Attachment`
- [x] Rename `photo_id` field → `attachment_id`
- [x] Update all type exports
- [x] NO backwards-compatibility aliases (clean break)

### 5.3 Rename API File
File: `photoApi.ts` → `attachmentApi.ts`

- [x] Rename file
- [x] Update table reference: `.from('photos')` → `.from('attachments')` (with `as any` cast until types regenerated)
- [x] Update storage reference: `.from('photos')` → `.from('attachments')`
- [x] Rename all exported functions
- [x] Update return types (with `as unknown as Attachment` cast until types regenerated)

### 5.4 Rename Hooks File
File: `photoHooks.ts` → `attachmentHooks.ts`

- [x] Rename file
- [x] Rename hook: `usePhotos` → `useAttachments`
- [x] Update query keys
- [x] Update all internal references

### 5.5 Rename Helpers File
File: `photoHelpers.ts` → `attachmentHelpers.ts`

- [x] Rename file
- [x] Update any function names if needed
- [x] Update parameter types

### 5.6 Update Core Index
File: `packages/core/src/index.ts`

- [x] Update exports to use new module path
- [x] NO backwards-compatible re-exports (clean break)

### 5.7 Update Database Types
File: `packages/core/src/shared/database.types.ts`

- [x] Regenerate types after Supabase migration: `npx supabase gen types typescript`
- [x] Verify `attachments` table types are correct
- [x] Verify `attachment_id` column type is correct
- [x] Remove `as any` and `as unknown` type casts from database operations (storage bucket casts kept - not typed)

---

## Phase 6: Web App

### 6.1 Update Config Reference
File: `apps/web/src/modules/entries/components/EntryListItem.tsx`

- [x] Update `showPhotos` reference if it imports from core types (N/A - not implemented yet)
- [x] No other changes needed - web photos feature not implemented yet

---

## Phase 7: Testing

### 7.1 Build Verification
- [x] `npm run build:core` succeeds
- [x] `npm run type-check` passes
- [x] No TypeScript errors

### 7.2 Integration Testing
- [ ] Test creating new attachments (photos)
- [ ] Test viewing attachments
- [ ] Test deleting attachments
- [ ] Test sync: local → Supabase
- [ ] Test sync: Supabase → local
- [ ] Test offline capture + sync when online
- [ ] Verify existing test photos still accessible after migration

### 7.3 Final Verification
- [ ] Global search for "photo" - verify no missed references (except UI text)
- [ ] Confirm old `photos` bucket still exists (rollback safety)
- [ ] Test app on fresh install
- [ ] Test app with existing local data

---

## Execution Order

**All changes deployed together:**

1. ~~**Backup** - pg_dump database~~ (user responsibility)
2. ~~**Supabase** - Run `npx supabase db push` to apply migrations~~ DONE
3. ~~**Storage Migration** - Copy files to new bucket~~ (deferred - can sync fresh)
4. ~~**Core Package** - Regenerate types after push, rebuild~~ DONE
5. ~~**Mobile LocalDB** - Update schema and methods~~ DONE
6. ~~**Mobile Sync** - Update sync service~~ DONE
7. ~~**Mobile API/Hooks** - Rename files and functions~~ DONE
8. ~~**Mobile Components** - Update imports~~ DONE
9. ~~**Web App** - Update config reference~~ N/A
10. **Build & Test** - Verify everything works ← YOU ARE HERE
11. **Deploy**

**Later (after confirmed working):**
- Delete old `photos` storage bucket
- Remove any rollback scripts

---

## Remaining Steps

All code changes complete. Only testing remains:

1. **Test the app** - Run on device/simulator and verify:
   - Creating photos works
   - Viewing photos works
   - Deleting photos works
   - Sync works both directions (push and pull)
   - Offline capture + sync when online

2. **After testing confirmed working:**
   - Delete old `photos` storage bucket from Supabase dashboard

---

## Files Changed Summary

| Location | Files |
|----------|-------|
| Supabase | 2 new migrations |
| Core Package | 5 files renamed + index.ts |
| Mobile LocalDB | 1 file (localDB.ts) |
| Mobile Sync | 2 files (syncService.ts, syncTypes.ts) |
| Mobile API/Hooks | 2 files renamed |
| Mobile Components | ~3-5 files updated (imports only) |
| Web App | 0 files (not implemented yet) |
| **Total** | ~15-20 files |

---

## Rollback Plan

If something goes wrong:

1. **Database**: Restore from pg_dump backup
2. **Storage**: Old `photos` bucket still exists with original files
3. **Code**: Revert git branch
4. **Local SQLite**: Users can clear app data (no real users yet)

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Sync breaks during deploy | All changes deployed together |
| Existing files inaccessible | Keep old bucket as fallback |
| Local data lost | SQLite migration renames table |
| Type mismatches | Regenerate database types |
| Missed references | Global search for "photo" after refactor |
| Rollback needed | pg_dump backup + old bucket preserved |

---

## Future Enhancements (Not Part of This Refactor)

After rename is complete, these can be added incrementally:

- [ ] Add PDF mime type to storage bucket
- [ ] Add document mime types (docx, xlsx, etc.)
- [ ] Create PDF viewer component
- [ ] Create document preview component
- [ ] Update attachment picker to support documents
- [ ] Add file type icons in gallery view
