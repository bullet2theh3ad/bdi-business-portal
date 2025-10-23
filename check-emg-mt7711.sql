-- Check if MT7711-10 exists in EMG warehouse data
SELECT 
    'emg_inventory_tracking' as table_name,
    model,
    COUNT(*) as record_count,
    MIN(created_at) as earliest_record,
    MAX(created_at) as latest_record
FROM emg_inventory_tracking 
WHERE model = 'MT7711-10'
GROUP BY model;
