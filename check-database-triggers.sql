-- Check for database triggers or functions that might auto-create shipments

-- 1. Check for triggers on sales_forecasts table
SELECT 
    'TRIGGERS ON SALES_FORECASTS' as check_type,
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'sales_forecasts';

-- 2. Check for any functions that mention shipments
SELECT 
    'FUNCTIONS MENTIONING SHIPMENTS' as check_type,
    routine_name,
    routine_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_definition ILIKE '%shipment%' 
AND routine_schema = 'public';

-- 3. Check for any triggers on other tables that might create shipments
SELECT 
    'ALL TRIGGERS' as check_type,
    trigger_name,
    event_object_table,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE trigger_schema = 'public';

-- 4. Check for stored procedures or functions
SELECT 
    'ALL FUNCTIONS' as check_type,
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION';
