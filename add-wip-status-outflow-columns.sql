-- Add WIP Status and Outflow columns to warehouse_wip_units table
-- Run this in your Supabase SQL editor

-- Add wip_status column with enum constraint
ALTER TABLE warehouse_wip_units
ADD COLUMN IF NOT EXISTS wip_status VARCHAR(50);

-- Add outflow column (destination identifier)
ALTER TABLE warehouse_wip_units
ADD COLUMN IF NOT EXISTS outflow VARCHAR(100);

-- Create index for performance on wip_status
CREATE INDEX IF NOT EXISTS idx_wip_units_wip_status ON warehouse_wip_units(wip_status);

-- Create index for performance on outflow
CREATE INDEX IF NOT EXISTS idx_wip_units_outflow ON warehouse_wip_units(outflow);

-- Add check constraint for valid WIP status values (optional but recommended)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'wip_units_valid_status'
  ) THEN
    ALTER TABLE warehouse_wip_units
    ADD CONSTRAINT wip_units_valid_status
    CHECK (
      wip_status IS NULL OR
      wip_status IN (
        'RECEIVED',
        'PASSED',
        'FAILED',
        'RTS-NEW',
        'RTS-KITTED',
        'RECYCLED',
        'SHIPPED',
        'RMA_SHIPPED',
        'MISSING'
      )
    );
  END IF;
END $$;

-- Update existing records to set default status if null
-- (Run this after first import to avoid constraint violations)
-- UPDATE warehouse_wip_units SET wip_status = 'RECEIVED' WHERE wip_status IS NULL AND is_wip = true;

-- Verify the changes
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'warehouse_wip_units' 
  AND column_name IN ('wip_status', 'outflow');

-- Show sample data
SELECT 
  serial_number,
  model_number,
  wip_status,
  outflow,
  received_date
FROM warehouse_wip_units
LIMIT 5;

-- Summary by WIP Status (will be empty until first import)
SELECT 
  wip_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM warehouse_wip_units
WHERE wip_status IS NOT NULL
GROUP BY wip_status
ORDER BY count DESC;

-- Summary by Outflow (will be empty until first import)
SELECT 
  COALESCE(outflow, 'In WIP') as destination,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM warehouse_wip_units
GROUP BY outflow
ORDER BY count DESC;

COMMENT ON COLUMN warehouse_wip_units.wip_status IS 'Current processing status: RECEIVED, PASSED, FAILED, RTS-NEW, RTS-KITTED, RECYCLED, SHIPPED, RMA_SHIPPED, MISSING';
COMMENT ON COLUMN warehouse_wip_units.outflow IS 'Destination identifier for shipped units (e.g., EMG, ISSOY, SVT)';

