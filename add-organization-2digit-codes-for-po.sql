-- Add 2-digit organization codes for PO number generation
-- Format: MTN=10, CBN=20, ASK=30, ATL=40, BDI=90, CAT=80, GPN=70

-- Step 1: Add the new column to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS po_code_2_digit VARCHAR(2);

-- Step 2: Assign the specific 2-digit codes as requested
UPDATE organizations SET po_code_2_digit = '10' WHERE code = 'MTN';
UPDATE organizations SET po_code_2_digit = '20' WHERE code = 'CBN';  
UPDATE organizations SET po_code_2_digit = '30' WHERE code = 'ASK';
UPDATE organizations SET po_code_2_digit = '40' WHERE code = 'ATL';
UPDATE organizations SET po_code_2_digit = '70' WHERE code = 'GPN';
UPDATE organizations SET po_code_2_digit = '80' WHERE code = 'CAT';
UPDATE organizations SET po_code_2_digit = '90' WHERE code = 'BDI';

-- Step 3: Verify the assignments
SELECT 
    code as org_code,
    name as org_name,
    po_code_2_digit,
    type as org_type
FROM organizations 
WHERE po_code_2_digit IS NOT NULL
ORDER BY po_code_2_digit;

-- Step 4: Check for any organizations without codes assigned
SELECT 
    'Organizations without PO codes:' as info,
    code as org_code,
    name as org_name
FROM organizations 
WHERE po_code_2_digit IS NULL
ORDER BY code;

-- Step 5: Verify uniqueness of 2-digit codes
SELECT 
    po_code_2_digit,
    COUNT(*) as count,
    STRING_AGG(code, ', ') as org_codes
FROM organizations 
WHERE po_code_2_digit IS NOT NULL
GROUP BY po_code_2_digit 
ORDER BY po_code_2_digit;

-- Step 6: Show the mapping for reference
SELECT 
    'PO Code Assignments:' as info
UNION ALL
SELECT CONCAT(code, ' = ', po_code_2_digit) as assignment
FROM organizations 
WHERE po_code_2_digit IS NOT NULL
ORDER BY po_code_2_digit;
