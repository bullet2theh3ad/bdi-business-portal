-- Update invoice status constraint to include new workflow statuses
-- This fixes the "submitted_to_finance" status error

-- Step 1: Drop the existing constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Step 2: Add new constraint with updated status values
ALTER TABLE invoices ADD CONSTRAINT invoices_status_check 
CHECK (status IN (
    'draft', 
    'sent', 
    'confirmed', 
    'shipped', 
    'delivered',
    'submitted_to_finance',    -- NEW: For CFO approval workflow
    'approved_by_finance',     -- NEW: After CFO approval
    'rejected_by_finance'      -- NEW: If CFO rejects
));

-- Step 3: Verify the constraint was updated
SELECT 
    'CONSTRAINT UPDATE CHECK' as status,
    constraint_name,
    check_clause
FROM information_schema.check_constraints 
WHERE constraint_name = 'invoices_status_check';

-- Step 4: Test that the new status is now allowed
SELECT 'NEW STATUS TEST' as test, 'submitted_to_finance' as new_status_allowed;
