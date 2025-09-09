-- DEBUG: Julianna's invitations to see why they show wrong organization

-- 1. Check all organization invitations for business1@mtncn.com
SELECT 
  'JULIANNA INVITATIONS' as status,
  inv.id,
  inv.invited_email,
  inv.invited_name,
  inv.invited_role,
  inv.organization_id,
  inv.organization_code,
  inv.status,
  inv.created_at,
  inv.expires_at,
  inv.invitation_token,
  o.name as actual_org_name,
  o.code as actual_org_code
FROM organization_invitations inv
LEFT JOIN organizations o ON inv.organization_id = o.id
WHERE inv.invited_email = 'business1@mtncn.com'
ORDER BY inv.created_at DESC;

-- 2. Check who sent these invitations
SELECT 
  'INVITATION SENDERS' as status,
  inv.invited_email,
  inv.organization_code,
  inv.created_by_user_id,
  u.email as sender_email,
  u.name as sender_name,
  sender_org.code as sender_org_code,
  sender_org.name as sender_org_name
FROM organization_invitations inv
LEFT JOIN users u ON inv.created_by_user_id = u.id
LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
LEFT JOIN organizations sender_org ON om.organization_uuid = sender_org.id
WHERE inv.invited_email = 'business1@mtncn.com'
ORDER BY inv.created_at DESC;

-- 3. Check MTN organization details
SELECT 
  'MTN ORGANIZATION' as status,
  id,
  code,
  name,
  legal_name,
  type
FROM organizations
WHERE code = 'MTN';

-- 4. Check BDI organization details  
SELECT 
  'BDI ORGANIZATION' as status,
  id,
  code,
  name,
  legal_name,
  type
FROM organizations
WHERE code = 'BDI';
