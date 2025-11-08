-- =====================================================
-- Forecast Analysis Sessions Schema
-- =====================================================
-- Purpose: Save forecast analysis work so users can return to their scenarios
-- Stores: date ranges, filters, SKU scenario selections, manual ASPs
-- =====================================================

-- Main analysis session table
CREATE TABLE IF NOT EXISTS public.forecast_analysis_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Session metadata
  session_name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- User & Organization
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Analysis configuration
  start_date DATE,
  end_date DATE,
  selected_sku VARCHAR(255), -- 'all' or specific SKU code
  search_query TEXT,
  
  -- Additional filters (can store as JSON for flexibility)
  filters JSONB DEFAULT '{}'::jsonb,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Soft delete
  is_active BOOLEAN DEFAULT TRUE
);

-- Index for faster lookups
CREATE INDEX idx_forecast_analysis_sessions_user ON forecast_analysis_sessions(user_id);
CREATE INDEX idx_forecast_analysis_sessions_org ON forecast_analysis_sessions(organization_id);
CREATE INDEX idx_forecast_analysis_sessions_active ON forecast_analysis_sessions(is_active) WHERE is_active = TRUE;

-- Link forecasts to SKU scenarios within a session
CREATE TABLE IF NOT EXISTS public.forecast_analysis_selections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to session
  session_id UUID NOT NULL REFERENCES forecast_analysis_sessions(id) ON DELETE CASCADE,
  
  -- Link to forecast
  forecast_id UUID NOT NULL REFERENCES sales_forecasts(id) ON DELETE CASCADE,
  
  -- Link to SKU financial scenario (optional)
  sku_scenario_id UUID REFERENCES sku_financial_scenarios(id) ON DELETE SET NULL,
  
  -- Manual ASP override (takes precedence over scenario ASP)
  manual_asp NUMERIC(12, 2),
  
  -- Notes for this specific forecast in the analysis
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one selection per forecast per session
  UNIQUE(session_id, forecast_id)
);

-- Indexes
CREATE INDEX idx_forecast_analysis_selections_session ON forecast_analysis_selections(session_id);
CREATE INDEX idx_forecast_analysis_selections_forecast ON forecast_analysis_selections(forecast_id);

-- RLS Policies
ALTER TABLE forecast_analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_analysis_selections ENABLE ROW LEVEL SECURITY;

-- Users can only see their own sessions
CREATE POLICY "Users can view their own forecast analysis sessions"
  ON forecast_analysis_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own forecast analysis sessions"
  ON forecast_analysis_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own forecast analysis sessions"
  ON forecast_analysis_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own forecast analysis sessions"
  ON forecast_analysis_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Selection policies
CREATE POLICY "Users can view selections for their sessions"
  ON forecast_analysis_selections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM forecast_analysis_sessions
      WHERE id = forecast_analysis_selections.session_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create selections for their sessions"
  ON forecast_analysis_selections FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM forecast_analysis_sessions
      WHERE id = forecast_analysis_selections.session_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update selections for their sessions"
  ON forecast_analysis_selections FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM forecast_analysis_sessions
      WHERE id = forecast_analysis_selections.session_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete selections for their sessions"
  ON forecast_analysis_selections FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM forecast_analysis_sessions
      WHERE id = forecast_analysis_selections.session_id
      AND user_id = auth.uid()
    )
  );

-- Grant permissions
GRANT ALL ON forecast_analysis_sessions TO authenticated;
GRANT ALL ON forecast_analysis_selections TO authenticated;

-- Comments
COMMENT ON TABLE forecast_analysis_sessions IS 'Stores saved forecast analysis sessions with configurations and filters';
COMMENT ON TABLE forecast_analysis_selections IS 'Links forecasts to SKU scenarios and manual ASPs within an analysis session';

