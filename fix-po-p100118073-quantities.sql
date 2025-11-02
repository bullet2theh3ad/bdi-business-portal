-- ==========================================
-- EMERGENCY FIX: Reset PO P100118073 quantities
-- ==========================================
-- Problem: Both partial invoices were deleted but PO quantities not reclaimed
-- Current DB state: invoiced_quantity=681, remaining_quantity=304
-- Should be: invoiced_quantity=0, remaining_quantity=985

-- Step 1: Check current state
SELECT 
    po.purchase_order_number,
    po.invoice_status,
    li.sku_code,
    li.quantity as total_qty,
    li.invoiced_quantity,
    li.remaining_quantity
FROM purchase_orders po
JOIN purchase_order_line_items li ON po.id = li.purchase_order_id
WHERE po.purchase_order_number = 'P100118073';

-- Step 2: RESET quantities to 0 invoiced, full remaining
UPDATE purchase_order_line_items
SET 
    invoiced_quantity = 0,
    remaining_quantity = quantity
WHERE purchase_order_id = (
    SELECT id FROM purchase_orders WHERE purchase_order_number = 'P100118073'
);

-- Step 3: Update PO status to not_invoiced
UPDATE purchase_orders
SET invoice_status = 'not_invoiced'
WHERE purchase_order_number = 'P100118073';

-- Step 4: Verify fix
SELECT 
    po.purchase_order_number,
    po.invoice_status,
    li.sku_code,
    li.quantity as total_qty,
    li.invoiced_quantity,
    li.remaining_quantity
FROM purchase_orders po
JOIN purchase_order_line_items li ON po.id = li.purchase_order_id
WHERE po.purchase_order_number = 'P100118073';

