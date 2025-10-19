-- Query to find the 291 "unclassified" units
-- These are units that are NOT WIP, NOT RMA, and NOT Outflow

SELECT 
    serial_number,
    model_number,
    source,
    received_date,
    is_wip,
    is_rma,
    is_catv_intake,
    outflow_date,
    emg_ship_date,
    jira_transfer_date,
    stage
FROM 
    warehouse_wip_units
WHERE 
    -- Get most recent import batch
    import_batch_id = (
        SELECT id 
        FROM warehouse_wip_imports 
        WHERE status = 'completed' 
        ORDER BY completed_at DESC 
        LIMIT 1
    )
    -- NOT in WIP, RMA, or Outflow
    AND is_wip = false
    AND is_rma = false
    AND outflow_date IS NULL
ORDER BY 
    received_date DESC NULLS LAST,
    serial_number
LIMIT 20;

-- Count to verify
SELECT 
    COUNT(*) as unclassified_count,
    stage
FROM 
    warehouse_wip_units
WHERE 
    import_batch_id = (
        SELECT id 
        FROM warehouse_wip_imports 
        WHERE status = 'completed' 
        ORDER BY completed_at DESC 
        LIMIT 1
    )
    AND is_wip = false
    AND is_rma = false
    AND outflow_date IS NULL
GROUP BY stage;

