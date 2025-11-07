# Cross-Platform App Project Startup Template

*A battle-tested monorepo architecture for building cross-platform (mobile/web) applications with shared business logic*

## 🎯 Architecture Philosophy

This template represents months of refinement building a production app. It embodies these core principles:

1. **Write Once, Deploy Everywhere** - Business logic lives in one place, UI adapts per platform
2. **Module-First Organization** - Code organized by business domain, not technical layers
3. **Functions Over Classes** - Simple, testable, composable functions instead of OOP complexity
4. **Offline-First** - React Query + Supabase for seamless offline/online sync
5. **Type Safety Throughout** - TypeScript everywhere with shared type definitions
6. **AI-Assisted Development Ready** - Clear patterns that AI can understand and extend

## 🏗️ Project Structure

```
your-app/
├── apps/
│   ├── mobile/                 # React Native/Expo mobile app
│   │   ├── src/
│   │   │   ├── modules/           # Feature modules (mirrors core)
│   │   │   │   ├── auth/
│   │   │   │   │   ├── screens/      # Mobile screens
│   │   │   │   │   └── components/   # Mobile-specific components
│   │   │   │   ├── [feature]/        # Each feature follows same pattern
│   │   │   │   └── ...
│   │   │   ├── shared/            # Mobile-specific shared code
│   │   │   │   ├── components/       # Reusable UI components
│   │   │   │   └── contexts/         # React contexts
│   │   │   └── App.tsx            # Main app entry
│   │   ├── app.json               # Expo configuration
│   │   └── package.json
│   └── web/                    # React web app
│       ├── src/
│       │   ├── modules/           # Feature modules (mirrors core)
│       │   │   ├── auth/
│       │   │   │   ├── pages/        # Web pages
│       │   │   │   └── components/   # Web-specific components
│       │   │   ├── [feature]/        # Each feature follows same pattern
│       │   │   └── ...
│       │   ├── shared/            # Web-specific shared code
│       │   └── App.tsx            # Main app with routing
│       ├── index.html
│       ├── vite.config.ts         # Vite configuration
│       └── package.json
├── packages/
│   └── core/                   # Shared business logic (@yourapp/core)
│       ├── src/
│       │   ├── modules/           # Business domain modules
│       │   │   └── [domain]/         # e.g., auth, users, posts
│       │   │       ├── {domain}Api.ts      # Database operations
│       │   │       ├── {domain}Hooks.ts    # React Query hooks
│       │   │       ├── {Domain}Types.ts    # TypeScript types (PascalCase)
│       │   │       ├── {domain}Helpers.ts  # Pure utility functions
│       │   │       └── index.ts            # Public exports
│       │   ├── shared/            # Cross-module utilities
│       │   │   ├── supabase.ts       # Database client
│       │   │   ├── constants.ts      # App-wide constants
│       │   │   ├── dateUtils.ts      # Date utilities
│       │   │   ├── logger.ts         # Logging utility
│       │   │   └── types.ts          # Generic types
│       │   └── index.ts           # Package exports
│       ├── config.json            # Environment config (gitignored)
│       ├── config.example.json    # Config template
│       └── package.json
├── supabase/                   # Database schema & migrations
├── package.json                # Root with npm workspaces
├── tsconfig.json               # Root TypeScript config
└── CLAUDE.md                   # AI assistant instructions
```

## 📦 Initial Setup Commands

### 1. Create the Monorepo Structure

```bash
# Create project
mkdir your-app && cd your-app

# Initialize root package.json with workspaces
npm init -y
```

### 2. Root package.json Configuration

