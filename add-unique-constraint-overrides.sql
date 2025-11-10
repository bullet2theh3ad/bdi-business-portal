-- Check if unique constraint exists
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'gl_transaction_overrides'::regclass
  AND contype = 'u';

-- Add unique constraint if it doesn't exist
-- This prevents duplicate overrides for the same transaction
-- Run this AFTER cleaning up duplicates with fix-duplicate-overrides.sql

/*
-- First, drop the constraint if it exists with the wrong definition
ALTER TABLE gl_transaction_overrides 
DROP CONSTRAINT IF EXISTS gl_transaction_overrides_unique_transaction;

-- Then add the correct constraint
ALTER TABLE gl_transaction_overrides
ADD CONSTRAINT gl_transaction_overrides_unique_transaction 
UNIQUE (transaction_source, transaction_id, line_item_index);
*/

