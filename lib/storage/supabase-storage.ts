// Centralized Supabase Storage Management
// Reusable file upload system for entire application

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for storage operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface UploadResult {
  success: boolean;
  filePath?: string;
  publicUrl?: string;
  error?: string;
  metadata?: {
    fileName: string;
    fileSize: number;
    fileType: string;
    uploadedAt: string;
  };
}

export interface FileMetadata {
  fileName: string;
  fileSize: number;
  fileType: string;
  category: string; // 'invoice', 'sku', 'user-avatar', etc.
  entityId: string; // Invoice ID, SKU ID, User ID, etc.
}

/**
 * Upload file to Supabase Storage with proper organization
 * @param file - File to upload
 * @param metadata - File metadata and categorization
 * @returns Upload result with file path and public URL
 */
export async function uploadFile(file: File, metadata: FileMetadata): Promise<UploadResult> {
  try {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Generate organized file path
    const filePath = generateFilePath(file.name, metadata);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('bdi-documents') // Main storage bucket
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false // Don't overwrite existing files
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return { success: false, error: error.message };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('bdi-documents')
      .getPublicUrl(filePath);

    return {
      success: true,
      filePath: data.path,
      publicUrl: urlData.publicUrl,
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadedAt: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('Upload error:', error);
    return { success: false, error: 'Upload failed' };
  }
}

/**
 * Upload multiple files with progress tracking
 * @param files - Array of files to upload
 * @param metadata - Base metadata (entityId, category)
 * @param onProgress - Progress callback
 * @returns Array of upload results
 */
export async function uploadMultipleFiles(
  files: File[], 
  metadata: Omit<FileMetadata, 'fileName' | 'fileSize' | 'fileType'>,
  onProgress?: (progress: number) => void
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileMetadata: FileMetadata = {
      ...metadata,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type
    };
    
    const result = await uploadFile(file, fileMetadata);
    results.push(result);
    
    // Report progress
    if (onProgress) {
      onProgress(((i + 1) / files.length) * 100);
    }
  }
  
  return results;
}

/**
 * Delete file from Supabase Storage
 * @param filePath - Path to file in storage
 * @returns Success status
 */
export async function deleteFile(filePath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage
      .from('bdi-documents')
      .remove([filePath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: 'Delete failed' };
  }
}

/**
 * Get signed URL for private file access
 * @param filePath - Path to file in storage
 * @param expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns Signed URL for secure access
 */
export async function getSignedUrl(filePath: string, expiresIn: number = 3600): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from('bdi-documents')
      .createSignedUrl(filePath, expiresIn);

    if (error) {
      console.error('Signed URL error:', error);
      return null;
    }

    return data.signedUrl;
  } catch (error) {
    console.error('Signed URL error:', error);
    return null;
  }
}

/**
 * Validate file before upload
 * @param file - File to validate
 * @returns Validation result
 */
function validateFile(file: File): { valid: boolean; error?: string } {
  // File size limit: 10MB
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  // Allowed file types
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain'
  ];

  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'File type not allowed' };
  }

  return { valid: true };
}

/**
 * Generate organized file path in storage
 * @param fileName - Original file name
 * @param metadata - File metadata
 * @returns Organized file path
 */
function generateFilePath(fileName: string, metadata: FileMetadata): string {
  // Sanitize file name
  const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  
  // Add timestamp to prevent conflicts
  const timestamp = Date.now();
  const fileExtension = sanitizedName.split('.').pop();
  const baseName = sanitizedName.replace(`.${fileExtension}`, '');
  const uniqueName = `${baseName}_${timestamp}.${fileExtension}`;
  
  // Organize by category and entity
  return `${metadata.category}/${metadata.entityId}/${uniqueName}`;
}

/**
 * List files for a specific entity
 * @param category - File category (invoice, sku, etc.)
 * @param entityId - Entity ID
 * @returns Array of file information
 */
export async function listFiles(category: string, entityId: string) {
  try {
    const { data, error } = await supabase.storage
      .from('bdi-documents')
      .list(`${category}/${entityId}`, {
        limit: 100,
        sortBy: { column: 'created_at', order: 'desc' }
      });

    if (error) {
      console.error('List files error:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('List files error:', error);
    return [];
  }
}
