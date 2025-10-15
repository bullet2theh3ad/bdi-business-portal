'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as XLSX from 'xlsx';
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
  Package,
  Info,
  X
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
  refundedUnits?: number;
  refundAmount?: number;
  netUnits?: number;
}

interface FeeBreakdown {
  feeType: string;
  amount: number;
  percentage: number;
}

interface FinancialData {
  eventGroups: number;
  uniqueOrders: number;
  totalRevenue: number;
  totalFees: number;
  totalRefunds?: number;
  netRevenue: number;
  uniqueSKUs?: number;
  refundRate?: number;
  topSKUs?: SKUData[];
  allSKUs?: SKUData[];
  feeBreakdown?: FeeBreakdown[];
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
  const [showFeeModal, setShowFeeModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      loadFinancialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  function handlePasswordSubmit() {
    if (password === 'BDI1') {
      setIsAuthenticated(true);
      setShowPasswordModal(false);
      setPassword('');
    } else {
      alert('Incorrect password. Please try again.');
      setPassword('');
    }
  }

  function handlePasswordCancel() {
    // Redirect back to main Amazon Data page
    window.location.href = '/admin/amazon-data';
  }

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
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        setError(`Server error: ${text.substring(0, 100)}...`);
        return;
      }

      const data = await response.json();
      
