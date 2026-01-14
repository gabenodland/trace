# Testing TODO - Trace Mobile App

## Current State

**Core Package Tests: 132 PASSING ✅**
**Mobile Hook Tests: BLOCKED ⚠️** (Expo SDK 54 runtime issue)
**E2E Tests: NOT STARTED**

### What's Working
- `@trace/core` has full testing infrastructure with vitest
- 132 unit tests covering entry helpers (89) and template helpers (43)
- All tests pass: `npm run test:run -w @trace/core`
- Coverage reports available: `npm run test:coverage -w @trace/core`
- GitHub Actions CI runs tests on every push/PR to master/main

### Known Issues
- **Expo SDK 54 Winter Runtime**: Mobile hook tests are blocked by an incompatibility between `jest-expo` and the new Expo winter runtime. Error: `ReferenceError: You are trying to import a file outside of the scope of the test code`. This is a known issue with Expo SDK 54+.
- **React 19 peer deps**: Required `--legacy-peer-deps` flag for installing test dependencies in mobile package.

---

## Testing Strategy

### Testing Pyramid

```
         /\
        /  \  E2E (Maestro)
       /----\  5-10 critical flows
      /      \
     /--------\  Hook Tests (Jest + RNTL)
    /          \  All 5 extracted hooks
   /------------\
  /              \  Unit Tests (Jest/Vitest)
 /________________\  All 11 helper files
```

### Priority Order

| Priority | Layer | Files | Est. Tests | ROI |
|----------|-------|-------|------------|-----|
| P0 | Unit - Core Helpers | 11 files | ~80 tests | **Highest** - Pure functions, easy to test |
| P1 | Hook - Mobile | 5 hooks | ~25 tests | **High** - Validates extracted logic |
| P2 | E2E - Critical Paths | 5 flows | 5 tests | **High** - Catches regressions |
| P3 | Component | As needed | TBD | Medium - Add when bugs found |

---

## Phase 0: Infrastructure Setup

### 0.1 Install Dependencies

**Core Package (`packages/core`):**
```bash
npm install -D vitest @vitest/coverage-v8
```

**Mobile Package (`apps/mobile`):**
```bash
npm install -D jest @testing-library/react-native @testing-library/react-hooks jest-expo
```

**Root (E2E):**
```bash
npm install -D maestro  # Or use homebrew: brew install maestro
```

### 0.2 Configuration Files

**`packages/core/vitest.config.ts`:**
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/modules/**/*Helpers.ts'],
    },
  },
});
```

**`apps/mobile/jest.config.js`:**
```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['@testing-library/react-native/extend-expect'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|@tanstack/.*)',
  ],
  moduleNameMapper: {
    '^@trace/core$': '<rootDir>/../../packages/core/src',
  },
};
```

### 0.3 NPM Scripts

**`packages/core/package.json`** (update):
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

**`apps/mobile/package.json`** (add):
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
}
```

### 0.4 CI Integration (GitHub Actions)

**`.github/workflows/test.yml`:**
```yaml
name: Tests
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build -w @trace/core
      - run: npm test -w @trace/core -- --run
      - run: npm test -w @trace/mobile -- --ci
```

---

## Phase 1: Unit Tests - Core Helpers

### File: `packages/core/src/modules/entries/entryHelpers.test.ts`

**Functions to test (25+ tests):**

