-- ============================================================================
-- Update Entry Status Constraint for New 9-Status System
-- ============================================================================
-- This migration updates the status constraint to allow the new status values:
-- none, new, todo, in_progress, in_review, waiting, on_hold, done, closed, cancelled
-- ============================================================================

-- Step 1: Drop the existing status constraint
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_status_check;

-- Step 2: Drop the completed_at constraint (we need to update this too)
ALTER TABLE entries DROP CONSTRAINT IF EXISTS completed_at_requires_complete_status;

-- Step 3: Add new status constraint with all 9 status values plus 'none'
ALTER TABLE entries ADD CONSTRAINT entries_status_check
  CHECK (status IN ('none', 'new', 'todo', 'in_progress', 'in_review', 'waiting', 'on_hold', 'done', 'closed', 'cancelled'));

-- Step 4: Add new completed_at constraint that works with all "completed" statuses (done, closed, cancelled)
-- Note: We're making this more lenient - completed_at is optional and can be set for completed statuses
-- This allows flexibility in how the app manages the completed_at field
ALTER TABLE entries ADD CONSTRAINT completed_at_requires_completed_status
  CHECK (
    (status IN ('done', 'closed', 'cancelled') AND completed_at IS NOT NULL) OR
    (status NOT IN ('done', 'closed', 'cancelled') AND completed_at IS NULL)
  );

-- Step 5: Update the trigger function to handle all completed statuses
CREATE OR REPLACE FUNCTION update_entry_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Set completed_at when status becomes a completed status (done, closed, cancelled)
  IF NEW.status IN ('done', 'closed', 'cancelled') AND (OLD.status IS NULL OR OLD.status NOT IN ('done', 'closed', 'cancelled')) THEN
    NEW.completed_at := NOW();
  END IF;

  -- Clear completed_at when status changes from completed to non-completed
  IF NEW.status NOT IN ('done', 'closed', 'cancelled') AND OLD.status IN ('done', 'closed', 'cancelled') THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Migrate existing data - convert 'incomplete' to 'todo' and 'complete' to 'done'
-- First, we need to temporarily disable the constraint to do the migration
ALTER TABLE entries DROP CONSTRAINT IF EXISTS entries_status_check;
ALTER TABLE entries DROP CONSTRAINT IF EXISTS completed_at_requires_completed_status;

UPDATE entries SET status = 'todo' WHERE status = 'incomplete';
UPDATE entries SET status = 'done' WHERE status = 'complete';

-- Re-add the constraints after migration
ALTER TABLE entries ADD CONSTRAINT entries_status_check
  CHECK (status IN ('none', 'new', 'todo', 'in_progress', 'in_review', 'waiting', 'on_hold', 'done', 'closed', 'cancelled'));

ALTER TABLE entries ADD CONSTRAINT completed_at_requires_completed_status
  CHECK (
    (status IN ('done', 'closed', 'cancelled') AND completed_at IS NOT NULL) OR
    (status NOT IN ('done', 'closed', 'cancelled') AND completed_at IS NULL)
  );

-- Update column comment
COMMENT ON COLUMN entries.status IS 'Entry status: none=note, new/todo/in_progress/in_review/waiting/on_hold=actionable task, done/closed/cancelled=completed task';
