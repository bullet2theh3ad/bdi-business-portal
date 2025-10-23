-- Create junction table for production_schedule_shipments
-- This allows a single production schedule to be associated with multiple shipments
-- Run this in Supabase SQL Editor

-- Create the junction table
CREATE TABLE IF NOT EXISTS production_schedule_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    production_schedule_id UUID NOT NULL REFERENCES production_schedules(id) ON DELETE CASCADE,
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(production_schedule_id, shipment_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_production_schedule_shipments_production_schedule_id 
    ON production_schedule_shipments(production_schedule_id);
CREATE INDEX IF NOT EXISTS idx_production_schedule_shipments_shipment_id 
    ON production_schedule_shipments(shipment_id);

-- Add RLS policies
ALTER TABLE production_schedule_shipments ENABLE ROW LEVEL SECURITY;

-- Allow users to view production schedule shipments for their organization
CREATE POLICY "Users can view production schedule shipments for their organization" 
    ON production_schedule_shipments
    FOR SELECT USING (
        production_schedule_id IN (
            SELECT ps.id 
            FROM production_schedules ps
            JOIN users u ON ps.created_by = u.auth_id
            JOIN organization_members om ON om.user_auth_id = u.auth_id
            WHERE om.organization_uuid IN (
                SELECT organization_uuid 
                FROM organization_members 
                WHERE user_auth_id = auth.uid()
            )
        )
    );

-- Allow users to manage production schedule shipments for their organization
CREATE POLICY "Users can manage production schedule shipments for their organization" 
    ON production_schedule_shipments
    FOR ALL USING (
        production_schedule_id IN (
            SELECT ps.id 
            FROM production_schedules ps
            JOIN users u ON ps.created_by = u.auth_id
            JOIN organization_members om ON om.user_auth_id = u.auth_id
            WHERE om.organization_uuid IN (
                SELECT organization_uuid 
                FROM organization_members 
                WHERE user_auth_id = auth.uid()
            )
        )
    );
