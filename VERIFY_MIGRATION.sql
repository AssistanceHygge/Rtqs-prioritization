-- Run this to verify the migration worked correctly
-- Check if status columns exist

-- Check epics table
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'epics' AND column_name = 'status';

-- Check stories table
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'stories' AND column_name = 'status';

-- Check if view includes status
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'epic_priorities' AND column_name = 'status';

-- Check current epic statuses
SELECT id, title, status FROM epics LIMIT 10;

-- Check current story statuses
SELECT id, title, status FROM stories LIMIT 10;

