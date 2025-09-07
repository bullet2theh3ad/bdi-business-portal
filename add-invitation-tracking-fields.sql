-- Enhanced Invitation Tracking System
-- Add tracking fields to both organization_invitations and users tables

-- 1. Add tracking fields to organization_invitations table
ALTER TABLE organization_invitations 
ADD COLUMN IF NOT EXISTS sender_domain VARCHAR(100),
ADD COLUMN IF NOT EXISTS email_delivery_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS resend_message_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS bounce_reason TEXT,
ADD COLUMN IF NOT EXISTS sent_by_user_type VARCHAR(50), -- 'super_admin', 'org_admin', 'system'
ADD COLUMN IF NOT EXISTS delivery_attempts INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS last_delivery_attempt TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS email_clicked_at TIMESTAMPTZ;

-- 2. Add tracking fields to users tablof a -- image.pnge for user invitations
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS invitation_sender_domain VARCHAR(100),
ADD COLUMN IF NOT EXISTS invitation_delivery_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS invitation_resend_message_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS invitation_bounce_reason TEXT,
ADD COLUMN IF NOT EXISTS invitation_sent_by_user_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS invitation_delivery_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS invitation_last_delivery_attempt TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invitation_email_opened_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS invitation_email_clicked_at TIMESTAMPTZ;

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_org_invitations_sender_domain ON organization_invitations(sender_domain);
CREATE INDEX IF NOT EXISTS idx_org_invitations_delivery_status ON organization_invitations(email_delivery_status);
CREATE INDEX IF NOT EXISTS idx_org_invitations_resend_id ON organization_invitations(resend_message_id);
CREATE INDEX IF NOT EXISTS idx_users_invitation_sender_domain ON users(invitation_sender_domain);
CREATE INDEX IF NOT EXISTS idx_users_invitation_delivery_status ON users(invitation_delivery_status);

-- 4. Update existing records with probable sender domains
-- Organization invitations
UPDATE organization_invitations 
SET 
    sender_domain = CASE 
        WHEN created_at >= '2025-09-07 00:00:00'::timestamp THEN 'bdibusinessportal.com'
        ELSE 'boundlessdevices.com'
    END,
    email_delivery_status = CASE 
        WHEN status = 'accepted' THEN 'delivered'
        WHEN created_at >= '2025-09-07 00:00:00'::timestamp THEN 'sent'
        ELSE 'failed_domain_verification'
    END,
    sent_by_user_type = 'super_admin',
    last_delivery_attempt = created_at
WHERE sender_domain IS NULL;

-- User invitations (for recent ones only)
UPDATE users 
SET 
    invitation_sender_domain = CASE 
        WHEN created_at >= '2025-09-07 00:00:00'::timestamp THEN 'bdibusinessportal.com'
        WHEN created_at >= '2025-09-01 00:00:00'::timestamp THEN 'boundlessdevices.com'
        ELSE NULL
    END,
    invitation_delivery_status = CASE 
        WHEN password_hash != 'invitation_pending' THEN 'delivered'
        WHEN created_at >= '2025-09-07 00:00:00'::timestamp THEN 'sent'
        WHEN created_at >= '2025-09-01 00:00:00'::timestamp THEN 'failed_domain_verification'
        ELSE NULL
    END,
    invitation_delivery_attempts = CASE 
        WHEN created_at >= '2025-09-01 00:00:00'::timestamp THEN 1
        ELSE 0
    END,
    invitation_last_delivery_attempt = CASE 
        WHEN created_at >= '2025-09-01 00:00:00'::timestamp THEN created_at
        ELSE NULL
    END
WHERE created_at >= '2025-09-01 00:00:00'::timestamp 
  AND invitation_sender_domain IS NULL;

-- 5. Show updated tracking data
SELECT 
    'organization_invitations' as table_name,
    sender_domain,
    email_delivery_status,
    COUNT(*) as count
FROM organization_invitations 
GROUP BY sender_domain, email_delivery_status
ORDER BY sender_domain, email_delivery_status;

SELECT 
    'users' as table_name,
    invitation_sender_domain,
    invitation_delivery_status,
    COUNT(*) as count
FROM users 
WHERE invitation_sender_domain IS NOT NULL
GROUP BY invitation_sender_domain, invitation_delivery_status
ORDER BY invitation_sender_domain, invitation_delivery_status;
