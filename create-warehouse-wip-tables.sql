-- =====================================================
-- Warehouse WIP (Work In Progress) Flow Tables
-- Track CATV intake, repair, RMA, and outflow
-- =====================================================

-- WIP Unit Records (parsed from Excel)
CREATE TABLE IF NOT EXISTS warehouse_wip_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core Identifiers
    serial_number TEXT NOT NULL UNIQUE,
    model_number TEXT NOT NULL, -- SKU
    source TEXT, -- e.g., "CATV", "RMA", etc.
    
    -- Dates (all stored as DATE or TIMESTAMPTZ)
    received_date DATE, -- Date Stamp from Excel
    iso_year_week_received TEXT, -- e.g., "2025-41"
    emg_ship_date DATE,
    emg_invoice_date DATE,
    jira_iso_year_week TEXT,
    jira_invoice_date DATE,
    jira_transfer_iso_week TEXT,
    jira_transfer_date DATE,
    
    -- Flags
    is_wip BOOLEAN DEFAULT false, -- WIP (1/0) column
    is_rma BOOLEAN DEFAULT false, -- Derived from Source
    is_catv_intake BOOLEAN DEFAULT false, -- Derived from Source
    
    -- Derived Fields
    stage TEXT, -- 'Intake' | 'WIP' | 'RMA' | 'Outflow' | 'Other Intake'
    outflow_date DATE, -- First of EMG Ship or Jira Transfer
    aging_days INTEGER, -- Days from received to outflow (or today if not outflowed)
    aging_bucket TEXT, -- '0-7' | '8-14' | '15-30' | '>30'
    
    -- Import Metadata
    import_batch_id UUID, -- Track which import this came from
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Raw Data (for debugging)
    raw_data JSONB -- Store full Excel row as JSON
);

-- WIP Import Batches (track each Excel upload)
CREATE TABLE IF NOT EXISTS warehouse_wip_imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- File Info
    file_name TEXT NOT NULL,
    file_size INTEGER,
    
    -- Import Stats
    total_rows INTEGER DEFAULT 0,
    processed_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'processing', -- 'processing' | 'completed' | 'failed'
    error_message TEXT,
    
    -- Metadata
    imported_by UUID REFERENCES auth.users(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Summary Stats (computed after import)
    summary_stats JSONB -- { intake: N, wip: N, rma: N, outflow: N }
);

-- Weekly Summary Data (parsed from "Weekly Summary" sheet)
CREATE TABLE IF NOT EXISTS warehouse_wip_weekly_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Week Identifier
    iso_year INTEGER NOT NULL,
    week_number INTEGER NOT NULL, -- e.g., 15, 16, 41
    iso_year_week TEXT GENERATED ALWAYS AS (iso_year || '-' || LPAD(week_number::TEXT, 2, '0')) STORED,
    
    -- Metrics (from Excel columns)
    received_in INTEGER DEFAULT 0,
    jira_shipped_out INTEGER DEFAULT 0,
    emg_shipped_out INTEGER DEFAULT 0,
    wip_in_house INTEGER DEFAULT 0,
    wip_cumulative INTEGER DEFAULT 0,
    
    -- Import Metadata
    import_batch_id UUID REFERENCES warehouse_wip_imports(id) ON DELETE CASCADE,
    imported_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_week UNIQUE (iso_year, week_number, import_batch_id)
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

CREATE INDEX idx_wip_units_serial ON warehouse_wip_units(serial_number);
CREATE INDEX idx_wip_units_model ON warehouse_wip_units(model_number);
CREATE INDEX idx_wip_units_stage ON warehouse_wip_units(stage);
CREATE INDEX idx_wip_units_source ON warehouse_wip_units(source);
CREATE INDEX idx_wip_units_received ON warehouse_wip_units(received_date);
CREATE INDEX idx_wip_units_outflow ON warehouse_wip_units(outflow_date);
CREATE INDEX idx_wip_units_iso_week ON warehouse_wip_units(iso_year_week_received);
CREATE INDEX idx_wip_units_batch ON warehouse_wip_units(import_batch_id);

CREATE INDEX idx_wip_imports_status ON warehouse_wip_imports(status);
CREATE INDEX idx_wip_imports_started ON warehouse_wip_imports(started_at DESC);

CREATE INDEX idx_wip_weekly_year_week ON warehouse_wip_weekly_summary(iso_year, week_number);
CREATE INDEX idx_wip_weekly_batch ON warehouse_wip_weekly_summary(import_batch_id);

