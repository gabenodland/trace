# EntryManagementScreen Feature Checklist

This document tracks features from the old EntryScreen/EntryFormContext system that must be preserved when migrating to EntryManagementScreen.

## Status Legend
- [ ] Not implemented
- [x] Implemented
- [~] Partially implemented

---

## 1. Snackbar/Toast System (IMPLEMENTED)
- [x] `showSnackbar(message)` function via useSnackbar hook
- [x] snackbarMessage state
- [x] snackbarOpacity animated value
- [x] Shows for 2.5s then fades out over 300ms
- [x] Positioned at top of screen (same as old system)

---

## 2. Dirty Tracking
- [x] Compare entry to originalEntry for isDirty
- [x] Compare 15 editable fields
- [x] isDirty visual indicator in header (orange dot)
- [ ] isFormDirty = isDirty OR photo count changed from baseline

---

## 3. Autosave System (useEntryManagement - IMPLEMENTED)
- [x] Dual-timer: 2-second debounce + 30-second max wait
- [x] Conditions: isDirty AND !isSaving AND hasContent
- [x] Silent failure (no error alerts in autosave path)
- [x] Triggers after content changes (via contentKey tracking)
- [x] Integrated in useEntryManagement hook

---

## 4. Version/Sync Conflict Detection (MVP: LAST WRITE WINS)
- [x] knownVersionRef tracks loaded version (in useEntryManagement)
- [x] initializeVersion() on first load
- [x] incrementKnownVersion() after successful save (via version update in performSave)
- [x] recordSaveTime() to detect recent save being overwritten

**MVP Decision:** Using "last write wins" - no pre-save conflict blocking. Post-save notifications implemented.

---

## 5. External Sync Update Handling (IMPLEMENTED - useEntryManagement)
When entry updates from another device (via realtime/sync):
- [x] Skip sync processing while save is in-flight (race condition protection)
- [x] If isDirty: show snackbar "Entry updated by {device} - you have unsaved changes"
- [x] If !isDirty: update form data from server, set new baseline
- [x] If !isDirty: exit edit mode, blur editor, show snackbar "Entry updated by {device}"
- [x] If recently saved and overwritten: show Alert dialog for sync conflict warning

---

## 6. Conflict Resolution (DEFERRED - Post-MVP)
Pre-save conflict detection with 4-option Alert:
- [ ] Option 1: "Keep My Changes" - overwrite server version
- [ ] Option 2: "Discard My Changes" - load server version
- [ ] Option 3: "Save as Copy" - create new entry with local content
- [ ] Option 4: "Cancel" - dismiss dialog, keep editing

**Deferred:** MVP uses last write wins with post-hoc notifications (section 5).

---

## 7. Save Flow (useEntryManagement hook - IMPLEMENTED)
- [x] Extract tags from content via extractContentMetadata()
- [x] Extract mentions from content via extractContentMetadata()
- [ ] Capture GPS if enabled and no location set (via captureGpsOnSave())
- [ ] Auto-geocode if coordinates but no address
- [x] Process pending photos for new entries (path swap)
- [x] Update entry via updateEntry() or create via createEntry()
- [x] Update version tracking after successful save
- [x] Mark form clean after save (update originalEntry)
- [ ] Update baseline photo count after save

---

## 8. Back Navigation (IMPLEMENTED)
- [x] If dirty: auto-save then navigate back
- [x] If new entry with no content: discard silently (hasUserContent check in save)
- [x] If new entry with content: auto-save as new entry
- [x] Keyboard dismiss before navigation
- [x] Editor blur before navigation
- [x] Navigate to 'back' via NavigationService
- [x] Save on visibility change (swipe back, navigate away) when dirty

---

## 9. Photo/Attachment Handling
- [x] handleTakePhoto - camera capture
- [x] handleGallery - gallery picker
- [x] handleDeletePhoto - delete photo
- [x] photoCount tracking
- [ ] baselinePhotoCount for dirty tracking
- [ ] pendingPhotos array for new entries before first save
- [ ] externalRefreshKey to force PhotoGallery refresh on external changes
- [x] PhotoGallery component integration

