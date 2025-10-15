'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  DollarSign, 
  RefreshCw,
  Download,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  Receipt,
  CreditCard,
  Package
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface SKUData {
  sku: string;
  units: number;
  revenue: number;
  fees: number;
  net: number;
}

interface FinancialData {
  eventGroups: number;
  uniqueOrders: number;
  totalRevenue: number;
  totalFees: number;
  netRevenue: number;
  uniqueSKUs?: number;
  topSKUs?: SKUData[];
  allSKUs?: SKUData[];
}

interface DateRange {
  start: string;
  end: string;
}

const COLORS = {
  green: ['#10b981', '#059669', '#047857', '#065f46'],
  blue: ['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'],
  purple: ['#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6'],
};

export default function AmazonFinancialDataPage() {
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    end: new Date().toISOString().split('T')[0] // today
  });
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    loadFinancialData();
  }, []);

  async function loadFinancialData() {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/amazon/financial-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: dateRange.start,
          endDate: dateRange.end,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        // The API returns data in a 'summary' object, extract it
        setFinancialData({
          eventGroups: data.summary.eventGroups,
          uniqueOrders: data.summary.uniqueOrders,
          totalRevenue: data.summary.totalRevenue,
          totalFees: data.summary.totalFees,
          netRevenue: data.summary.netRevenue,
          uniqueSKUs: data.summary.uniqueSKUs,
          topSKUs: data.topSKUs || [],
          allSKUs: data.allSKUs || []
        });
        setLastRefresh(new Date());
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to load financial data');
      }
    } catch (err) {
      console.error('Error loading financial data:', err);
      setError('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function getQuickDateRange(days: number) {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    
    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    });
  }

  function handleExport() {
    if (!financialData || !financialData.allSKUs) {
      alert('No data available to export');
      return;
    }

    // Create CSV content
    const headers = ['SKU', 'Units Sold', 'Revenue', 'Fees', 'Net Profit'];
    const rows = financialData.allSKUs.map(sku => [
      sku.sku,
      sku.units.toString(),
      `$${sku.revenue.toFixed(2)}`,
      `$${sku.fees.toFixed(2)}`,
      `$${sku.net.toFixed(2)}`
    ]);

    // Add summary rows
    rows.push([]);
    rows.push(['SUMMARY', '', '', '', '']);
    rows.push(['Total Orders', financialData.uniqueOrders.toString(), '', '', '']);
    rows.push(['Total SKUs', financialData.uniqueSKUs?.toString() || '0', '', '', '']);
    rows.push(['Total Revenue', '', `$${financialData.totalRevenue.toFixed(2)}`, '', '']);
    rows.push(['Total Fees', '', `$${financialData.totalFees.toFixed(2)}`, '', '']);
    rows.push(['Net Revenue', '', '', '', `$${financialData.netRevenue.toFixed(2)}`]);
    rows.push(['Date Range', `${dateRange.start} to ${dateRange.end}`, '', '', '']);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `amazon-financial-data-${dateRange.start}-to-${dateRange.end}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const profitMargin = financialData ? 
    ((financialData.netRevenue / financialData.totalRevenue) * 100) : 0;

  const feePercentage = financialData ? 
    ((financialData.totalFees / financialData.totalRevenue) * 100) : 0;

  if (loading && !financialData) {
    return (
      <div className="container mx-auto p-4 sm:p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-gray-600">Loading Amazon financial data...</p>
        </div>
      </div>
    );
  }

  if (error && !financialData) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <Card className="border-red-300 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-[1800px]">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
              <span>Amazon Financial Data</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Real-time transaction data from Amazon SP-API
            </p>
            {lastRefresh && (
              <p className="text-xs text-gray-500 mt-1">
                Last updated: {lastRefresh.toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button onClick={loadFinancialData} disabled={loading} className="flex-1 sm:flex-none">
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex-1 sm:flex-none"
              onClick={handleExport}
              disabled={!financialData || !financialData.allSKUs || financialData.allSKUs.length === 0}
            >
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Date Range Controls */}
        <Card className="bg-gray-50 mb-6">
          <CardContent className="pt-4">
            <div className="space-y-4">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Date Range
              </Label>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <Label htmlFor="start-date" className="text-xs text-gray-600">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                    className="w-full"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="end-date" className="text-xs text-gray-600">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                    className="w-full"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={loadFinancialData} disabled={loading} className="w-full sm:w-auto">
                    <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Update
                  </Button>
                </div>
              </div>

              {/* Quick Date Range Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => getQuickDateRange(7)}
                  className="text-xs"
                >
                  Last 7 Days
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => getQuickDateRange(30)}
                  className="text-xs"
                >
                  Last 30 Days
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => getQuickDateRange(90)}
                  className="text-xs"
                >
                  Last 90 Days
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => getQuickDateRange(365)}
                  className="text-xs"
                >
                  Last Year
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        {financialData && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(financialData.totalRevenue)}</div>
                <p className="text-xs text-gray-500 mt-1">{financialData.uniqueOrders} orders</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Fees</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(financialData.totalFees)}</div>
                <p className="text-xs text-gray-500 mt-1">{feePercentage.toFixed(1)}% of revenue</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Net Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(financialData.netRevenue)}</div>
                <p className="text-xs text-gray-500 mt-1">{profitMargin.toFixed(1)}% margin</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Event Groups</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{financialData.eventGroups}</div>
                <p className="text-xs text-gray-500 mt-1">Transaction groups</p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Charts */}
      {financialData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Revenue vs Fees */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Revenue Breakdown
              </CardTitle>
              <CardDescription>Revenue vs fees breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[
                  { category: 'Total Revenue', amount: financialData.totalRevenue, color: '#3b82f6' },
                  { category: 'Total Fees', amount: financialData.totalFees, color: '#ef4444' },
                  { category: 'Net Revenue', amount: financialData.netRevenue, color: '#10b981' }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="category" 
                    style={{ fontSize: '11px' }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    style={{ fontSize: '11px' }}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Amount']}
                    contentStyle={{ fontSize: '12px' }}
                  />
                  <Bar dataKey="amount" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Profit Margin Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-green-600" />
                Profit Margin
              </CardTitle>
              <CardDescription>Revenue distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Net Revenue', value: financialData.netRevenue, color: '#10b981' },
                      { name: 'Fees', value: financialData.totalFees, color: '#ef4444' }
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[
                      { name: 'Net Revenue', value: financialData.netRevenue, color: '#10b981' },
                      { name: 'Fees', value: financialData.totalFees, color: '#ef4444' }
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontSize: '12px' }} />
                  <Legend 
                    formatter={(value, entry: any) => `${entry.payload.name}: ${formatCurrency(entry.payload.value)}`}
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* All SKUs Table */}
      {financialData && financialData.allSKUs && financialData.allSKUs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-600" />
              All SKU Performance
            </CardTitle>
            <CardDescription>
              Complete product performance data ({financialData.allSKUs.length} SKUs) - Scroll to view all
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="max-h-[600px] overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-3 font-semibold bg-gray-50">#</th>
                      <th className="text-left p-3 font-semibold bg-gray-50">SKU</th>
                      <th className="text-right p-3 font-semibold bg-gray-50">Units</th>
                      <th className="text-right p-3 font-semibold bg-gray-50">Revenue</th>
                      <th className="text-right p-3 font-semibold bg-gray-50">Fees</th>
                      <th className="text-right p-3 font-semibold bg-gray-50">Net Profit</th>
                      <th className="text-right p-3 font-semibold bg-gray-50">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialData.allSKUs.map((sku, index) => (
                      <tr key={`${sku.sku}-${index}`} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-3 text-gray-500 text-xs">{index + 1}</td>
                        <td className="p-3 font-medium text-gray-900">{sku.sku}</td>
                        <td className="p-3 text-right text-gray-600">{sku.units}</td>
                        <td className="p-3 text-right font-semibold text-blue-600">
                          {formatCurrency(sku.revenue)}
                        </td>
                        <td className="p-3 text-right text-red-600">
                          {formatCurrency(sku.fees)}
                        </td>
                        <td className="p-3 text-right font-semibold text-green-600">
                          {formatCurrency(sku.net)}
                        </td>
                        <td className="p-3 text-right text-gray-600">
                          {sku.revenue > 0 ? ((sku.net / sku.revenue) * 100).toFixed(1) : '0.0'}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {financialData && financialData.uniqueOrders === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Receipt className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Transaction Data</h3>
              <p className="text-gray-600 mb-4">
                No transactions found for the selected date range: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}
              </p>
              <Button onClick={loadFinancialData} variant="outline">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
