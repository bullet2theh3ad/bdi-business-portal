-- Create Production Schedules table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS production_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- SKU reference
    sku_id UUID NOT NULL REFERENCES product_skus(id) ON DELETE CASCADE,
    
    -- Optional references to shipment and purchase order
    shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
    purchase_order_id UUID REFERENCES purchase_orders(id) ON DELETE SET NULL,
    
    -- Quantity for this production schedule
    quantity INTEGER NOT NULL DEFAULT 0,
    
    -- Manufacturing milestone dates (from CPFR CSV export)
    material_arrival_date DATE,
    smt_date DATE,
    dip_date DATE,
    atp_begin_date DATE,
    atp_end_date DATE,
    oba_date DATE,
    exw_date DATE,
    
    -- Notes and metadata
    notes TEXT,
    status VARCHAR(50) DEFAULT 'draft', -- draft, confirmed, in_progress, completed, cancelled
    
    -- Tracking
    created_by UUID REFERENCES users(auth_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_production_schedules_sku_id ON production_schedules(sku_id);
CREATE INDEX IF NOT EXISTS idx_production_schedules_shipment_id ON production_schedules(shipment_id);
CREATE INDEX IF NOT EXISTS idx_production_schedules_purchase_order_id ON production_schedules(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_production_schedules_material_arrival ON production_schedules(material_arrival_date);
CREATE INDEX IF NOT EXISTS idx_production_schedules_exw ON production_schedules(exw_date);
CREATE INDEX IF NOT EXISTS idx_production_schedules_status ON production_schedules(status);
CREATE INDEX IF NOT EXISTS idx_production_schedules_created_at ON production_schedules(created_at);

-- Add RLS policies
ALTER TABLE production_schedules ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY "super_admins_all_production_schedules" ON production_schedules
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.auth_id = auth.uid()
            AND users.role = 'super_admin'
        )
    );

-- Regular users can view production schedules
CREATE POLICY "users_view_production_schedules" ON production_schedules
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.auth_id = auth.uid()
        )
    );

-- Admins can manage production schedules
CREATE POLICY "admins_manage_production_schedules" ON production_schedules
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.auth_id = auth.uid()
            AND users.role IN ('admin', 'super_admin')
        )
    );

-- Verify the table was created
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'production_schedules'
ORDER BY ordinal_position;

