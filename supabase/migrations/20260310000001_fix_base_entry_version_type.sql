-- Fix base_entry_version column type: was uuid, should be text.
-- The app stores version numbers as text strings (e.g., "1", "2"),
-- not UUID references. uuid type would reject these values on push.

alter table entry_versions alter column base_entry_version type text using base_entry_version::text;
