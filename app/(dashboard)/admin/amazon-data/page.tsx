'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { User } from '@/lib/db/schema';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Download, RefreshCw, Calendar, FileText, Package, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Report {
  reportId: string;
  reportType: string;
  dataStartTime?: string;
  dataEndTime?: string;
  createdTime: string;
  processingStatus: string;
  reportDocumentId?: string;
}

export default function AmazonDataPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const [reportType, setReportType] = useState<string>('settlement');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);
  const [requestingReport, setRequestingReport] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<string | null>(null);
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);
  const [downloadFormat, setDownloadFormat] = useState<'csv' | 'json' | 'txt'>('csv');

  // Clear reports when report type changes
  const handleReportTypeChange = (newType: string) => {
    setReportType(newType);
    setReports([]); // Clear the current reports list
    setError(null); // Clear any errors
  };

  // Access control - only BDI Super Admins and CFOs can access Amazon data
  if (!user || !['super_admin', 'admin_cfo'].includes(user.role) || (user as any).organization?.code !== 'BDI') {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="security" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              Only BDI Super Admins and CFOs can access Amazon data.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const reportTypes = [
    { value: 'settlement', label: 'Settlement Reports', icon: DollarSign, description: 'Financial settlement data from Amazon' },
    { value: 'orders', label: 'Orders Reports', icon: Package, description: 'Detailed order transaction data' },
    { value: 'returns', label: 'Returns Reports', icon: RefreshCw, description: 'Customer return information' },
    { value: 'fees', label: 'Fee Reports', icon: TrendingUp, description: 'FBA fees and cost breakdown' },
    { value: 'inventory', label: 'Inventory Reports', icon: FileText, description: 'Current inventory levels' },
  ];

  const getReportTypeId = (type: string): string => {
    const mapping: Record<string, string> = {
      settlement: 'GET_V2_SETTLEMENT_REPORT_DATA_FLAT_FILE',
      orders: 'GET_FLAT_FILE_ALL_ORDERS_DATA_BY_ORDER_DATE_GENERAL',
      returns: 'GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA',
      fees: 'GET_FBA_ESTIMATED_FBA_FEES_TXT_DATA',
      inventory: 'GET_FBA_INVENTORY_AGED_DATA',
    };
    return mapping[type] || type;
  };

  const handleListReports = async () => {
    setIsLoading(true);
    setError(null);
    setReports([]);

    try {
      const reportTypeId = getReportTypeId(reportType);
      const response = await fetch(`/api/amazon/list-reports?reportType=${reportTypeId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch reports');
      }

      setReports(data.reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const pollReportStatus = async (reportId: string): Promise<string | null> => {
    const maxAttempts = 30;
    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt++;
      setPollingStatus(`Checking report status (attempt ${attempt}/${maxAttempts})...`);

      try {
        const response = await fetch(`/api/amazon/report-status?reportId=${reportId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to check report status');
        }

        const status = data.processingStatus;
        setPollingStatus(`Report status: ${status}`);

        if (status === 'DONE') {
          return data.reportDocumentId;
        } else if (status === 'CANCELLED' || status === 'FATAL') {
          throw new Error(`Report processing failed with status: ${status}`);
        }

        // Wait 5-10 seconds before checking again (random to avoid rate limiting)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 5000 + 5000));
      } catch (err) {
        throw err;
      }
    }

    throw new Error('Report did not complete after maximum attempts');
  };

  const handleRequestNewReport = async () => {
    setRequestingReport(true);
    setError(null);
    setPollingStatus(null);
    setCurrentReportId(null);

    try {
      // Step 1: Request the report
      setPollingStatus('Step 1: Requesting report from Amazon...');
      const response = await fetch('/api/amazon/request-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request report');
      }

      const reportId = data.reportId;
      setCurrentReportId(reportId);
      setPollingStatus(`Report requested successfully. Report ID: ${reportId}`);

      // Step 2: Poll for report completion
      setPollingStatus('Step 2: Waiting for Amazon to generate report...');
      const reportDocumentId = await pollReportStatus(reportId);

      if (!reportDocumentId) {
        throw new Error('Failed to get report document ID');
      }

      setPollingStatus(`Report ready! Document ID: ${reportDocumentId}`);

      // Step 3: Automatically download the report
      setPollingStatus('Step 3: Downloading report...');
      await handleDownloadReport(reportDocumentId, reportId);

      setPollingStatus('✓ Report downloaded successfully!');

      // Refresh the reports list
      setTimeout(() => {
        handleListReports();
        setPollingStatus(null);
        setCurrentReportId(null);
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setPollingStatus(null);
    } finally {
      setRequestingReport(false);
    }
  };

  const handleDownloadReport = async (documentId: string, reportId: string) => {
    setDownloadingReportId(reportId);
    setError(null);

    try {
      const response = await fetch(`/api/amazon/download-report?documentId=${documentId}&format=${downloadFormat}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to download report');
      }

      // Determine content type and file extension based on format
      let content: string;
      let mimeType: string;
      let extension: string;

      if (downloadFormat === 'json') {
        content = JSON.stringify(data.parsedData, null, 2);
        mimeType = 'application/json';
        extension = 'json';
      } else if (downloadFormat === 'csv') {
        // Convert TSV to CSV or keep as is
        content = data.content.replace(/\t/g, ',');
        mimeType = 'text/csv';
        extension = 'csv';
      } else {
        // txt format - keep original
        content = data.content;
        mimeType = 'text/plain';
        extension = 'txt';
      }

      // Create a blob and download the file
      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `amazon_${reportType}_${reportId}_${new Date().toISOString().split('T')[0]}.${extension}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setDownloadingReportId(null);
    }
  };

  const selectedReportType = reportTypes.find(rt => rt.value === reportType);
  
  // Check if current report type needs date ranges
  const requiresDateRange = !['inventory', 'fees', 'settlement'].includes(reportType);
  
  // Settlement reports should only be listed, not requested
  const canRequestNewReport = reportType !== 'settlement';

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-2">
          <SemanticBDIIcon semantic="analytics" size={32} />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Amazon Data</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              View and download Amazon Seller Central reports
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Report Configuration
          </CardTitle>
          <CardDescription>
            Select report type and date range to view available reports
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="reportType">Report Type</Label>
            <Select value={reportType} onValueChange={handleReportTypeChange}>
              <SelectTrigger id="reportType">
                <SelectValue placeholder="Select report type" />
              </SelectTrigger>
              <SelectContent>
                {reportTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="h-4 w-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedReportType && (
              <p className="text-sm text-muted-foreground">
                {selectedReportType.description}
              </p>
            )}
          </div>

          {/* Date Range (Optional) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className={!requiresDateRange ? 'text-muted-foreground' : ''}>
                Start Date {requiresDateRange ? <span className="text-muted-foreground">(optional)</span> : <span className="text-muted-foreground">(not used)</span>}
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={!requiresDateRange}
                className={!requiresDateRange ? 'opacity-50 cursor-not-allowed' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className={!requiresDateRange ? 'text-muted-foreground' : ''}>
                End Date {requiresDateRange ? <span className="text-muted-foreground">(optional)</span> : <span className="text-muted-foreground">(not used)</span>}
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={!requiresDateRange}
                className={!requiresDateRange ? 'opacity-50 cursor-not-allowed' : ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="downloadFormat">Download Format</Label>
              <Select value={downloadFormat} onValueChange={(value: any) => setDownloadFormat(value)}>
                <SelectTrigger id="downloadFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV (Comma-separated)</SelectItem>
                  <SelectItem value="json">JSON (For database)</SelectItem>
                  <SelectItem value="txt">TXT (Original format)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleListReports}
              disabled={isLoading || requestingReport}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              List Available Reports
            </Button>
            {canRequestNewReport && (
              <Button
                onClick={handleRequestNewReport}
                disabled={isLoading || requestingReport}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Calendar className={`h-4 w-4 ${requestingReport ? 'animate-pulse' : ''}`} />
                {requestingReport ? 'Requesting...' : 'Request New Report'}
              </Button>
            )}
          </div>

          {/* Polling Status Display */}
          {pollingStatus && (
            <Alert className="mt-4">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <AlertDescription>
                <div className="space-y-1">
                  <p className="font-medium">{pollingStatus}</p>
                  {currentReportId && (
                    <p className="text-xs text-muted-foreground">Report ID: {currentReportId}</p>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Info Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Note:</strong> Settlement reports are generated automatically by Amazon every 14 days - use "List Available Reports" only.
              Orders and Returns reports can be requested with custom date ranges. Inventory and Fee reports use current data.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Reports List */}
      {reports.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedReportType?.label} - Available Reports ({reports.length})
            </CardTitle>
            <CardDescription>
              {selectedReportType?.description} • Click download to retrieve report data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.reportId}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1 space-y-1 mb-3 sm:mb-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="font-normal">
                        {selectedReportType?.label}
                      </Badge>
                      <span className="font-mono text-sm text-muted-foreground">{report.reportId}</span>
                      <Badge 
                        variant={report.processingStatus === 'DONE' ? 'default' : 'secondary'}
                        className={report.processingStatus === 'DONE' ? 'bg-green-600 hover:bg-green-700' : ''}
                      >
                        {report.processingStatus === 'DONE' ? 'Ready for Download' : report.processingStatus}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {report.dataStartTime && report.dataEndTime && (
                        <span className="font-medium">
                          {new Date(report.dataStartTime).toLocaleDateString()} -{' '}
                          {new Date(report.dataEndTime).toLocaleDateString()}
                        </span>
                      )}
                      {report.createdTime && (
                        <span className="ml-4">
                          Created: {new Date(report.createdTime).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={() => report.reportDocumentId && handleDownloadReport(report.reportDocumentId, report.reportId)}
                    disabled={!report.reportDocumentId || report.processingStatus !== 'DONE' || downloadingReportId === report.reportId}
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Download className={`h-4 w-4 ${downloadingReportId === report.reportId ? 'animate-bounce' : ''}`} />
                    {downloadingReportId === report.reportId ? 'Downloading...' : 'Download'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && reports.length === 0 && !error && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Reports Found</h3>
              <p className="text-muted-foreground mb-4">
                Click "List Available Reports" to view existing reports or "Request New Report" to generate a new one.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
