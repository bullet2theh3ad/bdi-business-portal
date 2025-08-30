'use client';

import React, { useState, useCallback } from 'react';
import { Upload, File, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseCLient';

interface FileUploadProps {
  organizationId: string;
  category: 'business' | 'banking' | 'legal' | 'technical' | 'compliance' | 'contracts';
  subcategory?: string;
  maxFiles?: number;
  maxSizeInMB?: number;
  acceptedTypes?: string[];
  onUploadComplete?: (files: UploadedFile[]) => void;
  onUploadError?: (error: string) => void;
  className?: string;
  disabled?: boolean;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  uploadedAt: string;
}

interface FileWithStatus {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  id?: string;
}

export function FileUpload({
  organizationId,
  category,
  subcategory,
  maxFiles = 5,
  maxSizeInMB = 50,
  acceptedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'text/plain',
    'text/csv'
  ],
  onUploadComplete,
  onUploadError,
  className = '',
  disabled = false
}: FileUploadProps) {
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const validateFile = (file: File): string | null => {
    if (file.size > maxSizeInMB * 1024 * 1024) {
      return `File size must be less than ${maxSizeInMB}MB`;
    }
    if (!acceptedTypes.includes(file.type)) {
      return 'File type not supported';
    }
    return null;
  };

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles: FileWithStatus[] = [];
    
    for (let i = 0; i < fileList.length && newFiles.length + files.length < maxFiles; i++) {
      const file = fileList[i];
      const error = validateFile(file);
      
      newFiles.push({
        file,
        status: error ? 'error' : 'pending',
        progress: 0,
        error
      });
    }
    
    setFiles(prev => [...prev, ...newFiles]);
  }, [files.length, maxFiles, maxSizeInMB, acceptedTypes]);

  const uploadFile = async (fileWithStatus: FileWithStatus) => {
    const { file } = fileWithStatus;
    
    try {
      // Update status to uploading
      setFiles(prev => prev.map(f => 
        f.file === file ? { ...f, status: 'uploading' as const, progress: 0 } : f
      ));

      // Create file path: organizationId/category/subcategory?/filename
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const filePath = subcategory 
        ? `${organizationId}/${category}/${subcategory}/${fileName}`
        : `${organizationId}/${category}/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('organization-documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Insert metadata into database
      const { data: dbData, error: dbError } = await supabase
        .from('organization_documents')
        .insert({
          organization_id: organizationId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
          category,
          subcategory,
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // Get public URL (for private buckets, this will be a signed URL)
      const { data: urlData } = supabase.storage
        .from('organization-documents')
        .getPublicUrl(filePath);

      // Update status to success
      setFiles(prev => prev.map(f => 
        f.file === file ? { 
          ...f, 
          status: 'success' as const, 
          progress: 100,
          id: dbData.id 
        } : f
      ));

      // Call success callback
      const uploadedFile: UploadedFile = {
        id: dbData.id,
        name: file.name,
        size: file.size,
        type: file.type,
        url: urlData.publicUrl,
        uploadedAt: dbData.uploaded_at
      };

      onUploadComplete?.([uploadedFile]);

    } catch (error) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      setFiles(prev => prev.map(f => 
        f.file === file ? { 
          ...f, 
          status: 'error' as const, 
          progress: 0,
          error: errorMessage || 'Upload failed'
        } : f
      ));
      
      onUploadError?.(errorMessage);
    }
  };

  const removeFile = (file: File) => {
    setFiles(prev => prev.filter(f => f.file !== file));
  };

  const uploadAllPending = () => {
    const pendingFiles = files.filter(f => f.status === 'pending');
    pendingFiles.forEach(uploadFile);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!disabled) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && !disabled) {
      handleFiles(e.target.files);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('image')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    return '📄';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <Card 
        className={`border-2 border-dashed transition-colors ${
          isDragOver 
            ? 'border-bdi-green-1 bg-bdi-green-1/5' 
            : 'border-gray-300 hover:border-bdi-green-1'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <Upload className="h-10 w-10 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Upload {category} documents
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Drag and drop files here, or click to select files
          </p>
          <input
            type="file"
            multiple
            accept={acceptedTypes.join(',')}
            onChange={onFileSelect}
            disabled={disabled}
            className="hidden"
            id={`file-upload-${category}`}
          />
          <label
            htmlFor={`file-upload-${category}`}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-bdi-green-1 hover:bg-bdi-green-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bdi-green-1 ${
              disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            }`}
          >
            Select Files
          </label>
          <p className="text-xs text-gray-400 mt-2">
            Max {maxFiles} files, {maxSizeInMB}MB each
          </p>
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-medium text-gray-700">
              Files ({files.length}/{maxFiles})
            </h4>
            {files.some(f => f.status === 'pending') && (
              <Button
                onClick={uploadAllPending}
                size="sm"
                disabled={disabled}
                className="bg-bdi-green-1 hover:bg-bdi-green-2"
              >
                Upload All
              </Button>
            )}
          </div>
          
          {files.map((fileWithStatus, index) => (
            <Card key={index} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <span className="text-lg">
                    {getFileIcon(fileWithStatus.file.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {fileWithStatus.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(fileWithStatus.file.size)}
                    </p>
                  </div>
                  <Badge 
                    variant={
                      fileWithStatus.status === 'success' ? 'default' :
                      fileWithStatus.status === 'error' ? 'destructive' :
                      fileWithStatus.status === 'uploading' ? 'secondary' : 'outline'
                    }
                    className={
                      fileWithStatus.status === 'success' ? 'bg-green-100 text-green-800' :
                      fileWithStatus.status === 'uploading' ? 'bg-blue-100 text-blue-800' : ''
                    }
                  >
                    {fileWithStatus.status === 'success' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {fileWithStatus.status === 'error' && <AlertCircle className="h-3 w-3 mr-1" />}
                    {fileWithStatus.status.charAt(0).toUpperCase() + fileWithStatus.status.slice(1)}
                  </Badge>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(fileWithStatus.file)}
                  disabled={fileWithStatus.status === 'uploading'}
                  className="ml-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              {fileWithStatus.status === 'uploading' && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-bdi-green-1 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${fileWithStatus.progress}%` }}
                    />
                  </div>
                </div>
              )}
              
              {fileWithStatus.error && (
                <p className="text-xs text-red-600 mt-1">
                  {fileWithStatus.error}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default FileUpload;
