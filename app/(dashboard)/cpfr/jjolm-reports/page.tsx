'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import useSWR from 'swr';
import { User, JjolmTracking } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function JjolmReportsPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const { data: jjolmData, mutate: mutateJjolm } = useSWR('/api/cpfr/jjolm-reports', fetcher);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);

  // Only admins can access this page
  if (!user || !['admin', 'super_admin'].includes(user.role)) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="security" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Access denied. Admin required.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/cpfr/jjolm-reports', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (response.ok) {
        setUploadResult(result);
        setSelectedFile(null);
        mutateJjolm(); // Refresh the JJOLM data
        
        // Reset file input
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        alert(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const jjolmRecords = jjolmData?.data || [];

  return (
    <div className="flex-1 p-3 sm:p-4 lg:p-8 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <SemanticBDIIcon semantic="analytics" size={24} className="sm:w-8 sm:h-8" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">JJOLM Shipment Reports</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Upload and manage BOUNDLESS-DEVICES-SHIPMENT-REPORT Excel files
            </p>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SemanticBDIIcon semantic="plus" size={20} />
            Upload JJOLM Report
          </CardTitle>
          <CardDescription>
            Upload Excel files with format: BOUNDLESS-DEVICES-SHIPMENT-REPORT_[date].xlsx
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                id="file-upload"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                disabled={uploading}
              />
            </div>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="bg-green-600 hover:bg-green-700"
            >
              {uploading ? (
                <>
                  <SemanticBDIIcon semantic="sync" size={16} className="mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <SemanticBDIIcon semantic="plus" size={16} className="mr-2" />
                  Upload Report
                </>
              )}
            </Button>
          </div>

          {selectedFile && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <SemanticBDIIcon semantic="analytics" size={16} className="text-blue-600" />
                <span className="text-sm font-medium text-blue-800">
                  Selected: {selectedFile.name}
                </span>
                <Badge variant="outline" className="text-xs">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </Badge>
              </div>
            </div>
          )}

          {uploadResult && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-start gap-3">
                <SemanticBDIIcon semantic="check" size={20} className="text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-green-800 mb-2">
                    Upload Successful!
                  </h4>
                  <div className="text-sm text-green-700 space-y-1">
                    <p><strong>File:</strong> {uploadResult.summary?.fileName}</p>
                    <p><strong>Total Processed:</strong> {uploadResult.summary?.totalProcessed}</p>
                    <p><strong>New Records:</strong> {uploadResult.summary?.newRecords}</p>
                    <p><strong>Updated Records:</strong> {uploadResult.summary?.updatedRecords}</p>
                    {uploadResult.summary?.errors > 0 && (
                      <p><strong>Errors:</strong> {uploadResult.summary?.errors}</p>
                    )}
                  </div>
                  
                  {uploadResult.data?.errors?.length > 0 && (
                    <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                      <p className="text-xs font-medium text-yellow-800 mb-1">Errors:</p>
                      <ul className="text-xs text-yellow-700 list-disc list-inside">
                        {uploadResult.data.errors.map((error: string, index: number) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* JJOLM Records */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SemanticBDIIcon semantic="shipping" size={20} />
              JJOLM Records ({jjolmRecords.length})
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => mutateJjolm()}
            >
              <SemanticBDIIcon semantic="sync" size={14} className="mr-1" />
              Refresh
            </Button>
          </CardTitle>
          <CardDescription>
            Shipment reference numbers available for use in shipment forms
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jjolmRecords.length === 0 ? (
            <div className="text-center py-8">
              <SemanticBDIIcon semantic="shipping" size={48} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No JJOLM records found. Upload a report to get started.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {jjolmRecords.slice(0, 20).map((record: JjolmTracking) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {record.jjolmNumber}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {record.customerReferenceNumber && (
                        <span>Customer: {record.customerReferenceNumber} • </span>
                      )}
                      {record.mode && <span>Mode: {record.mode} • </span>}
                      Updates: {record.updateCount}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {record.status && (
                      <Badge variant="outline" className="text-xs">
                        {record.status}
                      </Badge>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {record.lastUpdated && new Date(record.lastUpdated).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
              
              {jjolmRecords.length > 20 && (
                <div className="text-center pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing first 20 of {jjolmRecords.length} records
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