```typescript
// Parsing
- parseHashtags(content)
  - extracts single tag
  - extracts multiple tags
  - deduplicates tags
  - normalizes to lowercase
  - handles empty content
  - handles content with no tags

- parseMentions(content)
  - extracts single mention
  - extracts multiple mentions
  - deduplicates mentions
  - normalizes to lowercase

- extractTagsAndMentions(content)
  - extracts both tags and mentions

// HTML Processing
- stripHtml(htmlContent)
  - removes basic tags
  - preserves text content
  - adds newlines for block elements
  - decodes HTML entities (&amp;, &lt;, etc.)
  - handles nested tags
  - handles empty string

- getWordCount(content)
  - counts words in plain text
  - strips HTML before counting
  - returns 0 for empty content

- getCharacterCount(content)
  - counts characters in plain text
  - strips HTML before counting

- getPreviewText(content, maxLength)
  - truncates long content
  - adds ellipsis
  - returns full content if under limit

// Status Logic
- isActionableStatus(status)
  - returns true for: new, todo, in_progress, in_review, waiting, on_hold
  - returns false for: done, closed, cancelled, none

- isCompletedStatus(status)
  - returns true for: done, closed, cancelled
  - returns false for actionable statuses

- getNextStatus(currentStatus)
  - none → none
  - actionable → done
  - completed → todo

- isTask(status)
  - returns true for any status except "none"

// Due Date Logic
- isTaskOverdue(status, dueDate)
  - returns true when actionable + past due
  - returns false when completed
  - returns false when no due date
  - returns false when future due date

- isDueToday(dueDate)
  - returns true for today
  - returns false for other days

- isDueThisWeek(dueDate)
  - returns true for dates within 7 days

- formatDueDate(dueDate, status)
  - formats "Today", "Tomorrow"
  - formats "Overdue by X days" for actionable
  - formats date for future

// Type Helpers
- validateTypeName(name)
  - rejects empty
  - rejects > 20 chars
  - accepts valid names

- isLegacyType(type, allowedTypes)
  - detects types not in allowed list

- isTypeFeatureAvailable(useType, types)
  - requires both enabled AND types defined

// Aggregation
- aggregateTags(entries)
  - counts tag occurrences
  - sorts by count descending

- aggregateMentions(entries)
  - counts mention occurrences

- aggregateLocations(entries)
  - counts location occurrences

- getEntryCounts(entries)
  - returns total and noStream counts
```

### File: `packages/core/src/modules/streams/templateHelpers.test.ts`

**Functions to test (15+ tests):**

```typescript
- getTemplateVariables(date, streamName)
  - returns all expected keys
  - formats date correctly
  - formats time correctly
  - handles missing streamName

- replaceVariables(template, variables)
  - replaces {date} with value
  - replaces multiple variables
  - case-insensitive replacement
  - leaves unknown variables unchanged

- applyTitleTemplate(template, options)
  - applies variables to template
  - handles null template
  - handles empty template

- markdownToHtml(markdown)
  - converts # to <h1>
  - converts ## to <h2>
  - converts ### to <h3>
  - converts **bold** to <strong>
  - converts _italic_ to <em>
  - converts - bullets to <ul><li>
  - converts 1. to <ol><li>
  - converts [ ] to unchecked checkbox
  - converts [x] to checked checkbox
  - handles mixed content

- applyContentTemplate(template, options)
  - applies variables first
  - converts markdown second

- shouldApplyTemplate(title, content)
  - returns true when both empty
  - returns false when title present
  - returns false when content present
```

### Other Helper Files to Test

| File | Est. Tests | Priority |
|------|------------|----------|
| `entryDisplayHelpers.ts` | ~10 | P0 |
| `entrySortHelpers.ts` | ~8 | P0 |
| `ratingHelpers.ts` | ~5 | P0 |
| `streamHelpers.ts` | ~8 | P0 |
| `attachmentHelpers.ts` | ~5 | P1 |
| `locationHelpers.ts` | ~5 | P1 |
| `settingsHelpers.ts` | ~5 | P1 |
| `authHelpers.ts` | ~3 | P1 |
| `profileHelpers.ts` | ~3 | P2 |

---

## Phase 2: Hook Tests - Mobile

### File: `apps/mobile/src/modules/entries/components/hooks/__tests__/useAutosave.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useAutosave } from '../useAutosave';

