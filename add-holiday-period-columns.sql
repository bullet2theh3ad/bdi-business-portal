-- Add holiday period columns to chinese_holidays table
-- This enhances the table to handle multi-day holiday periods and proper buffer calculations

-- Add new columns for holiday periods
ALTER TABLE chinese_holidays 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 1;

-- Update existing records to have proper start/end dates (assume single day for existing data)
UPDATE chinese_holidays 
SET 
  start_date = date,
  end_date = date,
  duration = 1
WHERE start_date IS NULL OR end_date IS NULL;

-- Make the new columns NOT NULL after populating them
ALTER TABLE chinese_holidays 
ALTER COLUMN start_date SET NOT NULL,
ALTER COLUMN end_date SET NOT NULL,
ALTER COLUMN duration SET NOT NULL;

-- Add indexes for efficient period queries
CREATE INDEX IF NOT EXISTS idx_chinese_holidays_start_date ON chinese_holidays(start_date);
CREATE INDEX IF NOT EXISTS idx_chinese_holidays_end_date ON chinese_holidays(end_date);
CREATE INDEX IF NOT EXISTS idx_chinese_holidays_period ON chinese_holidays(start_date, end_date);

-- Add comments for documentation
COMMENT ON COLUMN chinese_holidays.start_date IS 'First day of the holiday period';
COMMENT ON COLUMN chinese_holidays.end_date IS 'Last day of the holiday period';
COMMENT ON COLUMN chinese_holidays.duration IS 'Number of days in the holiday period';

-- Verify the migration worked by checking a count
SELECT COUNT(*) as total_holidays FROM chinese_holidays;