```json
{
  "name": "your-app-monorepo",
  "version": "1.0.0",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev": "npm run dev:web",
    "dev:mobile": "cd apps/mobile && npm run dev",
    "dev:web": "cd apps/web && npm run dev",
    "dev:all": "concurrently \"npm run dev:mobile\" \"npm run dev:web\"",
    "build:shared": "cd packages/core && npm run build",
    "build:web": "cd apps/web && npm run build",
    "type-check": "npm run type-check:mobile && npm run type-check:web",
    "type-check:mobile": "cd apps/mobile && npm run type-check",
    "type-check:web": "cd apps/web && npm run type-check",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "test": "cd packages/core && npm test"
  },
  "devDependencies": {
    "@vitest/ui": "^3.2.4",
    "concurrently": "^8.2.2",
    "prettier": "^3.6.2",
    "typescript": "^5.9.2",
    "vitest": "^3.2.4"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  },
  "overrides": {
    "react": "19.1.0",
    "react-dom": "19.1.0"
  }
}
```

### 3. Create Core Package

```bash
mkdir -p packages/core/src/{modules,shared}

# packages/core/package.json
cat > packages/core/package.json << 'EOF'
{
  "name": "@yourapp/core",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "clean": "rm -rf dist",
    "test": "vitest",
    "test:ui": "vitest --ui"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.58.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.9.2"
  },
  "peerDependencies": {
    "react": "*",
    "@tanstack/react-query": "*"
  }
}
EOF
```

### 4. Create Web App

```bash
# Use Vite for web
cd apps && npm create vite@latest web -- --template react-ts
cd web

# Update package.json name
# "name": "@yourapp/web"
```

### 5. Create Mobile App

```bash
# Use Expo for mobile
cd apps && npx create-expo-app mobile --template blank-typescript
cd mobile

# Update package.json name
# "name": "@yourapp/mobile"
```

## 🏛️ Service Architecture Standards

### Module File Naming Convention

Each module follows this strict pattern:

- `{module}Api.ts` - Database operations and external API calls
- `{module}Hooks.ts` - React Query hooks for data fetching/mutations
- `{Module}Types.ts` - TypeScript interfaces and types (PascalCase filename)
- `{module}Helpers.ts` - Pure utility functions (calculations, formatting)
- `index.ts` - Public API exports for the module

### Service Function Rules

**✅ DO:**
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

**❌ DON'T:**
```typescript
// No classes or unnecessary wrappers
export class UserService {
  static async getUser(userId: string) {
    return this.handleRequest(/* ... */);
  }
}
```

### Key Principles

1. **One function = One operation** - Each function does exactly one thing
2. **Throw errors directly** - Let components/hooks handle with try/catch
3. **No ServiceResponse wrappers** - Return data directly, throw errors
4. **Descriptive names** - `createUser()` not `create()`
5. **Colocate by module** - All user operations in `users/userApi.ts`
6. **Auth checks in functions** - Each function validates auth if needed
7. **No state in services** - Services are stateless, state lives in React
8. **Export hooks from modules** - Use React Query pattern

## 🎭 Component Data Management Pattern - Single Source of Truth

### The Four-Layer Architecture

After extensive refinement, this architecture achieves a true single source of truth through four distinct layers:

#### 1️⃣ **API Layer** (`{module}Api.ts`)
- Direct database operations via Supabase
- Handles auth and error throwing
- NOT exported to components - internal use only
- Excludes client-side fields when inserting/updating

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

#### 2️⃣ **Hooks Layer** (`{module}Hooks.ts`)
- Wraps API functions with React Query
- Handles caching, optimistic updates, invalidation
- Exposes ONE unified hook as the single source of truth
- Internal hooks are NOT exported

```typescript
// habitHooks.ts - Internal hooks (not exported)
function useHabitsQuery(status?: string) {
  return useQuery({
    queryKey: ["habits", status],
    queryFn: () => getHabits(status),
  });
}

// THE SINGLE SOURCE OF TRUTH - Only this is exported
export function useHabits(status?: string) {
  const habitsQuery = useHabitsQuery(status);
  const createMutation = useCreateHabit();
  const updateMutation = useUpdateHabit();

  return {
    // Data
    habits: habitsQuery.data || [],
    isLoading: habitsQuery.isLoading,
    error: habitsQuery.error,

    // Mutations
    habitMutations: {
      createHabit: createMutation.mutateAsync,
      updateHabit: updateMutation.mutateAsync,
      logEntry: logEntryMutation.mutateAsync,
    },

    // Helpers (all pure functions)
    habitHelpers,
  };
}
```

