-- Check if there are any documents for the Purchase Order
SELECT 
  pod.id,
  pod.purchase_order_id,
  pod.file_name,
  pod.file_path,
  pod.file_size,
  pod.uploaded_at,
  po.purchase_order_number
FROM purchase_order_documents pod
LEFT JOIN purchase_orders po ON po.id = pod.purchase_order_id
WHERE pod.purchase_order_id = 'cd7e363f-828e-4abc-8971-a6c63b704fda'
ORDER BY pod.uploaded_at DESC;

-- Also check if the documents table exists and has any data
SELECT COUNT(*) as total_documents
FROM purchase_order_documents;
