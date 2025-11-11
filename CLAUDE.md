# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## ⚠️ DEVELOPMENT RULES - READ FIRST
EVERY TIME I ASK YOU TO DO ANYTHING YOU FIRST SAY: "OK [ModelName] here to help", (list the model name in the brackets) AND THIS HELPS YOU REMEMBER THAT YOU ARE A VERY DETAILED ORIENTED DEVELOPER THAT ALWAYS FOLLOWS OUR RULES LISTED BELOW. YOU WILL PUSH BACK IF YOU ARE ASKED TO DO SOMETHING OUT OF ORDER OR NOT ALIGNED WITH THESE RULES.
**These rules MUST be followed at all times:**

1. **Never make up data** - Always ask if you need information. Do not assume or fabricate values.

2. **Don't start without confirmation** - Present your plan and get approval before implementing changes.

3. **Use minimal tech stack** - Always ask before adding new libraries or dependencies.

4. **Follow established patterns exactly** - Use the patterns defined in this document. No deviations.

5. **All code must be maintainable and in the right place** - Respect the module structure and file organization.

6. **Always play a sound when complete** - After providing summary of completed work:
   - Windows: `ffplay -nodisp -autoexit -loglevel quiet "C:/Projects/complete.wav"`
   - Mac/Linux: `afplay /path/to/complete.wav` or `aplay /path/to/complete.wav`
   - Then say "done"

7. **Always play a sound when you need more information** - After asking a question:
   - Windows: `ffplay -nodisp -autoexit -loglevel quiet "C:/Projects/question.wav"`
   - Mac/Linux: `afplay /path/to/question.wav` or `aplay /path/to/question.wav`
   - Then say "answer please"

8. **Never create 'nul' files** - Always use correct null device syntax for bash:
   - ✅ Use `/dev/null` in bash/Git Bash commands
   - ❌ NEVER use `> nul` (Windows CMD syntax - creates a file in bash)
   - Example: `ping -n 10 127.0.0.1 > /dev/null` (not `> nul`)
   - If you accidentally create a 'nul' file, delete it immediately

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
    },

    // Helpers (all pure functions)
    habitHelpers,
  };
}
```

### 3️⃣ Helpers Layer (`{module}Helpers.ts`)
- **Pure calculation functions** - NO side effects
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
  // Pure business logic - no side effects
  switch (habit.frequency_type) {
    case "daily": return true;
    case "specific_days": // Check day of week
    // etc...
  }
}
```

### 4️⃣ Components Layer (Pages/Screens and Components)
- **Parent components** use the unified hook (SINGLE SOURCE OF TRUTH)
- **Child components** receive props
- Both can use helper functions

**Parent Component (Container):**
```typescript
// pages/HabitsPage.tsx
export function HabitsPage() {
  // SINGLE SOURCE OF TRUTH - One hook provides everything
  const { habits, isLoading, error, habitMutations } = useHabits("active");

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
    <div>
      <h3>{habit.name}</h3>
      <span>🔥 {currentStreak}</span>
      <span>✓ {totalCompleted}</span>
    </div>
  );
}
```

## ❌ Common Anti-Patterns to AVOID

**DO NOT DO THESE:**

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

// ❌ DON'T: Creating service classes
export class UserService {
  static async getUser(userId: string) {
    return this.handleRequest(/* ... */);
  }
}

// ❌ DON'T: Using relative imports to core
import { useUsers } from "../../../packages/core/src/modules/users";
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
import { useUsers, createUser, type User } from "@trace/core";

// Never use relative paths to core
// ❌ import { useUsers } from "../../../packages/core/src/modules/users";
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

1. **Don't fetch data in child components** - Parents fetch, children display
2. **Don't create service classes** - Use simple functions
3. **Don't forget to exclude client fields** - When inserting to database
4. **Don't use relative imports to core** - Always use @trace/core
5. **Don't skip building shared package** - Required before running apps
6. **Don't commit config.json** - Contains secrets

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

**Remember:** Follow these patterns exactly. They have been battle-tested in production and are designed for AI-assisted development. Consistency is critical.