#### 3️⃣ **Helpers Layer** (`{module}Helpers.ts`)
- Pure calculation functions - NO side effects
- Business logic and data transformation
- Can be used ANYWHERE (parent or child components)
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
  // Pure business logic
  switch (habit.frequency_type) {
    case "daily": return true;
    case "specific_days": // Check day of week
    case "x_per_period": // Check period
    // etc...
  }
}
```

#### 4️⃣ **Components Layer** (Pages/Screens and Components)
- Parent components use the unified hook
- Child components receive props
- Both can use helper functions

### Container/Presentational Pattern with Single Source

**Parent Component (Container):**
```typescript
// pages/HabitsPage.tsx
export function HabitsPage() {
  // SINGLE SOURCE OF TRUTH - One hook provides everything
  const { habits, isLoading, error, habitMutations } = useHabits("active");

  const handleDayPress = (habit: Habit, date: string) => {
    // Parent handles interactions
    setSelectedHabit(habit);
    setSelectedDate(date);
    setModalVisible(true);
  };

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage />;

  return (
    <div>
      {habits.map(habit => (
        <HabitCard
          key={habit.id}
          habit={habit}  // Pass full habit with entries
          onDayPress={(date) => handleDayPress(habit, date)}
        />
      ))}
    </div>
  );
}
```

**Child Component (Presentational):**
```typescript
// components/HabitCard.tsx
interface HabitCardProps {
  habit: Habit;  // Receives complete data
  onDayPress: (date: string) => void;
}

export function HabitCard({ habit, onDayPress }: HabitCardProps) {
  // Use helpers for calculations (pure functions)
  const currentStreak = getCurrentStreak(habit);
  const totalCompleted = getTotalCompleted(habit);

  // Child NEVER fetches data
  // NO useHabits() hook here
  // Just render what was passed

  return (
    <div onClick={() => navigate(`/habits/${habit.id}`)}>
      <h3>{habit.name}</h3>
      <span>🔥 {currentStreak}</span>
      <span>✓ {totalCompleted}</span>

      {getLast7Days().map(date => {
        const entry = habit.entries.find(e => e.entry_date === date);
        const status = getHabitDayStatus(habit, date, entry);
        // Render day...
      })}
    </div>
  );
}
```

### Module Exports Pattern

```typescript
// modules/habits/index.ts
export * from "./habitHooks";    // The unified hook
export * from "./HabitTypes";    // All TypeScript types
export * from "./habitHelpers";  // All pure functions
// NO export of habitApi - it's internal only!
```

### Why This Pattern Works

1. **Single Source of Truth**: The unified hook (`useHabits`) is the ONLY way to get habit data
2. **No Duplicate Fetching**: Data is fetched once at parent level, passed down
3. **Consistent State**: All components see the same cached data via React Query
4. **Pure Calculations**: Helpers can be used anywhere without side effects
5. **Type Safety**: Full TypeScript types flow through all layers
6. **Testable**: Helpers are pure functions, components are predictable
7. **Offline-First**: React Query handles offline caching automatically

### Common Anti-Patterns to Avoid

```typescript
// ❌ DON'T: Child component fetching data
export function HabitCard({ habitId }) {
  const { habits } = useHabits();  // Wrong! Parent should fetch
  const habit = habits.find(h => h.id === habitId);
}

// ❌ DON'T: Direct API calls in components
export function HabitCard({ habit }) {
  const handleComplete = async () => {
    await createHabitEntry(...);  // Wrong! Use mutations from hook
  };
}

