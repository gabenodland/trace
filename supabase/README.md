# Trace Database Schema

This directory contains the Supabase database schema and migrations for the Trace application.

## Setup Instructions

### 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose your organization
4. Enter project details:
   - **Name**: trace (or your preferred name)
   - **Database Password**: Generate a strong password and save it
   - **Region**: Choose closest to your users
5. Wait for project to be created (~2 minutes)

### 2. Get Your Credentials

Once your project is created:

1. Go to **Project Settings** (gear icon)
2. Click **API** in the sidebar
3. Copy the following:
   - **Project URL** (e.g., `https://abcdefghij.supabase.co`)
   - **anon/public** key (safe for client-side use)

### 3. Configure Your App

#### Option A: Using config.json (Development)

1. Copy the example config:
   ```bash
   cp packages/core/config.json.example packages/core/config.json
   ```

2. Edit `packages/core/config.json` with your credentials:
   ```json
   {
     "supabase": {
       "url": "https://your-project-id.supabase.co",
       "anonKey": "your-anon-key-here"
     },
     "environment": "development"
   }
   ```

   **Note**: `config.json` is gitignored and won't be committed

#### Option B: Using Environment Variables (Production)

1. Copy the example env file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` with your credentials:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

   **Note**: `.env.local` is gitignored and won't be committed

### 4. Run Migrations

You have two options to apply the database schema:

#### Option A: Using Supabase SQL Editor (Recommended for Quick Start)

1. Go to your Supabase project dashboard
2. Click **SQL Editor** in the sidebar
3. Click **New Query**
4. Copy the contents of `migrations/20250101000000_initial_schema.sql`
5. Paste into the editor and click **Run**
6. Create another new query
7. Copy the contents of `migrations/20250101000001_rls_policies.sql`
8. Paste and click **Run**

#### Option B: Using Supabase CLI (Recommended for Production)

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-id
   ```

4. Push migrations:
   ```bash
   supabase db push
   ```

### 5. Verify Setup

1. Go to **Table Editor** in Supabase dashboard
2. You should see two tables:
   - `categories`
   - `entries`
3. Click on each table and verify the columns match the schema
4. Go to **Authentication** > **Policies** to verify RLS policies are enabled

## Database Schema

### Tables

#### `categories`
Hierarchical organization structure for entries (like folders).

- `category_id` (UUID, PK)
- `user_id` (UUID, FK → auth.users)
- `name` (TEXT)
- `full_path` (TEXT, unique per user)
- `parent_category_id` (UUID, FK → categories, nullable)
- `depth` (INTEGER, 0-5)
- `entry_count` (INTEGER)
- `color` (TEXT, nullable)
- `icon` (TEXT, nullable)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

#### `entries`
Primary data entity - stores all captured content (notes, tasks, events).

- `entry_id` (UUID, PK)
- `user_id` (UUID, FK → auth.users)
- `title` (TEXT, nullable)
- `content` (TEXT)
- `category_id` (UUID, FK → categories, nullable)
- `tags` (TEXT[])
- `mentions` (TEXT[])
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)
- `location_lat` (FLOAT, nullable)
- `location_lng` (FLOAT, nullable)
- `location_name` (TEXT, nullable)
- `status` (TEXT: 'none' | 'incomplete' | 'complete')
- `due_date` (TIMESTAMPTZ, nullable)
- `completed_at` (TIMESTAMPTZ, nullable)
- `attachments` (JSONB)

### Row-Level Security (RLS)

All tables have RLS enabled with policies that ensure:
- Users can only view their own data
- Users can only insert data for themselves
- Users can only update/delete their own data

### Triggers

- **Auto-update timestamps**: `updated_at` automatically updates on row modification
- **Auto-update entry counts**: `entry_count` on categories updates when entries are added/removed/moved
- **Auto-set completed_at**: Sets timestamp when task status changes to 'complete'

## Migrations

Migration files are located in `supabase/migrations/`:

- `20250101000000_initial_schema.sql` - Creates tables, indexes, and triggers
- `20250101000001_rls_policies.sql` - Enables RLS and creates security policies

### Creating New Migrations

When you need to modify the schema:

1. Create a new migration file with timestamp prefix:
   ```bash
   # Format: YYYYMMDDHHMMSS_description.sql
   # Example: 20250115120000_add_entry_images.sql
   ```

2. Write your SQL changes in the file

3. Apply migration using Supabase SQL Editor or CLI

## Troubleshooting

### "Supabase configuration missing" Error

**Cause**: The app can't find your Supabase credentials.

**Solution**: Make sure you have either:
- Created `packages/core/config.json` with valid credentials, OR
- Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables

### RLS Policy Blocking Queries

**Cause**: Row-Level Security is working correctly! It only allows users to see their own data.

**Solution**: Make sure you're authenticated before querying. Check that `auth.uid()` returns the correct user ID.

### Migration Failed

**Cause**: SQL syntax error or constraint violation.

**Solution**:
1. Check the error message in Supabase SQL Editor
2. Fix the SQL in the migration file
3. If using CLI, reset the database: `supabase db reset` (⚠️ deletes all data)
4. Reapply migrations

## Next Steps

After setting up the database:

1. ✅ Database schema created
2. ✅ RLS policies enabled
3. ⏭️ Build authentication UI (Feature 0.3)
4. ⏭️ Create entry and category modules in @trace/core
5. ⏭️ Build the capture interface (Feature 1)

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Data Types](https://www.postgresql.org/docs/current/datatype.html)
