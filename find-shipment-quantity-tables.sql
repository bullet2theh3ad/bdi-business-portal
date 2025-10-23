-- Find tables related to shipments that might have quantity
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%shipment%'
ORDER BY table_name;

-- Also check for any tables with 'quantity' columns
SELECT DISTINCT table_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name LIKE '%quantity%'
ORDER BY table_name;

