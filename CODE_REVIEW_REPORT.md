# Trace Codebase Review Report

**Date:** December 1, 2025
**Reviewer:** Claude Opus 4.5
**Scope:** Full codebase analysis for pattern compliance, code quality, and maintainability

---

## Executive Summary

| Metric | Value | Status |
|--------|-------|--------|
| Total Files | 137 | - |
| Total Lines | 35,636 | - |
| Module Compliance | 5/6 (83%) | ⚠️ |
| Anti-Pattern Violations | 0 | ✅ |
| Critical File Size Issues | 2 | 🔴 |
| Components with Excessive Hooks | 3 | ⚠️ |
| Direct API Imports in Components | 11 | ⚠️ |

**Overall Health: GOOD with actionable improvements needed**

---

## 1. Critical Issues (Priority: HIGH)

### 1.1 🔴 CaptureForm.tsx - Severely Oversized Component

**File:** `apps/mobile/src/modules/entries/components/CaptureForm.tsx`
**Lines:** 2,651
**Hook Calls:** 52+ (useState, useRef, useEffect, useMemo, useCallback)

**Problems:**
- **52+ hook calls** in a single component (recommended: <15)
- **40+ useState declarations** tracking form state
- **7 useRef declarations** for various DOM/component references
- Component handles: form state, photos, location, categories, dates, ratings, priorities, status, navigation, keyboard, animations, and more

**Impact:**
- Extremely difficult to maintain and debug
- High cognitive load for developers
- Performance concerns with so many state updates
- Testing is nearly impossible in isolation

**Root Cause:** CaptureForm follows the AI-generated anti-pattern of individual useState per field AND fetches its own data. Per CLAUDE.md Form Component Pattern, forms should:
1. NOT fetch their own data (parent should pass entry as prop)
2. Use ONE useState for the entire entry object, not 40+ individual useState calls
3. Return edited data via `onSave(editedEntry)` callback

**Recommended Refactor (per CLAUDE.md Form Component Pattern + Component Size Limits):**

**Step 1: Fix Data Ownership**
```typescript
// BEFORE (wrong): CaptureForm fetches its own data
function CaptureForm({ entryId }: Props) {
  const { entry } = useEntry(entryId);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  // ... 40+ more useState calls ...
}

// AFTER (correct): Parent fetches, form receives entry
function EntryScreen({ entryId }: Props) {
  const { entry } = useEntry(entryId);
  const { entryMutations } = useEntries();

  return (
    <CaptureForm
      entry={entry}
      onSave={(editedEntry) => entryMutations.updateEntry(entryId, editedEntry)}
      onCancel={() => navigate("inbox")}
    />
  );
}

function CaptureForm({ entry, onSave, onCancel }: Props) {
  // ONE state for entire entry
  const [formData, setFormData] = useState(entry);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
}
```

**Step 2: Split into Sub-Components**
```
CaptureForm/
├── CaptureForm.tsx               # Main orchestrator (~150-200 lines)
├── hooks/
│   └── useCaptureFormPhotos.ts   # Photo handling only (not form state!)
├── components/
│   ├── CaptureFormHeader.tsx
│   ├── CaptureFormContent.tsx    # Title + RichTextEditor
│   ├── CaptureFormMetadata.tsx   # Rating, priority, status, dates
│   ├── CaptureFormPhotos.tsx
│   ├── CaptureFormLocation.tsx
│   └── CaptureFormActions.tsx    # Bottom bar actions
└── index.ts
```

**CLAUDE.md Limits Violated:**
| Metric | Limit | Actual | Over By |
|--------|-------|--------|---------|
| Lines of code | ~300 | 2,651 | 8.8x |
| useState/useRef | ~10 | 47 | 4.7x |
| Total hooks | ~15 | 52+ | 3.5x |

### 1.2 🔴 Settings Module Incomplete

**Location:** `packages/core/src/modules/settings/`
**Current Files:** `SettingsTypes.ts`, `settingsHelpers.ts`, `index.ts`
**Missing:** `settingsApi.ts`, `settingsHooks.ts`

**Impact:**
- No React Query hooks for settings persistence
- Cannot follow the unified hook pattern
- Settings changes may not sync properly

**Recommendation:** Implement the missing files following the established pattern.

---

## 2. Major Issues (Priority: MEDIUM)

### 2.1 ⚠️ Components Directly Importing API Functions

The CLAUDE.md states that API functions should NOT be directly imported by components - they should go through hooks. Found **11 violations**:

