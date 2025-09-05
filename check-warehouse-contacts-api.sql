-- Check the contacts field in the warehouse record
SELECT 
    id,
    name,
    contact_name,
    contact_email,
    contact_phone,
    contacts,
    updated_at
FROM warehouses 
WHERE id = '9613effe-ff6f-4f80-b8d2-be38977e202d';
