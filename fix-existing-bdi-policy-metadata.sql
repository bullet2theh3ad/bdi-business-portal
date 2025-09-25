-- Fix metadata for the existing BDI DB Backup Policy file
-- Update category and uploader information

UPDATE storage.objects 
SET metadata = jsonb_set(
  jsonb_set(
    jsonb_set(
      COALESCE(metadata, '{}'),
      '{category}', 
      '"database"'
    ),
    '{uploaderName}', 
    '"Steven Cistulli"'
  ),
  '{description}',
  '"BDI Database Backup Policy - Revision 1"'
)
WHERE bucket_id = 'organization-documents'
  AND name LIKE '%BDI_DB_Backup_Policy%';
