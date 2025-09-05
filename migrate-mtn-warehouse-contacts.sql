-- Migrate MTN warehouse from single contact to multiple contacts format
-- Run this in Supabase SQL Editor

-- Update the MTN warehouse to use the new contacts array format
UPDATE warehouses 
SET contacts = '[
  {
    "name": "Julianna",
    "email": "business1@mtncn.com", 
    "phone": "+86-13923621089",
    "extension": "",
    "isPrimary": true
  },
  {
    "name": "Huang Liangzhou",
    "email": "huangliangzhou@mtncn.com",
    "phone": "+86-13794563521", 
    "extension": "",
    "isPrimary": false
  },
  {
    "name": "Enya Zhou",
    "email": "sales3@mtncn.com",
    "phone": "86-0755-89585920",
    "extension": "8311", 
    "isPrimary": false
  }
]'::jsonb,
updated_at = NOW()
WHERE name LIKE '%HUA ZHUANG%' OR name LIKE '%MTN%';

-- Verify the update worked
SELECT 
  id,
  name,
  contact_name,
  contact_email, 
  contact_phone,
  contacts,
  updated_at
FROM warehouses 
WHERE name LIKE '%HUA ZHUANG%' OR name LIKE '%MTN%';
