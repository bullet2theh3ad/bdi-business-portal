-- Add reference number to production schedules table
-- Run this in Supabase SQL Editor

-- Add reference number column
ALTER TABLE production_schedules 
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(20) UNIQUE;

-- Create a function to generate reference numbers
CREATE OR REPLACE FUNCTION generate_production_schedule_reference()
RETURNS TRIGGER AS $$
DECLARE
    new_ref_number VARCHAR(20);
    counter INTEGER := 1;
BEGIN
    -- Generate reference number in format: PS-YYYY-NNNN
    -- Where YYYY is the current year and NNNN is a sequential number
    LOOP
        new_ref_number := 'PS-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(counter::TEXT, 4, '0');
        
        -- Check if this reference number already exists
        IF NOT EXISTS (SELECT 1 FROM production_schedules WHERE reference_number = new_ref_number) THEN
            NEW.reference_number := new_ref_number;
            EXIT;
        END IF;
        
        counter := counter + 1;
        
        -- Safety check to prevent infinite loop
        IF counter > 9999 THEN
            RAISE EXCEPTION 'Unable to generate unique reference number';
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate reference numbers
DROP TRIGGER IF EXISTS generate_production_schedule_reference_trigger ON production_schedules;
CREATE TRIGGER generate_production_schedule_reference_trigger
    BEFORE INSERT ON production_schedules
    FOR EACH ROW
    WHEN (NEW.reference_number IS NULL)
    EXECUTE FUNCTION generate_production_schedule_reference();

-- Update existing records with reference numbers
DO $$
DECLARE
    rec RECORD;
    counter INTEGER := 1;
    new_ref_number VARCHAR(20);
BEGIN
    FOR rec IN 
        SELECT id FROM production_schedules 
        WHERE reference_number IS NULL 
        ORDER BY created_at ASC
    LOOP
        LOOP
            new_ref_number := 'PS-' || EXTRACT(YEAR FROM NOW()) || '-' || LPAD(counter::TEXT, 4, '0');
            
            -- Check if this reference number already exists
            IF NOT EXISTS (SELECT 1 FROM production_schedules WHERE reference_number = new_ref_number) THEN
                UPDATE production_schedules 
                SET reference_number = new_ref_number 
                WHERE id = rec.id;
                EXIT;
            END IF;
            
            counter := counter + 1;
        END LOOP;
        
        counter := counter + 1;
    END LOOP;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_production_schedules_reference_number 
    ON production_schedules(reference_number);