### New Entry Photo Flow (PARTIALLY IMPLEMENTED):
Current `useEntryManagementPhotos` saves to local storage immediately.
Path swap on save is handled in `useEntrySave`:
1. [x] Save photos to local storage with temp entry_id path
2. [ ] Track in pendingPhotos array (don't save to DB yet) - currently saves to entry.attachments
3. [x] PhotoGallery displays attachments from entry
4. [x] On entry save: get real entry_id first
5. [x] For each pending photo: move file to new path with real entry_id
6. [x] Create attachment records with real entry_id
7. [x] Clear handled via state update

### Existing Entry Photo Flow (WORKS):
- [x] Save to DB immediately on add
- [x] Delete from DB immediately on delete

---

## 10. GPS/Location
- [x] Location picker integration
- [x] handleLocationSelect with batched field updates
- [x] buildLocationFromEntry() helper
- [x] Auto GPS capture on new entry load if setting enabled
- [x] Auto geocode if coordinates but no address (with saved location snapping)
- [x] geocode_status tracking (snapped/success/no_data/error)

---

## 11. Edit Mode Management
- [x] isEditMode state
- [x] isFullScreen state
- [x] Enter edit mode via keyboard show event (not overlay tap)
- [x] Exit edit mode via Done button
- [x] Exit edit mode when screen hidden (swipe back)
- [ ] editModeInitialContent for cursor stability

---

## 12. Entry Date/Time
- [x] entryDate state (derived from entry.entry_date)
- [x] includeTime derived from date format (has 'T' = includes time)
- [x] handleEntryDateChange
- [x] handleIncludeTimeChange with removingTimeRef coordination
- [x] DatePicker integration
- [x] TimePicker integration

---

## 13. Attribute Management
- [x] Stream picker
- [x] Status picker
- [x] Rating picker
- [x] Priority picker
- [x] Due date picker
- [x] Type picker
- [x] Location picker
- [x] Pin toggle
- [x] Archive toggle

---

## 14. State Management Architecture
Current EntryManagementScreen uses:
- [x] Local useState for entry
- [x] Local useState for originalEntry
- [x] Local isDirty computed inline
- [x] Subscribe to React Query cache for sync updates
- [x] Single unified hook: useEntryManagement (save + autosave + sync in one hook, shared version tracking)

---

## 15. Header Indicators
- [x] isDirty orange dot when unsaved
- [x] isSaving red dot when saving
- [x] showSavedCheck green checkmark briefly after save
- [x] Actual save state tracking (from useEntrySave)

---

## 16. Stream Templates
- [x] Apply title template when stream selected on new entry (if title blank)
- [x] Apply content template when stream selected on new entry (if content blank)
- [x] Apply default status when stream selected on new entry

### Deferred (Never Built in Old System):
- [ ] "Save as Template" prompt on back navigation

---

## Progress Summary

### COMPLETED:
1. Snackbar system
2. Dirty tracking (entry fields)
3. Autosave (dual-timer)
4. Save flow (create/update with tags, mentions, location)
5. Back navigation with auto-save
6. Version tracking
7. Header indicators
8. External sync update handling (unified in useEntryManagement hook)
9. Photo handling (add/delete for existing entries, path swap for new entries)
10. All pickers (stream, status, rating, priority, due date, type, location)
11. Edit mode management (enter/exit, visibility handling)
12. Entry date/time handling
13. GPS auto-capture on new entry load (setting-dependent)
14. Auto-geocode with saved location snapping
15. Stream templates (title, content, default status)

### REMAINING FOR MVP:
None - core functionality complete.

### DEFERRED (Post-MVP):
1. Pre-save conflict detection with 4-option Alert
2. "Save as Template" prompt on back navigation (never built in old system)
3. baselinePhotoCount for photo-only dirty tracking (attachments embedded in EntryWithRelations)
