# CLAUDE.md (ab)

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.


## ⚠️ DEVELOPMENT RULES - READ FIRST
EVERY TIME I ASK YOU TO DO ANYTHING YOU FIRST SAY: "OK [ModelName] here to help", (list the model name in the brackets) AND THIS HELPS YOU REMEMBER THAT YOU ARE A VERY DETAILED ORIENTED DEVELOPER THAT ALWAYS FOLLOWS OUR RULES LISTED BELOW. YOU WILL PUSH BACK IF YOU ARE ASKED TO DO SOMETHING OUT OF ORDER OR NOT ALIGNED WITH THESE RULES.
**These rules MUST be followed at all times:**

0. **DON'T HACK** Stop and always look at the bigger picture the fix you are working on needs to be quality. You might want to use a Timer or delay DO NO USE TIMERS!!!! THAT IS A HACK.

1. **Never make up data** - Always ask if you need information. Do not assume or fabricate values.

2. **Don't start without confirmation** - Present your plan and get approval before implementing changes.

3. **Use minimal tech stack** - Always ask before adding new libraries or dependencies.

4. **Follow established patterns exactly** - Use the patterns defined in this document. No deviations.

5. **All code must be maintainable and in the right place** - Respect the module structure and file organization.

6. **Always play a sound when complete** - After providing summary of completed work:
   ```bash
   python c:/projects/trace/scripts/voice.py "<one sentence summary>" --agent <your_name>
   ```
   - Use a unique name for yourself (e.g., `main`, `search`, `refactor`, `test`)
   - Each unique name gets a random voice that persists for the session
   - Example: `python c:/projects/trace/scripts/voice.py "just updated the app config" --agent main`

7. **Always play a sound when you need more information** - After asking a question:
   ```bash
   python c:/projects/trace/scripts/voice.py "<question summary>" --agent <your_name>
   ```
   - Example: `python c:/projects/trace/scripts/voice.py "do you want me to update the config" --agent main`

   **NOTE:** The user likes hearing your voice. TTS works even in plan mode. Use it freely.
   **Voice System:** Uses Microsoft Edge neural voices (14 high-quality voices). Each agent name gets a randomly assigned voice on first use that sticks for the entire session.
   **Commands:**
   - Reset all voices: `python c:/projects/trace/scripts/voice.py --reset-session`
   - Show voice assignments: `python c:/projects/trace/scripts/voice.py --show-session`

8. **Never create 'nul' files** - Always use correct null device syntax for bash:
   - ✅ Use `/dev/null` in bash/Git Bash commands
   - ❌ NEVER use `> nul` (Windows CMD syntax - creates a file in bash)
   - Example: `ping -n 10 127.0.0.1 > /dev/null` (not `> nul`)
   - If you accidentally create a 'nul' file, delete it immediately

9. **DO NOT BE GLIB OR A PEOPLE PLEASER** Do what I ask you to do, but do the right thing not the nice thing. Your answers should be harsh, critical, and borderline rude. No sugar coating.

10. **Never commit without being asked** - Do not run `git commit` until the user explicitly asks you to commit. Complete the work, verify it builds, but wait for the user to request the commit.

11. **Always use design skills when changing the UI** - Apply good design principles when modifying UI components.

12. **Core package changes require tests** - When adding or modifying `@trace/core`:
   - Helper functions MUST have unit tests (vitest)
   - Run `npm run test:run` to verify tests pass
   - New helper files need corresponding `.test.ts` files
   - Follow existing test patterns in `entryHelpers.test.ts` and `templateHelpers.test.ts`
   - Mobile code relies on type-check only (no unit tests)

13. **Verify CI pipeline passes** - Before considering work complete:
   - Run `npm run test:run` for unit tests
   - Run `npm run type-check:mobile` for type checking
   - These commands mirror what GitHub Actions runs on every PR
   - Do NOT merge or consider work done if tests fail

After completing a task that involves tool use provide a quick summary of the work done. prefix the summary with TOOL USE:

---

## 🐛 DEBUGGING RULES - CRITICAL

**When you encounter a bug or error, FOLLOW THIS PROCESS:**

1. **STOP. Do NOT start fixing immediately.**

2. **Gather evidence FIRST:**
   - Read the actual error message/logs completely
   - Identify WHAT is failing and WHEN
   - Look for patterns (does it happen every time? only on fresh start?)
   - Note the exact sequence of events leading to the error

3. **Add logging/instrumentation BEFORE making changes:**
   - Add strategic console.logs to trace execution flow
   - Track state changes and function calls
   - Instrument the suspected code paths
   - Get user to reproduce with logging enabled

4. **Present your diagnosis to the user:**
   - "I see X happening. I think it's caused by Y because Z."
   - "To confirm, I want to add logging to A, B, C to see if..."
   - **WAIT for user confirmation before proceeding with fixes**

5. **NEVER say "this should fix it" without evidence:**
   - ❌ BAD: "Let me add memoization, that should fix the infinite loop"
   - ✅ GOOD: "The logs show 3 duplicate hook instances. Let me trace where they're being called."

6. **If your first fix doesn't work:**
   - **DO NOT** try another fix immediately
   - Go back to step 2 - gather MORE evidence
   - The user telling you "that didn't work" means your diagnosis was WRONG
   - Admit the mistake: "My diagnosis was incorrect. Let me investigate further."

7. **Be skeptical of your own assumptions:**
   - Just because something is a "common cause" doesn't mean it's THE cause
   - Verify with data, not assumptions
   - If you're not 100% sure, SAY SO: "I'm not certain, but one possibility is..."

**Example of CORRECT debugging approach:**
```
User: "Getting infinite loop error on app start"
Assistant: "I see the error happens during sync init. Before I make changes,
let me add logging to:
1. Track how many times useAuthState runs
2. See if queryClient is changing
3. Check for duplicate hook instances

This will show us what's actually happening. Should I add this instrumentation?"

[User approves]
Assistant: [Adds logging, gets output]
Assistant: "The logs show useAuthState is being called from 3 different places:
- AuthContext (correct)
- EntryListScreen (wrong - should use useAuth)
- EntryScreen (wrong - should use useAuth)

This creates 3 separate auth listeners, each calling setState 3 times = 9 simultaneous
state updates = infinite loop. The fix is to change those two screens to use useAuth()
instead of useAuthState(). Should I make that change?"
```

**Example of WRONG debugging approach (DO NOT DO THIS):**
```
User: "Getting infinite loop error"
Assistant: "This is probably Context re-renders. Let me add useMemo to fix it."
[adds memoization without investigation]
User: "Still broken"
Assistant: "Oh, let me try useCallback instead..."
[keeps guessing without evidence]
```

