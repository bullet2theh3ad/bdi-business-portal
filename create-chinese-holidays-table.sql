-- Create Chinese holidays table for reliable holiday data storage
-- This is a standalone table that won't impact any existing functionality

CREATE TABLE IF NOT EXISTS chinese_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Holiday identification
  date DATE NOT NULL,
  name VARCHAR(255) NOT NULL, -- English name
  name_chinese VARCHAR(255), -- Chinese name (optional for now)
  year INTEGER NOT NULL,
  
  -- Holiday metadata
  is_official BOOLEAN DEFAULT true,
  is_adjusted_workday BOOLEAN DEFAULT false, -- Government makeup days
  holiday_type VARCHAR(50) DEFAULT 'public', -- public, traditional, adjusted
  
  -- Data source tracking
  source VARCHAR(50) DEFAULT 'api', -- api, manual, government
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicates
  UNIQUE(date)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_chinese_holidays_date ON chinese_holidays(date);
CREATE INDEX IF NOT EXISTS idx_chinese_holidays_year ON chinese_holidays(year);
CREATE INDEX IF NOT EXISTS idx_chinese_holidays_source ON chinese_holidays(source);

-- Add comments for documentation
COMMENT ON TABLE chinese_holidays IS 'Stores Chinese public holidays for shipment planning and calendar highlighting';
COMMENT ON COLUMN chinese_holidays.is_adjusted_workday IS 'True for government-mandated makeup workdays during holiday periods';
COMMENT ON COLUMN chinese_holidays.source IS 'Data source: api (from external service), manual (admin entered), government (official source)';