| File | Importing From | Functions |
|------|----------------|-----------|
| `CaptureForm.tsx` | `mobileLocationApi` | `createLocation`, `getLocationById` |
| `CaptureForm.tsx` | `mobilePhotoApi` | `compressPhoto`, `savePhotoToLocalStorage`, `deletePhoto` |
| `EntryListScreen.tsx` | `mobileLocationApi` | `getLocationById` |
| `EntryNavigator.tsx` | `mobileLocationApi` | `getLocationsWithCounts` |
| `PhotoCapture.tsx` | `mobilePhotoApi` | `capturePhoto`, `pickPhotoFromGallery` |
| `PhotoGallery.tsx` | `mobilePhotoApi` | `getPhotoUri`, `ensurePhotoDownloaded` |
| `DatabaseInfoScreen.tsx` | `mobilePhotoApi` | `deletePhotoFromLocalStorage` |
| `htmlRenderer.tsx` | `mobilePhotoApi` | `getPhotoUri` |
| `webViewHtmlRenderer.tsx` | `mobilePhotoApi` | `getPhotoUri` |

**Exception:** `syncQueue.ts` and `mobileLocationHooks.ts` importing APIs is correct (infrastructure/hooks layer).

**Recommendation:** Create proper hooks for these operations:
- `usePhotoOperations()` - for photo capture, compression, deletion
- `useLocationOperations()` - for location CRUD operations

### 2.2 ⚠️ Large Files Requiring Review

| File | Lines | Issue |
|------|-------|-------|
| `localDB.ts` | 1,961 | Acceptable - SQLite implementation requires this |
| `syncQueue.ts` | 1,576 | Acceptable - sync orchestration is complex |
| `DatabaseInfoScreen.tsx` | 1,794 | Debug screen - consider feature-flagging |
| `CalendarScreen.tsx` | 954 | 26 hook calls - could split into sub-components |
| `LocationBuilderScreen.tsx` | 944 | Complex but focused |
| `useLocationPicker.ts` | 777 | 34 hook calls - acceptable for extracted hook |
| `EntryNavigator.tsx` | 741 | Navigation logic - acceptable |

### 2.3 ⚠️ Components Exceeding CLAUDE.md Limits

Per CLAUDE.md: Max ~300 lines, ~10 useState/useRef, ~15 total hooks

| Component | Lines | Hooks | Status |
|-----------|-------|-------|--------|
| `CaptureForm.tsx` | 2,651 | 52+ | 🔴 Critical - 8.8x over line limit |
| `CalendarScreen.tsx` | 954 | 26 | ⚠️ Over limits - extract `useCalendarState()` |
| `useLocationPicker.ts` | 777 | 34 | ✅ OK - this IS the extracted hook |
| `LocationBuilderScreen.tsx` | 944 | ~20 | ⚠️ Borderline - consider splitting |

**Note:** Extracted hooks (like `useLocationPicker.ts`) are allowed to exceed component limits since they ARE the extracted logic.

---

## 3. Module Structure Compliance

### ✅ Fully Compliant Modules (5/6)

| Module | Api | Hooks | Types | Helpers | Index |
|--------|-----|-------|-------|---------|-------|
| auth | ✅ | ✅ | ✅ | ✅ | ✅ |
| categories | ✅ | ✅ | ✅ | ✅ | ✅ |
| entries | ✅ | ✅ | ✅ | ✅ | ✅ |
| locations | ✅ | ✅ | ✅ | ✅ | ✅ |
| photos | ✅ | ✅ | ✅ | ✅ | ✅ |

### ❌ Incomplete Module

| Module | Api | Hooks | Types | Helpers | Index |
|--------|-----|-------|-------|---------|-------|
| settings | ❌ | ❌ | ✅ | ✅ | ✅ |

---

## 4. Anti-Pattern Compliance

### ✅ No Service Classes
No `class XxxService` patterns found in core package.

### ✅ No Relative Imports to Core
No `from "../../../packages/core/src"` violations found.

### ✅ Proper Export Patterns
All modules correctly hide internal API functions and export only public hooks/types.

### ✅ Type Safety
- `database.types.ts` properly auto-generated from Supabase
- All modules have proper TypeScript type definitions
- Client-side fields properly excluded from database operations

---

## 5. File Size Distribution

```
Under 100 lines:   42 files (31%) ████████░░░░░░░░ Excellent
100-300 lines:     68 files (50%) ████████████████ Good
300-600 lines:     16 files (12%) ████░░░░░░░░░░░░ Acceptable
600-1000 lines:     7 files (5%)  ██░░░░░░░░░░░░░░ Review
Over 1000 lines:    4 files (3%)  █░░░░░░░░░░░░░░░ Concern
```

---

## 6. Platform-Specific Implementation

### Mobile (26,424 lines)
- ✅ Proper mobile-specific API variants (`mobileXxxApi.ts`)
- ✅ Proper mobile-specific hooks (`mobileXxxHooks.ts`)
- ✅ SQLite implementation for offline-first
- ✅ Sync queue for bidirectional sync

### Web (2,942 lines)
- ✅ Uses core hooks directly
- ✅ Simpler architecture (online-first)
- ✅ Tailwind CSS for styling

---

## 7. Recommendations Summary

### Immediate Actions (This Sprint)

