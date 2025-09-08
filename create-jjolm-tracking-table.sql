-- Create JJOLM tracking table for shipment reference numbers
-- This stores parsed data from BOUNDLESS-DEVICES-SHIPMENT-REPORT Excel files

CREATE TABLE IF NOT EXISTS jjolm_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- JJOLM Reference Information
    jjolm_number VARCHAR(100) NOT NULL, -- The "Shipment Reference Number" from Excel
    customer_reference_number VARCHAR(100), -- Customer ref from Excel
    mode VARCHAR(50), -- Shipping mode from Excel
    
    -- Shipment Details from Excel
    origin VARCHAR(100),
    destination VARCHAR(100),
    carrier VARCHAR(100),
    service_type VARCHAR(100),
    
    -- Dates from Excel (can be updated with new uploads)
    pickup_date DATE,
    delivery_date DATE,
    estimated_delivery_date DATE,
    
    -- Status and tracking
    status VARCHAR(50), -- Current status from Excel
    tracking_number VARCHAR(100),
    
    -- Additional Excel columns (flexible JSON for future columns)
    additional_data JSONB DEFAULT '{}',
    
    -- Upload tracking
    source_file_name VARCHAR(255), -- Original Excel filename
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES users(auth_id),
    
    -- History tracking
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    update_count INTEGER DEFAULT 1,
    
    -- Constraints
    UNIQUE(jjolm_number), -- Prevent duplicates
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jjolm_tracking_jjolm_number ON jjolm_tracking(jjolm_number);
CREATE INDEX IF NOT EXISTS idx_jjolm_tracking_upload_date ON jjolm_tracking(upload_date);
CREATE INDEX IF NOT EXISTS idx_jjolm_tracking_status ON jjolm_tracking(status);
CREATE INDEX IF NOT EXISTS idx_jjolm_tracking_uploaded_by ON jjolm_tracking(uploaded_by);

-- Create history table for timeline tracking
CREATE TABLE IF NOT EXISTS jjolm_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jjolm_number VARCHAR(100) NOT NULL,
    
    -- What changed
    field_name VARCHAR(100) NOT NULL, -- e.g., 'status', 'delivery_date', etc.
    old_value TEXT,
    new_value TEXT,
    
    -- When and by whom
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    changed_by UUID REFERENCES users(auth_id),
    source_file_name VARCHAR(255),
    
    -- Reference to main record
    jjolm_tracking_id UUID REFERENCES jjolm_tracking(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for history queries
CREATE INDEX IF NOT EXISTS idx_jjolm_history_jjolm_number ON jjolm_history(jjolm_number);
CREATE INDEX IF NOT EXISTS idx_jjolm_history_changed_at ON jjolm_history(changed_at);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_jjolm_tracking_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_updated = NOW();
    NEW.update_count = OLD.update_count + 1;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_jjolm_tracking_updated_at
    BEFORE UPDATE ON jjolm_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_jjolm_tracking_updated_at();

-- Add to schema.ts exports
COMMENT ON TABLE jjolm_tracking IS 'Tracks JJOLM shipment reference numbers from Excel uploads with history';
COMMENT ON TABLE jjolm_history IS 'History of changes to JJOLM records for timeline tracking';
