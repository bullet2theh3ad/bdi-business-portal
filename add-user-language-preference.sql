-- Add language preference to users table for i18n support

-- 1. Add language preference column
ALTER TABLE users 
ADD COLUMN preferred_language VARCHAR(5) DEFAULT 'en';

-- 2. Add constraint to ensure valid language codes
ALTER TABLE users 
ADD CONSTRAINT users_preferred_language_check 
CHECK (preferred_language IN ('en', 'zh', 'vi', 'es'));

-- 3. Set default language preferences based on organization
UPDATE users 
SET preferred_language = 'zh' 
WHERE supplier_code = 'MTN';

-- 4. Verify the changes
SELECT 'USER LANGUAGE PREFERENCES' as status, email, name, supplier_code, preferred_language
FROM users 
WHERE preferred_language IS NOT NULL
ORDER BY supplier_code, email;
