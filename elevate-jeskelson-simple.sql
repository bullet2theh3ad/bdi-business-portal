-- Elevate jeskelson@boundlessdevices.com to super_admin

UPDATE users
SET role = 'super_admin'
WHERE email = 'jeskelson@boundlessdevices.com';