// ❌ DON'T: Business logic in components
export function HabitCard({ habit }) {
  // Wrong! This should be in helpers
  const streak = habit.entries.reduce((count, entry) => {
    // Complex calculation...
  });
}

// ❌ DON'T: Including client fields in database operations
export async function createHabit(data: Habit) {
  // Wrong! Will fail - 'entries' doesn't exist in DB
  await supabase.from("habits").insert(data);
}
```

### The Complete Data Flow

```
User Action → Component → Unified Hook → React Query → API Layer → Database
     ↑            ↓            ↓                ↓           ↓          ↓
     ←────── UI Update ← Cached Data ← Optimistic ← Response ←────────←
                  ↓
             Helper Functions (calculations)
```

### Key Insights from Implementation

1. **Exclude client fields**: Always destructure out `entries`, `id`, `created_at` etc. before database operations
2. **Unified hooks**: One hook per module that combines queries, mutations, and helpers
3. **Helper purity**: Keep all calculations in helpers, not components or hooks
4. **Props over hooks**: Children receive data via props, not by calling hooks
5. **Optimistic updates**: React Query handles optimistic updates in the hooks layer
6. **Type narrowing**: Use TypeScript discriminated unions for frequency configs

## 🔑 Critical Configuration

### Supabase Setup

1. **Create config file:** `packages/core/config.json`
```json
{
  "supabase": {
    "url": "https://your-project.supabase.co",
    "anonKey": "your-anon-key-here"
  },
  "environment": "development"
}
```

2. **Add to .gitignore:**
```
packages/core/config.json
```

3. **Create example:** `packages/core/config.example.json`

### Supabase Client with Cross-Platform Support

```typescript
// packages/core/src/shared/supabase.ts
import { createClient } from "@supabase/supabase-js";
import config from "../../config.json";

// Dynamic AsyncStorage loading for React Native
function getAsyncStorage() {
  try {
    const isReactNative =
      (typeof navigator !== "undefined" && navigator.product === "ReactNative") ||
      (typeof global !== "undefined" && (global as any).__fbBatchedBridge);

    if (isReactNative) {
      const AsyncStorageModule = require("@react-native-async-storage/async-storage");
      return AsyncStorageModule.default || AsyncStorageModule;
    }
  } catch (e) {
    // Web environment
  }
  return undefined;
}

const AsyncStorage = getAsyncStorage();

