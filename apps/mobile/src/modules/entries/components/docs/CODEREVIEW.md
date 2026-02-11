# Code Review: Entry Management Refactor

**Date:** 2026-02-11
**Status:** In Progress
**Reviewer:** Claude Opus 4.5

## 🎯 Goal

**Replace `EntryScreen.tsx` with `EntryManagementScreen.tsx` as the primary entry editor.**

### Architectural Decisions

1. **Direct state over Context** - `EntryManagementScreen` uses direct `useState` instead of `EntryFormContext`. This is simpler to debug and follow.

2. **Refs for cross-component communication** - Instead of Context for sharing callbacks between parent and child components (like editor), we use refs (e.g., `handleAutosaveRef`). This avoids the re-render cascade that Context causes.

3. **Existing Context-based hooks are obsolete** - Hooks like `useGpsCapture.ts`, `useAutoGeocode.ts`, and `useAutosave.ts` were written for `EntryFormContext`. They need to be either:
   - Rewritten to accept props/parameters (preferred)
   - Or deleted and logic kept inline until extraction

4. **EntryScreen.tsx will be deprecated** - Once `EntryManagementScreen` is fully working and cleaned up, the old `EntryScreen` and `EntryFormContext` can be removed.

---

## Executive Summary

The codebase has significant uncommitted changes (~3,525 additions, ~623 deletions across 48 files) focused on:
1. A new `EntryManagementScreen` as a refactored entry editor
2. A new singleton-based navigation system (`NavigationService`)
3. Supporting hooks and components

The navigation migration is **complete** - all screens now use `useNavigate()` from the new system. However, there are several issues that need to be addressed before merging.

---

## Critical Issues

### 1. Component Size Violation: EntryManagementScreen

**File:** `EntryManagementScreen.tsx`
**Lines:** 1,168
**Limit:** 300 lines max per CLAUDE.md

**Impact:** Hard to maintain, debug, and test. Risk of stale closures and subtle bugs.

**NOTE:** All new hooks must use **props/refs pattern**, NOT Context. Pass state and callbacks as parameters.

- [x] **1.1** Extract GPS/geocode/template effects into a new hook: `useEntryManagementEffects.ts`
  - GPS auto-capture effect
  - Auto-geocode effect
  - Stream templates effect
  - **Pattern:** Accept `entry`, `updateEntryField`, `settings`, etc. as parameters
  - **Actual size:** 311 lines (includes full documentation)
  - **Renamed:** from `useEntryEffects.ts` to `useEntryManagementEffects.ts` for clarity

- [x] **1.2** Extract picker handlers into `useEntryManagementPickers.ts`
  - All `handleXxxPress` functions (date, time, stream, status, rating, priority, location, dueDate, more)
  - All `handleXxxChange` functions (entryDate, includeTime, type, stream, status, rating, priority, dueDate, locationSelect)
  - Includes `EntryPickerType` type definition
  - **Pattern:** Accept `setActivePicker`, `updateEntryField`, `setEntry` as parameters
  - **Actual size:** 271 lines
  - **Screen reduction:** 940 → 806 lines (-134 lines)

- [x] **1.3** Extract entry options handlers into `useEntryActions.ts` (NEW HOOK)
  - `handlePinToggle`
  - `handleArchiveToggle`
  - `handleDuplicate`
  - `handleDelete`
  - **Note:** Created separate hook instead of adding to `useEntryManagement.ts` to avoid conflict with item 2 (which aims to slim down useEntryManagement to save-only)
  - **Pattern:** Accept `entry`, `setEntry`, `handleSave`, `loadEntryById` callback as parameters
  - **Actual size:** 137 lines
  - **Screen reduction:** 806 → 778 lines (-28 lines, added loadEntryById callback)

- [~] **1.4** ~~Extract remaining header handlers into a small hook~~ **SKIPPED**
  - `handleBack`, `handleToggleFullScreen` - simple 5-line functions
  - **Reason:** Minimal savings (~23 lines), adds indirection for no benefit
  - These handlers are tightly coupled to screen UI state, easier to understand inline

