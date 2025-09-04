-- Check warehouse schema and contacts structure
-- First, check the warehouses table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'warehouses' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if there are any warehouses with contacts data
SELECT 
    id,
    name,
    contacts::text as contacts_raw,
    jsonb_pretty(contacts) as contacts_formatted
FROM warehouses 
WHERE contacts IS NOT NULL 
    AND contacts != '[]'::jsonb
LIMIT 3;

-- Check specific contact structure for extension field
SELECT 
    id,
    name,
    jsonb_array_elements(contacts) as individual_contact
FROM warehouses 
WHERE contacts IS NOT NULL 
    AND jsonb_array_length(contacts) > 0
LIMIT 5;

-- Check if any contacts have extension field
SELECT 
    id,
    name,
    contact->>'name' as contact_name,
    contact->>'email' as contact_email,
    contact->>'phone' as contact_phone,
    contact->>'extension' as contact_extension,
    contact->>'isPrimary' as is_primary
FROM warehouses,
     jsonb_array_elements(contacts) as contact
WHERE contacts IS NOT NULL 
    AND jsonb_array_length(contacts) > 0;
