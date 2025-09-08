-- Create EMG inventory tracking table for warehouse inventory reports
-- This stores parsed data from BOUNDLESS DEVICES, INC-Inventory Report.csv files

CREATE TABLE IF NOT EXISTS emg_inventory_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Warehouse Information
    warehouse_code VARCHAR(10) DEFAULT 'EMG', -- Fixed for EMG warehouse
    
    -- SKU Information from CSV
    location VARCHAR(100), -- Location column
    upc VARCHAR(50), -- UPC column
    model VARCHAR(100), -- Model column
    description TEXT, -- Description column
    
    -- Inventory Quantities
    qty_on_hand INTEGER DEFAULT 0, -- Qty on Hand column
    qty_allocated INTEGER DEFAULT 0, -- Qty Allocated column  
    qty_backorder INTEGER DEFAULT 0, -- Qty Backorder column
    net_stock INTEGER DEFAULT 0, -- Net Stock column
    
    -- Additional CSV columns (flexible JSON for future columns)
    additional_data JSONB DEFAULT '{}',
    
    -- Upload tracking
    source_file_name VARCHAR(255), -- Original CSV filename
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    uploaded_by UUID REFERENCES users(auth_id),
    
    -- History tracking
    first_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    update_count INTEGER DEFAULT 1,
    
    -- Note: We'll handle duplicates in application logic instead of DB constraint
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_emg_inventory_upc ON emg_inventory_tracking(upc);
CREATE INDEX IF NOT EXISTS idx_emg_inventory_model ON emg_inventory_tracking(model);
CREATE INDEX IF NOT EXISTS idx_emg_inventory_upload_date ON emg_inventory_tracking(upload_date);
CREATE INDEX IF NOT EXISTS idx_emg_inventory_warehouse ON emg_inventory_tracking(warehouse_code);
CREATE INDEX IF NOT EXISTS idx_emg_inventory_location ON emg_inventory_tracking(location);

-- Create partial unique index for UPC (when UPC is not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_emg_inventory_upc_unique 
ON emg_inventory_tracking(upc) WHERE upc IS NOT NULL;

-- Create partial unique index for Model (when UPC is null)  
CREATE UNIQUE INDEX IF NOT EXISTS idx_emg_inventory_model_unique 
ON emg_inventory_tracking(model) WHERE upc IS NULL;

-- Create history table for inventory changes over time
CREATE TABLE IF NOT EXISTS emg_inventory_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- SKU identification
    upc VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    location VARCHAR(100),
    
    -- Inventory snapshot
    qty_on_hand INTEGER DEFAULT 0,
    qty_allocated INTEGER DEFAULT 0,
    qty_backorder INTEGER DEFAULT 0,
    net_stock INTEGER DEFAULT 0,
    
    -- Change tracking
    qty_change INTEGER DEFAULT 0, -- Change from previous record
    change_type VARCHAR(20), -- 'increase', 'decrease', 'no_change'
    
    -- Upload info
    snapshot_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source_file_name VARCHAR(255),
    uploaded_by UUID REFERENCES users(auth_id),
    
    -- Reference to main record
    emg_inventory_id UUID REFERENCES emg_inventory_tracking(id) ON DELETE CASCADE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for history queries and charting
CREATE INDEX IF NOT EXISTS idx_emg_history_upc_date ON emg_inventory_history(upc, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_emg_history_model_date ON emg_inventory_history(model, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_emg_history_snapshot_date ON emg_inventory_history(snapshot_date);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_emg_inventory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_updated = NOW();
    NEW.update_count = OLD.update_count + 1;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_emg_inventory_updated_at
    BEFORE UPDATE ON emg_inventory_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_emg_inventory_updated_at();

-- Create view for latest inventory snapshot per SKU
CREATE OR REPLACE VIEW emg_current_inventory AS
SELECT DISTINCT ON (upc, model)
    id,
    warehouse_code,
    location,
    upc,
    model,
    description,
    qty_on_hand,
    qty_allocated,
    qty_backorder,
    net_stock,
    source_file_name,
    upload_date,
    last_updated,
    update_count
FROM emg_inventory_tracking
ORDER BY upc, model, upload_date DESC;

-- Add comments
COMMENT ON TABLE emg_inventory_tracking IS 'Tracks EMG warehouse inventory from CSV uploads with history';
COMMENT ON TABLE emg_inventory_history IS 'Historical inventory snapshots for charting and trend analysis';
COMMENT ON VIEW emg_current_inventory IS 'Latest inventory levels per SKU for dashboard display';