**Rule Priority: Investigation > Implementation**

When debugging, spend 80% of your effort understanding the problem and 20% fixing it.
A correct diagnosis leads to a simple fix. An incorrect diagnosis leads to complexity and wasted code.

**RED FLAGS that indicate you're doing it wrong:**
- You're making a second fix attempt without new evidence
- You're using words like "should", "probably", "might" without data to back it up
- You're adding complexity (memoization, refactoring) before understanding the problem
- The user has said "that didn't work" and you immediately try something else

---

## 📋 Logging Guidelines

**Use the centralized logger for ALL logging in mobile code.**

### Quick Start

```typescript
import { createScopedLogger, LogScopes } from '../../../../shared/utils/logger';

// Use a predefined scope (PREFERRED)
const log = createScopedLogger(LogScopes.Sync);

// Usage
log.debug('Starting sync', { userId });  // Dev/debug mode only
log.info('Sync completed', { count: 5 }); // General info
log.warn('Slow response', { ms: 3000 }); // Something unexpected
log.error('Sync failed', error, { userId }); // Errors
```

### Log Levels

| Level | When to Use | Example |
|-------|-------------|---------|
| `debug` | Detailed troubleshooting info, state changes | `log.debug('State updated', { old, new })` |
| `info` | General operational messages | `log.info('User logged in')` |
| `warn` | Unexpected but handled situations | `log.warn('Retry attempt', { attempt: 2 })` |
| `error` | Errors requiring attention | `log.error('Save failed', error)` |

### Available Scopes (LogScopes)

Use these predefined scopes for consistency:

| Category | Scopes |
|----------|--------|
| Core | `App`, `Init`, `Config` |
| Data & Sync | `Sync`, `SyncPush`, `SyncPull`, `Database`, `Cache`, `Migration` |
| Auth | `Auth`, `OAuth`, `Session` |
| Entries | `Entry`, `EntryForm`, `EntryNav`, `EntryApi`, `Autosave` |
| Media | `Photos`, `Attachments`, `PhotoGallery` |
| Location | `Location`, `Geocode`, `GPS`, `LocationPicker` |
| Streams | `Streams`, `StreamApi` |
| UI | `Editor`, `Navigation`, `Settings`, `Map` |
| Other | `Profile`, `Version` |

### Adding a New Scope

1. Add to `LogScopes` in `apps/mobile/src/shared/utils/logger.ts`:
```typescript
export const LogScopes = {
  // ... existing scopes
  YourNewScope: { icon: '🆕', name: 'YourNewScope' },
} as const;
```

2. Use it:
```typescript
const log = createScopedLogger(LogScopes.YourNewScope);
```

### Rules

1. **NEVER use raw `console.log`** - Always use the scoped logger
2. **Choose the right level** - Don't spam `info` with debug-level details
3. **Include context** - Pass relevant data as the second argument
4. **Errors need the error object** - `log.error('Message', error, { context })`
5. **Keep messages concise** - The scope name provides context

### Runtime Debug Mode

Users can enable debug mode in Settings > Developer to capture all logs (including debug level) for bug reports. Logs are stored in a circular buffer and can be exported via the Share API.

---

## 🔧 Project Configuration

**Supabase Project:**
- Project ID: `lsszorssvkavegobmqic`
- Dashboard: https://supabase.com/dashboard/project/lsszorssvkavegobmqic
- Region: us-east-2

---

## 🗄️ Supabase Database Migrations

### Migration Workflow

When adding new database columns or modifying the schema:

**Step 1: Create Migration File**
```bash
# Create timestamped migration file in supabase/migrations/
# Format: YYYYMMDDHHMMSS_description.sql
# Example: 20260122000001_add_is_archived.sql
```

**Step 2: Write Migration SQL**
```sql
-- supabase/migrations/20260122000001_add_is_archived.sql
ALTER TABLE entries ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX idx_entries_is_archived ON entries(is_archived);
```

**Step 3: Update TypeScript Types (Manual)**
Since we don't use CLI-generated types, manually update:
1. **`packages/core/src/shared/database.types.ts`** - Add field to `Row`, `Insert`, and `Update` types
2. **`packages/core/src/modules/{module}/{Module}Types.ts`** - Add to interface if it has one

**Step 4: Apply Migration**

**Option A: Via Supabase CLI (Recommended - tracks migration history)**

First, check if CLI is linked by running a dry-run:
```bash
cd /c/projects/trace
npx supabase db push --dry-run
```

If you get an error like "Cannot find project ref", you need to link first:
```bash
# Step 1: Login to Supabase (opens browser for auth)
npx supabase login

# Step 2: Link to our project
npx supabase link --project-ref lsszorssvkavegobmqic
# It will ask for database password - use the one from Supabase dashboard
# Settings → Database → Connection string → Password
```

Once linked, apply migrations:
```bash
# Check what will be pushed (dry run):
npx supabase db push --dry-run
# Shows: "Would push these migrations: • 20260122000001_add_is_archived.sql"

# Apply migrations:
npx supabase db push
# Prompts: "Do you want to push these migrations? [Y/n]"
# Press Y
# Shows: "Applying migration 20260122000001_add_is_archived.sql..."
# Shows: "Finished supabase db push."
```

The CLI automatically:
- Tracks which migrations have been applied in `supabase_migrations` table
- Only pushes new migrations that haven't been applied yet
- Skips files that don't match the `<timestamp>_name.sql` pattern (like `initial_schema.sql`)

**Option B: Via Supabase Dashboard (Quick one-off changes)**
1. Go to https://supabase.com/dashboard/project/lsszorssvkavegobmqic/sql/new
2. Copy/paste the migration SQL
3. Click "Run"
4. Verify in Table Editor that column was added

Note: Dashboard method doesn't track migration history, so CLI won't know the migration was applied.

**Step 5: Rebuild Core Package**
```bash
cd packages/core && npm run build
```

**Step 6: Update Mobile Code**
- Add field to entry construction in `mobileEntryApi.ts` (`createEntry`, `copyEntry`)
- Add field to sync mapping in `pullSyncOperations.ts` and `syncService.ts`

### Common Issues

**"Property X does not exist on type Entry"**
- The `database.types.ts` file hasn't been updated
- Or the core package hasn't been rebuilt after changes

**Migration applied but mobile not seeing new field**
- Sync service needs to map the new field from server responses
- Check `pullSyncOperations.ts` and `syncService.ts` for entry construction

---

## 📱 Android Build Configuration

### Dev Build vs Release APK

We use **Expo dev builds** (not Expo Go) for development. This allows native code and custom plugins while maintaining hot reload.

