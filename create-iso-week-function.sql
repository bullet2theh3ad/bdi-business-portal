-- =====================================================
-- Create ISO Week Function
-- Run this FIRST, then run the check query
-- =====================================================

CREATE OR REPLACE FUNCTION get_iso_week(input_date DATE) 
RETURNS INTEGER AS $$
DECLARE
  d DATE;
  day_of_week INTEGER;
  jan4 DATE;
BEGIN
  d := input_date;
  day_of_week := EXTRACT(DOW FROM d);
  
  -- Adjust to Thursday of the same week (ISO week definition)
  d := d + ((4 - day_of_week) || ' days')::INTERVAL;
  
  -- Get January 4th of the same year (always in week 1)
  jan4 := DATE_TRUNC('year', d) + INTERVAL '3 days';
  
  -- Calculate week number
  RETURN FLOOR((d - jan4) / 7) + 1;
END;
$$ LANGUAGE plpgsql;

SELECT 'ISO Week function created successfully!' as status;