describe('useAutosave', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not autosave when form is not dirty', () => {
    const onSave = jest.fn();
    renderHook(() => useAutosave({
      isEditMode: true,
      isEditing: true,
      isFormDirty: false,  // Not dirty
      isFormReady: true,
      isSubmitting: false,
      isSaving: false,
      hasContent: true,
      onSave,
    }));

    jest.advanceTimersByTime(3000);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('autosaves after delay when dirty', () => {
    const onSave = jest.fn();
    renderHook(() => useAutosave({
      isEditMode: true,
      isEditing: true,
      isFormDirty: true,
      isFormReady: true,
      isSubmitting: false,
      isSaving: false,
      hasContent: true,
      onSave,
    }));

    jest.advanceTimersByTime(2000);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('debounces rapid changes', () => {
    const onSave = jest.fn();
    const { rerender } = renderHook(
      (props) => useAutosave(props),
      {
        initialProps: {
          isEditMode: true,
          isEditing: true,
          isFormDirty: true,
          isFormReady: true,
          isSubmitting: false,
          isSaving: false,
          hasContent: true,
          onSave,
        },
      }
    );

    // Simulate rapid typing by re-rendering
    jest.advanceTimersByTime(500);
    rerender({ /* same props */ });
    jest.advanceTimersByTime(500);
    rerender({ /* same props */ });
    jest.advanceTimersByTime(500);

    expect(onSave).not.toHaveBeenCalled();  // Timer keeps resetting

    jest.advanceTimersByTime(2000);
    expect(onSave).toHaveBeenCalledTimes(1);  // Finally fires
  });

  it('does not autosave while already saving', () => {
    const onSave = jest.fn();
    renderHook(() => useAutosave({
      isEditMode: true,
      isEditing: true,
      isFormDirty: true,
      isFormReady: true,
      isSubmitting: false,
      isSaving: true,  // Already saving
      hasContent: true,
      onSave,
    }));

    jest.advanceTimersByTime(3000);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('does not autosave new entry without content', () => {
    const onSave = jest.fn();
    renderHook(() => useAutosave({
      isEditMode: true,
      isEditing: false,  // New entry
      isFormDirty: true,
      isFormReady: true,
      isSubmitting: false,
      isSaving: false,
      hasContent: false,  // No content
      onSave,
    }));

    jest.advanceTimersByTime(3000);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('clears timer on unmount', () => {
    const onSave = jest.fn();
    const { unmount } = renderHook(() => useAutosave({
      isEditMode: true,
      isEditing: true,
      isFormDirty: true,
      isFormReady: true,
      isSubmitting: false,
      isSaving: false,
      hasContent: true,
      onSave,
    }));

    jest.advanceTimersByTime(1000);
    unmount();
    jest.advanceTimersByTime(2000);

    expect(onSave).not.toHaveBeenCalled();  // Timer was cleared
  });
});
```

### File: `apps/mobile/src/modules/entries/components/hooks/__tests__/useVersionConflict.test.ts`

```typescript
describe('useVersionConflict', () => {
  it('initializes version on first call', () => {
    const { result } = renderHook(() => useVersionConflict({ isEditing: true }));

    expect(result.current.getKnownVersion()).toBeNull();

    act(() => {
      result.current.initializeVersion(5);
    });

    expect(result.current.getKnownVersion()).toBe(5);
  });

  it('does not re-initialize if already set', () => {
    const { result } = renderHook(() => useVersionConflict({ isEditing: true }));

    act(() => {
      result.current.initializeVersion(5);
      result.current.initializeVersion(10);  // Should be ignored
    });

    expect(result.current.getKnownVersion()).toBe(5);
  });

  it('detects conflict when entry version > known version', () => {
    const { result } = renderHook(() => useVersionConflict({ isEditing: true }));

    act(() => {
      result.current.initializeVersion(5);
    });

    const entry = { version: 7, last_edited_device: 'iPhone' };
    const conflict = result.current.checkForConflict(entry as any);

    expect(conflict?.hasConflict).toBe(true);
    expect(conflict?.conflictDevice).toBe('iPhone');
    expect(conflict?.currentVersion).toBe(7);
    expect(conflict?.baseVersion).toBe(5);
  });

  it('returns no conflict when versions match', () => {
    const { result } = renderHook(() => useVersionConflict({ isEditing: true }));

    act(() => {
      result.current.initializeVersion(5);
    });

    const entry = { version: 5 };
    const conflict = result.current.checkForConflict(entry as any);

    expect(conflict?.hasConflict).toBe(false);
  });

  it('increments known version after save', () => {
    const { result } = renderHook(() => useVersionConflict({ isEditing: true }));

    act(() => {
      result.current.initializeVersion(5);
      result.current.incrementKnownVersion();
    });

    expect(result.current.getKnownVersion()).toBe(6);
  });

  it('detects external update from different device', () => {
    const { result } = renderHook(() => useVersionConflict({ isEditing: true }));

    const entry = { last_edited_device: 'iPad' };
    const external = result.current.isExternalUpdate(entry as any);

    // Will compare against current device name
    expect(external?.device).toBe('iPad');
  });
});
```

### File: `apps/mobile/src/modules/entries/components/hooks/__tests__/usePhotoTracking.test.ts`

```typescript
describe('usePhotoTracking', () => {
  it('initializes with zero photo count', () => {
    const { result } = renderHook(() => usePhotoTracking({
      entryId: null,
      isEditing: false,
      isFormReady: false,
      baselinePhotoCount: null,
      queryPhotoCount: 0,
    }));

    expect(result.current.photoCount).toBe(0);
    expect(result.current.externalRefreshKey).toBe(0);
  });

  it('syncs photo count when called', () => {
    const { result } = renderHook(() => usePhotoTracking({
      entryId: '123',
      isEditing: true,
      isFormReady: true,
      baselinePhotoCount: 3,
      queryPhotoCount: 3,
    }));

    act(() => {
      result.current.syncPhotoCount(5);
    });

    expect(result.current.photoCount).toBe(5);
  });

  it('increments refresh key on external change', () => {
    const { result, rerender } = renderHook(
      (props) => usePhotoTracking(props),
      {
        initialProps: {
          entryId: '123',
          isEditing: true,
          isFormReady: true,
          baselinePhotoCount: 3,
          queryPhotoCount: 3,
        },
      }
    );

    const initialKey = result.current.externalRefreshKey;

    // Simulate external photo addition
    rerender({
      entryId: '123',
      isEditing: true,
      isFormReady: true,
      baselinePhotoCount: 3,
      queryPhotoCount: 4,  // Changed externally
    });

    expect(result.current.externalRefreshKey).toBe(initialKey + 1);
    expect(result.current.photoCount).toBe(4);
  });

  it('does not detect external changes before form is ready', () => {
    const { result, rerender } = renderHook(
      (props) => usePhotoTracking(props),
      {
        initialProps: {
          entryId: '123',
          isEditing: true,
          isFormReady: false,  // Not ready
          baselinePhotoCount: null,
          queryPhotoCount: 3,
        },
      }
    );

    const initialKey = result.current.externalRefreshKey;

    rerender({
      entryId: '123',
      isEditing: true,
      isFormReady: false,
      baselinePhotoCount: null,
      queryPhotoCount: 5,
    });

    expect(result.current.externalRefreshKey).toBe(initialKey);  // No change
  });
});
```

### File: `apps/mobile/src/modules/entries/components/hooks/__tests__/useGpsCapture.test.ts`

```typescript
describe('useGpsCapture', () => {
  // Mock expo-location
  jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn(),
    getCurrentPositionAsync: jest.fn(),
    Accuracy: { High: 6 },
  }));

  it('starts with loading false', () => {
    const { result } = renderHook(() => useGpsCapture({
      captureGpsSetting: true,
      hasExistingGps: false,
      updateGpsData: jest.fn(),
      units: 'imperial',
      showSnackbar: jest.fn(),
    }));

    expect(result.current.isGpsLoading).toBe(false);
    expect(result.current.pendingGpsData).toBeNull();
  });

  it('captures GPS when called', async () => {
    const Location = require('expo-location');
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' });
    Location.getCurrentPositionAsync.mockResolvedValue({
      coords: {
        latitude: 40.7128,
        longitude: -74.0060,
        altitude: 10,
        accuracy: 5,
        speed: 0,
        heading: 0,
      },
      timestamp: Date.now(),
    });

    const updateGpsData = jest.fn();
    const { result } = renderHook(() => useGpsCapture({
      captureGpsSetting: true,
      hasExistingGps: false,
      updateGpsData,
      units: 'imperial',
      showSnackbar: jest.fn(),
    }));

    await act(async () => {
      await result.current.captureGps();
    });

    expect(updateGpsData).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: 40.7128,
        longitude: -74.0060,
      })
    );
  });

  it('handles permission denied', async () => {
    const Location = require('expo-location');
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const showSnackbar = jest.fn();
    const { result } = renderHook(() => useGpsCapture({
      captureGpsSetting: true,
      hasExistingGps: false,
      updateGpsData: jest.fn(),
      units: 'imperial',
      showSnackbar,
    }));

    await act(async () => {
      await result.current.captureGps();
    });

    expect(showSnackbar).toHaveBeenCalledWith(
      expect.stringContaining('permission')
    );
  });

  it('clears pending GPS data', () => {
    const { result } = renderHook(() => useGpsCapture({
      captureGpsSetting: true,
      hasExistingGps: false,
      updateGpsData: jest.fn(),
      units: 'imperial',
      showSnackbar: jest.fn(),
    }));

    // Simulate having pending data
    act(() => {
      result.current.clearPendingGps();
    });

    expect(result.current.pendingGpsData).toBeNull();
  });
});
```

### File: `apps/mobile/src/modules/entries/components/hooks/__tests__/useCaptureFormState.test.ts`

```typescript
describe('useCaptureFormState', () => {
  it('initializes with default values for new entry', () => {
    const { result } = renderHook(() => useCaptureFormState(null, []));

    expect(result.current.formData.title).toBe('');
    expect(result.current.formData.content).toBe('');
    expect(result.current.formData.status).toBe('none');
    expect(result.current.isFormDirty).toBe(false);
  });

  it('initializes with entry values when editing', () => {
    const entry = {
      title: 'Test Entry',
      content: '<p>Hello</p>',
      status: 'todo',
    };

    const { result } = renderHook(() => useCaptureFormState(entry as any, []));

    expect(result.current.formData.title).toBe('Test Entry');
    expect(result.current.formData.content).toBe('<p>Hello</p>');
    expect(result.current.formData.status).toBe('todo');
  });

  it('marks form dirty on field update', () => {
    const { result } = renderHook(() => useCaptureFormState(null, []));

    expect(result.current.isFormDirty).toBe(false);

    act(() => {
      result.current.updateField('title', 'New Title');
    });

    expect(result.current.isFormDirty).toBe(true);
    expect(result.current.formData.title).toBe('New Title');
  });

  it('marks form clean after markClean called', () => {
    const { result } = renderHook(() => useCaptureFormState(null, []));

    act(() => {
      result.current.updateField('title', 'New Title');
    });

    expect(result.current.isFormDirty).toBe(true);

    act(() => {
      result.current.markClean();
    });

    expect(result.current.isFormDirty).toBe(false);
  });

  it('resets form to initial values', () => {
    const { result } = renderHook(() => useCaptureFormState(null, []));

    act(() => {
      result.current.updateField('title', 'New Title');
      result.current.updateField('content', 'New Content');
    });

    act(() => {
      result.current.resetForm();
    });

    expect(result.current.formData.title).toBe('');
    expect(result.current.formData.content).toBe('');
    expect(result.current.isFormDirty).toBe(false);
  });
});
```

---

## Phase 3: E2E Tests - Maestro

### Directory: `.maestro/`

### File: `.maestro/create-entry.yaml`

```yaml
appId: com.trace.mobile
---
- launchApp
- tapOn: "New Entry"
- inputText: "Test Entry Title"
- tapOn: "Content"
- inputText: "This is test content for the entry"
- assertVisible: "Test Entry Title"
- tapOn: "Save"
- assertVisible: "Entry saved"
```

### File: `.maestro/edit-entry.yaml`

```yaml
appId: com.trace.mobile
---
- launchApp
- tapOn:
    text: ".*"  # First entry in list
    index: 0