      if (response.ok && data.success) {
        // The API returns data in a 'summary' object, extract it
        setFinancialData({
          eventGroups: data.summary.eventGroups,
          uniqueOrders: data.summary.uniqueOrders,
          totalRevenue: data.summary.totalRevenue,
          totalFees: data.summary.totalFees,
          totalRefunds: data.summary.totalRefunds || 0,
          netRevenue: data.summary.netRevenue,
          uniqueSKUs: data.summary.uniqueSKUs,
          refundRate: data.summary.refundRate || 0,
          topSKUs: data.topSKUs || [],
          allSKUs: data.allSKUs || [],
          feeBreakdown: data.feeBreakdown || []
        });
        setLastRefresh(new Date());
      } else {
        setError(data.error || 'Failed to load financial data');
      }
    } catch (err) {
      console.error('Error loading financial data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load financial data');
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

  async function handleExport() {
    if (!financialData || !financialData.allSKUs) {
      alert('No data available to export');
      return;
    }

    // Fetch detailed transaction data for line items
    setLoading(true);
    try {
      const response = await fetch('/api/amazon/financial-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: dateRange.start,
          endDate: dateRange.end,
          includeTransactions: true, // Request full transaction details
        }),
      });

      const data = await response.json();
      const transactions = data.transactions || [];

      // Create a new workbook
      const workbook = XLSX.utils.book_new();

      // TAB 1: Summary
      const summaryData = [
        ['Amazon Financial Data - Summary Report'],
        [''],
        ['Date Range', `${dateRange.start} to ${dateRange.end}`],
        ['Generated', new Date().toLocaleString()],
        [''],
        ['Metric', 'Value'],
        ['Total Orders', financialData.uniqueOrders],
        ['Total SKUs', financialData.uniqueSKUs || 0],
        ['Total Revenue', financialData.totalRevenue],
        ['Total Fees', financialData.totalFees],
        ['Total Refunds', financialData.totalRefunds || 0],
        ['Net Revenue', financialData.netRevenue],
        ['Profit Margin', `${((financialData.netRevenue / financialData.totalRevenue) * 100).toFixed(2)}%`],
        ['Fee Percentage', `${((financialData.totalFees / financialData.totalRevenue) * 100).toFixed(2)}%`],
        ['Refund Rate', `${(financialData.refundRate || 0).toFixed(2)}%`],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

      // TAB 2: Fee Breakdown
      if (financialData.feeBreakdown && financialData.feeBreakdown.length > 0) {
        const feeData = [
          ['Fee Breakdown by Type'],
          [''],
          ['Fee Type', 'Amount', 'Percentage of Total Fees'],
          ...financialData.feeBreakdown.map(fee => [
            fee.feeType,
            fee.amount,
            `${fee.percentage.toFixed(2)}%`
          ]),
          [''],
          ['Total', financialData.totalFees, '100.00%']
        ];
        const feeSheet = XLSX.utils.aoa_to_sheet(feeData);
        XLSX.utils.book_append_sheet(workbook, feeSheet, 'Fee Breakdown');
      }

      // TAB 3: All SKU Line Items (Aggregated with Refunds)
      const skuData = [
        ['All SKU Performance - Aggregated with Returns'],
        [''],
        ['Rank', 'SKU', 'Units Sold', 'Returns', 'Net Units', 'Revenue', 'Refunded $', 'Fees', 'Net Profit', 'Profit Margin %'],
        ...financialData.allSKUs.map((sku, index) => [
          index + 1,
          sku.sku,
          sku.units,
          sku.refundedUnits || 0,
          sku.netUnits || sku.units,
          sku.revenue,
          sku.refundAmount || 0,
          sku.fees,
          sku.net,
          sku.revenue > 0 ? `${((sku.net / sku.revenue) * 100).toFixed(2)}%` : '0.00%'
        ])
      ];
      const skuSheet = XLSX.utils.aoa_to_sheet(skuData);
      XLSX.utils.book_append_sheet(workbook, skuSheet, 'SKU Summary');

      // TAB 4: Transaction Line Items (Detailed)
      const transactionLineItems: any[] = [
        ['Transaction-Level Line Items (All Orders)'],
        [''],
        ['Order ID', 'Posted Date', 'SKU', 'ASIN', 'Quantity', 'Item Price', 'Item Tax', 'Shipping', 'Gift Wrap', 'Promotion', 'Total Charges', 'Fees', 'Net Amount', 'Fee Types']
      ];

      // Extract all line items from transactions
      transactions.forEach((eventGroup: any) => {
        eventGroup.ShipmentEventList?.forEach((shipment: any) => {
          const orderId = shipment.AmazonOrderId || 'N/A';
          const postedDate = shipment.PostedDate || 'N/A';

          shipment.ShipmentItemList?.forEach((item: any) => {
            const sku = item.SellerSKU || 'N/A';
            const asin = item.ASIN || 'N/A';
            const quantity = item.QuantityShipped || 0;

            // Calculate charges
            let itemPrice = 0;
            let itemTax = 0;
            let shipping = 0;
            let giftWrap = 0;
            let promotion = 0;

            item.ItemChargeList?.forEach((charge: any) => {
              const amount = charge.ChargeAmount?.CurrencyAmount || 0;
              const type = charge.ChargeType;
              if (type === 'Principal') itemPrice += amount;
              if (type === 'Tax') itemTax += amount;
              if (type === 'Shipping') shipping += amount;
              if (type === 'ShippingTax') shipping += amount;
              if (type === 'GiftWrap') giftWrap += amount;
              if (type === 'GiftWrapTax') giftWrap += amount;
              if (type === 'Promotion') promotion += amount;
            });

            // Calculate fees
            let totalFees = 0;
            const feeTypes: string[] = [];
            item.ItemFeeList?.forEach((fee: any) => {
              const feeAmount = Math.abs(fee.FeeAmount?.CurrencyAmount || 0);
              totalFees += feeAmount;
              if (fee.FeeType) feeTypes.push(fee.FeeType);
            });

            const totalCharges = itemPrice + itemTax + shipping + giftWrap + promotion;
            const netAmount = totalCharges - totalFees;

            transactionLineItems.push([
              orderId,
              postedDate,
              sku,
              asin,
              quantity,
              itemPrice,
              itemTax,
              shipping,
              giftWrap,
              promotion,
              totalCharges,
              totalFees,
              netAmount,
              feeTypes.join(', ')
            ]);
          });
        });
      });

      const transactionSheet = XLSX.utils.aoa_to_sheet(transactionLineItems);
      XLSX.utils.book_append_sheet(workbook, transactionSheet, 'Transaction Details');

      // TAB 5: Refund/Return Line Items (Detailed)
      const refundLineItems: any[] = [
        ['Refund/Return Line Items (All Returns)'],
        [''],
        ['Order ID', 'Posted Date', 'SKU', 'ASIN', 'Quantity Returned', 'Refund Amount', 'Fees Refunded', 'Net Refund', 'Return Reason']
      ];

      // Extract all refund line items from transactions
      transactions.forEach((eventGroup: any) => {
        eventGroup.RefundEventList?.forEach((refund: any) => {
          const orderId = refund.AmazonOrderId || 'N/A';
          const postedDate = refund.PostedDate || 'N/A';

          refund.ShipmentItemAdjustmentList?.forEach((item: any) => {
            const sku = item.SellerSKU || 'N/A';
            const asin = item.ASIN || 'N/A';
            const quantity = Math.abs(item.QuantityShipped || 0);

            // Calculate refund amount
            let refundAmount = 0;
            item.ItemChargeAdjustmentList?.forEach((charge: any) => {
              const amount = charge.ChargeAmount?.CurrencyAmount || 0;
              refundAmount += Math.abs(amount);
            });

            // Calculate fees refunded
            let feesRefunded = 0;
            item.ItemFeeAdjustmentList?.forEach((fee: any) => {
              const feeAmount = fee.FeeAmount?.CurrencyAmount || 0;
              feesRefunded += Math.abs(feeAmount);
            });

            const netRefund = refundAmount - feesRefunded;

            refundLineItems.push([
              orderId,
              postedDate,
              sku,
              asin,
              quantity,
              refundAmount,
              feesRefunded,
              netRefund,
              'Customer Return' // Amazon doesn't provide detailed return reasons in API
            ]);
          });
        });
      });

      // Only add refunds tab if there are refunds
      if (refundLineItems.length > 3) {
        const refundSheet = XLSX.utils.aoa_to_sheet(refundLineItems);
        XLSX.utils.book_append_sheet(workbook, refundSheet, 'Refund Details');
      }

      // Generate Excel file and download
      XLSX.writeFile(workbook, `amazon-financial-data-${dateRange.start}-to-${dateRange.end}.xlsx`);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const profitMargin = financialData ? 
    ((financialData.netRevenue / financialData.totalRevenue) * 100) : 0;

  const feePercentage = financialData ? 
    ((financialData.totalFees / financialData.totalRevenue) * 100) : 0;

  // Password protection modal - CHECK THIS FIRST
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-md w-full">
          {/* Modal Header */}
          <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <DollarSign className="h-7 w-7 text-blue-600" />
              Amazon Financial Data Access
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              This page makes API calls to Amazon. Please enter the password to continue.
            </p>
          </div>

          {/* Modal Content */}
          <div className="p-6">
            <Label htmlFor="password" className="text-sm font-semibold text-gray-700 mb-2 block">
              Enter Password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePasswordSubmit();
                }
              }}
              placeholder="Enter password"
              className="w-full"
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-2">
              This protects against accidental API abuse and excessive usage.
            </p>
          </div>

          {/* Modal Footer */}
          <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handlePasswordCancel}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePasswordSubmit}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Submit
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state after authentication
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

  // Show error state after authentication
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
              <span className="hidden sm:inline">Export Excel</span>
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
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                  <span>Total Fees</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-red-50"
                    onClick={() => setShowFeeModal(true)}
                    title="View fee breakdown"
                  >
                    <Info className="h-4 w-4 text-red-500" />
                  </Button>
                </CardTitle>
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

            <Card className="border-l-4 border-l-orange-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Refunds</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(financialData.totalRefunds || 0)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {financialData.refundRate?.toFixed(1)}% refund rate
                </p>
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
                      <th className="text-right p-3 font-semibold bg-gray-50">Units Sold</th>
                      <th className="text-right p-3 font-semibold bg-gray-50">Returns</th>
                      <th className="text-right p-3 font-semibold bg-gray-50">Net Units</th>
                      <th className="text-right p-3 font-semibold bg-gray-50">Revenue</th>
                      <th className="text-right p-3 font-semibold bg-gray-50">Refunded</th>
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
                        <td className="p-3 text-right text-orange-600">
                          {sku.refundedUnits || 0}
                        </td>
                        <td className="p-3 text-right font-semibold text-gray-700">
                          {sku.netUnits || sku.units}
                        </td>
                        <td className="p-3 text-right font-semibold text-blue-600">
                          {formatCurrency(sku.revenue)}
                        </td>
                        <td className="p-3 text-right text-orange-600">
                          {formatCurrency(sku.refundAmount || 0)}
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

      {/* Fee Breakdown Modal */}
      {showFeeModal && financialData && financialData.feeBreakdown && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-red-50 to-white">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <CreditCard className="h-6 w-6 text-red-600" />
                  Fee Breakdown
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Detailed breakdown of all Amazon fees
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFeeModal(false)}
                className="hover:bg-red-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Total Summary */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Fees</p>
                    <p className="text-3xl font-bold text-red-600">{formatCurrency(financialData.totalFees)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">% of Revenue</p>
                    <p className="text-2xl font-semibold text-gray-700">{feePercentage.toFixed(2)}%</p>
                  </div>
                </div>
              </div>

              {/* Fee Types Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left p-3 font-semibold text-gray-700">Fee Type</th>
                      <th className="text-right p-3 font-semibold text-gray-700">Amount</th>
                      <th className="text-right p-3 font-semibold text-gray-700">% of Total Fees</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialData.feeBreakdown.map((fee, index) => (
                      <tr key={index} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-3 font-medium text-gray-900">{fee.feeType}</td>
                        <td className="p-3 text-right font-semibold text-red-600">
                          {formatCurrency(fee.amount)}
                        </td>
                        <td className="p-3 text-right text-gray-600">
                          {fee.percentage.toFixed(2)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2">
                    <tr>
                      <td className="p-3 font-bold text-gray-900">Total</td>
                      <td className="p-3 text-right font-bold text-red-600">
                        {formatCurrency(financialData.totalFees)}
                      </td>
                      <td className="p-3 text-right font-bold text-gray-600">100.00%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Fee Analysis */}
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Fee Analysis
                </h3>
                <div className="space-y-1 text-sm text-blue-800">
                  <p>• Total fees represent <strong>{feePercentage.toFixed(2)}%</strong> of your total revenue</p>
                  <p>• Net profit margin after fees: <strong>{profitMargin.toFixed(2)}%</strong></p>
                  <p>• Date range: {formatDate(dateRange.start)} to {formatDate(dateRange.end)}</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowFeeModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
