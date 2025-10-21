-- =====================================================
-- Check ISO Week Calculation
-- Verify that dates are being grouped into correct weeks
-- =====================================================

-- Function to calculate ISO week (same as frontend)
CREATE OR REPLACE FUNCTION get_iso_week(input_date DATE) 
RETURNS INTEGER AS $$
DECLARE
  d DATE;
  day_of_week INTEGER;
  jan4 DATE;
BEGIN
  d := input_date;
  day_of_week := EXTRACT(DOW FROM d);
  
  -- Adjust to Thursday of the same week (ISO week definition)
  d := d + ((4 - day_of_week) || ' days')::INTERVAL;
  
  -- Get January 4th of the same year (always in week 1)
  jan4 := DATE_TRUNC('year', d) + INTERVAL '3 days';
  
  -- Calculate week number
  RETURN FLOOR((d - jan4) / 7) + 1;
END;
$$ LANGUAGE plpgsql;

-- Check what ISO week each date in our range falls into
SELECT 
  DATE(posted_date) as sale_date,
  EXTRACT(YEAR FROM posted_date) as year,
  get_iso_week(DATE(posted_date)) as iso_week,
  EXTRACT(YEAR FROM posted_date) || '-W' || LPAD(get_iso_week(DATE(posted_date))::TEXT, 2, '0') as week_key,
  COUNT(*) as line_items,
  SUM(quantity) as total_units
FROM amazon_financial_line_items
WHERE posted_date >= '2024-10-06' 
  AND posted_date < '2024-10-13'
  AND bdi_sku IS NOT NULL
  AND transaction_type = 'sale'
  AND quantity > 0
GROUP BY DATE(posted_date), EXTRACT(YEAR FROM posted_date), get_iso_week(DATE(posted_date))
ORDER BY sale_date;

-- Summary by ISO week
SELECT 
  EXTRACT(YEAR FROM posted_date) || '-W' || LPAD(get_iso_week(DATE(posted_date))::TEXT, 2, '0') as week_key,
  MIN(DATE(posted_date)) as week_start,
  MAX(DATE(posted_date)) as week_end,
  COUNT(*) as line_items,
  SUM(quantity) as total_units,
  SUM(item_price::numeric) as total_revenue
FROM amazon_financial_line_items
WHERE posted_date >= '2024-10-01' 
  AND posted_date < '2024-10-20'
  AND bdi_sku IS NOT NULL
  AND transaction_type = 'sale'
  AND quantity > 0
GROUP BY EXTRACT(YEAR FROM posted_date) || '-W' || LPAD(get_iso_week(DATE(posted_date))::TEXT, 2, '0')
ORDER BY week_key;

