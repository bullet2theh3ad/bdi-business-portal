-- Fix the inconsistent forecast that has sales_signal='submitted' but status='draft'
-- This will make the Dashboard show all blue bars as expected

UPDATE sales_forecasts 
SET 
  status = 'submitted',
  updated_at = NOW()
WHERE id = '83c1ca01-dd56-42ef-bc0b-85d7c3bf118a'
  AND status = 'draft' 
  AND sales_signal = 'submitted';

-- Verify the fix
SELECT 
  id,
  status,
  sales_signal,
  CASE 
    WHEN status = 'submitted' THEN '🔵 FIXED - Will show blue bar'
    WHEN status = 'draft' THEN '🟠 STILL DRAFT - Will show orange bar'
  END as dashboard_result
FROM sales_forecasts 
WHERE id = '83c1ca01-dd56-42ef-bc0b-85d7c3bf118a';

-- Check final status distribution
SELECT 
  status,
  COUNT(*) as count,
  SUM(quantity) as total_quantity
FROM sales_forecasts 
GROUP BY status
ORDER BY status;