- tapOn: "Edit"
- clearText
- inputText: "Updated Title"
- tapOn: "Save"
- assertVisible: "Updated Title"
```

### File: `.maestro/add-photo.yaml`

```yaml
appId: com.trace.mobile
---
- launchApp
- tapOn: "New Entry"
- tapOn: "Add Photo"
- tapOn: "Choose from Library"
# Simulator will show photo picker
- tapOn:
    text: ".*"
    index: 0
- assertVisible: "1 photo"
```

### File: `.maestro/stream-assignment.yaml`

```yaml
appId: com.trace.mobile
---
- launchApp
- tapOn: "New Entry"
- tapOn: "Stream"
- tapOn: "Journal"  # Assumes "Journal" stream exists
- assertVisible: "Journal"
- tapOn: "Save"
```

### File: `.maestro/status-toggle.yaml`

```yaml
appId: com.trace.mobile
---
- launchApp
- tapOn: "New Entry"
- inputText: "Task Entry"
- tapOn: "Status"
- tapOn: "Todo"
- assertVisible: "Todo"
- tapOn: "Save"
# Verify in list
- assertVisible: "Task Entry"
- tapOn: "Task Entry"
- assertVisible: "Todo"
```

---

## Test Coverage Targets

### Phase 1 Complete (Unit Tests)

| Package | Target | Files |
|---------|--------|-------|
| `@trace/core` | 80% | All *Helpers.ts files |

### Phase 2 Complete (Hook Tests)

| Package | Target | Files |
|---------|--------|-------|
| `@trace/mobile` | 70% hooks | 5 extracted hooks |

### Phase 3 Complete (E2E)

| Flows | Target |
|-------|--------|
| Critical paths | 5 happy paths covered |

---

## Implementation Checklist

### Phase 0: Infrastructure
- [x] Install vitest in core package
- [x] Install jest + RNTL in mobile package (with --legacy-peer-deps)
- [x] Create vitest.config.ts
- [x] Create jest.config.js
- [x] Add npm scripts
- [x] Create GitHub Actions workflow (`.github/workflows/test.yml`)
- [x] Verify `npm test` works in core package
- [ ] ⚠️ Mobile tests blocked by Expo SDK 54 winter runtime issue

### Phase 1: Unit Tests - Core
- [x] `entryHelpers.test.ts` (89 tests) ✅
- [x] `templateHelpers.test.ts` (43 tests) ✅
- [ ] `entryDisplayHelpers.test.ts` (~10 tests)
- [ ] `entrySortHelpers.test.ts` (~8 tests)
- [ ] `ratingHelpers.test.ts` (~5 tests)
- [ ] `streamHelpers.test.ts` (~8 tests)
- [ ] `attachmentHelpers.test.ts` (~5 tests)
- [ ] `locationHelpers.test.ts` (~5 tests)
- [ ] `settingsHelpers.test.ts` (~5 tests)
- [ ] `authHelpers.test.ts` (~3 tests)
- [ ] `profileHelpers.test.ts` (~3 tests)
- [ ] Achieve 80% coverage on helpers

### Phase 2: Hook Tests - Mobile
- [ ] ⚠️ `useAutosave.test.ts` - BLOCKED (Expo runtime issue)
- [ ] ⚠️ `useVersionConflict.test.ts` - BLOCKED (Expo runtime issue)
- [ ] ⚠️ `usePhotoTracking.test.ts` - BLOCKED (Expo runtime issue)
- [ ] `useGpsCapture.test.ts` (~6 tests)
- [ ] `useCaptureFormState.test.ts` (~8 tests)

**Note:** Test files exist in `apps/mobile/src/modules/entries/components/hooks/__tests__/` but cannot run due to Expo SDK 54 winter runtime incompatibility with Jest. Waiting for Expo/Jest ecosystem to catch up.

### Phase 3: E2E Tests
- [ ] Install Maestro
- [ ] Create `.maestro/` directory
- [ ] `create-entry.yaml`
- [ ] `edit-entry.yaml`
- [ ] `add-photo.yaml`
- [ ] `stream-assignment.yaml`
- [ ] `status-toggle.yaml`
- [ ] Run on iOS Simulator
- [ ] Run on Android Emulator

---

## Running Tests

```bash
# Core unit tests
cd packages/core
npm test              # Watch mode
npm run test:run      # Single run
npm run test:coverage # With coverage

