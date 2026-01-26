-- Update app_sessions to support multiple devices per user
-- Each app installation gets a unique device_id (UUID generated on first launch)
-- Same device with different users = multiple rows (shared device tracking)

-- Drop old table and recreate with new schema
drop table if exists app_sessions;

create table app_sessions (
  device_id uuid not null,                                       -- Generated UUID per app install (stored in local storage)
  user_id uuid not null references auth.users(id) on delete cascade,
  device_name text,                                              -- User-set device name (e.g., "John's iPhone")
  device_model text,                                             -- Hardware model (e.g., "iPhone 8", "Pixel 8 Pro")
  platform text not null,                                        -- 'ios', 'android', 'web'
  app_version text not null,
  build_number text,
  is_debug_build boolean default false,
  os_version text,
  first_seen_at timestamptz default now(),
  last_seen_at timestamptz default now(),

  primary key (device_id, user_id)                               -- Composite key: same device + different user = new row
);

-- RLS: users can only manage their own sessions
alter table app_sessions enable row level security;

create policy "Users can read own sessions"
on app_sessions for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own sessions"
on app_sessions for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own sessions"
on app_sessions for update
to authenticated
using (auth.uid() = user_id);

create policy "Users can delete own sessions"
on app_sessions for delete
to authenticated
using (auth.uid() = user_id);

-- Indexes for common queries
create index idx_app_sessions_user_id on app_sessions(user_id);
create index idx_app_sessions_version on app_sessions(app_version);
create index idx_app_sessions_last_seen on app_sessions(last_seen_at);
create index idx_app_sessions_platform on app_sessions(platform);

comment on table app_sessions is 'Tracks app installations per user - one row per (device, user) pair. Same device with multiple users = multiple rows.';
comment on column app_sessions.device_id is 'UUID generated on first app launch, stored in AsyncStorage/localStorage. Persists across logins, cleared on reinstall.';
comment on column app_sessions.device_name is 'User-set device name from OS settings (e.g., "Kitchen iPad")';
comment on column app_sessions.is_debug_build is 'True for development builds (.dev suffix)';
