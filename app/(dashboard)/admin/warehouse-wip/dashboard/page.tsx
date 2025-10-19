'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Package,
  Wrench,
  AlertCircle,
  TrendingUp,
  Download,
  Filter,
  X,
  Loader2,
  Upload,
  FileSpreadsheet,
  Trash2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function WarehouseWIPDashboard() {
  // Filters
  const [importBatchId, setImportBatchId] = useState<string>('');
  const [sku, setSku] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [selectedStage, setSelectedStage] = useState<string>('');

  // Upload state
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Export modal
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');
  const [exportAllData, setExportAllData] = useState(false); // Toggle to ignore filters
  const [exporting, setExporting] = useState(false);

  // Build query params
  const buildParams = (additional?: Record<string, string>) => {
    const params = new URLSearchParams();
    if (importBatchId) params.append('importBatchId', importBatchId);
    if (sku) params.append('sku', sku);
    if (source) params.append('source', source);
    if (additional) {
      Object.entries(additional).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    return params.toString();
  };

  // Fetch data
  const { data: metricsData } = useSWR(`/api/warehouse/wip/metrics?${buildParams()}`, fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
  });
  
  const { data: agingData } = useSWR(`/api/warehouse/wip/aging?${buildParams()}`, fetcher);
  
  const { data: cfdData } = useSWR(`/api/warehouse/wip/cfd?${buildParams()}`, fetcher);
  
  const { data: flowData } = useSWR(`/api/warehouse/wip/flow?${buildParams()}`, fetcher);

  const { data: unitsData } = useSWR(
    `/api/warehouse/wip/units?${buildParams({ search, stage: selectedStage, limit: '100' })}`,
    fetcher
  );

  const { data: importsData } = useSWR('/api/warehouse/wip/imports', fetcher);
  
  const { data: sourcesData } = useSWR(
    `/api/warehouse/wip/sources?${importBatchId ? `importBatchId=${importBatchId}` : ''}`,
    fetcher
  );

  const clearFilters = () => {
    setImportBatchId('');
    setSku('');
    setSource('');
    setSearch('');
    setSelectedStage('');
  };

  const hasFilters = importBatchId || sku || source || search || selectedStage;

  // Handle file upload
  const handleFileUpload = async () => {
    if (!file) return;

    setUploading(true);
    setUploadError('');
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/warehouse/wip/import', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setUploadSuccess(true);
      setFile(null);
      
      // Refresh data
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadError(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  // Handle delete all data
  const handleDeleteAllData = async () => {
    setDeleting(true);
    try {
      const response = await fetch('/api/warehouse/wip/imports', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete data');
      }

      setShowDeleteConfirm(false);
      
      // Refresh page
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error: any) {
      console.error('Delete error:', error);
      alert(error.message || 'Failed to delete data');
    } finally {
      setDeleting(false);
    }
  };

  // Build filter label for metric cards
  const getFilterLabel = () => {
    const parts = [];
    if (source) parts.push(source);
    if (sku) parts.push(sku);
    return parts.length > 0 ? ` (${parts.join(' • ')})` : '';
  };

  const filterLabel = getFilterLabel();

  // Export handler
  const handleExport = async () => {
    if (!exportFromDate || !exportToDate) {
      alert('Please select both start and end dates');
      return;
    }

    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.append('dateFrom', exportFromDate);
      params.append('dateTo', exportToDate);
      
      // Only apply filters if NOT exporting all data
      if (!exportAllData) {
        if (importBatchId) params.append('importId', importBatchId);
        if (sku) params.append('sku', sku);
        if (source) params.append('source', source);
      }

      const response = await fetch(`/api/warehouse/wip/export?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `warehouse-wip-report-${exportFromDate}-to-${exportToDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setShowExportModal(false);
      setExportFromDate('');
      setExportToDate('');
      setExportAllData(false);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export report. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Get export preview count
  const { data: exportPreviewData } = useSWR(
    showExportModal && exportFromDate && exportToDate
      ? `/api/warehouse/wip/units?${buildParams({
          ...(exportAllData ? {} : { source, sku }),
          limit: '0',
        })}&dateFrom=${exportFromDate}&dateTo=${exportToDate}`
      : null,
    fetcher
  );

  return (
    <div className="container mx-auto p-6 max-w-[1800px] space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Warehouse WIP Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor inventory flow and work-in-progress analytics
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setShowExportModal(true)}>
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* Data Upload Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Data Upload
              </CardTitle>
              <CardDescription>
                Upload Weekly_Report_*.xlsx file to import WIP data
              </CardDescription>
            </div>
            {importsData?.imports && importsData.imports.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Delete All Data
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* File Input */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const selectedFile = e.target.files?.[0];
                    if (selectedFile) {
                      setFile(selectedFile);
                      setUploadError('');
                      setUploadSuccess(false);
                    }
                  }}
                  disabled={uploading}
                  className="cursor-pointer"
                />
              </div>
              <Button
                onClick={handleFileUpload}
                disabled={!file || uploading}
                className="gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload File
                  </>
                )}
              </Button>
            </div>

            {/* Status Messages */}
            {uploadSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-800 text-sm">
                ✅ File uploaded successfully! Refreshing data...
              </div>
            )}
            {uploadError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-800 text-sm">
                ❌ {uploadError}
              </div>
            )}

            {/* Recent Imports */}
            {importsData?.imports && importsData.imports.length > 0 && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-2">Recent Imports:</h4>
                <div className="space-y-2">
                  {importsData.imports.slice(0, 3).map((imp: any) => (
                    <div
                      key={imp.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                    >
                      <div>
                        <span className="font-medium">{imp.file_name}</span>
                        <span className="text-gray-500 ml-2">
                          ({imp.total_records} records)
                        </span>
                      </div>
                      <span className="text-gray-500 text-xs">
                        {new Date(imp.started_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              <CardTitle>Filters</CardTitle>
            </div>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
                <X className="h-4 w-4" />
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Import Batch</Label>
              <Select value={importBatchId || 'all'} onValueChange={(val) => setImportBatchId(val === 'all' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="All batches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All batches</SelectItem>
                  {importsData?.imports?.map((imp: any) => (
                    <SelectItem key={imp.id} value={imp.id}>
                      {imp.file_name} ({new Date(imp.started_at).toLocaleDateString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>SKU</Label>
              <Input
                placeholder="Filter by SKU..."
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={source || 'all'} onValueChange={(val) => setSource(val === 'all' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {sourcesData?.sources?.map((src: string) => (
                    <SelectItem key={src} value={src}>
                      {src}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Serial Number</Label>
              <Input
                placeholder="Search serial..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Story Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex flex-col space-y-1">
              <CardTitle className="text-sm font-medium">Total Intake</CardTitle>
              {filterLabel && (
                <span className="text-[10px] text-muted-foreground font-normal truncate max-w-[140px]">
                  {filterLabel.replace(/^\s*\(/, '').replace(/\)$/, '')}
                </span>
              )}
            </div>
            <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricsData?.totalIntake?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Units received</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex flex-col space-y-1">
              <CardTitle className="text-sm font-medium">Active WIP</CardTitle>
              {filterLabel && (
                <span className="text-[10px] text-muted-foreground font-normal truncate max-w-[140px]">
                  {filterLabel.replace(/^\s*\(/, '').replace(/\)$/, '')}
                </span>
              )}
            </div>
            <Wrench className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricsData?.wip?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex flex-col space-y-1">
              <CardTitle className="text-sm font-medium">RMA</CardTitle>
              {filterLabel && (
                <span className="text-[10px] text-muted-foreground font-normal truncate max-w-[140px]">
                  {filterLabel.replace(/^\s*\(/, '').replace(/\)$/, '')}
                </span>
              )}
            </div>
            <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricsData?.rma?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Returns</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex flex-col space-y-1">
              <CardTitle className="text-sm font-medium">Outflow</CardTitle>
              {filterLabel && (
                <span className="text-[10px] text-muted-foreground font-normal truncate max-w-[140px]">
                  {filterLabel.replace(/^\s*\(/, '').replace(/\)$/, '')}
                </span>
              )}
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricsData?.outflow?.toLocaleString() || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Shipped</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex flex-col space-y-1">
              <CardTitle className="text-sm font-medium">Avg. Aging</CardTitle>
              {filterLabel && (
                <span className="text-[10px] text-muted-foreground font-normal truncate max-w-[140px]">
                  {filterLabel.replace(/^\s*\(/, '').replace(/\)$/, '')}
                </span>
              )}
            </div>
            <TrendingUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metricsData?.avgAgingDays || 0} days</div>
            <p className="text-xs text-muted-foreground mt-1">WIP average</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WIP Aging */}
        <Card>
          <CardHeader>
            <CardTitle>WIP Aging Distribution</CardTitle>
            <CardDescription>Units by days in WIP</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agingData?.aging || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cumulative Flow Diagram */}
        <Card>
          <CardHeader>
            <CardTitle>Cumulative Flow (Weekly)</CardTitle>
            <CardDescription>Units by stage over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cfdData?.cfd || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="Intake" stackId="1" stroke="#10b981" fill="#10b981" />
                <Area type="monotone" dataKey="WIP" stackId="1" stroke="#3b82f6" fill="#3b82f6" />
                <Area type="monotone" dataKey="RMA" stackId="1" stroke="#f59e0b" fill="#f59e0b" />
                <Area type="monotone" dataKey="Outflow" stackId="1" stroke="#6366f1" fill="#6366f1" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Units Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Unit Details</CardTitle>
              <CardDescription>
                {unitsData?.total?.toLocaleString() || 0} units found
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedStage || 'all'} onValueChange={(val) => setSelectedStage(val === 'all' ? '' : val)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All stages</SelectItem>
                  <SelectItem value="Intake">Intake</SelectItem>
                  <SelectItem value="WIP">WIP</SelectItem>
                  <SelectItem value="RMA">RMA</SelectItem>
                  <SelectItem value="Outflow">Outflow</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-muted/50 sticky top-0 z-10">
                  <tr className="border-b">
                    <th className="h-12 px-4 text-left align-middle font-medium">Serial Number</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">SKU</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Source</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Stage</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Received</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Aging</th>
                    <th className="h-12 px-4 text-left align-middle font-medium">Outflow</th>
                  </tr>
                </thead>
                <tbody>
                  {unitsData?.units?.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="h-24 text-center text-muted-foreground">
                        No units found
                      </td>
                    </tr>
                  ) : (
                    unitsData?.units?.map((unit: any) => (
                      <tr key={unit.id} className="border-b hover:bg-muted/50">
                        <td className="p-4 font-mono text-sm">{unit.serial_number}</td>
                        <td className="p-4">{unit.model_number}</td>
                        <td className="p-4 text-sm">{unit.source}</td>
                        <td className="p-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              unit.stage === 'Outflow'
                                ? 'bg-green-100 text-green-800'
                                : unit.stage === 'WIP'
                                ? 'bg-blue-100 text-blue-800'
                                : unit.stage === 'RMA'
                                ? 'bg-orange-100 text-orange-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {unit.stage}
                          </span>
                        </td>
                        <td className="p-4 text-sm">
                          {unit.received_date
                            ? new Date(unit.received_date).toLocaleDateString()
                            : '-'}
                        </td>
                        <td className="p-4 text-sm">{unit.aging_days || 0} days</td>
                        <td className="p-4 text-sm">
                          {unit.outflow_date
                            ? new Date(unit.outflow_date).toLocaleDateString()
                            : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Report Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Export WIP Report</DialogTitle>
            <DialogDescription>
              Select a date range to export all WIP data as a CSV file. Current filters will be applied.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="export-from-date">Start Date</Label>
              <Input
                id="export-from-date"
                type="date"
                value={exportFromDate}
                onChange={(e) => setExportFromDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="export-to-date">End Date</Label>
              <Input
                id="export-to-date"
                type="date"
                value={exportToDate}
                onChange={(e) => setExportToDate(e.target.value)}
              />
            </div>

            {/* Export Mode Selection */}
            <div className="space-y-3 rounded-lg border p-4">
              <Label className="text-sm font-medium">Export Mode</Label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!exportAllData}
                    onChange={() => setExportAllData(false)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">
                    Export Filtered Data {(source || sku) && `(${[source, sku].filter(Boolean).join(', ')})`}
                  </span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={exportAllData}
                    onChange={() => setExportAllData(true)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">Export All Data (All Sources, All SKUs)</span>
                </label>
              </div>
            </div>

            {/* Preview Count */}
            {exportFromDate && exportToDate && exportPreviewData?.total !== undefined && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm">
                <p className="font-medium text-green-900">
                  Ready to export: <span className="text-lg">{exportPreviewData.total.toLocaleString()}</span> records
                </p>
                <p className="text-green-700 text-xs mt-1">
                  {exportAllData ? 'All sources and SKUs' : (source || sku) ? `Filtered by ${[source, sku].filter(Boolean).join(', ')}` : 'No filters applied'}
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowExportModal(false);
                setExportFromDate('');
                setExportToDate('');
                setExportAllData(false);
              }}
              disabled={exporting}
            >
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={exporting || !exportFromDate || !exportToDate}>
              {exporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete All WIP Data?</DialogTitle>
            <DialogDescription>
              This will permanently delete all warehouse WIP data and import history. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAllData}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete All Data
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