1. **Refactor CaptureForm.tsx**
   - Split into 6-8 smaller components
   - Extract 3-4 custom hooks for state management
   - Target: Main component under 300 lines

2. **Complete Settings Module**
   - Add `settingsApi.ts` with CRUD operations
   - Add `settingsHooks.ts` with `useSettings()` unified hook

### Short-Term Actions (Next Sprint)

3. **Create Missing Hooks**
   - `usePhotoOperations()` for photo CRUD
   - `useLocationOperations()` for location CRUD
   - Update components to use hooks instead of direct API imports

4. **Refactor CalendarScreen.tsx**
   - Extract `useCalendarState()` hook
   - Split into `CalendarHeader`, `CalendarGrid`, `CalendarEntryList`

### Long-Term Considerations

5. **DatabaseInfoScreen.tsx** - Consider:
   - Feature-flagging for production builds
   - Splitting into separate debug modules

6. **Documentation**
   - Add JSDoc comments to complex hooks
   - Document the mobile-specific variant pattern

---

## 8. Positive Observations

1. **Strong Module Boundaries** - Clear separation between domains
2. **Consistent Naming** - File naming conventions followed throughout
3. **Type Safety** - Strong TypeScript usage across the codebase
4. **No Anti-Patterns** - No service classes or bad import patterns
5. **Good Hook Extraction** - `useLocationPicker.ts` is a good example of following CLAUDE.md's Custom Hook Extraction Pattern
6. **Offline-First Architecture** - Well-implemented SQLite + sync pattern
7. **Proper Data Fetching** - Screens fetch data, pass to children (per CLAUDE.md Data Fetching Location Guidelines)

---

## 9. Metrics by Package

| Package | Files | Lines | Largest File |
|---------|-------|-------|--------------|
| `packages/core` | 25 | 4,645 | `database.types.ts` (510) |
| `apps/mobile` | 85+ | 26,424 | `CaptureForm.tsx` (2,651) |
| `apps/web` | 25+ | 2,942 | `CaptureForm.tsx` (723) |

---

## 10. Action Items Checklist

### Per CLAUDE.md Component Size Limits

- [ ] **HIGH** Refactor `CaptureForm.tsx` (2,651 lines → ~200 lines)
  - [ ] **Step 1: Fix Data Ownership (per Form Component Pattern)**
    - [ ] Move data fetching to EntryScreen (parent)
    - [ ] Pass entry as prop to CaptureForm
    - [ ] Replace 40+ useState with single `useState(entry)`
    - [ ] Add `onSave(editedEntry)` callback pattern
  - [ ] **Step 2: Split into sub-components**
    - [ ] Extract `useCaptureFormPhotos.ts` hook (photo logic only)
    - [ ] Split into 6 sub-components (Header, Content, Metadata, Photos, Location, Actions)
- [ ] **MEDIUM** Refactor `CalendarScreen.tsx` (954 lines → ~300 lines)
  - [ ] Extract `useCalendarState()` hook
  - [ ] Split into `CalendarHeader`, `CalendarGrid`, `CalendarEntryList`
- [ ] **LOW** Review `LocationBuilderScreen.tsx` (944 lines)

### Per CLAUDE.md Module Structure

- [ ] **HIGH** Complete Settings module
  - [ ] Add `settingsApi.ts`
  - [ ] Add `settingsHooks.ts` with `useSettings()` unified hook

### Per CLAUDE.md Four-Layer Architecture

- [ ] **MEDIUM** Create `usePhotoOperations()` hook to wrap `mobilePhotoApi`
- [ ] **MEDIUM** Create `useLocationOperations()` hook to wrap `mobileLocationApi`
- [ ] **MEDIUM** Update 9 components to use hooks instead of direct API imports

### Other

- [ ] **LOW** Feature-flag `DatabaseInfoScreen` for production
- [ ] **LOW** Add `React.memo` to list item components (per Memoization Guidelines)

---

## 11. CLAUDE.md Compliance Summary

| Guideline | Status | Notes |
|-----------|--------|-------|
| Component Size Limits | ⚠️ 3 violations | CaptureForm, CalendarScreen, LocationBuilderScreen |
| Module Structure | ⚠️ 1 incomplete | Settings module missing Api/Hooks |
| **Form Component Pattern** | 🔴 1 critical violation | CaptureForm fetches own data + 40+ useState |
| Memoization Guidelines | ❓ Not audited | Consider adding React.memo to list items |
| Custom Hook Extraction | ✅ Good example | useLocationPicker.ts follows pattern |
| Data Fetching Location | ✅ Compliant | Screens fetch, children receive props |
| Loading/Error States | ❓ Not audited | Review for consistency |
| Anti-Patterns | ✅ None found | No service classes, proper imports |

---

*Report generated by Claude Opus 4.5 | Aligned with CLAUDE.md v2 (December 2025)*
