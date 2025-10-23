-- Check if MT7711-10 exists in emgInventoryTracking table (the one used by the API)
SELECT 
    'emgInventoryTracking' as table_name,
    model,
    description,
    location,
    qty_on_hand,
    qty_allocated,
    qty_backorder,
    net_stock,
    last_updated,
    upload_date
FROM emg_inventory_tracking 
WHERE model = 'MT7711-10'
ORDER BY upload_date DESC;
