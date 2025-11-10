# Debug Guide: hmitchem Cannot Access GL Code Assignment

## Problem
- Getting **401 (Unauthorized)** error
- Cannot see QuickBooks data in Supabase database

## 401 Error Means: NOT LOGGED IN
A 401 error is different from 403. It means:
- She's not authenticated at all
- Her session expired
- She needs to log out and log back in

---

## IMMEDIATE STEPS TO FIX:

### Step 1: Have hmitchem LOG OUT and LOG BACK IN
1. Click her profile in the top right
2. Click **"Sign Out"**
3. Go to the login page: https://bdibusinessportal.com/sign-in
4. Log back in with her credentials

**WHY:** Sessions can expire or get corrupted. A fresh login will get a new auth token.

---

### Step 2: After Login - Navigate to the Page
1. Go to: **Admin → Inventory Analysis → GL Code Assignment**
2. If she can't see "Inventory Analysis" in the menu, check Step 3

---

### Step 3: Check Her User Role
Run this SQL in Supabase to check her account:

```sql
-- Check hmitchem's account and role
SELECT 
  u.id,
  u.email,
  u.role,
  u.is_active,
  o.name as organization,
  o.code as org_code
FROM users u
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations o ON om.organization_uuid = o.id
WHERE u.email ILIKE '%hmit%';
```

**Expected Results:**
- `email`: Should be exactly `hmitchem@boundlessdevices.com` (check spelling!)
- `role`: Should be 'admin' or similar
- `is_active`: Should be `true`
- `organization`: Should be 'Boundless Devices' or 'BDI'

---

### Step 4: Check Supabase Auth
Run this in Supabase SQL Editor:

```sql
-- Check if she exists in Supabase Auth
SELECT 
  id,
  email,
  email_confirmed_at,
  last_sign_in_at,
  created_at
FROM auth.users
WHERE email ILIKE '%hmit%';
```

**What to look for:**
- Does her email exist?
- Is `email_confirmed_at` set? (If NULL, she never confirmed her email)
- When was `last_sign_in_at`? (If NULL, she never logged in)

---

### Step 5: If Email Is Wrong in Database
If the SQL shows a different email (e.g., typo), do ONE of these:

**Option A: Update the whitelist to match database**
Edit: `/Users/Steve/Projects/BDI/BDI PORTAL/lib/feature-flags.ts`

Add the EXACT email from the database to the `QUICKBOOKS_WHITELIST` array.

**Option B: Fix her email in Supabase**
If it's a typo in Supabase, update it:
```sql
-- CAREFUL: Only run if email is actually wrong
UPDATE auth.users
SET email = 'hmitchem@boundlessdevices.com'
WHERE email = 'wrong_email@boundlessdevices.com';
```

---

## Common Issues:

### Issue 1: She's not in the `users` table
**Symptoms:** Email exists in `auth.users` but not in `users` table.

**Fix:** Create her user record:
```sql
-- Insert into users table (adjust auth_id from auth.users query above)
INSERT INTO users (auth_id, email, name, role, is_active)
VALUES (
  '<her-auth-id-from-auth.users>',
  'hmitchem@boundlessdevices.com',
  'Heather Mitchell',
  'admin',
  true
);
```

### Issue 2: She's not in an organization
**Symptoms:** `users` record exists but no `organization_members` record.

**Fix:** Add her to BDI organization:
```sql
-- Get BDI organization ID
SELECT id, code, name FROM organizations WHERE code = 'BDI';

-- Add her to BDI organization (use her auth_id from previous query)
INSERT INTO organization_members (user_auth_id, organization_uuid, role)
VALUES (
  '<her-auth-id>',
  '<bdi-organization-uuid>',
  'member'
);
```

### Issue 3: GL Code Assignment page not visible in menu
**Check:** The menu item is under **Admin → Inventory Analysis → GL Code Assignment**

**Required:** She needs to:
- Be logged in
- Have access to the Admin section (check her role)

---

## Test URLs:

Try having her access these URLs directly:

1. **Dashboard:** https://bdibusinessportal.com/dashboard
   - If this works, she's logged in

2. **GL Code Assignment:** https://bdibusinessportal.com/admin/inventory-analysis/gl-code-assignment
   - If 401: Not logged in
   - If 403: Logged in but no access (whitelist issue)
   - If works: Success!

---

## Debug Checklist:

- [ ] She logged out and back in
- [ ] Checked `auth.users` table - email exists and confirmed
- [ ] Checked `users` table - record exists with correct email
- [ ] Checked `organization_members` - she's in BDI organization
- [ ] Email in whitelist matches EXACTLY what's in database
- [ ] She can see the Admin menu section
- [ ] She can navigate to the GL Code Assignment page

---

## Still Not Working?

### Enable Debug Mode
Have her open browser console (F12) and look for:
- Network tab → Filter by "gl-management"
- Look at the failing request
- Check the Response tab for the exact error message
- Screenshot and send to you

### Check Server Logs
Look for these log messages when she tries to access:
```
[GL Summary] Access granted for user: hmitchem@boundlessdevices.com
[GL Summary] Access denied for user: <email>
```

The exact email will tell you what Supabase has for her account.

---

## Whitelist Reference

Current whitelist in `lib/feature-flags.ts`:
```typescript
export const QUICKBOOKS_WHITELIST = [
  'scistulli@boundlessdevices.com',
  'dzand@boundlessdevices.com',
  'sjin@boundlessdevices.com',
  'hmitchem@boundlessdevices.com',  // Heather Mitchell
  'hmitcehm@boundlessdevices.com',  // Alternative spelling
];
```

Both spellings are covered, but the email MUST match exactly (case-insensitive).

