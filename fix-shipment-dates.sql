-- Fix the shipment dates and incoterms for the specific shipment
UPDATE shipments 
SET 
    estimated_departure = '2025-09-28 00:00:00+00',
    estimated_arrival = '2025-10-05 00:00:00+00',
    incoterms = 'FOB',
    updated_at = NOW()
WHERE id = 'ebbd6c71-088b-4e3e-b39e-b6622e1fb951';

-- Verify the update
SELECT 
    id,
    shipment_number,
    estimated_departure,
    estimated_arrival,
    incoterms,
    updated_at
FROM shipments 
WHERE id = 'ebbd6c71-088b-4e3e-b39e-b6622e1fb951';
