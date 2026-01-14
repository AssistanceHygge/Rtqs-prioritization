# Troubleshooting: Proposed Epics Not Working

## Issue
- "Propose Epic" button does nothing
- No "Proposed Epics" section appears

## Step 1: Verify Migration Ran Successfully

Run this SQL in Supabase SQL Editor to check if the migration worked:

```sql
-- Check if status column exists in epics
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'epics' AND column_name = 'status';

-- Check if status column exists in stories
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'stories' AND column_name = 'status';

-- Check if view includes status
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'epic_priorities' AND column_name = 'status';
```

**Expected Results:**
- `epics.status` should exist with type `text` and default `'unprioritized'`
- `stories.status` should exist with type `text` and default `'official'`
- `epic_priorities.status` should exist (from the view)

## Step 2: If Columns Don't Exist

If the columns don't exist, run the migration again:

1. Open: https://supabase.com/dashboard/project/oomtgqehlmdzbwcyszko/sql/new
2. Copy and paste the ENTIRE contents of `database_migration_add_status_and_proposed.sql`
3. Click "Run"
4. Check for any errors in the output

## Step 3: Check Browser Console

1. Open your browser's Developer Tools (F12)
2. Go to the Console tab
3. Try clicking "Propose Epic"
4. Look for any error messages

Common errors:
- `column "status" does not exist` → Migration didn't run
- `violates check constraint` → Status value is invalid
- `null value in column "status"` → Default value not set

## Step 4: Manual Fix (If Migration Failed)

If the migration partially failed, run these commands one by one:

```sql
-- Add status to epics if missing
ALTER TABLE epics ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unprioritized';
ALTER TABLE epics ADD CONSTRAINT epics_status_check CHECK (status IN ('prioritized', 'unprioritized', 'proposed'));

-- Add status to stories if missing
ALTER TABLE stories ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'official';
ALTER TABLE stories ADD CONSTRAINT stories_status_check CHECK (status IN ('official', 'proposed'));

-- Update existing data
UPDATE epics SET status = 'unprioritized' WHERE status IS NULL;
UPDATE stories SET status = 'official' WHERE status IS NULL;

-- Recreate the view
DROP VIEW IF EXISTS epic_priorities;

CREATE OR REPLACE VIEW epic_priorities AS
SELECT 
  e.id,
  e.title,
  e.link,
  e.r,
  e.t,
  e.q,
  e.s,
  e.status,
  COALESCE(
    (e.r * COALESCE(mr.coefficient, 1.0)) +
    (e.t * COALESCE(mt.coefficient, 1.0)) +
    (e.q * COALESCE(mq.coefficient, 1.0)) +
    (e.s * COALESCE(ms.coefficient, 1.0)),
    0
  ) AS value,
  COALESCE(SUM(CASE WHEN s.status = 'official' THEN s.sprint_points ELSE 0 END), 0) AS total_sprint_points,
  CASE 
    WHEN COALESCE(SUM(CASE WHEN s.status = 'official' THEN s.sprint_points ELSE 0 END), 0) > 0 
    THEN (
      (e.r * COALESCE(mr.coefficient, 1.0)) +
      (e.t * COALESCE(mt.coefficient, 1.0)) +
      (e.q * COALESCE(mq.coefficient, 1.0)) +
      (e.s * COALESCE(ms.coefficient, 1.0))
    )::NUMERIC / COALESCE(SUM(CASE WHEN s.status = 'official' THEN s.sprint_points ELSE 0 END), 0)::NUMERIC
    ELSE 0
  END AS priority,
  COUNT(CASE WHEN s.gate = true AND s.status = 'official' THEN 1 END) AS gate_count,
  e.is_confirmed,
  e.created_at,
  e.updated_at
FROM epics e
LEFT JOIN stories s ON e.id = s.epic_id
LEFT JOIN metrics mr ON mr.name = 'R' AND mr.is_active = true
LEFT JOIN metrics mt ON mt.name = 'T' AND mt.is_active = true
LEFT JOIN metrics mq ON mq.name = 'Q' AND mq.is_active = true
LEFT JOIN metrics ms ON ms.name = 'S' AND ms.is_active = true
GROUP BY e.id, e.title, e.link, e.r, e.t, e.q, e.s, e.status, e.is_confirmed, e.created_at, e.updated_at,
         mr.coefficient, mt.coefficient, mq.coefficient, ms.coefficient;
```

## Step 5: Test

After fixing, try:
1. Enter an epic title
2. Click "Propose Epic"
3. You should see an alert if there's an error (with the error message)
4. If successful, the epic should appear in the "Proposed Epics" section

## Still Not Working?

Check:
- Browser console for JavaScript errors
- Network tab to see if the API call is being made
- Supabase logs for database errors