**Two build types that can run side-by-side:**
| Build | Package ID | Icon | Purpose |
|-------|------------|------|---------|
| Debug (dev build) | `com.trace.app.dev` | Orange debug icon | Development with tunnel/local server |
| Release APK | `com.trace.app` | Normal icon | Standalone production build |

### Build Commands

```bash
# From apps/mobile directory:

# Dev build (requires prebuild first)
npm run android              # Runs prebuild:android + expo run:android

# Prebuild only (regenerates android/ folder)
npm run prebuild:android     # expo prebuild --platform android + addDebugAppId script

# Release APK (after prebuild)
cd android && ./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

### How Side-by-Side Installation Works

The `scripts/addDebugAppId.js` script runs after every prebuild and:
1. Adds `applicationIdSuffix ".dev"` to debug builds in `build.gradle`
2. Installs the debug icon from `assets/adaptive-icon-debug.png`

This allows both debug and release versions to be installed on the same device simultaneously.

### Debug Icon Setup

Place your debug icon at:
```
apps/mobile/assets/adaptive-icon-debug.png
```

The script uses `sharp` to resize it for all Android density folders automatically.

### Network Security Config

Dev builds require cleartext traffic for Metro bundler. The `plugins/withNetworkSecurityConfig.js` plugin creates:

```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<network-security-config>
    <base-config cleartextTrafficPermitted="true">
        <trust-anchors>
            <certificates src="system"/>
            <certificates src="user"/>
        </trust-anchors>
    </base-config>
</network-security-config>
```

### Monorepo Metro Bundler Fix

The `plugins/withMonorepoRoot.js` plugin fixes Metro resolution for monorepo builds by setting the correct `root` path in `build.gradle`. Without this, release builds fail with "Unable to resolve module ./index.ts".

### Cache Clearing

**When images or assets don't update properly, clear these caches:**

```bash
# From apps/mobile directory:

# Clean Android build cache
rm -rf android/app/build android/app/.cxx android/.gradle

# Then rebuild
npm run prebuild:android
npm run android
```

### Google Maps API Key

Maps API key is configured in both `app.json` and `app.config.js`:
- iOS: `expo.ios.config.googleMapsApiKey`
- Android: `expo.android.config.googleMaps.apiKey`

### Running Dev Build with Tunnel (Remote Testing)

```bash
# Start with tunnel for remote device testing
npm run dev    # or: expo start --tunnel

# Then press 'a' to run on Android, or scan QR with Expo Go
```

**Note:** Tunnel mode requires the network security config to allow cleartext traffic.

### Key Files

| File | Purpose |
|------|---------|
| `app.config.js` | Main Expo config (JS, dynamic) |
| `app.json` | Static Expo config |
| `scripts/addDebugAppId.js` | Post-prebuild script for .dev suffix + debug icon |
| `plugins/withNetworkSecurityConfig.js` | Network security for dev builds |
| `plugins/withMonorepoRoot.js` | Fixes Metro bundler paths for monorepo |
| `plugins/withReleaseSigning.js` | Release signing config (disabled by default) |

---

## 📦 App Versioning

### Semantic Versioning (SemVer)

We use **Semantic Versioning**: `MAJOR.MINOR.PATCH`

| Component | When to Increment | Example |
|-----------|-------------------|---------|
| **MAJOR** | Breaking changes, major rewrites | 1.0.0 → 2.0.0 |
| **MINOR** | New features (backwards compatible) | 1.0.0 → 1.1.0 |
| **PATCH** | Bug fixes, small tweaks | 1.0.0 → 1.0.1 |

**Version is incremented manually** when releasing meaningful updates.

### Build Numbers

Build numbers are **separate from version** and auto-increment on every release build:

| Platform | Field | Store Requirement |
|----------|-------|-------------------|
| iOS | `buildNumber` | Must increment every App Store upload |
| Android | `versionCode` | Must increment every Play Store upload |

Build numbers track iterations (1, 2, 3...) regardless of version changes.

### How It Works

1. **Version** is stored in `app.config.js` (manual updates)
2. **Build number** is stored in `apps/mobile/build-number.json` (auto-incremented)
3. The `scripts/incrementBuildNumber.js` script bumps build number before release builds
4. `app.config.js` reads from `build-number.json` dynamically

### Build Commands

```bash
# From apps/mobile directory:

# Dev build (does NOT increment build number)
npm run android

# Release build (auto-increments build number)
npm run build:release
# This runs: incrementBuildNumber.js → prebuild → gradlew assembleRelease

# Manual version bump (edit app.config.js)
# version: '1.0.0' → '1.1.0'
```

### Version Display

Version and build number are displayed in **Settings > About** section at the bottom.

Uses `appVersionService.ts`:
- `getAppVersion()` - Returns version from expo-constants
- `getBuildNumber()` - Returns platform-specific build number

### Server-Side Version Tracking

Two database tables support version management:

**`app_config`** - Stores version requirements:
```json
{
  "minimum_version": "1.0.0",
  "latest_version": "1.0.0",
  "update_url_ios": "https://apps.apple.com/...",
  "update_url_android": "https://play.google.com/..."
}
```

**`app_sessions`** - Tracks user sessions with version info:
- `app_version`, `build_number`, `platform`, `device_model`, `last_seen_at`

This enables:
- Force updates for critical fixes (version < minimum_version)
- Soft update prompts (version < latest_version)
- Analytics on version adoption

### Key Files

| File | Purpose |
|------|---------|
| `app.config.js` | Version and build number config |
| `build-number.json` | Stores current build number |
| `scripts/incrementBuildNumber.js` | Auto-increments build number |
| `src/config/appVersionService.ts` | Version checking and session logging |

---

## ✏️ Custom Rich Text Editor

We use a custom Tiptap editor with a **title-first schema** that runs inside TenTap's WebView.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React Native (RichTextEditor.tsx)                      │
│    └─ useEditorBridge({ customSource: editorHtml })     │
│         └─ TenTap RichText WebView                      │
│              └─ Custom HTML bundle (editor-web/)        │
│                   └─ useTenTap + Title extensions       │
└─────────────────────────────────────────────────────────┘
```

- **TenTap** (`@10play/tentap-editor`): React Native wrapper for Tiptap using WebView
- **Custom bundle**: Our Tiptap editor with Title-first schema, built as single HTML file
- **Bridges**: Handle communication between RN and WebView (formatting commands, content sync)

### Title-First Schema

The editor enforces a document structure where the first node is always a title:

```typescript
// TitleDocument: content: 'title block+'
// - Exactly one title node first
// - Followed by one or more block nodes (paragraphs, lists, etc.)
```

