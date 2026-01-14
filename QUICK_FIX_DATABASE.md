# ⚠️ URGENT: Database Migration Required

## The Problem
Your database still has constraints that only allow RTQS values of **1, 3, or 5**, but the app now uses a **1-10 scale**. This is causing the "Failed to save changes" error.

## Quick Fix (2 minutes)

1. **Open Supabase SQL Editor:**
   - Go to: https://supabase.com/dashboard/project/oomtgqehlmdzbwcyszko/sql/new

2. **Copy and paste this SQL:**
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

3. **Click "Run"**

4. **Refresh your app** - saving should now work!

## What This Does
- Removes the old constraints (1, 3, or 5 only)
- Adds new constraints (0-10 allowed)
- Takes about 1 second to run
- No data loss - all your epics remain intact

