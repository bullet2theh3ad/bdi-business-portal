'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import useSWR from 'swr';
import { User, JjolmTracking } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function JjolmReportsPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const { data: jjolmData, mutate: mutateJjolm } = useSWR('/api/cpfr/jjolm-reports', fetcher);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [selectedJjolm, setSelectedJjolm] = useState<string | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  
  // Fetch timeline data when JJOLM is selected
  const { data: timelineData, isLoading: timelineLoading } = useSWR(
    selectedJjolm ? `/api/cpfr/jjolm-reports/${selectedJjolm}/timeline` : null,
    fetcher
  );

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

  const handleViewTimeline = (jjolmNumber: string) => {
    setSelectedJjolm(jjolmNumber);
    setShowTimeline(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString();
  };

  const getEventIcon = (icon: string) => {
    const iconMap: { [key: string]: string } = {
      plus: 'plus',
      sync: 'sync',
      shipping: 'shipping',
      calendar: 'calendar',
      check: 'check',
    };
    return iconMap[icon] || 'sync';
  };

  const getEventColor = (color: string) => {
    const colorMap: { [key: string]: string } = {
      green: 'text-green-600 bg-green-100',
      blue: 'text-blue-600 bg-blue-100',
      purple: 'text-purple-600 bg-purple-100',
      orange: 'text-orange-600 bg-orange-100',
      yellow: 'text-yellow-600 bg-yellow-100',
      indigo: 'text-indigo-600 bg-indigo-100',
    };
    return colorMap[color] || 'text-gray-600 bg-gray-100';
  };

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
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleViewTimeline(record.jjolmNumber)}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm text-blue-600 hover:text-blue-800">
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
                    <SemanticBDIIcon semantic="analytics" size={16} className="text-blue-500" />
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

      {/* Timeline Modal */}
      <Dialog open={showTimeline} onOpenChange={setShowTimeline}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SemanticBDIIcon semantic="analytics" size={20} />
              JJOLM Timeline: {selectedJjolm}
            </DialogTitle>
            <DialogDescription>
              Shipment tracking history and status progression
            </DialogDescription>
          </DialogHeader>

          {timelineLoading ? (
            <div className="flex items-center justify-center py-8">
              <SemanticBDIIcon semantic="sync" size={32} className="animate-spin text-blue-500" />
              <span className="ml-2">Loading timeline...</span>
            </div>
          ) : timelineData?.data ? (
            <div className="flex-1 overflow-hidden">
              {/* Current Status Summary */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-3">Current Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-blue-700">Customer Ref:</span>
                    <span className="ml-1">{timelineData.data.currentStatus.customerReferenceNumber || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Mode:</span>
                    <span className="ml-1">{timelineData.data.currentStatus.mode || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Status:</span>
                    <span className="ml-1">{timelineData.data.currentStatus.status || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Origin:</span>
                    <span className="ml-1">{timelineData.data.currentStatus.origin || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Destination:</span>
                    <span className="ml-1">{timelineData.data.currentStatus.destination || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Carrier:</span>
                    <span className="ml-1">{timelineData.data.currentStatus.carrier || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Pickup Date:</span>
                    <span className="ml-1">{formatDate(timelineData.data.currentStatus.pickupDate)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Delivery Date:</span>
                    <span className="ml-1">{formatDate(timelineData.data.currentStatus.deliveryDate)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Est. Delivery:</span>
                    <span className="ml-1">{formatDate(timelineData.data.currentStatus.estimatedDeliveryDate)}</span>
                  </div>
                </div>
              </div>

              {/* Timeline Events */}
              <div className="flex-1 overflow-y-auto">
                <h3 className="font-semibold mb-4">Timeline ({timelineData.data.timeline.length} events)</h3>
                <div className="space-y-4">
                  {timelineData.data.timeline.map((event: any, index: number) => (
                    <div key={event.id} className="flex items-start gap-4">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getEventColor(event.color)}`}>
                          <SemanticBDIIcon semantic={getEventIcon(event.icon)} size={14} />
                        </div>
                        {index < timelineData.data.timeline.length - 1 && (
                          <div className="w-0.5 h-8 bg-gray-200 mt-2"></div>
                        )}
                      </div>

                      {/* Event content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{event.title}</h4>
                            <p className="text-sm text-muted-foreground">{event.description}</p>
                            {event.user && (
                              <p className="text-xs text-muted-foreground mt-1">
                                by {event.user.name} ({event.user.email})
                              </p>
                            )}
                            {event.data?.sourceFileName && (
                              <p className="text-xs text-muted-foreground">
                                Source: {event.data.sourceFileName}
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground ml-4">
                            {new Date(event.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <SemanticBDIIcon semantic="analytics" size={48} className="mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No timeline data available</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