**Target:** EntryManagementScreen should be ~300 lines (render + simple state)

---

### 2. Hook Size Violation: useEntryManagement

**File:** `hooks/useEntryManagement.ts`
**Lines:** 654
**Limit:** Should be focused on one responsibility

**Impact:** Complex, hard to test, mixing multiple concerns.

**NOTE:** This hook already uses the correct **props/refs pattern** (not Context). Extraction should maintain this approach.

- [x] **2.1** Extract autosave logic into `useEntryAutosave.ts`
  - Dual-timer autosave (2s debounce + 30s max wait)
  - Timer refs and clearAllTimers helper
  - **Pattern:** Accept `entry`, `isDirty`, `isSaving`, `handleAutosave` as parameters
  - **Actual size:** 138 lines
  - **Hook reduction:** 654 → 575 lines (-79 lines)

- [x] **2.2** Extract sync subscription into `useEntrySyncSubscription.ts`
  - Sync subscription effect and `isExternalUpdate` helper
  - **Pattern:** Accept `entryId`, `setEntry`, `setOriginalEntry`, version refs as parameters
  - **Actual size:** 247 lines
  - **Hook reduction:** 575 → 408 lines (-167 lines)

- [x] **2.3** Keep `useEntryManagement.ts` focused on save logic only
  - `performSave`, `handleSave`, `handleAutosave`
  - Version initialization and refs (shared with sync subscription)
  - **Final size:** 408 lines (target was ~200, but save logic is complex with attachments)

---

### 3. Parallel Entry Screens Need Resolution

**Files:**
- `EntryScreen.tsx` (857 lines) - Old screen using `EntryFormContext` - **TO BE DEPRECATED**
- `EntryManagementScreen.tsx` (1,168 lines) - New screen with direct state - **KEEPING**

**Impact:** Two screens doing the same thing with different patterns = confusion, bugs, maintenance burden.

- [x] **3.1** Decide which screen to keep ~~(recommend: `EntryManagementScreen` pattern)~~
  - **DECIDED:** Keep `EntryManagementScreen` with direct state + refs pattern
  - Old `EntryScreen` + `EntryFormContext` will be deprecated after cleanup

- [x] **3.2** After cleanup complete, deprecate the old screen
  - `@deprecated` comment added to `EntryScreen.tsx`
  - `@deprecated` comment added to `EntryFormContext.tsx`
  - Remove from navigation once EntryManagementScreen is stable (pending)

- [x] **3.3** Mark obsolete Context-based hooks as deprecated
  - `useGpsCapture.ts` - marked @deprecated
  - `useAutoGeocode.ts` - marked @deprecated
  - `useAutosave.ts` - marked @deprecated
  - `useEntryPhotos.ts` - marked @deprecated
  - `useEntryNavigation.ts` - marked @deprecated
  - Deletion deferred until EntryScreen is removed

---

## Medium Priority Issues

### 4. Missing Memoization: isDirty Calculation

**File:** `EntryManagementScreen.tsx`, lines 155-187

- [x] **4.1** Wrap in `useMemo` with proper dependencies `[entry, originalEntry]`

---

### 5. Excessive Logging Verbosity

- [x] **5.1** Downgraded routine logs to `log.debug`:
  - EntryManagementScreen: edit mode, keyboard, loadEntry timing
  - useEntryManagementEffects: geocoding, templates
  - useEntrySyncSubscription: version change, editor push
  - useEntryManagementPhotos: processing, camera/gallery open
  - useEntryActions: pre-duplicate save

- [x] **5.2** Kept `log.info` for significant operations:
  - Entry create/update/delete
  - GPS capture results
  - Auto-save triggers
  - Photo add/delete results
  - External sync updates

---

### 6. ~~Duplicate buildLocationFromEntry~~

