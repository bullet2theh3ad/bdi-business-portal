-- QuickBooks Items/Products Table
-- This table stores product catalog from QuickBooks
-- Items are the bridge between QB and BDI SKUs

CREATE TABLE IF NOT EXISTS quickbooks_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES quickbooks_connections(id) ON DELETE CASCADE,
  
  -- QuickBooks IDs
  qb_item_id TEXT NOT NULL,
  qb_sync_token TEXT,
  
  -- Item Details
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  type TEXT, -- Inventory, Service, NonInventory, Bundle, etc.
  
  -- Pricing
  unit_price DECIMAL(15, 2),
  purchase_cost DECIMAL(15, 2),
  
  -- Inventory (if type = Inventory)
  qty_on_hand DECIMAL(15, 2),
  reorder_point DECIMAL(15, 2),
  
  -- Accounting References
  income_account_ref TEXT,
  expense_account_ref TEXT,
  asset_account_ref TEXT,
  
  -- Status & Flags
  is_active BOOLEAN DEFAULT true,
  taxable BOOLEAN DEFAULT false,
  
  -- Category/Parent (for sub-items)
  parent_ref TEXT,
  
  -- Full item data (for line items, etc.)
  full_data JSONB,
  
  -- Metadata
  qb_created_at TIMESTAMPTZ,
  qb_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(connection_id, qb_item_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_qb_items_connection ON quickbooks_items(connection_id);
CREATE INDEX IF NOT EXISTS idx_qb_items_sku ON quickbooks_items(sku) WHERE sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qb_items_name ON quickbooks_items(name);
CREATE INDEX IF NOT EXISTS idx_qb_items_type ON quickbooks_items(type);
CREATE INDEX IF NOT EXISTS idx_qb_items_active ON quickbooks_items(is_active);

-- Enable RLS
ALTER TABLE quickbooks_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only authorized QB users can access
DROP POLICY IF EXISTS "QuickBooks authorized users can view items" ON quickbooks_items;
CREATE POLICY "QuickBooks authorized users can view items"
  ON quickbooks_items
  FOR SELECT
  USING (
    auth.uid() IN (SELECT auth_id FROM quickbooks_authorized_users)
  );

-- Comments
COMMENT ON TABLE quickbooks_items IS 'QuickBooks product/service catalog - bridge to BDI SKUs';
COMMENT ON COLUMN quickbooks_items.sku IS 'SKU/Part Number - key for matching with BDI SKUs';
COMMENT ON COLUMN quickbooks_items.type IS 'Inventory, Service, NonInventory, Bundle, Group, Category';
COMMENT ON COLUMN quickbooks_items.full_data IS 'Complete QB Item object for reference';

