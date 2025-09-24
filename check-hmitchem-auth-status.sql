-- Check Hannah's Supabase auth record status
-- Note: This uses the auth schema which may require service role access
SELECT 
    id,
    email,
    email_confirmed_at,
    created_at,
    updated_at,
    last_sign_in_at,
    email_change_sent_at
FROM auth.users 
WHERE id = '17e44952-1809-49f9-846c-da94a5a25835';
