-- Create helper functions for schema scanning in Ask BDI

-- Function to get complete table schemas
CREATE OR REPLACE FUNCTION get_table_schemas()
RETURNS TABLE (
  table_name text,
  column_name text,
  data_type text,
  is_nullable text,
  column_default text,
  character_maximum_length integer,
  ordinal_position integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.table_name::text,
    c.column_name::text,
    c.data_type::text,
    c.is_nullable::text,
    c.column_default::text,
    c.character_maximum_length,
    c.ordinal_position
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' 
  AND c.table_name NOT LIKE 'pg_%'
  AND c.table_name NOT LIKE '__%'
  AND c.table_name NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns')
  ORDER BY c.table_name, c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to execute dynamic SQL (for schema queries)
CREATE OR REPLACE FUNCTION exec_sql(sql text)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  EXECUTE 'SELECT array_to_json(array_agg(row_to_json(t))) FROM (' || sql || ') t' INTO result;
  RETURN COALESCE(result, '[]'::json);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to authenticated users (for Ask BDI)
GRANT EXECUTE ON FUNCTION get_table_schemas() TO authenticated;
GRANT EXECUTE ON FUNCTION exec_sql(text) TO authenticated;

-- Test the schema scanner
SELECT 'Schema scanner functions created successfully' as status;
