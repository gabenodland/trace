-- Fix category updated_at trigger to only update when content actually changes
-- Not when entry_count changes (which happens via trigger when entries are added/removed)

CREATE OR REPLACE FUNCTION update_categories_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update timestamp if something other than entry_count changed
  IF (OLD.name IS DISTINCT FROM NEW.name OR
      OLD.full_path IS DISTINCT FROM NEW.full_path OR
      OLD.parent_category_id IS DISTINCT FROM NEW.parent_category_id OR
      OLD.depth IS DISTINCT FROM NEW.depth OR
      OLD.color IS DISTINCT FROM NEW.color OR
      OLD.icon IS DISTINCT FROM NEW.icon) THEN
    NEW.updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger already exists, function is replaced above