# Mobile hook tests
cd apps/mobile
npm test              # Watch mode
npm test -- --ci      # CI mode

# E2E tests
maestro test .maestro/create-entry.yaml
maestro test .maestro/              # Run all flows
```

---

## What NOT to Test

- React Query hooks (already tested by library)
- Supabase client operations (integration test territory)
- Simple presentational components (too much churn)
- Third-party component props (test the library, not your usage)
- Type definitions (TypeScript compiler handles this)

---

## When to Add More Tests

1. **Bug found** → Write test that reproduces bug, then fix
2. **Complex logic added** → Test it before shipping
3. **Regression occurred** → Add test to prevent recurrence
4. **Refactoring** → Ensure tests exist before refactoring

---

## Estimated Timeline

| Phase | Effort |
|-------|--------|
| Phase 0 (Setup) | 2-4 hours |
| Phase 1 (Unit) | 8-12 hours |
| Phase 2 (Hooks) | 4-6 hours |
| Phase 3 (E2E) | 4-6 hours |
| **Total** | **18-28 hours** |

---

## Success Metrics

- [ ] `npm test` passes in CI on every PR
- [ ] 80%+ coverage on helper functions
- [ ] All 5 hooks have tests
- [ ] E2E catches any regression in critical flows
- [ ] New features include tests before merge
