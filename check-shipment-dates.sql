-- Check the actual dates in the shipment record
SELECT 
    id,
    shipment_number,
    estimated_departure,
    estimated_arrival,
    incoterms,
    updated_at
FROM shipments 
WHERE id = 'ebbd6c71-088b-4e3e-b39e-b6622e1fb951';
