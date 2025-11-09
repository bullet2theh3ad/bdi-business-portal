-- Debug: Check NRE Payment Line Items
SELECT 
    'NRE Payments' as source,
    COUNT(*) as total_count,
    SUM(amount) as total_amount,
    COUNT(CASE WHEN is_paid = true THEN 1 END) as paid_count,
    SUM(CASE WHEN is_paid = true THEN amount ELSE 0 END) as paid_amount,
    COUNT(CASE WHEN is_paid = false AND payment_date < CURRENT_DATE THEN 1 END) as overdue_count,
    SUM(CASE WHEN is_paid = false AND payment_date < CURRENT_DATE THEN amount ELSE 0 END) as overdue_amount,
    COUNT(CASE WHEN is_paid = false AND payment_date >= CURRENT_DATE THEN 1 END) as to_be_paid_count,
    SUM(CASE WHEN is_paid = false AND payment_date >= CURRENT_DATE THEN amount ELSE 0 END) as to_be_paid_amount
FROM nre_budget_payment_line_items;

-- Debug: Check Inventory Payment Line Items  
SELECT 
    'Inventory Payments' as source,
    COUNT(*) as total_count,
    SUM(amount) as total_amount,
    COUNT(CASE WHEN is_paid = true THEN 1 END) as paid_count,
    SUM(CASE WHEN is_paid = true THEN amount ELSE 0 END) as paid_amount,
    COUNT(CASE WHEN is_paid = false AND payment_date < CURRENT_DATE THEN 1 END) as overdue_count,
    SUM(CASE WHEN is_paid = false AND payment_date < CURRENT_DATE THEN amount ELSE 0 END) as overdue_amount,
    COUNT(CASE WHEN is_paid = false AND payment_date >= CURRENT_DATE THEN 1 END) as to_be_paid_count,
    SUM(CASE WHEN is_paid = false AND payment_date >= CURRENT_DATE THEN amount ELSE 0 END) as to_be_paid_amount
FROM inventory_payment_line_items;

-- Sample data to see actual values
SELECT 'NRE Sample' as type, payment_date, amount, is_paid, 
       CASE 
         WHEN is_paid = true THEN 'PAID'
         WHEN payment_date < CURRENT_DATE THEN 'OVERDUE'
         ELSE 'TO_BE_PAID'
       END as status
FROM nre_budget_payment_line_items
ORDER BY payment_date DESC
LIMIT 10;

SELECT 'Inventory Sample' as type, payment_date, amount, is_paid,
       CASE 
         WHEN is_paid = true THEN 'PAID'
         WHEN payment_date < CURRENT_DATE THEN 'OVERDUE'
         ELSE 'TO_BE_PAID'
       END as status
FROM inventory_payment_line_items
ORDER BY payment_date DESC
LIMIT 10;

