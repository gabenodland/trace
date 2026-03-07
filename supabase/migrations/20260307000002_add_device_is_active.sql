-- Add is_active flag for device deactivation (remote sign-out)
-- Deactivated devices are forced to sign out via realtime subscription.
-- Only deactivated devices can be hard-deleted.

alter table devices add column is_active boolean not null default true;

comment on column devices.is_active is 'False = deactivated. Device will be forced to sign out on next connection.';

-- Partial index for quick lookup of deactivated devices
create index idx_devices_is_active on devices(is_active) where is_active = false;
