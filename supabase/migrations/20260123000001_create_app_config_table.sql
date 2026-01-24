-- App configuration table for version requirements and other app-wide settings
-- Used for soft-force updates and kill switch functionality

create table app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Anyone can read config (needed before auth for version check)
alter table app_config enable row level security;

create policy "Anyone can read app_config"
on app_config for select
to anon, authenticated
using (true);

-- No insert/update/delete policies = only service role can modify

-- Insert initial version requirements
insert into app_config (key, value) values (
  'version_requirements',
  '{
    "minimum_version": "1.0.0",
    "latest_version": "1.0.0",
    "update_url_ios": "https://apps.apple.com/app/trace",
    "update_url_android": "https://play.google.com/store/apps/details?id=com.trace.app",
    "update_message": "A new version of Trace is available with exciting new features!"
  }'::jsonb
);

comment on table app_config is 'App-wide configuration including version requirements for update prompts';
