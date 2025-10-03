-- Check if OL-USA organization exists in the database

SELECT 
    id,
    name,
    code,
    type,
    is_active,
    legal_name,
    created_at,
    updated_at
FROM organizations 
WHERE code = 'OL-USA' 
   OR name ILIKE '%OL-USA%' 
   OR name ILIKE '%OL%USA%'
   OR legal_name ILIKE '%OL%USA%';













