-- Check current Purchase Orders to ensure they're still there
-- This will show all existing purchase orders before adding PDF functionality

SELECT 
    id,
    purchase_order_number,
    supplier_name,
    purchase_order_date,
    requested_delivery_date,
    status,
    terms,
    total_value,
    created_at,
    notes
FROM purchase_orders 
ORDER BY created_at DESC
LIMIT 10;

-- Also check if the pdf_url column exists (it might not be added yet)
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'purchase_orders' 
ORDER BY ordinal_position;
