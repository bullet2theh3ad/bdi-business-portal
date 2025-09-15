-- ADD COMPREHENSIVE INVOICE FIELDS: Addresses, Ship Date, Bank Information
-- This adds all missing fields needed for professional invoice generation

-- Add customer address fields
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS customer_address TEXT,
ADD COLUMN IF NOT EXISTS ship_to_address TEXT,
ADD COLUMN IF NOT EXISTS ship_date DATE;

-- Add comprehensive bank information fields
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS bank_routing_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS bank_swift_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS bank_iban VARCHAR(100),
ADD COLUMN IF NOT EXISTS bank_address TEXT,
ADD COLUMN IF NOT EXISTS bank_country VARCHAR(100),
ADD COLUMN IF NOT EXISTS bank_currency VARCHAR(10);

-- Add comments for documentation
COMMENT ON COLUMN invoices.customer_address IS 'Customer billing address';
COMMENT ON COLUMN invoices.ship_to_address IS 'Shipping address (can be different from billing)';
COMMENT ON COLUMN invoices.ship_date IS 'Planned shipping date';
COMMENT ON COLUMN invoices.bank_name IS 'Bank name for wire transfers';
COMMENT ON COLUMN invoices.bank_account_number IS 'Bank account number';
COMMENT ON COLUMN invoices.bank_routing_number IS 'Bank routing number (US)';
COMMENT ON COLUMN invoices.bank_swift_code IS 'SWIFT code for international transfers';
COMMENT ON COLUMN invoices.bank_iban IS 'IBAN for international transfers';
COMMENT ON COLUMN invoices.bank_address IS 'Bank physical address';
COMMENT ON COLUMN invoices.bank_country IS 'Bank country';
COMMENT ON COLUMN invoices.bank_currency IS 'Currency for bank transfers (USD, EUR, etc.)';

-- Check the updated table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
ORDER BY ordinal_position;
