-- Entry versions table for immutable snapshots of entry state
-- Created at session boundaries and during sync conflicts

create table entry_versions (
  version_id uuid not null default gen_random_uuid() primary key,
  entry_id uuid not null references entries(entry_id) on delete cascade,
  user_id uuid not null,
  version_number integer not null,
  trigger text not null,  -- 'session_end' or 'conflict'
  snapshot jsonb not null,
  attachment_ids uuid[],
  change_summary text,
  device_id text,  -- UUID string from devices table, TEXT to match entries.last_edited_device
  device_created_at timestamptz,
  base_entry_version uuid,  -- version_id of last synced version (for fork detection)
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_entry_versions_entry_id on entry_versions(entry_id);
create index idx_entry_versions_user_id on entry_versions(user_id);
create index idx_entry_versions_created_at on entry_versions(created_at);
create index idx_entry_versions_entry_created on entry_versions(entry_id, created_at desc);

-- RLS: users can only manage their own versions
alter table entry_versions enable row level security;

create policy "Users can read own versions"
on entry_versions for select
to authenticated
using (user_id = auth.uid());

create policy "Users can insert own versions"
on entry_versions for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can delete own versions"
on entry_versions for delete
to authenticated
using (user_id = auth.uid());

-- No UPDATE policy — versions are immutable (append-only)

-- Soft-delete support for attachments
alter table attachments add column if not exists deleted_at timestamptz;

-- Conflict status for entries
alter table entries add column if not exists conflict_status text;

comment on table entry_versions is 'Immutable snapshots of entry state at session boundaries and sync conflicts.';
