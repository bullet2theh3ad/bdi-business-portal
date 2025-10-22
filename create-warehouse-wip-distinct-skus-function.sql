-- Function to get distinct SKUs (model_number) efficiently
-- This returns only unique model_numbers instead of fetching all 12k+ rows

CREATE OR REPLACE FUNCTION get_warehouse_wip_distinct_skus(
  batch_id UUID DEFAULT NULL
)
RETURNS TABLE (model_number TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF batch_id IS NULL THEN
    -- All SKUs across all imports
    RETURN QUERY
    SELECT DISTINCT wip.model_number
    FROM warehouse_wip_units wip
    WHERE wip.model_number IS NOT NULL
      AND wip.model_number != ''
    ORDER BY wip.model_number;
  ELSE
    -- SKUs for a specific import batch
    RETURN QUERY
    SELECT DISTINCT wip.model_number
    FROM warehouse_wip_units wip
    WHERE wip.model_number IS NOT NULL
      AND wip.model_number != ''
      AND wip.import_batch_id = batch_id
    ORDER BY wip.model_number;
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_warehouse_wip_distinct_skus(UUID) TO authenticated;

COMMENT ON FUNCTION get_warehouse_wip_distinct_skus IS 
  'Returns distinct model_number (SKU) values from warehouse_wip_units, optionally filtered by import batch';

