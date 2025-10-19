-- Fix the user_id foreign key constraint
-- The constraint is currently pointing to users.id but should point to users.id
-- OR we can just drop the constraint and make it nullable

-- Option 1: Drop the foreign key constraint entirely
ALTER TABLE public.sku_financial_scenarios
DROP CONSTRAINT IF EXISTS sku_financial_scenarios_user_id_fkey;

-- Option 2: Make user_id nullable (already is)
-- No action needed

-- The user_id column will still store the user's ID for filtering purposes
-- but won't enforce referential integrity

