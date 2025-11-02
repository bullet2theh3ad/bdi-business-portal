-- ==========================================
-- Recalculate Remaining Quantities for P100118073
-- ==========================================

-- 1. Check if the 481-unit invoice still exists
SELECT 
  i.id,
  i.invoice_number,
  i.created_at,
  il.sku_code,
  il.quantity
FROM invoices i
JOIN invoice_line_items il ON i.id = il.invoice_id
WHERE il.sku_code = 'B12-30-1'
  AND i.created_at > '2025-11-02'
ORDER BY i.created_at DESC;

-- 2. Get the PO line item details
SELECT 
  pol.id,
  po.purchase_order_number,
  pol.sku_code,
  pol.quantity as original_quantity,
  pol.invoiced_quantity,
  pol.remaining_quantity
FROM purchase_order_line_items pol
JOIN purchase_orders po ON pol.purchase_order_id = po.id
WHERE po.purchase_order_number = 'P100118073';

-- 3. Recalculate the invoiced and remaining quantities
-- Find all invoices that reference this PO
DO $$
DECLARE
  po_id UUID;
  po_line RECORD;
  total_invoiced NUMERIC;
BEGIN
  -- Get the PO ID
  SELECT id INTO po_id
  FROM purchase_orders
  WHERE purchase_order_number = 'P100118073';
  
  RAISE NOTICE 'PO ID: %', po_id;
  
  -- For each line item in the PO
  FOR po_line IN 
    SELECT id, sku_code, quantity
    FROM purchase_order_line_items
    WHERE purchase_order_id = po_id
  LOOP
    -- Calculate total invoiced for this SKU from all invoices created today
    SELECT COALESCE(SUM(il.quantity), 0) INTO total_invoiced
    FROM invoice_line_items il
    JOIN invoices i ON il.invoice_id = i.id
    WHERE il.sku_code = po_line.sku_code
      AND i.created_at > '2025-11-02'
      AND (i.notes LIKE '%P100118073%' OR i.po_reference = 'P100118073');
    
    RAISE NOTICE 'SKU %: Total invoiced = %', po_line.sku_code, total_invoiced;
    
    -- Update the PO line item
    UPDATE purchase_order_line_items
    SET 
      invoiced_quantity = total_invoiced,
      remaining_quantity = po_line.quantity - total_invoiced
    WHERE id = po_line.id;
    
    RAISE NOTICE 'SKU %: Remaining = %', po_line.sku_code, (po_line.quantity - total_invoiced);
  END LOOP;
END $$;

-- 4. Verify the update
SELECT 
  po.purchase_order_number,
  pol.sku_code,
  pol.quantity as original_qty,
  pol.invoiced_quantity,
  pol.remaining_quantity,
  (pol.quantity - pol.invoiced_quantity) as calculated_remaining
FROM purchase_orders po
JOIN purchase_order_line_items pol ON po.id = pol.purchase_order_id
WHERE po.purchase_order_number = 'P100118073';

