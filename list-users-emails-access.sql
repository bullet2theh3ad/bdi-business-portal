-- Simple list of all user emails with their access level
-- Run this in Supabase SQL Editor

SELECT 
    email,
    role AS access_level
FROM users
ORDER BY 
    CASE role
        WHEN 'super_admin' THEN 1
        WHEN 'admin' THEN 2
        WHEN 'developer' THEN 3
        WHEN 'user' THEN 4
        WHEN 'member' THEN 5
        ELSE 6
    END,
    email;

