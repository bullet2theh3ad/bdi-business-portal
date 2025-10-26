-- =====================================================
-- Notifications System Tables
-- Supports multi-channel notifications including WhatsApp
-- =====================================================

-- Notification types enum
CREATE TYPE notification_type AS ENUM (
    'system',
    'order',
    'shipment',
    'rma',
    'cpfr',
    'user',
    'alert',
    'message'
);

-- Notification channels enum
CREATE TYPE notification_channel AS ENUM (
    'portal',
    'email',
    'whatsapp',
    'sms'
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Recipient (references auth_id from users table)
    user_id UUID NOT NULL REFERENCES users(auth_id) ON DELETE CASCADE,
    
    -- Notification Details
    type VARCHAR(50) NOT NULL DEFAULT 'system',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Delivery Channels (JSONB array)
    channels JSONB NOT NULL DEFAULT '["portal"]',
    
    -- Metadata
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    category VARCHAR(50), -- For grouping/filtering
    
    -- Links and Actions
    action_url VARCHAR(500), -- URL to navigate when clicked
    action_label VARCHAR(100), -- Button text
    
    -- References to related entities
    related_entity_type VARCHAR(50), -- 'purchase_order', 'shipment', 'rma', etc.
    related_entity_id UUID, -- ID of the related entity
    
    -- Status tracking
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- Delivery status per channel (JSONB object)
    delivery_status JSONB DEFAULT '{}',
    
    -- WhatsApp specific fields
    whatsapp_message_id VARCHAR(255), -- Twilio message SID
    whatsapp_status VARCHAR(50), -- sent, delivered, read, failed
    whatsapp_error_code VARCHAR(50),
    whatsapp_error_message TEXT,
    
    -- Metadata
    metadata JSONB, -- Additional flexible data
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- Optional expiration
    
    -- Soft delete
    deleted_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON notifications(is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_deleted_at ON notifications(deleted_at) WHERE deleted_at IS NULL;

-- WhatsApp Configuration table
CREATE TABLE IF NOT EXISTS whatsapp_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Organization-specific config (NULL = global/default)
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Twilio Credentials (should be encrypted in production)
    twilio_account_sid TEXT,
    twilio_auth_token TEXT,
    twilio_whatsapp_number VARCHAR(50), -- e.g., whatsapp:+14155238886
    
    -- Feature Flags
    is_enabled BOOLEAN DEFAULT FALSE,
    enabled_for_notification_types JSONB DEFAULT '["order", "shipment", "rma", "alert"]',
    
    -- Message Templates (pre-approved by WhatsApp)
    templates JSONB DEFAULT '{}',
    
    -- Rate Limiting
    daily_message_limit INTEGER DEFAULT 1000,
    messages_used_today INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    
    -- Webhook Configuration
    webhook_url VARCHAR(500), -- For receiving status updates
    webhook_secret VARCHAR(255),
    
    -- Metadata
    created_by UUID REFERENCES users(auth_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_whatsapp_config_org_id ON whatsapp_config(organization_id);
CREATE INDEX idx_whatsapp_config_enabled ON whatsapp_config(is_enabled) WHERE is_enabled = TRUE;

-- Comments for documentation
COMMENT ON TABLE notifications IS 'Multi-channel notifications including portal, email, WhatsApp, and SMS';
COMMENT ON TABLE whatsapp_config IS 'Configuration for WhatsApp integration via Twilio';
COMMENT ON COLUMN notifications.channels IS 'Array of channels: ["portal", "email", "whatsapp", "sms"]';
COMMENT ON COLUMN notifications.delivery_status IS 'Object tracking delivery per channel: {"portal": "delivered", "email": "sent"}';
COMMENT ON COLUMN whatsapp_config.twilio_account_sid IS 'Twilio Account SID (should be encrypted)';
COMMENT ON COLUMN whatsapp_config.twilio_auth_token IS 'Twilio Auth Token (should be encrypted)';

