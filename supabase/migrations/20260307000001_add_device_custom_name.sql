-- Add custom_name column for user-defined device names
-- Display priority: custom_name > device_name > 'Unknown Device'

alter table devices add column custom_name text;

comment on column devices.custom_name is 'User-set nickname for the device. Overrides OS-provided device_name in UI when set.';
