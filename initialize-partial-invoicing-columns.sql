-- ==========================================
-- Partial Invoicing - Initialize Database Columns
-- ==========================================
-- This script adds the necessary columns for partial invoicing
-- and initializes them with correct values for existing data
-- ==========================================

-- 1. Add columns to purchase_order_line_items (if they don't exist)
ALTER TABLE purchase_order_line_items 
ADD COLUMN IF NOT EXISTS invoiced_quantity NUMERIC(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS remaining_quantity NUMERIC(10, 2) DEFAULT 0;

-- 2. Add invoice_status to purchase_orders (if it doesn't exist)
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS invoice_status VARCHAR(50) DEFAULT 'not_invoiced';

-- 3. Add partial invoicing fields to invoices (if they don't exist)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS po_reference VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_partial BOOLEAN DEFAULT false;

-- 4. Initialize remaining_quantity for ALL existing PO line items
-- Set remaining_quantity = quantity for any records where it's NULL or 0
UPDATE purchase_order_line_items
SET 
  remaining_quantity = quantity,
  invoiced_quantity = 0
WHERE remaining_quantity IS NULL OR remaining_quantity = 0;

-- 5. For POs that already have invoices, calculate the actual remaining quantities
-- This is a more complex update that looks at actual invoice line items
DO $$
DECLARE
  po_record RECORD;
  line_record RECORD;
  invoiced_qty NUMERIC;
BEGIN
  -- Loop through all purchase orders
  FOR po_record IN 
    SELECT DISTINCT po.id, po.purchase_order_number
    FROM purchase_orders po
    INNER JOIN invoices i ON i.notes LIKE '%' || po.purchase_order_number || '%'
    WHERE po.purchase_order_number IS NOT NULL
  LOOP
    RAISE NOTICE 'Processing PO: %', po_record.purchase_order_number;
    
    -- Loop through line items for this PO
    FOR line_record IN
      SELECT id, sku_code, quantity
      FROM purchase_order_line_items
      WHERE purchase_order_id = po_record.id
    LOOP
      -- Calculate total invoiced quantity for this SKU from all related invoices
      SELECT COALESCE(SUM(il.quantity), 0) INTO invoiced_qty
      FROM invoice_line_items il
      INNER JOIN invoices i ON il.invoice_id = i.id
      WHERE i.notes LIKE '%' || po_record.purchase_order_number || '%'
        AND il.sku_code = line_record.sku_code;
      
      -- Update the PO line item with correct values
      UPDATE purchase_order_line_items
      SET 
        invoiced_quantity = invoiced_qty,
        remaining_quantity = line_record.quantity - invoiced_qty
      WHERE id = line_record.id;
      
      RAISE NOTICE '  SKU %: invoiced=%, remaining=%', 
        line_record.sku_code, 
        invoiced_qty, 
        (line_record.quantity - invoiced_qty);
    END LOOP;
  END LOOP;
END $$;

-- 6. Update PO invoice_status based on line item quantities
UPDATE purchase_orders po
SET invoice_status = CASE
  -- Fully invoiced: all line items have remaining_quantity = 0
  WHEN (
    SELECT COUNT(*) 
    FROM purchase_order_line_items pol 
    WHERE pol.purchase_order_id = po.id 
      AND pol.remaining_quantity > 0
  ) = 0 AND (
    SELECT COUNT(*) 
    FROM purchase_order_line_items pol 
    WHERE pol.purchase_order_id = po.id
  ) > 0 THEN 'fully_invoiced'
  
  -- Partially invoiced: some line items have been invoiced
  WHEN (
    SELECT COUNT(*) 
    FROM purchase_order_line_items pol 
    WHERE pol.purchase_order_id = po.id 
      AND pol.invoiced_quantity > 0
  ) > 0 THEN 'partially_invoiced'
  
  -- Not invoiced: no line items have been invoiced
  ELSE 'not_invoiced'
END;

-- 7. Verification queries
SELECT 
  'Purchase Order Line Items' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN remaining_quantity > 0 THEN 1 END) as has_remaining,
  COUNT(CASE WHEN invoiced_quantity > 0 THEN 1 END) as has_invoiced
FROM purchase_order_line_items;

SELECT 
  'Purchase Orders by Invoice Status' as description,
  invoice_status,
  COUNT(*) as count
FROM purchase_orders
GROUP BY invoice_status
ORDER BY invoice_status;

-- Show specific PO details for P100118073
SELECT 
  po.purchase_order_number,
  po.invoice_status,
  pol.sku_code,
  pol.quantity as original_qty,
  pol.invoiced_quantity,
  pol.remaining_quantity
FROM purchase_orders po
JOIN purchase_order_line_items pol ON po.id = pol.purchase_order_id
WHERE po.purchase_order_number = 'P100118073';