**Status:** ✅ Completed

**Files:**
- `EntryManagementScreen.tsx` - now imports from helper
- `hooks/useEntryManagement.ts` - now imports from helper

**Issue:** Same function defined in two places.

- [x] **6.1** Moved to shared location: `helpers/entryLocationHelpers.ts` (35 lines)
- [x] **6.2** Both files now import from the shared helper

---

### 7. ~~Missing Type Safety for Picker State~~

**Status:** ✅ Completed as part of item 1.2

- [x] **7.1** `EntryPickerType` now defined and exported from `useEntryManagementPickers.ts`
  - Screen imports and uses the type: `const [activePicker, setActivePicker] = useState<EntryPickerType>(null);`

---

## Blocking Issues (Need Research)

### 11. Editor Undo History Not Clearing Between Entries

**Files:**
- `editor-web/AdvancedEditor.tsx`
- `components/editor/EditorWebBridge.tsx`
- `components/editor/RichTextEditorV2.tsx`

**Problem:** When switching between entries, the undo history persists. User can undo through ALL previously loaded entries.

**What we tried (didn't work):**
1. `editor.view.updateState(editor.createState())` - The "official" Tiptap approach from GitHub issues
2. Transaction with `addToHistory: false` - Only prevents NEW items, doesn't clear existing
3. Direct JS injection to WebView - Timing issues with TenTap bridge

**What we need:**
- [ ] **11.1** Research how ProseMirror history plugin actually stores state
- [ ] **11.2** Check if TenTap's `useTenTap` wraps the editor differently than standard Tiptap
- [ ] **11.3** Consider: maybe we need to destroy/recreate the editor component entirely
- [ ] **11.4** Alternative: accept the limitation and just disable undo when `canUndo` would go past current entry

**TenTap provides:** `editorState.canUndo` and `editorState.canRedo` via HistoryBridge

**Resources:**
- [Tiptap Issue #491](https://github.com/ueberdosis/tiptap/issues/491)
- [Tiptap Issue #600](https://github.com/ueberdosis/tiptap/issues/600)
- ProseMirror history plugin source code

---

## Low Priority / Nice to Have

### 8. ~~Dead Code: NavigationContext~~

**Status:** ✅ Completed

**File:** `shared/contexts/NavigationContext.tsx` - deleted

- [x] **8.1** File verified deleted (no longer exists)
- [x] **8.2** No lingering imports found in codebase

---

### 9. ~~Inconsistent Error Handling~~

**Status:** ✅ Already follows pattern

**Files reviewed:** `useEntryManagement.ts`, `useEntryActions.ts`, `useEntryManagementPhotos.ts`, `useEntrySyncSubscription.ts`

- [x] **9.1** Pattern verified - new code already follows:
  - **Destructive actions** (delete): `Alert.alert` for confirmation ✓
  - **Errors** (save/photo/delete failed): `Alert.alert` ✓
  - **Success notifications** (saved, pinned, duplicated): `showSnackbar` ✓
  - **Transient warnings** (sync updates): `showSnackbar` ✓

---

### 10. ~~Comments Need Cleanup~~

**Status:** ✅ Completed

**File:** `EntryManagementScreen.tsx`

- [x] **10.1** Updated header comment to describe architecture and delegated hooks
- [x] **10.2** Removed phase markers

---

## Completed Items

### Architecture Decisions
- [x] **3.1** Decided to keep `EntryManagementScreen` (direct state + refs pattern)
- [x] Old `EntryScreen` + `EntryFormContext` marked for deprecation
- [x] All deprecated files marked with `@deprecated` JSDoc comments

### Deprecated Files (to be deleted after migration)

All files below have been marked with `@deprecated` comments and will be removed once `EntryManagementScreen` is stable:

**Screens & Components:**
| File | Replaced By |
|------|-------------|
| `EntryScreen.tsx` | `EntryManagementScreen.tsx` |
| `RichTextEditor.tsx` | `RichTextEditorV2.tsx` |

**Context (no longer needed):**
| File | Reason |
|------|--------|
| `context/EntryFormContext.tsx` | Direct state in `EntryManagementScreen` |

**Hooks (use EntryFormContext - obsolete pattern):**
| File | Replaced By |
|------|-------------|
| `hooks/useGpsCapture.ts` | Inline in `EntryManagementScreen` (TBD: extract with props pattern) |
| `hooks/useAutoGeocode.ts` | Inline in `EntryManagementScreen` (TBD: extract with props pattern) |
| `hooks/useAutosave.ts` | `useEntryManagement.ts` (refs pattern) |
| `hooks/useEntryPhotos.ts` | `useEntryManagementPhotos.ts` (props pattern) |
| `hooks/useEntryNavigation.ts` | Inline in `EntryManagementScreen` |

**Still in use (NOT deprecated):**
- `hooks/useKeyboardHeight.ts` - Used by both old and new screens
- `hooks/useEntryManagement.ts` - New pattern (refs) - save logic only
- `hooks/useEntryAutosave.ts` - New pattern (props) - autosave timer management
- `hooks/useEntrySyncSubscription.ts` - New pattern (props) - external update detection
- `hooks/useEntryManagementPhotos.ts` - New pattern (props) - photo operations
- `hooks/useEntryManagementEffects.ts` - New pattern (props) - GPS, geocode, templates
- `hooks/useEntryManagementPickers.ts` - New pattern (props) - picker press/change handlers
- `hooks/useEntryActions.ts` - New pattern (props) - pin, archive, duplicate, delete
- `helpers/entryVisibility.ts` - Used by both
- `helpers/entrySaveHelpers.ts` - Used by both

### Navigation Migration
- [x] Created `NavigationService.ts` singleton pattern
- [x] Created navigation hooks (`useNavigate`, `useGoBack`, `useActiveScreen`, etc.)
- [x] Migrated all 20+ screens to new navigation system
- [x] Old `NavigationContext` no longer imported anywhere

### Editor Improvements
- [x] Implemented `setContentAndClearHistory` to fix undo-to-blank issue
- [x] Added theme change detection for preloaded editor CSS updates
- [x] Delete functionality implemented in EntryManagementScreen

---

## Verification Steps

Before marking items complete:

1. **After hook extraction:**
   ```bash
   npm run type-check:mobile
   ```

2. **After component changes:**
   - Test entry create flow
   - Test entry edit flow
   - Test all pickers
   - Test undo/redo
   - Test theme switching
   - Test GPS capture

3. **Final verification:**
   ```bash
   npm run test:run
   npm run type-check:mobile
   ```

---

## Recommended Order of Operations

1. **Phase 1: Critical size issues**
   - Items 1.1 - 1.4 (split EntryManagementScreen into focused hooks)
   - Items 2.1 - 2.3 (split useEntryManagement into focused hooks)
   - Item 3.3 (delete obsolete Context-based hooks)

2. **Phase 2: Clean up**
   - Items 4.1, 5.1-5.2, 6.1-6.2 (memoization, logging, dedup)
   - Items 7.1, 8.1-8.2 (types, dead code)

3. **Phase 3: Deprecate old screen**
   - Item 3.2 (mark EntryScreen and EntryFormContext as deprecated)
   - Final cleanup and removal when stable

---

## Metrics

| Metric | Current | Target |
|--------|---------|--------|
| EntryManagementScreen lines | 761 | ~300 |
| useEntryManagement lines | 386 | ~200 |
| useEntryAutosave lines | 138 | - |
| useEntrySyncSubscription lines | 247 | - |
| useEntryActions lines | 137 | - |
| entryLocationHelpers lines | 39 | - |
| Total hooks in screen component | ~18 | ~10 |
| Parallel entry screens | 2 | 1 |

---

*Last updated: 2026-02-11*
