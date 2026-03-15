# Core Package (`@trace/core`)

This package contains all shared business logic. Follow these patterns exactly.

---

## 📋 Module File Naming Convention

**STRICT PATTERN:**

- `{module}Api.ts` - Database operations (camelCase) — **internal, not exported**
- `{module}Hooks.ts` - React Query hooks (camelCase)
- `{Module}Types.ts` - TypeScript interfaces/types (PascalCase)
- `{module}Helpers.ts` - Pure utility functions (camelCase)
- `index.ts` - Public API exports

## 📦 Module Exports

```typescript
// modules/habits/index.ts
export * from "./habitHooks";    // The unified hook
export * from "./HabitTypes";    // TypeScript types
export * from "./habitHelpers";  // Pure functions
// NO export of habitApi — internal only!
```

## 📏 Component Size Limits

| Metric | Limit | Action |
|--------|-------|--------|
| Lines of code | ~300 max | Split into sub-components |
| useState/useRef | ~10 max | Extract to custom hook |
| Total hooks | ~15 max | Extract to custom hook |
| Props | ~8 max | Consider composition or context |

When exceeded, refactor into:
```
ComponentName/
├── ComponentName.tsx
├── hooks/useComponentState.ts
├── components/
└── index.ts
```

---

## 🎭 The Four-Layer Architecture

### 1️⃣ API Layer (`{module}Api.ts`) — Internal Only

```typescript
export async function createHabit(habitData: Habit): Promise<Habit> {
  // CRITICAL: Exclude client-side fields
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

### 2️⃣ Hooks Layer (`{module}Hooks.ts`) — Single Source of Truth

- Internal queries/mutations are NOT exported
- ONE unified hook is the public API
- Handles caching, optimistic updates, invalidation

```typescript
// Internal (NOT exported)
function useHabitsQuery(status?: string) {
  return useQuery({ queryKey: ["habits", status], queryFn: () => getHabits(status) });
}

function useUpdateHabitMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateHabit,
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

// THE SINGLE SOURCE OF TRUTH — only this is exported
export function useHabits(status?: string) {
  const habitsQuery = useHabitsQuery(status);
  const updateMutation = useUpdateHabitMutation();

  return {
    habits: habitsQuery.data || [],
    isLoading: habitsQuery.isLoading,
    error: habitsQuery.error,
    refetch: habitsQuery.refetch,
    habitMutations: {
      updateHabit: updateMutation.mutateAsync,
      isUpdating: updateMutation.isPending,
    },
  };
}
```

### 3️⃣ Helpers Layer (`{module}Helpers.ts`) — Pure Functions

- NO side effects, NO data fetching, NO state
- Import directly where needed (not re-exported through hooks)

```typescript
export function getCurrentStreak(habit: Habit): number { /* pure calculation */ }
export function isDateScheduled(habit: Habit, dateStr: string): boolean { /* pure logic */ }
```

### 4️⃣ Components Layer

**Data Fetching Location:**

| Scenario | Where to Fetch |
|----------|----------------|
| Screen-level data | In the Screen component |
| Data only one component needs | In that component |
| Data shared by siblings | In parent, pass as props |
| Self-contained widgets | In the widget itself |
| Data passed 3+ levels deep | Co-locate or use context |

---

## 📋 Form Component Pattern

**CRITICAL: Forms do NOT fetch or save their own data.**

**Parent** fetches data, handles save/cancel, handles navigation.
**Child form** receives data as prop, stores ONE working copy in state, calls `onSave(editedData)`.

```typescript
// Parent — owns data
export function EntryEditScreen({ entryId }: Props) {
  const { entry, isLoading } = useEntry(entryId);
  const { entryMutations } = useEntries();

  const handleSave = async (edited: Entry) => {
    await entryMutations.updateEntry(entryId, edited);
    navigate("inbox");
  };

  return <EntryForm entry={entry} onSave={handleSave} onCancel={() => navigate("inbox")} />;
}

// Child — ONE state object, no fetching
export function EntryForm({ entry, onSave, onCancel }: EntryFormProps) {
  const [formData, setFormData] = useState<Entry>(entry);

  const updateField = <K extends keyof Entry>(field: K, value: Entry[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (/* render fields using formData, call onSave(formData) */);
}
```

**NEVER** create individual `useState` per field. ONE state object for the entire entity.

---

## 📋 List/Detail Data Fetching

Pass the **ID** to detail screens. React Query cache makes it instant:

```typescript
// List — caches entries
const { entries } = useEntries();
<EntryRow onPress={() => navigate("capture", { entryId: entry.id })} />

// Detail — instant from cache, background refresh
const { entry, isLoading } = useEntry(entryId);
// Only shows loading on deep-link (cache miss)
```

**Edit vs Create:**
- Editing: `useEntry(entryId)` — from cache
- Creating: build new object with defaults, no fetch needed

---

## 🧠 Memoization Guidelines

**Profile first, memoize second.**

| Tool | Use When |
|------|----------|
| `useMemo` | Expensive calculation or filtering large arrays |
| `useCallback` | Callback passed to `React.memo` component |
| `React.memo` | Pure presentational components rendered many times |

Don't memoize simple calculations (`fullName = \`${first} ${last}\``), callbacks not passed to memoized children, or components that always re-render anyway.

---

## 🪝 Custom Hook Extraction

Extract when: >10 useState calls, reusable logic, complex enough for isolated testing.

```typescript
// hooks/useCaptureFormState.ts
export function useCaptureFormState(initialData?: Partial<Entry>) {
  const [title, setTitle] = useState(initialData?.title || "");
  // ... related state
  return { title, setTitle, hasChanges, resetForm };
}
```

Naming: `use{Feature}{Purpose}.ts`

---

## ⏳ Loading & Error States

```typescript
if (isLoading) return <EntryListSkeleton />;
if (error) return <ErrorState message="Failed to load" onRetry={refetch} />;
if (entries.length === 0) return <EmptyState message="No entries yet" />;
```

- Skeleton loaders for content areas
- Spinners for buttons/actions
- Always provide retry for failed queries

---

## ✅ Service Function Rules

1. One function = one operation
2. Throw errors directly (no ServiceResponse wrappers)
3. Descriptive names (`createUser` not `create`)
4. Auth checks inside each function
5. No state in services — stateless

---

## 🔑 Database Type Safety

Always exclude client-side fields when inserting/updating:

```typescript
const { clientField, id, created_at, ...dbFields } = data;
await supabase.from("items").insert(dbFields).select().single();
```

---

## 🔐 Error Handling

```typescript
// Service: throw directly
if (error) throw error;
return data;

// Component: try/catch
try { await updateUser(id, data); } catch (error) { /* handle */ }
```

**Logging in core:** `console.error` is acceptable in `@trace/core` for mutation `onError` handlers. The scoped logger (`createScopedLogger`) lives in `apps/mobile/` and is not available here. Do NOT use `console.log` for debug traces — remove those before committing.

---

## 🔄 Creating a New Module

Use `/new-module` slash command for step-by-step guidance.

---

## 🧪 Testing Requirements

- Helper functions MUST have unit tests (vitest)
- Run `npm run test:run` to verify
- New helper files need corresponding `.test.ts` files
- Follow patterns in `entryHelpers.test.ts` and `templateHelpers.test.ts`