export const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: {
    ...(AsyncStorage ? { storage: AsyncStorage } : {}),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
```

## 📝 Module Creation Template

When adding a new feature module:

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

### Module index.ts Template

```typescript
// packages/core/src/modules/posts/index.ts
export * from "./postHooks";      // All hooks
export * from "./PostTypes";      // All types
export * from "./postHelpers";    // All helpers
// Selective API exports (most stay internal)
export { createPost, deletePost } from "./postApi";
```

## 🚀 Development Workflow

### First-Time Setup
```bash
# 1. Install all dependencies
npm install

# 2. Configure Supabase
cp packages/core/config.example.json packages/core/config.json
# Edit with your credentials

# 3. Build shared package
npm run build:shared

# 4. Start development
npm run dev:web        # For web
npm run dev:mobile     # For mobile
```

### Daily Development
```bash
# Working on shared code?
cd packages/core && npm run dev  # Watch mode

# In another terminal
npm run dev:web  # or dev:mobile

# Working only on UI?
npm run dev:web  # No rebuild needed
```

## 🧪 Testing Strategy

Tests live in the core package alongside the code:

```
packages/core/src/modules/posts/
├── postApi.ts
├── postApi.test.ts        # API tests
├── postHelpers.ts
├── postHelpers.test.ts    # Helper tests
└── ...
```

Run tests:
```bash
npm test              # Run once
npm run test:ui       # Vitest UI
npm run test:coverage # Coverage report
```

## 🎨 Tech Stack Decisions

### Mobile Stack
- **React Native 0.81+** with **Expo SDK 54**
- **React Native StyleSheet** for styling
- **Custom navigation** (stack-based, no React Navigation)
- **React Native Elements** for UI components

### Web Stack
- **React 19+** with **Vite 7+**
- **Tailwind CSS** with Class Variance Authority
- **React Router v7** for routing
- **Custom components** with clsx/tailwind-merge

### Shared Stack
- **TypeScript** everywhere
- **Supabase** for backend (PostgreSQL, Auth, Storage, Realtime)
- **React Query (TanStack Query)** for data fetching
- **Vitest** for testing

## 🔐 Common Patterns

### Error Handling
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

### Database Type Safety
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

### Import Pattern
```typescript
// Always import from @yourapp/core
import { useUsers, createUser, type User } from "@yourapp/core";

// Never use relative paths to core
// ❌ import { useUsers } from "../../../packages/core/src/modules/users";
```

## 📚 CLAUDE.md Template

Create a `CLAUDE.md` file in your project root with your specific rules:

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
[Your app description and key features]

## Development Rules
1. Never make up data - ask if you need information
2. Don't start without confirmation on plans
3. Use minimal tech stack - ask before adding libraries
4. Follow established patterns exactly
5. All code must be maintainable and in the right place
6. Always play a sound when complete (play very last after summary, then say "done")
   - Windows: `ffplay -nodisp -autoexit -loglevel quiet "C:/Projects/complete.wav"`
   - Mac/Linux: `afplay /path/to/complete.wav` or `aplay /path/to/complete.wav`
7. Always play a sound when you need more information (play after asking a question, then say "answer please")
   - Windows: `ffplay -nodisp -autoexit -loglevel quiet "C:/Projects/question.wav"`
   - Mac/Linux: `afplay /path/to/question.wav` or `aplay /path/to/question.wav`

## Tech Stack
[List your specific stack choices]

## Architecture Standards
[Copy relevant sections from this document]
```

## 🎯 Key Success Factors

1. **Module Boundaries** - Each module is self-contained with clear exports
2. **Type Safety** - TypeScript catches errors before runtime
3. **Offline-First** - React Query ensures app works without internet
4. **Code Sharing** - 80% of logic shared between platforms
5. **Clear Patterns** - Consistent patterns that AI can learn and apply
6. **Fast Iteration** - Watch mode and hot reload for rapid development

## 🚨 Common Pitfalls to Avoid

1. **Don't fetch data in child components** - Parents fetch, children display
2. **Don't create service classes** - Use simple functions
3. **Don't forget to exclude client fields** - When inserting to database
4. **Don't use relative imports to core** - Always use package name
5. **Don't skip building shared package** - Required before running apps
6. **Don't commit config.json** - Contains secrets

## 🔄 Migration from Existing Project

If migrating an existing app to this architecture:

1. Start with the core package - move business logic first
2. Create modules based on your current features
3. Convert API calls to service functions
4. Wrap service functions with React Query hooks
5. Update components to use hooks instead of direct API calls
6. Gradually adopt the Container/Presentational pattern

## 📈 Scaling Considerations

As your app grows:

- **Module splitting** - Large modules can be split into sub-modules
- **Package splitting** - Create additional packages for specialized functionality
- **Performance** - Add React.memo and useMemo where measurements show benefit
- **Testing** - Add integration tests for critical user paths
- **Documentation** - Document module interfaces and complex business logic

## 🎉 You're Ready!

This architecture has been battle-tested in production. It provides:
- Clear separation of concerns
- Maximum code reuse between platforms
- Type safety throughout
- Offline-first capabilities
- AI-friendly patterns
- Fast development iteration

Start with the setup commands above and build your modules incrementally. The patterns will guide you toward a maintainable, scalable application.

---

*Remember: The best architecture is one that's understood by your entire team (including AI assistants). Keep patterns consistent and document deviations.*