-- Check organizations table structure and current data
-- First, show the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'organizations' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Show current organizations data
SELECT 
    id,
    name,
    legal_name,
    code,
    type,
    duns_number,
    tax_id,
    industry_code,
    company_size,
    contact_email,
    contact_phone,
    business_address,
    billing_address,
    is_active,
    created_at,
    updated_at
FROM organizations 
ORDER BY code;
