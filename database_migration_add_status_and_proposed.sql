-- Migration to add status fields and proposed workflow
-- Run this in your Supabase SQL Editor

-- Add status column to epics
ALTER TABLE epics ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'unprioritized' CHECK (status IN ('prioritized', 'unprioritized', 'proposed'));

-- Add status column to stories
ALTER TABLE stories ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'official' CHECK (status IN ('official', 'proposed'));

-- Backfill existing epics: set status based on current RTQS and stories
UPDATE epics SET status = CASE
  WHEN r > 0 AND t > 0 AND q > 0 AND s > 0 AND EXISTS (
    SELECT 1 FROM stories WHERE epic_id = epics.id
  ) THEN 'prioritized'
  ELSE 'unprioritized'
END
WHERE status IS NULL OR status = 'unprioritized';

-- Backfill existing stories: all existing stories are official
UPDATE stories SET status = 'official' WHERE status IS NULL;

-- Update the epic_priorities view to only sum official stories
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

