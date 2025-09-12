-- Create CATV inventory tracking table for warehouse inventory reports
-- This stores parsed data from CATV Communications XLS files with 4 key metrics

CREATE TABLE IF NOT EXISTS catv_inventory_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Warehouse Information
    warehouse_code VARCHAR(10) DEFAULT 'CATV', -- Fixed for CATV warehouse
    
    -- Week Information (dynamic columns)
    week_number VARCHAR(20), -- Week identifier (e.g., "Week 15", "Week 16", etc.)
    week_date DATE, -- Date for the week
    
    -- Key Metrics (4 main rows from Tab 1)
    received_in INTEGER DEFAULT 0, -- Received (IN)
    shipped_jira_out INTEGER DEFAULT 0, -- Shipped via Jira (OUT)
    shipped_emg_out INTEGER DEFAULT 0, -- Shipped to EMG (OUT) - renamed from "Count of EMG Shipped (OUT)"
    wip_in_house INTEGER DEFAULT 0, -- WIP (IN HOUSE)
    
    -- Pivot Data (from Tab 2 - flexible JSON structure)
    pivot_data JSONB DEFAULT '{}', -- Raw pivot table data for searchable display
    
    -- Upload tracking
    source_file_name VARCHAR(255), -- Original XLS filename
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES users(auth_id),
    
    -- History tracking
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    update_count INTEGER DEFAULT 1,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_catv_inventory_week ON catv_inventory_tracking(week_number);
CREATE INDEX IF NOT EXISTS idx_catv_inventory_date ON catv_inventory_tracking(week_date);
CREATE INDEX IF NOT EXISTS idx_catv_inventory_upload_date ON catv_inventory_tracking(upload_date);
CREATE INDEX IF NOT EXISTS idx_catv_inventory_warehouse ON catv_inventory_tracking(warehouse_code);

-- Enable Row Level Security
ALTER TABLE catv_inventory_tracking ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for CATV inventory access  
CREATE POLICY "Users can view CATV inventory data" ON catv_inventory_tracking
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.auth_id = auth.uid()
            AND u.is_active = true
        )
    );

-- Allow super_admin to insert/update CATV inventory data
CREATE POLICY "Super admin can manage CATV inventory data" ON catv_inventory_tracking
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.auth_id = auth.uid()
            AND u.role = 'super_admin'
            AND u.is_active = true
        )
    );

-- Add comment for documentation
COMMENT ON TABLE catv_inventory_tracking IS 'Stores CATV Communications warehouse inventory data with 4 key metrics: Received (IN), Shipped via Jira (OUT), Shipped to EMG (OUT), and WIP (IN HOUSE). Includes weekly tracking and pivot data for detailed analysis.';
