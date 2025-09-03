-- Add starter warehouses for BDI organization to test shipping system
-- Replace the organization_id with your actual BDI organization ID

-- First, get your BDI organization ID
SELECT id, name, code FROM organizations WHERE code = 'BDI';

-- Insert starter warehouses (replace '85a60a82-9d78-4cd9-85a1-e7e62cac552b' with your BDI org ID)
INSERT INTO warehouses (
  warehouse_code,
  name,
  type,
  address,
  city,
  state,
  country,
  postal_code,
  timezone,
  capabilities,
  operating_hours,
  contact_name,
  contact_email,
  contact_phone,
  max_pallet_height_cm,
  max_pallet_weight_kg,
  loading_dock_count,
  storage_capacity_sqm,
  notes,
  created_by,
  organization_id
) VALUES 
-- BDI Shanghai Warehouse
(
  'BDI-SH-01',
  'BDI Shanghai Distribution Center',
  'distribution_center',
  '1234 Logistics Road, Pudong District',
  'Shanghai',
  'Shanghai',
  'China',
  '200000',
  'Asia/Shanghai',
  '{
    "airFreight": true,
    "seaFreight": true,
    "truckLoading": true,
    "railAccess": false,
    "coldStorage": false,
    "hazmatHandling": true
  }',
  '8:00 AM - 6:00 PM UTC+8',
  'Li Wei',
  'li.wei@bdi-logistics.com',
  '+86 21 5555 0001',
  220,
  1200,
  6,
  15000,
  'Primary distribution center for Asia-Pacific operations. Handles both air and sea freight.',
  (SELECT auth_id FROM users WHERE email = 'scistulli@boundlessdevices.com'),
  '85a60a82-9d78-4cd9-85a1-e7e62cac552b'
),
-- BDI Los Angeles Warehouse  
(
  'BDI-LA-01',
  'BDI Los Angeles Import Center',
  'warehouse',
  '5678 Harbor Blvd, San Pedro',
  'Los Angeles',
  'California',
  'USA',
  '90731',
  'America/Los_Angeles',
  '{
    "airFreight": true,
    "seaFreight": true,
    "truckLoading": true,
    "railAccess": true,
    "coldStorage": true,
    "hazmatHandling": true
  }',
  '7:00 AM - 7:00 PM PST',
  'Maria Rodriguez',
  'maria.rodriguez@bdi-usa.com',
  '+1 310 555 0002',
  240,
  1500,
  8,
  20000,
  'Main USA import facility near LAX and Port of LA. Full customs clearance capabilities.',
  (SELECT auth_id FROM users WHERE email = 'scistulli@boundlessdevices.com'),
  '85a60a82-9d78-4cd9-85a1-e7e62cac552b'
),
-- BDI Vienna Warehouse
(
  'BDI-VIE-01', 
  'BDI Vienna European Hub',
  'fulfillment_center',
  'Logistics Strasse 123, Schwechat',
  'Vienna',
  'Lower Austria',
  'Austria',
  '1300',
  'Europe/Vienna',
  '{
    "airFreight": true,
    "seaFreight": false,
    "truckLoading": true,
    "railAccess": true,
    "coldStorage": false,
    "hazmatHandling": false
  }',
  '9:00 AM - 5:00 PM CET',
  'Hans Mueller',
  'hans.mueller@bdi-europe.com',
  '+43 1 555 0003',
  200,
  1000,
  4,
  8000,
  'European fulfillment center near Vienna International Airport. EU customs bonded facility.',
  (SELECT auth_id FROM users WHERE email = 'scistulli@boundlessdevices.com'),
  '85a60a82-9d78-4cd9-85a1-e7e62cac552b'
);

-- Verify the warehouses were created
SELECT 
  warehouse_code,
  name,
  city,
  country,
  capabilities,
  max_pallet_height_cm,
  max_pallet_weight_kg
FROM warehouses 
ORDER BY warehouse_code;
