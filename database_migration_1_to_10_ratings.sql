-- Migration to change RTQS ratings from 1/3/5 to 1-10
-- Run this in your Supabase SQL editor

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

-- Optional: Convert existing 1/3/5 scores to 1-10 scale
-- This maps: 1 -> 3, 3 -> 6, 5 -> 10 (roughly proportional)
UPDATE epics SET
  r = CASE 
    WHEN r = 1 THEN 3
    WHEN r = 3 THEN 6
    WHEN r = 5 THEN 10
    ELSE r
  END,
  t = CASE 
    WHEN t = 1 THEN 3
    WHEN t = 3 THEN 6
    WHEN t = 5 THEN 10
    ELSE t
  END,
  q = CASE 
    WHEN q = 1 THEN 3
    WHEN q = 3 THEN 6
    WHEN q = 5 THEN 10
    ELSE q
  END,
  s = CASE 
    WHEN s = 1 THEN 3
    WHEN s = 3 THEN 6
    WHEN s = 5 THEN 10
    ELSE s
  END
WHERE r IN (1, 3, 5) OR t IN (1, 3, 5) OR q IN (1, 3, 5) OR s IN (1, 3, 5);

