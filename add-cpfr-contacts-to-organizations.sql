-- Add CPFR Contacts to Organizations Table
-- Enables organization-level CPFR notification management

-- Add CPFR contacts JSONB field to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS cpfr_contacts JSONB DEFAULT '{
  "primary_contacts": [],
  "escalation_contacts": [],
  "notification_preferences": {
    "immediate_notifications": true,
    "escalation_hours": 24,
    "include_technical_team": true
  }
}'::jsonb;

-- Update the field with better structure and comments
COMMENT ON COLUMN organizations.cpfr_contacts IS 'CPFR notification contacts and preferences in JSON format:
{
  "primary_contacts": [
    {
      "name": "John Doe",
      "email": "john@tc1.com", 
      "role": "Factory Manager",
      "active": true
    }
  ],
  "escalation_contacts": [
    {
      "name": "Jane Smith",
      "email": "jane.smith@tc1.com",
      "role": "Operations Director", 
      "active": true
    }
  ],
  "notification_preferences": {
    "immediate_notifications": true,
    "escalation_hours": 24,
    "include_technical_team": true,
    "business_hours_only": false
  }
}';

-- Create index for efficient CPFR contact queries
CREATE INDEX IF NOT EXISTS idx_organizations_cpfr_contacts 
ON organizations USING gin (cpfr_contacts);

-- Verify the new column was added
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'organizations' 
AND column_name = 'cpfr_contacts';

-- Show current organizations that will get CPFR contacts
SELECT 
    id,
    name,
    code,
    type,
    cpfr_contacts
FROM organizations 
ORDER BY type, code;
