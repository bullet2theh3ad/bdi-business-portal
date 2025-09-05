-- Add missing columns to shipments table
-- Run this in Supabase SQL Editor

-- 1. Add priority column
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS priority varchar(20) DEFAULT 'standard';

-- 2. Add shipper_reference column  
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS shipper_reference varchar(100);

-- 3. Add factory warehouse reference for contact details and professional forms
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS factory_warehouse_id uuid REFERENCES warehouses(id) ON DELETE SET NULL;

-- 4. Add any other missing columns that might be needed
ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS notes text;

ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS pickup_location text;

ALTER TABLE shipments 
ADD COLUMN IF NOT EXISTS delivery_location text;

-- 5. Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'shipments' AND table_schema = 'public'
  AND column_name IN ('priority', 'shipper_reference', 'factory_warehouse_id', 'notes', 'pickup_location', 'delivery_location')
ORDER BY column_name;

-- 6. Test the shipment record again
SELECT 
  id,
  shipment_number,
  priority,
  shipper_reference,
  factory_warehouse_id,
  notes,
  updated_at
FROM shipments 
WHERE id = 'ebbd6c71-088b-4e3e-b39e-b6622e1fb951';
