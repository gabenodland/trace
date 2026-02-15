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

## Common Issues

**"Property X does not exist on type Entry"**
→ `database.types.ts` not updated, or core not rebuilt.

**Migration applied but mobile not seeing field**
→ Sync service needs to map the field. Check `pullSyncOperations.ts` and `syncService.ts`.
