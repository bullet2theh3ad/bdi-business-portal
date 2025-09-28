-- Add 3-digit SKU codes for PO number generation
-- Format: 001-999 unique codes for each SKU

-- Step 1: Add the new column to product_skus table
ALTER TABLE product_skus 
ADD COLUMN IF NOT EXISTS sku_code_3_digit VARCHAR(3) UNIQUE;

-- Step 2: Create a function to generate sequential 3-digit codes
CREATE OR REPLACE FUNCTION generate_next_sku_code() RETURNS VARCHAR(3) AS $$
DECLARE
    next_code INTEGER;
    code_str VARCHAR(3);
BEGIN
    -- Find the highest existing code and increment
    SELECT COALESCE(MAX(CAST(sku_code_3_digit AS INTEGER)), 0) + 1 
    INTO next_code
    FROM product_skus 
    WHERE sku_code_3_digit ~ '^[0-9]{3}$';
    
    -- Format as 3-digit string with leading zeros
    code_str := LPAD(next_code::TEXT, 3, '0');
    
    -- Ensure we don't exceed 999
    IF next_code > 999 THEN
        RAISE EXCEPTION 'Cannot generate more than 999 SKU codes';
    END IF;
    
    RETURN code_str;
END;
$$ LANGUAGE plpgsql;

-- Step 3: Assign 3-digit codes to existing SKUs (in creation order)
DO $$
DECLARE
    sku_record RECORD;
    new_code VARCHAR(3);
BEGIN
    FOR sku_record IN 
        SELECT id, sku, name 
        FROM product_skus 
        WHERE sku_code_3_digit IS NULL 
        ORDER BY created_at ASC
    LOOP
        -- Generate next available code
        new_code := generate_next_sku_code();
        
        -- Update the SKU with the new code
        UPDATE product_skus 
        SET sku_code_3_digit = new_code,
            updated_at = NOW()
        WHERE id = sku_record.id;
        
        RAISE NOTICE 'Assigned code % to SKU % (%)', new_code, sku_record.sku, sku_record.name;
    END LOOP;
END;
$$;

-- Step 4: Verify the assignments
SELECT 
    sku_code_3_digit,
    sku,
    name,
    created_at
FROM product_skus 
ORDER BY CAST(sku_code_3_digit AS INTEGER);

-- Step 5: Check for any duplicates (should be none)
SELECT 
    sku_code_3_digit,
    COUNT(*) as count
FROM product_skus 
GROUP BY sku_code_3_digit 
HAVING COUNT(*) > 1;

-- Step 6: Show organization codes that will be used for PO generation
SELECT 
    'Organization 2-Digit Codes for PO Generation:' as info
UNION ALL
SELECT 'MTN = 10'
UNION ALL  
SELECT 'CBN = 20'
UNION ALL
SELECT 'ASK = 30' 
UNION ALL
SELECT 'ATL = 40'
UNION ALL
SELECT 'GPN = 70'
UNION ALL
SELECT 'CAT = 80'
UNION ALL
SELECT 'BDI = 90';

-- Step 7: Example PO number format
SELECT 
    'Example PO Number Format:' as info,
    '1010002711234' as example,
    '10 = MTN organization' as part1,
    '100 = SKU 3-digit code' as part2, 
    '0271 = Days since Jan 1, 2025' as part3,
    '1234 = Random 4-digit number' as part4;
