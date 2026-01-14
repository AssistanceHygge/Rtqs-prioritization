# Database Migration Required

## Issue
The database still has constraints that only allow RTQS values of 1, 3, or 5, but the app now uses a 1-10 scale. This causes save errors.

## Solution
Run this SQL in your Supabase SQL Editor:

1. Go to: https://supabase.com/dashboard/project/oomtgqehlmdzbwcyszko/sql/new
2. Copy and paste the SQL below
3. Click "Run"

```sql
-- Update epics table to allow ratings from 1 to 10
ALTER TABLE epics 
  DROP CONSTRAINT IF EXISTS epics_r_check,
  DROP CONSTRAINT IF EXISTS epics_t_check,
  DROP CONSTRAINT IF EXISTS epics_q_check,
  DROP CONSTRAINT IF EXISTS epics_s_check;

ALTER TABLE epics
  ADD CONSTRAINT epics_r_check CHECK (r >= 0 AND r <= 10),
  ADD CONSTRAINT epics_t_check CHECK (t >= 0 AND t <= 10),
  ADD CONSTRAINT epics_q_check CHECK (q >= 0 AND q <= 10),
  ADD CONSTRAINT epics_s_check CHECK (s >= 0 AND s <= 10);
```

After running this, the save functionality will work correctly.

