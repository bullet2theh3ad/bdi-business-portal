-- Function to get distinct sources efficiently
-- This returns only unique sources instead of fetching all 12k+ rows

CREATE OR REPLACE FUNCTION get_warehouse_wip_distinct_sources(
  batch_id UUID DEFAULT NULL
)
RETURNS TABLE (source TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF batch_id IS NULL THEN
    -- All sources across all imports
    RETURN QUERY
    SELECT DISTINCT wip.source
    FROM warehouse_wip_units wip
    WHERE wip.source IS NOT NULL
    ORDER BY wip.source;
  ELSE
    -- Sources for a specific import batch
    RETURN QUERY
    SELECT DISTINCT wip.source
    FROM warehouse_wip_units wip
    WHERE wip.source IS NOT NULL
      AND wip.import_batch_id = batch_id
    ORDER BY wip.source;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_warehouse_wip_distinct_sources(UUID) TO authenticated;

COMMENT ON FUNCTION get_warehouse_wip_distinct_sources IS 
  'Returns distinct source values from warehouse_wip_units, optionally filtered by import batch';

