'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Database
} from 'lucide-react';
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ImportBatch {
  id: string;
  file_name: string;
  file_size: number;
  total_rows: number;
  processed_rows: number;
  failed_rows: number;
  status: 'processing' | 'completed' | 'failed';
  error_message?: string;
  started_at: string;
  completed_at?: string;
  summary_stats?: {
    intake: number;
    wip: number;
    rma: number;
    outflow: number;
  };
}

export default function WarehouseWIPPage() {
  const { data: importsData, mutate } = useSWR<{ imports: ImportBatch[] }>(
    '/api/warehouse/wip/imports',
    fetcher
  );

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<any>(null);

  // Dropzone
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/warehouse/wip/import', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setUploadSuccess(result);
      mutate(); // Refresh imports list
    } catch (error: any) {
      setUploadError(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  }, [mutate]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    maxFiles: 1,
    disabled: uploading
  });

  // Export/Download
  const handleExport = async (importId?: string) => {
    try {
      const url = importId
        ? `/api/warehouse/wip/export?importId=${importId}`
        : '/api/warehouse/wip/export';
      
      window.location.href = url;
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Database className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Warehouse WIP Flow</h1>
          <Badge variant="outline" className="text-xs">BETA</Badge>
        </div>
        <p className="text-gray-600">
          Upload and manage WIP (Work In Progress) data from Weekly Reports
        </p>
      </div>

      {/* Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Upload WIP Data</CardTitle>
          <CardDescription>
            Drop your Weekly Report Excel file here to import WIP unit data and weekly summary
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Dropzone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : uploading
                ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
            }`}
          >
            <input {...getInputProps()} />
            
            {uploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
                <p className="text-lg font-medium text-blue-600">Processing upload...</p>
                <p className="text-sm text-gray-500 mt-2">
                  Parsing Excel file and importing data
                </p>
              </div>
            ) : (
              <>
                <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                {isDragActive ? (
                  <p className="text-lg font-medium text-blue-600">Drop the file here...</p>
                ) : (
                  <>
                    <p className="text-lg font-medium mb-2">
                      Drop your Weekly Report Excel file here
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      or click to select file
                    </p>
                    <p className="text-xs text-gray-400">
                      Supported formats: .xlsx, .xls
                    </p>
                  </>
                )}
              </>
            )}
          </div>

          {/* Upload Success */}
          {uploadSuccess && (
            <Alert className="mt-4 border-green-300 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Upload successful!</strong>
                <div className="mt-2 text-sm">
                  <div>Total units: {uploadSuccess.stats.total}</div>
                  <div>Processed: {uploadSuccess.stats.processed}</div>
                  {uploadSuccess.stats.failed > 0 && (
                    <div>Failed: {uploadSuccess.stats.failed}</div>
                  )}
                  {uploadSuccess.stats.stages && (
                    <div className="mt-2 flex gap-4 text-xs">
                      <span>Intake: {uploadSuccess.stats.stages.intake}</span>
                      <span>WIP: {uploadSuccess.stats.stages.wip}</span>
                      <span>RMA: {uploadSuccess.stats.stages.rma}</span>
                      <span>Outflow: {uploadSuccess.stats.stages.outflow}</span>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Upload Error */}
          {uploadError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Upload failed:</strong> {uploadError}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Import History */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Import History</CardTitle>
            <CardDescription>
              View past imports and download data
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => handleExport()}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export All Data
          </Button>
        </CardHeader>
        <CardContent>
          {!importsData?.imports || importsData.imports.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No imports yet</p>
              <p className="text-sm mt-2">Upload your first WIP data file above</p>
            </div>
          ) : (
            <div className="space-y-4">
              {importsData.imports.map((batch) => (
                <Card key={batch.id} className="border-2">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <FileSpreadsheet className="h-5 w-5 text-gray-600" />
                          <h3 className="font-semibold">{batch.file_name}</h3>
                          {batch.status === 'completed' && (
                            <Badge className="bg-green-100 text-green-800 border-green-300">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Completed
                            </Badge>
                          )}
                          {batch.status === 'processing' && (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                              <Clock className="h-3 w-3 mr-1" />
                              Processing
                            </Badge>
                          )}
                          {batch.status === 'failed' && (
                            <Badge className="bg-red-100 text-red-800 border-red-300">
                              <XCircle className="h-3 w-3 mr-1" />
                              Failed
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mt-4">
                          <div>
                            <span className="text-gray-500">Imported:</span>
                            <div className="font-medium">
                              {new Date(batch.started_at).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500">Total Rows:</span>
                            <div className="font-medium">{batch.total_rows}</div>
                          </div>
                          <div>
                            <span className="text-gray-500">Processed:</span>
                            <div className="font-medium text-green-600">
                              {batch.processed_rows}
                            </div>
                          </div>
                          {batch.failed_rows > 0 && (
                            <div>
                              <span className="text-gray-500">Failed:</span>
                              <div className="font-medium text-red-600">
                                {batch.failed_rows}
                              </div>
                            </div>
                          )}
                        </div>

                        {batch.summary_stats && (
                          <div className="flex gap-6 mt-4 text-xs">
                            <div>
                              <span className="text-gray-500">Intake:</span>{' '}
                              <span className="font-semibold">{batch.summary_stats.intake}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">WIP:</span>{' '}
                              <span className="font-semibold">{batch.summary_stats.wip}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">RMA:</span>{' '}
                              <span className="font-semibold">{batch.summary_stats.rma}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Outflow:</span>{' '}
                              <span className="font-semibold">{batch.summary_stats.outflow}</span>
                            </div>
                          </div>
                        )}

                        {batch.error_message && (
                          <Alert variant="destructive" className="mt-4">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              {batch.error_message}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>

                      <div className="ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExport(batch.id)}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Export
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card className="mt-6 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">📚 How to Use</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 space-y-2">
          <p><strong>1.</strong> Prepare your Weekly Report Excel file with two sheets:</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>"Raw Data"</strong> - Individual unit records with serial numbers, dates, and status</li>
            <li><strong>"Weekly Summary"</strong> - Aggregated metrics by ISO week</li>
          </ul>
          <p><strong>2.</strong> Drag and drop or click to upload the file</p>
          <p><strong>3.</strong> Wait for processing to complete</p>
          <p><strong>4.</strong> Download the processed data or view the dashboard (coming in Phase 3)</p>
          <p className="mt-4"><strong>Note:</strong> Duplicate serial numbers will be skipped. Re-uploading the same file will update existing records.</p>
        </CardContent>
      </Card>
    </div>
  );
}

