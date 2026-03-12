# Supabase Configuration & Migrations

## 🔧 Project Config

- **Project ID:** `lsszorssvkavegobmqic`
- **Dashboard:** https://supabase.com/dashboard/project/lsszorssvkavegobmqic
- **Region:** us-east-2

---

## 🗄️ Migration Workflow

### Step 1: Create Migration File

```bash
# Format: YYYYMMDDHHMMSS_description.sql
# in supabase/migrations/
```

### Step 2: Write Migration SQL

```sql
ALTER TABLE entries ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX idx_entries_is_archived ON entries(is_archived);
```

### Step 3: Update TypeScript Types (Manual)

1. `packages/core/src/shared/database.types.ts` — Add to `Row`, `Insert`, `Update`
2. `packages/core/src/modules/{module}/{Module}Types.ts` — Add to interface

### Step 4: Apply Migration

**Option A: Supabase CLI (Recommended)**

```bash
cd /c/projects/trace

# First time — link project:
npx supabase login
npx supabase link --project-ref lsszorssvkavegobmqic

# Dry run:
npx supabase db push --dry-run

# Apply:
npx supabase db push
```

**Option B: Supabase Dashboard (Quick one-off)**

Go to SQL Editor, paste SQL, run. Note: doesn't track migration history.

### Step 5: Rebuild Core

```bash
cd packages/core && npm run build
```

### Step 6: Update Mobile Code

- Add field to `mobileEntryApi.ts` (`createEntry`, `copyEntry`)
- Add field to `pullSyncOperations.ts` and `syncService.ts`

---

## ⚠️ RLS & Realtime Gotchas

**Supabase Realtime applies RLS before broadcasting `postgres_changes` events.** If a row's new state doesn't match the SELECT policy, the event is silently dropped — clients never receive it.

**Soft-delete example:** If a SELECT policy has `deleted_at IS NULL`, then setting `deleted_at` on a row causes the realtime event to be swallowed. The entries table SELECT policy was fixed in `20260312000001_fix_entries_rls_for_realtime.sql` to remove this filter — application-layer queries add `.is('deleted_at', null)` explicitly instead.

**Rule:** RLS should enforce **authorization** (`auth.uid() = user_id`), not **application logic** (`deleted_at IS NULL`). Move application filters to the query layer so realtime events flow correctly.

**Soft-delete queries must filter explicitly:**
```typescript
// Correct — application-layer filter
supabase.from('entries').select('*').eq('user_id', user.id).is('deleted_at', null)

// Wrong — relying on RLS to filter (breaks realtime)
supabase.from('entries').select('*').eq('user_id', user.id)
```

---

## Common Issues

**"Property X does not exist on type Entry"**
→ `database.types.ts` not updated, or core not rebuilt.

**Migration applied but mobile not seeing field**
→ Sync service needs to map the field. Check `pullSyncOperations.ts` and `syncService.ts`.
