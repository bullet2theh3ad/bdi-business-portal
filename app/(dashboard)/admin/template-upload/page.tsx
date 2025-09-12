'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import useSWR from 'swr';
import { User } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function TemplateUploadPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

  // Only allow super_admin access
  if (!user || user.role !== 'super_admin') {
    return (
      <div className="flex-1 p-8 text-center">
        <h1 className="text-2xl font-bold text-red-600">Access Denied</h1>
        <p className="text-muted-foreground mt-2">Super Admin access required</p>
      </div>
    );
  }

  const handleUpload = async () => {
    if (!templateFile) return;
    
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', templateFile);
      formData.append('templateType', 'production-file');
      
      const response = await fetch('/api/admin/template-upload', {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      setUploadResult(result);
      
      if (result.success) {
        setTemplateFile(null);
        alert('Template uploaded successfully! Users can now download the latest version.');
      } else {
        alert(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload error: ${error}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 p-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg p-6">
        <div className="flex items-center space-x-4">
          <SemanticBDIIcon semantic="upload" size={32} />
          <div>
            <h1 className="text-3xl font-bold">Template Upload</h1>
            <p className="text-muted-foreground">
              Upload production file templates for user downloads (Super Admin Only)
            </p>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SemanticBDIIcon semantic="document" size={20} />
            Upload Production Template
          </CardTitle>
          <CardDescription>
            Upload the latest production file template. This will be available for all users to download.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setTemplateFile(file);
              }}
              className="hidden"
              id="template-file-upload"
            />
            <label htmlFor="template-file-upload" className="cursor-pointer">
              <SemanticBDIIcon semantic="upload" size={32} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">
                Excel files only • Recommended: "Production Data Template R2 (Sep 12 2025).xlsx"
              </p>
            </label>
          </div>

          {templateFile && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <SemanticBDIIcon semantic="document" size={16} />
                  <span className="text-sm font-medium">{templateFile.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(templateFile.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTemplateFile(null)}
                >
                  <span className="text-red-500">✕</span>
                </Button>
              </div>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!templateFile || uploading}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {uploading ? 'Uploading...' : 'Upload Template to Supabase'}
          </Button>

          {uploadResult?.success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800">
                <SemanticBDIIcon semantic="check" size={16} />
                <span className="font-medium">Template Uploaded Successfully</span>
              </div>
              <div className="mt-2 text-sm text-green-700">
                <p><strong>File:</strong> {uploadResult.fileName}</p>
                <p><strong>Storage Path:</strong> {uploadResult.filePath}</p>
                <p><strong>Status:</strong> Available for all users to download</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <p><strong>1. Upload Template:</strong> Select your latest "Production Data Template R2" file</p>
            <p><strong>2. Automatic Update:</strong> The download link will automatically use the latest uploaded template</p>
            <p><strong>3. User Access:</strong> All authenticated users can download the template from Production Files → Templates</p>
            <p><strong>4. Version Control:</strong> Newer uploads will become the default download</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
