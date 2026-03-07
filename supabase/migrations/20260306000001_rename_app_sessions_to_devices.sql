-- Rename app_sessions table to devices

alter table app_sessions rename to devices;

-- Rename indexes
alter index idx_app_sessions_user_id rename to idx_devices_user_id;
alter index idx_app_sessions_version rename to idx_devices_version;
alter index idx_app_sessions_last_seen rename to idx_devices_last_seen;
alter index idx_app_sessions_platform rename to idx_devices_platform;

-- Rename RLS policies
alter policy "Users can read own sessions" on devices rename to "Users can read own devices";
alter policy "Users can insert own sessions" on devices rename to "Users can insert own devices";
alter policy "Users can update own sessions" on devices rename to "Users can update own devices";
alter policy "Users can delete own sessions" on devices rename to "Users can delete own devices";

-- Update table comment
comment on table devices is 'Registered devices per user. One row per (device_id, user_id) pair.';
