-- App sessions table for tracking user app versions and device info
-- Used to determine when it's safe to rotate API keys or revoke old versions

create table app_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  app_version text not null,
  build_number text,
  platform text not null,  -- 'ios', 'android', 'web'
  os_version text,
  device_model text,
  last_seen_at timestamptz default now(),
  created_at timestamptz default now()
);

-- RLS: users can only manage their own session
alter table app_sessions enable row level security;

create policy "Users can read own session"
on app_sessions for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own session"
on app_sessions for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own session"
on app_sessions for update
to authenticated
using (auth.uid() = user_id);

-- Index for version distribution queries (admin use via service role)
create index idx_app_sessions_version on app_sessions(app_version);
create index idx_app_sessions_last_seen on app_sessions(last_seen_at);

comment on table app_sessions is 'Tracks user app versions for update adoption monitoring';
