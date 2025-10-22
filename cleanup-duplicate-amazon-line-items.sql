-- Cleanup Duplicate Amazon Financial Line Items
-- This removes duplicate records keeping only one per order_id + bdi_sku + posted_date

-- Step 1: Check how many duplicates we have
SELECT 
  COUNT(*) as total_records,
  COUNT(DISTINCT (order_id, bdi_sku, DATE(posted_date))) as unique_records,
  COUNT(*) - COUNT(DISTINCT (order_id, bdi_sku, DATE(posted_date))) as duplicate_count
FROM amazon_financial_line_items;

-- Step 2: See example duplicates
SELECT 
  order_id,
  bdi_sku,
  DATE(posted_date) as posted_date,
  COUNT(*) as duplicate_count
FROM amazon_financial_line_items
GROUP BY order_id, bdi_sku, DATE(posted_date)
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 10;

-- Step 3: Create a temporary table with consolidated records
-- This approach sums all amounts for duplicate records
CREATE TEMP TABLE consolidated_line_items AS
SELECT 
  order_id,
  MAX(posted_date) as posted_date, -- Keep the latest timestamp
  MAX(transaction_type) as transaction_type,
  MAX(amazon_sku) as amazon_sku,
  MAX(asin) as asin,
  bdi_sku,
  MAX(product_name) as product_name,
  SUM(quantity) as quantity,
  SUM(unit_price::numeric) as unit_price,
  SUM(item_price::numeric) as item_price,
  SUM(shipping_price::numeric) as shipping_price,
  SUM(gift_wrap_price::numeric) as gift_wrap_price,
  SUM(item_promotion::numeric) as item_promotion,
  SUM(shipping_promotion::numeric) as shipping_promotion,
  SUM(item_tax::numeric) as item_tax,
  SUM(shipping_tax::numeric) as shipping_tax,
  SUM(gift_wrap_tax::numeric) as gift_wrap_tax,
  SUM(commission::numeric) as commission,
  SUM(fba_fees::numeric) as fba_fees,
  SUM(other_fees::numeric) as other_fees,
  SUM(total_fees::numeric) as total_fees,
  SUM(gross_revenue::numeric) as gross_revenue,
  SUM(net_revenue::numeric) as net_revenue,
  SUM(total_tax::numeric) as total_tax,
  MAX(marketplace_id) as marketplace_id,
  MAX(currency_code) as currency_code,
  (array_agg(raw_event))[1] as raw_event -- Take first raw_event (JSONB doesn't support MAX)
FROM amazon_financial_line_items
GROUP BY order_id, bdi_sku, DATE(posted_date);

-- Step 4: Delete all existing records
DELETE FROM amazon_financial_line_items;

-- Step 5: Insert consolidated records back
INSERT INTO amazon_financial_line_items (
  order_id, posted_date, transaction_type, amazon_sku, asin, bdi_sku, product_name,
  quantity, unit_price, item_price, shipping_price, gift_wrap_price,
  item_promotion, shipping_promotion, item_tax, shipping_tax, gift_wrap_tax,
  commission, fba_fees, other_fees, total_fees, gross_revenue, net_revenue, total_tax,
  marketplace_id, currency_code, raw_event
)
SELECT 
  order_id, posted_date, transaction_type, amazon_sku, asin, bdi_sku, product_name,
  quantity, unit_price, item_price, shipping_price, gift_wrap_price,
  item_promotion, shipping_promotion, item_tax, shipping_tax, gift_wrap_tax,
  commission, fba_fees, other_fees, total_fees, 
  gross_revenue, net_revenue, total_tax,
  marketplace_id, currency_code, raw_event
FROM consolidated_line_items;

-- Step 6: Verify cleanup
SELECT 
  COUNT(*) as total_records_after_cleanup,
  COUNT(DISTINCT (order_id, bdi_sku, DATE(posted_date))) as unique_records_after_cleanup
FROM amazon_financial_line_items;

-- Step 7: Check the most recent data after cleanup
SELECT 
  order_id,
  TO_CHAR(posted_date, 'YYYY-MM-DD HH24:MI:SS') as posted_datetime,
  bdi_sku,
  quantity,
  gross_revenue,
  total_tax
FROM amazon_financial_line_items
WHERE DATE(posted_date) >= CURRENT_DATE - INTERVAL '2 days'
ORDER BY posted_date DESC
LIMIT 20;

