# Testing Guide

## Quick Reference

```bash
# Run all tests (from repo root or packages/core)
npm run test:run

# Watch mode
npm test

# With coverage report
npm run test:coverage

# Type checking (CI requirement)
npm run type-check:mobile
```

## Current Status

- **543 tests** across 11 test files
- **Framework:** Vitest 4.x
- **Coverage:** ~80% statements, 65% branches

## Test File Locations

All tests live in `packages/core/src/modules/`:

| Module | Test File | Tests |
|--------|-----------|-------|
| entries | `entryHelpers.test.ts` | 102 |
| locations | `locationHelpers.test.ts` | 79 |
| attachments | `attachmentHelpers.test.ts` | 59 |
| profile | `profileHelpers.test.ts` | 47 |
| streams | `templateHelpers.test.ts` | 43 |
| entries | `entrySortHelpers.test.ts` | 41 |
| entries | `ratingHelpers.test.ts` | 41 |
| entries | `entryDisplayHelpers.test.ts` | 35 |
| streams | `streamHelpers.test.ts` | 34 |
| auth | `authHelpers.test.ts` | 32 |
| settings | `settingsHelpers.test.ts` | 30 |

## What Requires Tests

Per CLAUDE.md rules, `@trace/core` helper functions MUST have unit tests:

**REQUIRES tests:**
- Any `*Helpers.ts` file in core package
- Pure functions (calculations, formatting, validation)
- Business logic utilities

**Does NOT require tests:**
- API layer (`*Api.ts`) - integration territory
- React Query hooks (`*Hooks.ts`) - library tested
- Type definitions (`*Types.ts`) - TypeScript handles this
- Mobile/web components - type-check only

## Adding New Tests

### 1. Create test file next to helper

```
packages/core/src/modules/myModule/
  myModuleHelpers.ts      # Your helper functions
  myModuleHelpers.test.ts # Tests go here
```

### 2. Follow this structure

```typescript
import { describe, it, expect } from "vitest";
import {
  myFunction,
  anotherFunction,
} from "./myModuleHelpers";

describe("myFunction", () => {
  it("describes expected behavior", () => {
    const result = myFunction("input");
    expect(result).toBe("expected");
  });

  it("handles edge case", () => {
    expect(myFunction("")).toBe("");
  });

  it("handles null/undefined", () => {
    expect(myFunction(null)).toBeNull();
  });
});

describe("anotherFunction", () => {
  // Group related tests
});
```

### 3. Run tests before committing

```bash
npm run test:run && npm run type-check:mobile
```

## Test Patterns Used

### Basic assertions

```typescript
expect(result).toBe("exact");           // Strict equality
expect(result).toEqual({ a: 1 });       // Deep equality
expect(result).toContain("substring");  // String/array contains
expect(result.length).toBe(5);          // Property check
expect(result.isValid).toBe(true);      // Boolean check
```

### Testing validation functions

```typescript
describe("validateEmail", () => {
  it("returns invalid for empty email", () => {
    expect(validateEmail("")).toEqual({
      isValid: false,
      error: "Email is required"
    });
  });

  it("returns valid for correct format", () => {
    expect(validateEmail("test@example.com")).toEqual({ isValid: true });
  });
});
```

### Testing with dates (time-sensitive)

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-14T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for recent", () => {
    const now = new Date("2026-01-14T11:59:30Z");
    expect(formatRelativeTime(now.toISOString())).toBe("just now");
  });
});
```

### Testing arrays and aggregations

```typescript
describe("aggregateTags", () => {
  it("counts tag occurrences", () => {
    const entries = [
      { tags: ["work", "urgent"] },
      { tags: ["work", "meeting"] },
    ];
    const result = aggregateTags(entries);
    expect(result.find(t => t.tag === "work")?.count).toBe(2);
  });

  it("handles empty/null tags", () => {
    const entries = [{ tags: null }, { tags: [] }];
    const result = aggregateTags(entries);
    expect(result.length).toBe(0);
  });
});
```

## Coverage Configuration

From `packages/core/vitest.config.ts`:

```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "html", "lcov"],
  include: ["src/modules/**/*Helpers.ts", "src/modules/**/*helpers.ts"],
  exclude: ["src/**/*.test.ts", "src/**/index.ts"],
}
```

Coverage only tracks helper files. HTML report generated in `packages/core/coverage/`.

## CI Pipeline

GitHub Actions runs on every PR:
1. `npm run test:run` - Unit tests must pass
2. `npm run type-check:mobile` - Type checking must pass

Both must pass before merging.

## Blocked: Mobile Hook Tests

Mobile hook tests cannot run due to Expo SDK 54 runtime incompatibility with Jest/Vitest. The mobile app relies on type-checking only.

**Affected (not tested):**
- `useAutosave`
- `useVersionConflict`
- `usePhotoTracking`
- `useGpsCapture`
- `useCaptureFormState`

## Common Issues

**"Cannot find module" errors**
```bash
cd packages/core && npm run build
```

**Tests pass locally but fail in CI**
- Check for timezone-dependent date tests
- Use `vi.useFakeTimers()` for date-sensitive tests

**Coverage too low**
- Add edge case tests
- Test null/undefined inputs
- Test boundary conditions