-- =====================================================
-- Row Level Security (RLS) Policies
-- =====================================================

ALTER TABLE warehouse_wip_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_wip_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_wip_weekly_summary ENABLE ROW LEVEL SECURITY;

-- Super admins and operations team can view WIP data
CREATE POLICY "Super admins and ops can view WIP units"
    ON warehouse_wip_units FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' IN ('super_admin', 'admin', 'operations')
        )
    );

CREATE POLICY "Super admins and ops can manage WIP units"
    ON warehouse_wip_units FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' IN ('super_admin', 'admin', 'operations')
        )
    );

CREATE POLICY "Super admins and ops can view WIP imports"
    ON warehouse_wip_imports FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' IN ('super_admin', 'admin', 'operations')
        )
    );

CREATE POLICY "Super admins and ops can create WIP imports"
    ON warehouse_wip_imports FOR INSERT
    WITH CHECK (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' IN ('super_admin', 'admin', 'operations')
        )
    );

CREATE POLICY "Super admins and ops can view weekly summary"
    ON warehouse_wip_weekly_summary FOR SELECT
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' IN ('super_admin', 'admin', 'operations')
        )
    );

CREATE POLICY "Super admins and ops can manage weekly summary"
    ON warehouse_wip_weekly_summary FOR ALL
    USING (
        auth.uid() IN (
            SELECT id FROM auth.users 
            WHERE raw_user_meta_data->>'role' IN ('super_admin', 'admin', 'operations')
        )
    );

-- =====================================================
-- Helper Functions
-- =====================================================

-- Function to compute derived fields for a unit
CREATE OR REPLACE FUNCTION compute_wip_unit_stage(unit_row warehouse_wip_units)
RETURNS TEXT AS $$
BEGIN
    -- Priority order: Outflow → RMA → WIP → Intake
    IF unit_row.outflow_date IS NOT NULL THEN
        RETURN 'Outflow';
    ELSIF unit_row.is_rma THEN
        RETURN 'RMA';
    ELSIF unit_row.is_wip THEN
        RETURN 'WIP';
    ELSIF unit_row.received_date IS NOT NULL OR unit_row.iso_year_week_received IS NOT NULL THEN
        IF unit_row.is_catv_intake THEN
            RETURN 'Intake';
        ELSE
            RETURN 'Other Intake';
        END IF;
    ELSE
        RETURN 'Unknown';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to compute aging days
CREATE OR REPLACE FUNCTION compute_aging_days(
    received_date DATE,
    outflow_date DATE
)
RETURNS INTEGER AS $$
BEGIN
    IF received_date IS NULL THEN
        RETURN NULL;
    END IF;
    
    IF outflow_date IS NOT NULL THEN
        RETURN (outflow_date - received_date)::INTEGER;
    ELSE
        RETURN (CURRENT_DATE - received_date)::INTEGER;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to compute aging bucket
CREATE OR REPLACE FUNCTION compute_aging_bucket(aging_days INTEGER)
RETURNS TEXT AS $$
BEGIN
    IF aging_days IS NULL THEN
        RETURN NULL;
    ELSIF aging_days <= 7 THEN
        RETURN '0-7';
    ELSIF aging_days <= 14 THEN
        RETURN '8-14';
    ELSIF aging_days <= 30 THEN
        RETURN '15-30';
    ELSE
        RETURN '>30';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-compute derived fields on insert/update
CREATE OR REPLACE FUNCTION update_wip_unit_derived_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Compute outflow_date (first non-null of EMG Ship or Jira Transfer)
    NEW.outflow_date := LEAST(NEW.emg_ship_date, NEW.jira_transfer_date);
    
    -- Compute stage
    NEW.stage := compute_wip_unit_stage(NEW);
    
    -- Compute aging
    NEW.aging_days := compute_aging_days(NEW.received_date, NEW.outflow_date);
    NEW.aging_bucket := compute_aging_bucket(NEW.aging_days);
    
    -- Update timestamp
    NEW.updated_at := NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_wip_unit_derived
    BEFORE INSERT OR UPDATE ON warehouse_wip_units
    FOR EACH ROW
    EXECUTE FUNCTION update_wip_unit_derived_fields();

COMMENT ON TABLE warehouse_wip_units IS 'Individual unit records from WIP Excel file (Raw Data sheet)';
COMMENT ON TABLE warehouse_wip_imports IS 'Track each Excel import batch with stats';
COMMENT ON TABLE warehouse_wip_weekly_summary IS 'Weekly summary metrics from Excel (Weekly Summary sheet)';