**Title node behavior:**
- Renders as `<h1 class="entry-title">`
- No formatting marks allowed (bold/italic blocked)
- Backspace at start blocked (can't delete title)
- Enter key moves cursor to body
- Shift+Enter blocked (no line breaks in title)
- Only plain text allowed (no `<br>` tags)

### Build Commands

```bash
# From apps/mobile directory:

# Build the custom editor bundle
npm run editor:build
# Output: editor-web/build/editorHtml.js

# This is imported by RichTextEditor.tsx via customSource
```

**When to rebuild:**
- After modifying `editor-web/index.tsx` or `editor-web/index.html`
- After modifying Title/TitleDocument extensions in `@trace/core`
- The bundle is NOT auto-rebuilt during `npm run android`

### Key Files

| File | Purpose |
|------|---------|
| `apps/mobile/editor-web/index.tsx` | Editor entry point using useTenTap |
| `apps/mobile/editor-web/index.html` | HTML template with CSS |
| `apps/mobile/editor-web/vite.config.ts` | Vite build config |
| `apps/mobile/editor-web/build/editorHtml.js` | Built bundle (auto-generated) |
| `packages/core/src/modules/editor/TitleExtension.ts` | Title node extension |
| `packages/core/src/modules/editor/TitleDocument.ts` | Document schema |
| `packages/core/src/modules/editor/editorHelpers.ts` | HTML parsing utilities |
| `src/components/editor/RichTextEditor.tsx` | RN component using TenTap |

### Helper Functions

Import from `@trace/core`:

```typescript
import {
  splitTitleAndBody,    // Split HTML into { title, body }
  combineTitleAndBody,  // Combine title + body into HTML
  extractTitle,         // Get just the title text
  extractBody,          // Get just the body HTML
  hasTitleStructure,    // Check if HTML has title-first format
} from '@trace/core';
```

### Theming

The editor receives theme colors via `CoreBridge.configureCSS()` which injects CSS at runtime. Title styling (border, placeholder color) adapts to the current theme.

---

## 🎯 Project Overview

Trace is a cross-platform monorepo application (mobile/web) with shared business logic. The architecture is designed for:
- Maximum code reuse between platforms (80%+ shared)
- Type safety throughout with TypeScript
- Offline-first capabilities
- AI-assisted development
- Clear, maintainable patterns

## 🏗️ Project Structure

```
trace/
├── apps/
│   ├── mobile/                 # React Native/Expo mobile app
│   │   └── src/
│   │       ├── modules/           # Feature modules (mirrors core)
│   │       │   └── [feature]/
│   │       │       ├── screens/      # Mobile screens
│   │       │       └── components/   # Mobile-specific components
│   │       └── shared/            # Mobile-specific shared code
│   └── web/                    # React web app
│       └── src/
│           ├── modules/           # Feature modules (mirrors core)
│           │   └── [feature]/
│           │       ├── pages/        # Web pages
│           │       └── components/   # Web-specific components
│           └── shared/            # Web-specific shared code
├── packages/
│   └── core/                   # Shared business logic (@trace/core)
│       └── src/
│           ├── modules/           # Business domain modules
│           │   └── [domain]/         # e.g., auth, users, posts
│           │       ├── {domain}Api.ts      # Database operations
│           │       ├── {domain}Hooks.ts    # React Query hooks
│           │       ├── {Domain}Types.ts    # TypeScript types (PascalCase)
│           │       ├── {domain}Helpers.ts  # Pure utility functions
│           │       └── index.ts            # Public exports
│           └── shared/            # Cross-module utilities
│               ├── supabase.ts       # Database client
│               ├── constants.ts      # App-wide constants
│               └── types.ts          # Generic types
└── supabase/                   # Database schema & migrations
```

## 🏛️ Architecture Philosophy

**Core Principles:**
1. **Write Once, Deploy Everywhere** - Business logic lives in one place, UI adapts per platform
2. **Module-First Organization** - Code organized by business domain, not technical layers
3. **Functions Over Classes** - Simple, testable, composable functions instead of OOP complexity
4. **Offline-First** - React Query + Supabase for seamless offline/online sync
5. **Type Safety Throughout** - TypeScript everywhere with shared type definitions
6. **AI-Assisted Development Ready** - Clear patterns that AI can understand and extend

## 📋 Module File Naming Convention

**STRICT PATTERN - Always follow this:**

- `{module}Api.ts` - Database operations and external API calls (camelCase)
- `{module}Hooks.ts` - React Query hooks for data fetching/mutations (camelCase)
- `{Module}Types.ts` - TypeScript interfaces and types (PascalCase filename)
- `{module}Helpers.ts` - Pure utility functions (calculations, formatting) (camelCase)
- `index.ts` - Public API exports for the module

**Example:** For a "habits" module:
- `habitApi.ts`
- `habitHooks.ts`
- `HabitTypes.ts`
- `habitHelpers.ts`
- `index.ts`

## 📏 Component Size Limits

**These limits keep components maintainable:**

| Metric | Limit | Action if Exceeded |
|--------|-------|-------------------|
| Lines of code | ~300 max | Split into sub-components |
| useState/useRef calls | ~10 max | Extract to custom hook |
| Total hooks | ~15 max | Extract to custom hook |
| Props | ~8 max | Consider composition or context |

**When limits are exceeded, refactor into:**
```
ComponentName/
├── ComponentName.tsx       # Main orchestrator (~150-200 lines)
├── hooks/
│   └── useComponentState.ts    # Extracted state logic
├── components/
│   ├── ComponentHeader.tsx
│   ├── ComponentBody.tsx
│   └── ComponentFooter.tsx
└── index.ts
```

---

## 🎭 The Four-Layer Architecture - Single Source of Truth

This is the CORE pattern for all data management. Follow it exactly.

### 1️⃣ API Layer (`{module}Api.ts`)
- Direct database operations via Supabase
- Handles auth and error throwing
- **NOT exported to components** - internal use only
- **CRITICAL:** Exclude client-side fields when inserting/updating

```typescript
// habitApi.ts - INTERNAL, not exported
export async function createHabit(habitData: Habit): Promise<Habit> {
  // Critical: Exclude client-side fields from database operations
  const { entries, id, user_id, created_at, updated_at, ...dbFields } = habitData;

  const { data, error } = await supabase
    .from("habits")
    .insert({ user_id: user.id, ...dbFields })
    .select()
    .single();

  if (error) throw error;
  return data;
}
```

### 2️⃣ Hooks Layer (`{module}Hooks.ts`)
- Wraps API functions with React Query
- Handles caching, optimistic updates, invalidation
- **Exposes ONE unified hook as the single source of truth**
- Internal hooks are NOT exported

```typescript
// habitHooks.ts
// Internal hooks (NOT exported)
function useHabitsQuery(status?: string) {
  return useQuery({
    queryKey: ["habits", status],
    queryFn: () => getHabits(status),
  });
}

// Internal mutation with optimistic update
function useUpdateHabitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateHabit,
    // Optimistic update for instant UI feedback
    onMutate: async (newHabit) => {
      await queryClient.cancelQueries({ queryKey: ["habits"] });
      const previous = queryClient.getQueryData(["habits"]);
      queryClient.setQueryData(["habits"], (old: Habit[]) =>
        old.map(h => h.id === newHabit.id ? { ...h, ...newHabit } : h)
      );
      return { previous };
    },
    onError: (err, newHabit, context) => {
      queryClient.setQueryData(["habits"], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["habits"] });
    },
  });
}

// THE SINGLE SOURCE OF TRUTH - Only this is exported
export function useHabits(status?: string) {
  const habitsQuery = useHabitsQuery(status);
  const createMutation = useCreateHabitMutation();
  const updateMutation = useUpdateHabitMutation();

  return {
    // Data
    habits: habitsQuery.data || [],
    isLoading: habitsQuery.isLoading,
    error: habitsQuery.error,
    refetch: habitsQuery.refetch,

    // Mutations
    habitMutations: {
      createHabit: createMutation.mutateAsync,
      updateHabit: updateMutation.mutateAsync,
      isCreating: createMutation.isPending,
      isUpdating: updateMutation.isPending,
    },
  };
}
```

**Note:** Helpers are NOT re-exported from hooks. Import them directly where needed.

### 3️⃣ Helpers Layer (`{module}Helpers.ts`)
- **Pure calculation functions** - NO side effects
- Business logic and data transformation
- **Import directly where needed** (not through hooks)
- Never fetch data or modify state

```typescript
// habitHelpers.ts - Pure functions
export function getCurrentStreak(habit: Habit): number {
  // Pure calculation based on habit data
  const sortedEntries = [...habit.entries].sort((a, b) =>
    b.entry_date.localeCompare(a.entry_date)
  );
  // Calculate streak...
  return streak;
}

export function isDateScheduled(habit: Habit, dateStr: string): boolean {
  // Pure business logic - no side effects
  switch (habit.frequency_type) {
    case "daily": return true;
    case "specific_days": // Check day of week
    // etc...
  }
}
```

**Usage - import helpers directly:**
```typescript
import { useHabits } from "@trace/core";
import { getCurrentStreak, isDateScheduled } from "@trace/core";

function HabitCard({ habit }: Props) {
  const streak = getCurrentStreak(habit);  // Direct import, not from hook
  // ...
}
```

### 4️⃣ Components Layer (Pages/Screens and Components)
- **Screen/Page components** use hooks to fetch data
- **Child components** typically receive props, but CAN use hooks when appropriate
- All components can use helper functions directly

**Data Fetching Location Guidelines:**

| Scenario | Where to Fetch |
|----------|----------------|
| Screen/Page level data | In the Screen/Page component |
| Data only one component needs | In that component (co-located) |
| Data shared by siblings | In parent, pass as props |
| Self-contained widgets (e.g., UserAvatar) | In the widget itself |
| Data passed 3+ levels deep | Consider co-locating or context |

**Screen Component (Fetches Data):**
```typescript
// screens/HabitsScreen.tsx
export function HabitsScreen() {
  const { habits, isLoading, error, habitMutations } = useHabits("active");

  if (isLoading) return <HabitListSkeleton />;
  if (error) return <ErrorState onRetry={refetch} />;

  return (
    <View>
      {habits.map(habit => (
        <HabitCard
          key={habit.id}
          habit={habit}
          onDayPress={(date) => handleDayPress(habit, date)}
        />
      ))}
    </View>
  );
}
```

**Presentational Component (Receives Props):**
```typescript
// components/HabitCard.tsx
interface HabitCardProps {
  habit: Habit;
  onDayPress: (date: string) => void;
}

export const HabitCard = React.memo(function HabitCard({
  habit,
  onDayPress
}: HabitCardProps) {
  // Import helpers directly
  const currentStreak = getCurrentStreak(habit);

  return (
    <View>
      <Text>{habit.name}</Text>
      <Text>{currentStreak} day streak</Text>
    </View>
  );
});
```

**Self-Contained Widget (Fetches Own Data):**
```typescript
// components/UserAvatar.tsx - Used in many places
export function UserAvatar({ userId, size = "md" }: Props) {
  // This is OK - self-contained, used everywhere, needs only user data
  const { user } = useUser(userId);

  return <Avatar src={user?.avatar_url} size={size} />;
}
```

**When Child Components CAN Use Hooks:**
1. Self-contained widgets used in many different parents
2. Component needs different data than parent has
3. Avoiding prop drilling through 3+ levels
4. Data is cached anyway (React Query deduplicates requests)

## 🧠 Memoization Guidelines

**Don't over-memoize. Only use when necessary:**

### `useMemo` - For expensive calculations
```typescript
// ✅ DO: Expensive calculation or filtering large arrays
const filteredEntries = useMemo(() =>
  entries.filter(e => complexFilterLogic(e)),
  [entries, filterCriteria]
);

// ❌ DON'T: Simple calculations
const fullName = useMemo(() => `${first} ${last}`, [first, last]); // Overkill
const fullName = `${first} ${last}`; // Just do this
```

### `useCallback` - Only for memoized children
```typescript
// ✅ DO: Callback passed to React.memo component
const handlePress = useCallback((id: string) => {
  updateItem(id);
}, [updateItem]);

<MemoizedList onItemPress={handlePress} />

// ❌ DON'T: Callback not passed to memoized component
const handlePress = useCallback(() => setOpen(true), []); // Unnecessary
const handlePress = () => setOpen(true); // Just do this
```

### `React.memo` - For pure presentational components
```typescript
// ✅ DO: List items rendered many times
export const EntryListItem = React.memo(function EntryListItem({
  entry,
  onPress
}: Props) {
  return <View>...</View>;
});

// ❌ DON'T: Components that always re-render anyway
// (receiving new objects/callbacks each time)
```

**Rule of thumb:** Profile first, memoize second. Premature memoization adds complexity without benefit.

---

## 🪝 Custom Hook Extraction Pattern

**Extract a custom hook when:**
1. Component has >10 useState/useRef calls
2. Logic is reusable across multiple components
3. Logic is complex enough to warrant isolated testing
4. You need to share stateful logic (not just calculations)

**Pattern:**
```typescript
// hooks/useCaptureFormState.ts
export function useCaptureFormState(initialData?: Partial<Entry>) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [content, setContent] = useState(initialData?.content || "");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  // ... more related state

  const resetForm = useCallback(() => {
    setTitle("");
    setContent("");
    setCategoryId(null);
  }, []);

  const hasChanges = useMemo(() =>
    title !== initialData?.title || content !== initialData?.content,
    [title, content, initialData]
  );

  return {
    // State
    title, setTitle,
    content, setContent,
    categoryId, setCategoryId,
    // Derived
    hasChanges,
    // Actions
    resetForm,
  };
}

// Component uses the hook
export function CaptureForm({ entryId }: Props) {
  const formState = useCaptureFormState(initialData);
  const { entries, entryMutations } = useEntries();

  // Component is now focused on rendering, not state management
}
```

**Naming convention:** `use{Feature}{Purpose}.ts`
- `useCaptureFormState.ts` - form state management
- `useCaptureFormPhotos.ts` - photo handling logic
- `useLocationPicker.ts` - location picker logic

---

## 📝 Form Management

**Choose based on complexity:**

| Form Size | Approach |
|-----------|----------|
| 1-3 fields | Individual `useState` |
| 4-7 fields | Extract to custom hook |
| 8+ fields | Consider form library (react-hook-form) |

**Simple form (useState):**
```typescript
function SimpleForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  return <form>...</form>;
}
```

**Complex form (custom hook):**
```typescript
function ComplexForm() {
  const formState = useComplexFormState();
  const { formMutations } = useFormData();

  return <form>...</form>;
}
```

**Validation:** Use Zod schemas that can be shared with API layer:
```typescript
// In Types file
export const EntrySchema = z.object({
  title: z.string().max(200),
  content: z.string(),
  category_id: z.string().uuid().nullable(),
});

export type Entry = z.infer<typeof EntrySchema>;
```

---

## 📋 Form Component Pattern (Data Ownership)

**CRITICAL: Forms should NOT fetch or save their own data.**

This prevents the common AI-generated anti-pattern of creating dozens of individual useState calls for each field.

### The Pattern

**Parent (Screen/Page) responsibilities:**
- Fetches data using hooks
- Passes complete data object as prop to form
- Handles `onSave(editedData)` callback
- Handles `onCancel()` callback
- Performs actual save operation
- Handles navigation after save

**Child (Form) responsibilities:**
- Receives initial data as prop
- Stores ONE working copy in state: `useState(initialData)`
- Updates the single state object as user edits
- Calls `onSave(editedData)` when done
- Calls `onCancel()` to discard changes
- **NO data fetching hooks**
- **NO save/mutation logic**

### Example Implementation

**Parent Screen:**
```typescript
// screens/EntryEditScreen.tsx
export function EntryEditScreen({ entryId }: Props) {
  const { navigate } = useNavigation();
  const { entry, isLoading } = useEntry(entryId);
  const { entryMutations } = useEntries();

  if (isLoading) return <LoadingScreen />;
  if (!entry) return <NotFoundScreen />;

  const handleSave = async (editedEntry: Entry) => {
    await entryMutations.updateEntry(entryId, editedEntry);
    navigate("inbox");
  };

  const handleCancel = () => {
    navigate("inbox");
  };

  return (
    <EntryForm
      entry={entry}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
```

**Child Form:**
```typescript
// components/EntryForm.tsx
interface EntryFormProps {
  entry: Entry;                    // Complete entry object
  onSave: (entry: Entry) => void;  // Return edited entry
  onCancel: () => void;
}

export function EntryForm({ entry, onSave, onCancel }: EntryFormProps) {
  // ONE state for the entire entry - not individual fields!
  const [formData, setFormData] = useState<Entry>(entry);

  // Update single fields within the object
  const updateField = <K extends keyof Entry>(field: K, value: Entry[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    onSave(formData);  // Return edited entry to parent
  };

  return (
    <View>
      <TextInput
        value={formData.title}
        onChangeText={(text) => updateField("title", text)}
      />
      <TextInput
        value={formData.content}
        onChangeText={(text) => updateField("content", text)}
      />
      <CategoryPicker
        value={formData.category_id}
        onChange={(id) => updateField("category_id", id)}
      />

      <Button onPress={handleSubmit}>Save</Button>
      <Button onPress={onCancel}>Cancel</Button>
    </View>
  );
}
```

### ❌ Anti-Pattern: Individual useState per Field

**DO NOT DO THIS:**
```typescript
// ❌ WRONG - Creates 40+ useState calls, unmaintainable
function BadForm({ entryId }: Props) {
  // Fetching in the form - wrong!
  const { entry } = useEntry(entryId);

  // Individual state for each field - wrong!
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState(null);
  const [date, setDate] = useState(null);
  const [priority, setPriority] = useState(0);
  const [status, setStatus] = useState("draft");
  const [rating, setRating] = useState(0);
  // ... 30 more useState calls ...

  // Initialize from fetched data - complex sync logic
  useEffect(() => {
    if (entry) {
      setTitle(entry.title);
      setContent(entry.content);
      // ... set 30 more fields ...
    }
  }, [entry]);

  // Save directly in form - wrong!
  const handleSave = async () => {
    await updateEntry(entryId, { title, content, ... });
  };
}
```

### Why This Pattern Matters

1. **Single source of truth** - One state object, not 40 scattered useState calls
2. **Easy to track changes** - Compare `formData` with original `entry`
3. **Simple unsaved changes detection** - `JSON.stringify(formData) !== JSON.stringify(entry)`
4. **Type-safe** - TypeScript validates the entire Entry shape
5. **Easy to reset** - Just `setFormData(entry)` to discard changes
6. **Testable** - Form is pure, parent handles side effects
7. **AI-resistant** - Pattern is explicit enough that AI won't generate the bad version

---

## 📋 List/Detail Data Fetching Pattern

The most common pattern in applications: a list of items, click to view/edit details.

### The Problem: Two Approaches

**Option A: Pass ID to Detail Screen**
```
List → navigate(id) → Detail fetches by ID
```
- ✅ Always fresh data
- ✅ Works for deep links / bookmarks
- ❌ Extra network request
- ❌ Loading state on navigation

**Option B: Pass Entity Object**
```
List → navigate(entity) → Detail uses entity directly
```
- ✅ Instant display
- ❌ Data could be stale
- ❌ Can't deep-link without data

### The Solution: React Query Cache

**React Query gives you both benefits.** Pass the ID, but data is instant from cache:

```typescript
// List Screen - fetches and caches entries
function EntryListScreen() {
  const { entries } = useEntries();  // Data cached by React Query

  return entries.map(entry => (
    <EntryRow
      entry={entry}
      onPress={() => navigate("capture", { entryId: entry.id })}
    />
  ));
}

// Detail Screen - uses cached data, refreshes in background
function EntryScreen({ entryId }: Props) {
  const { entry, isLoading } = useEntry(entryId);

  // INSTANT: React Query returns cached data from list query
  // FRESH: Background refresh happens automatically if stale

  if (!entry && isLoading) return <Loading />;  // Only on deep-link
  if (!entry) return <NotFound />;

  return <CaptureForm entry={entry} onSave={handleSave} />;
}
```

**How it works:**
1. List screen fetches entries → cached by React Query
2. User taps entry → navigate with just `entryId`
3. Detail screen calls `useEntry(entryId)`
4. React Query returns cached data **immediately**
5. In background, React Query checks staleness and refetches if needed
6. If data changed on server, UI updates automatically

### Edit vs Create: Different Data Sources

**Editing (fetch by ID):**
```typescript
function EntryScreen({ entryId }: Props) {
  const { entry } = useEntry(entryId);  // From cache = instant

  return <CaptureForm entry={entry} onSave={handleUpdate} />;
}
```

**Creating (build new object):**
```typescript
function EntryScreen({ initialData }: Props) {
  // No fetch needed - build new entry with defaults
  const newEntry: Partial<Entry> = {
    title: "",
    content: "",
    category_id: initialData?.categoryId ?? null,
    date: initialData?.date ?? new Date().toISOString(),
    ...initialData,  // Pre-populate any passed values
  };

  return <CaptureForm entry={newEntry} onSave={handleCreate} />;
}
```

### Combined Pattern: Edit or Create

```typescript
interface EntryScreenProps {
  entryId?: string;              // If editing existing
  initialData?: Partial<Entry>;  // If creating new (pre-populated)
}

export function EntryScreen({ entryId, initialData }: EntryScreenProps) {
  const { navigate } = useNavigation();
  const { entry, isLoading } = useEntry(entryId ?? null);
  const { entryMutations } = useEntries();

  const isEditing = !!entryId;

  // Build entry for form: fetched (edit) or new (create)
  const formEntry: Partial<Entry> = isEditing
    ? entry
    : { title: "", content: "", ...initialData };

  // Loading only when editing AND cache miss (e.g., deep-link)
  if (isEditing && !entry && isLoading) {
    return <LoadingScreen />;
  }

  const handleSave = async (editedEntry: Entry) => {
    if (isEditing) {
      await entryMutations.updateEntry(entryId, editedEntry);
    } else {
      await entryMutations.createEntry(editedEntry);
    }
    navigate("inbox");
  };

  return (
    <CaptureForm
      entry={formEntry}
      onSave={handleSave}
      onCancel={() => navigate("inbox")}
    />
  );
}
```

### Summary: When to Use What

| Scenario | Navigation Params | Data Source |
|----------|-------------------|-------------|
| List → Edit | `{ entryId }` | `useEntry(id)` - instant from cache |
| Create New | `{ initialData? }` | Build object with defaults |
| Deep Link | `{ entryId }` | `useEntry(id)` - fetches if not cached |

**Key insight:** With React Query, passing ID vs passing entity is equivalent in practice. The cache makes ID-based fetching instant while keeping data fresh.

---

## ⏳ Loading & Error States

**Consistent patterns for async states:**

```typescript
// Screen/Page level
export function EntriesPage() {
  const { entries, isLoading, error } = useEntries();

  if (isLoading) {
    return <EntryListSkeleton />; // Skeleton loader for content
  }

  if (error) {
    return (
      <ErrorState
        message="Failed to load entries"
        onRetry={() => refetch()}
      />
    );
  }

  if (entries.length === 0) {
    return <EmptyState message="No entries yet" />;
  }

  return <EntryList entries={entries} />;
}
```

**Button/Action loading:**
```typescript
<Button
  onPress={handleSave}
  disabled={isSaving}
>
  {isSaving ? <Spinner size="small" /> : "Save"}
</Button>
```

**Guidelines:**
- Use **skeleton loaders** for content areas (lists, cards)
- Use **spinners** for buttons and actions
- Always provide **retry option** for failed queries
- Show **empty states** when data loads but is empty

---

## ❌ Common Anti-Patterns to AVOID

**DO NOT DO THESE:**

```typescript
// ❌ DON'T: Fetch full list to find one item
export function HabitCard({ habitId }) {
  const { habits } = useHabits();  // Wrong! Fetching all to find one
  const habit = habits.find(h => h.id === habitId);
}
// ✅ DO: Either pass the habit as prop, or use useHabit(habitId)

// ❌ DON'T: Direct API calls in components
export function HabitCard({ habit }) {
  const handleComplete = async () => {
    await createHabitEntry(...);  // Wrong! Use mutations from hook
  };
}
// ✅ DO: Use habitMutations.createEntry() from the hook

// ❌ DON'T: Complex business logic in components
export function HabitCard({ habit }) {
  // Wrong! Complex calculation should be in helpers
  const streak = habit.entries.reduce((count, entry) => {
    // 20 lines of calculation...
  });
}
// ✅ DO: const streak = getCurrentStreak(habit); // Import from helpers

// ❌ DON'T: Including client fields in database operations
export async function createHabit(data: Habit) {
  // Wrong! Will fail - 'entries' doesn't exist in DB
  await supabase.from("habits").insert(data);
}
// ✅ DO: const { entries, ...dbFields } = data; insert(dbFields);

// ❌ DON'T: Creating service classes
export class UserService {
  static async getUser(userId: string) { ... }
}
// ✅ DO: export async function getUser(userId: string) { ... }

// ❌ DON'T: Using relative imports to core
import { useUsers } from "../../../packages/core/src/modules/users";
// ✅ DO: import { useUsers } from "@trace/core";

// ❌ DON'T: Over-memoizing everything
const name = useMemo(() => user.name, [user.name]);  // Pointless
const onClick = useCallback(() => setOpen(true), []);  // Often unnecessary
// ✅ DO: Only memoize expensive calculations or for React.memo children
```

## ✅ Service Function Rules

**DO:**
```typescript
// Simple function pattern
export async function getUser(userId: string) {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}
```

**Key Principles:**
1. **One function = One operation** - Each function does exactly one thing
2. **Throw errors directly** - Let components/hooks handle with try/catch
3. **No ServiceResponse wrappers** - Return data directly, throw errors
4. **Descriptive names** - `createUser()` not `create()`
5. **Colocate by module** - All user operations in `users/userApi.ts`
6. **Auth checks in functions** - Each function validates auth if needed
7. **No state in services** - Services are stateless, state lives in React

## 📦 Module Exports Pattern

```typescript
// modules/habits/index.ts
export * from "./habitHooks";    // The unified hook
export * from "./HabitTypes";    // All TypeScript types
export * from "./habitHelpers";  // All pure functions
// NO export of habitApi - it's internal only!
```

## 📝 Import Pattern

```typescript
// Always import from package name
import { useUsers, type User } from "@trace/core";
import { formatUserName, isUserActive } from "@trace/core";  // Helpers

// Never use relative paths to core
// ❌ import { useUsers } from "../../../packages/core/src/modules/users";

// Never import API functions in components (they're internal)
// ❌ import { createUser } from "@trace/core";  // API functions not exported
```

## 🎨 Tech Stack

### Mobile Stack
- React Native 0.81+ with Expo SDK 54
- React Native StyleSheet for styling
- Custom navigation (stack-based, no React Navigation)
- React Native Elements for UI components

### Web Stack
- React 19+ with Vite 7+
- Tailwind CSS with Class Variance Authority
- React Router v7 for routing
- Custom components with clsx/tailwind-merge

### Shared Stack
- TypeScript everywhere
- Supabase for backend (PostgreSQL, Auth, Storage, Realtime)
- React Query (TanStack Query) for data fetching
- Vitest for testing

## 🔐 Error Handling Pattern

```typescript
// In service
export async function updateUser(id: string, data: any) {
  const { data: result, error } = await supabase
    .from("users")
    .update(data)
    .eq("id", id);

  if (error) throw error;  // Throw directly
  return result;
}

// In component/hook
try {
  const user = await updateUser(id, updates);
  // Handle success
} catch (error) {
  // Handle error
}
```

## 🔑 Database Type Safety

```typescript
// Important: Exclude client-side fields when inserting
export async function createItem(data: Item) {
  // Remove fields that don't exist in database
  const { clientField, id, created_at, ...dbFields } = data;

  const { data: result, error } = await supabase
    .from("items")
    .insert(dbFields)
    .select()
    .single();

  if (error) throw error;
  return result;
}
```

## 🚨 Critical Pitfalls to Avoid

1. **Don't exceed component size limits** - Max ~300 lines, ~15 hooks
2. **Don't create service classes** - Use simple functions
3. **Don't forget to exclude client fields** - When inserting to database
4. **Don't use relative imports to core** - Always use @trace/core
5. **Don't skip building shared package** - Required before running apps
6. **Don't commit config.json** - Contains secrets
7. **Don't over-memoize** - Profile first, memoize second
8. **Don't re-export helpers through hooks** - Import helpers directly

## 📈 The Complete Data Flow

```
User Action → Component → Unified Hook → React Query → API Layer → Database
     ↑            ↓            ↓                ↓           ↓          ↓
     ←────── UI Update ← Cached Data ← Optimistic ← Response ←────────←
                  ↓
             Helper Functions (calculations)
```

## 🎯 Key Success Factors

1. **Module Boundaries** - Each module is self-contained with clear exports
2. **Type Safety** - TypeScript catches errors before runtime
3. **Offline-First** - React Query ensures app works without internet
4. **Code Sharing** - 80% of logic shared between platforms
5. **Clear Patterns** - Consistent patterns that AI can learn and apply
6. **Fast Iteration** - Watch mode and hot reload for rapid development

## 🔄 When Creating a New Module

```bash
# 1. Create module structure
mkdir -p packages/core/src/modules/posts
cd packages/core/src/modules/posts

# 2. Create files following naming convention
touch postApi.ts postHooks.ts PostTypes.ts postHelpers.ts index.ts

# 3. Export from core package
# Edit packages/core/src/index.ts:
# export * from "./modules/posts";

# 4. Create UI in apps
mkdir -p apps/web/src/modules/posts/{pages,components}
mkdir -p apps/mobile/src/modules/posts/{screens,components}
```

---

## 🔌 MCP Server Deployment

The MCP (Model Context Protocol) server allows Claude.ai and other AI clients to access Trace data via OAuth 2.1.

### Architecture

```
api/mcp/                    # Vercel Edge Function deployment
├── api/                    # Edge function code (Vercel convention)
│   ├── index.ts           # Main handler - routes all requests
│   ├── auth.ts            # API key validation
│   ├── oauth.ts           # OAuth 2.1 implementation
│   ├── sse.ts             # Server-sent events support
│   ├── types.ts           # MCP types
│   └── tools/             # MCP tool implementations
│       ├── mod.ts         # Tool registry and dispatcher
│       ├── entries.ts     # Entry CRUD operations
│       ├── streams.ts     # Stream operations
│       └── attachments.ts # Attachment URL generation
├── vercel.json            # Routing configuration
├── package.json           # Dependencies (@supabase/supabase-js)
└── .vercel/               # Vercel project link (gitignored)
```

### Deployment

**Prerequisites:**
- Vercel account linked to mindjig-projects team
- Supabase API keys from dashboard

**Deploy:**
```bash
cd api/mcp
npx vercel --prod --yes
```

**If "missing_scope" error:** The `.vercel/` folder is gitignored. Create it manually:
```bash
mkdir -p api/mcp/.vercel
cat > api/mcp/.vercel/project.json << 'EOF'
{
  "orgId": "team_0OgQw0913bFe7FuW09UKZhZa",
  "projectId": "prj_KVxeJI4AalU5X8ReogAdQim0WhuK"
}
EOF
```

**Environment Variables (in Vercel dashboard):**

| Variable | Source |
|----------|--------|
| `SUPABASE_URL` | `https://lsszorssvkavegobmqic.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase → Settings → API → anon/public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role/secret |

**URLs:**
- Production: https://trace-mcp.mindjig.com
- Vercel default: https://trace-mcp.vercel.app

### Testing

```bash
# Discovery endpoint (no auth)
curl https://trace-mcp.mindjig.com/mcp

# OAuth metadata
curl https://trace-mcp.mindjig.com/.well-known/oauth-protected-resource

# Auth server metadata
curl https://trace-mcp.mindjig.com/.well-known/oauth-authorization-server
```

### OAuth 2.1 Flow

1. Client discovers OAuth via `/.well-known/oauth-protected-resource`
2. Client registers dynamically via `/oauth/register` (RFC 7591)
3. Client initiates auth via `/oauth/authorize` with PKCE
4. User logs in via Supabase at `/oauth/login`
5. Callback returns auth code to client
6. Client exchanges code for token at `/oauth/token`
7. Client uses token for MCP requests

### Custom Domain

Domain `trace-mcp.mindjig.com` is configured via:
- Vercel: Project → Settings → Domains
- Porkbun DNS: A record → `76.76.21.21`

---

**Remember:** Follow these patterns exactly. They have been battle-tested in production and are designed for AI-assisted development. Consistency is critical.