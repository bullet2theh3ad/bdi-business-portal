'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Upload, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Eye,
  BarChart3,
  Download
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface CampaignSummary {
  totalSpend: number;
  totalSales: number;
  totalOrders: number;
  totalImpressions: number;
  totalClicks: number;
  avgAcos: number;
  avgRoas: number;
  avgCtr: number;
  campaignCount: number;
  bySku: Array<{
    sku: string;
    spend: number;
    sales: number;
    orders: number;
    impressions: number;
    clicks: number;
    campaignCount: number;
    acos: number;
    roas: number;
    ctr: number;
  }>;
}

export default function AmazonCampaignsPage() {
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CampaignSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/amazon/campaigns/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      console.log('✅ Upload successful:', data);
      setUploadSuccess(true);
      
      // Fetch summary after successful upload
      fetchSummary();
    } catch (error: any) {
      console.error('❌ Upload error:', error);
      setUploadError(error.message || 'Failed to upload file');
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const fetchSummary = async () => {
    setLoadingSummary(true);
    try {
      const response = await fetch('/api/amazon/campaigns/summary');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch summary');
      }

      setSummary(data);
    } catch (error: any) {
      console.error('❌ Summary fetch error:', error);
    } finally {
      setLoadingSummary(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Amazon Campaign Analytics</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">
          Upload and analyze Amazon Sponsored Products campaign data
        </p>
      </div>

      {/* Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload Campaign Data
          </CardTitle>
          <CardDescription>
            Download campaign CSV from Amazon Advertising Console and upload here
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Upload Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
              <p className="font-semibold text-blue-900 mb-2">📋 How to get your campaign data:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-800">
                <li>Go to Amazon Advertising Console</li>
                <li>Navigate to <strong>Campaign Manager</strong></li>
                <li>Select your campaigns</li>
                <li>Click <strong>Download</strong> → <strong>Campaign report (CSV)</strong></li>
                <li>Upload the CSV file below</li>
              </ol>
            </div>

            {/* File Upload */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={uploading}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {uploading && (
                <div className="flex items-center gap-2 text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Uploading...</span>
                </div>
              )}
            </div>

            {/* Success Message */}
            {uploadSuccess && (
              <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-lg p-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">Campaign data uploaded successfully!</span>
              </div>
            )}

            {/* Error Message */}
            {uploadError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                <XCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">{uploadError}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Total Spend */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Ad Spend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalSpend)}</div>
                <p className="text-xs text-gray-500 mt-1">{summary.campaignCount} campaigns</p>
              </CardContent>
            </Card>

            {/* Total Sales */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalSales)}</div>
                <p className="text-xs text-gray-500 mt-1">{summary.totalOrders} orders</p>
              </CardContent>
            </Card>

            {/* Average ACOS */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg ACOS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">{formatPercent(summary.avgAcos)}</div>
                <p className="text-xs text-gray-500 mt-1">Advertising Cost of Sales</p>
              </CardContent>
            </Card>

            {/* Average ROAS */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Avg ROAS</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{summary.avgRoas.toFixed(2)}x</div>
                <p className="text-xs text-gray-500 mt-1">Return on Ad Spend</p>
              </CardContent>
            </Card>
          </div>

          {/* SKU Performance Chart */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Ad Spend by SKU
              </CardTitle>
              <CardDescription>
                Top performing SKUs by advertising spend
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={summary.bySku.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="sku" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: any, name: string) => {
                      if (name === 'spend' || name === 'sales') {
                        return formatCurrency(value);
                      }
                      return value;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="spend" fill="#3b82f6" name="Ad Spend" />
                  <Bar dataKey="sales" fill="#10b981" name="Sales" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* SKU Table */}
          <Card>
            <CardHeader>
              <CardTitle>SKU Performance Details</CardTitle>
              <CardDescription>
                Detailed metrics for each SKU
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-semibold">SKU</th>
                      <th className="text-right p-2 font-semibold">Campaigns</th>
                      <th className="text-right p-2 font-semibold">Spend</th>
                      <th className="text-right p-2 font-semibold">Sales</th>
                      <th className="text-right p-2 font-semibold">Orders</th>
                      <th className="text-right p-2 font-semibold">ACOS</th>
                      <th className="text-right p-2 font-semibold">ROAS</th>
                      <th className="text-right p-2 font-semibold">CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.bySku.map((sku) => (
                      <tr key={sku.sku} className="border-b hover:bg-gray-50">
                        <td className="p-2 font-medium">{sku.sku}</td>
                        <td className="text-right p-2">{sku.campaignCount}</td>
                        <td className="text-right p-2">{formatCurrency(sku.spend)}</td>
                        <td className="text-right p-2 text-green-600">{formatCurrency(sku.sales)}</td>
                        <td className="text-right p-2">{sku.orders}</td>
                        <td className="text-right p-2">
                          <span className={sku.acos > 0.3 ? 'text-red-600' : 'text-green-600'}>
                            {formatPercent(sku.acos)}
                          </span>
                        </td>
                        <td className="text-right p-2 text-blue-600">{sku.roas.toFixed(2)}x</td>
                        <td className="text-right p-2">{formatPercent(sku.ctr)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Load Summary Button (if no summary loaded) */}
      {!summary && !loadingSummary && (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">Upload campaign data to see analytics</p>
          <Button onClick={fetchSummary} variant="outline">
            <BarChart3 className="w-4 h-4 mr-2" />
            Load Existing Data
          </Button>
        </div>
      )}

      {loadingSummary && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-gray-500">Loading campaign data...</p>
        </div>
      )}
    </div>
  );
}

