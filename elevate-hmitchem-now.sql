-- Elevate Hannah to super_admin (she has accepted invitation)
UPDATE users 
SET 
    role = 'super_admin',
    updated_at = NOW()
WHERE auth_id = 'f51d5cdb-a242-49a6-93f1-1d11b2f899b5';
