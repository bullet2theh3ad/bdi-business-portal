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
  sku: string; // Amazon seller SKU or ASIN
  units: number;
  revenue: number;
  fees: number;
  net: number;
  refundedUnits?: number;
  refundAmount?: number;
  netUnits?: number;
  bdiSku?: string; // Mapped internal SKU
  mappingStatus?: 'mapped' | 'no_mapping' | 'no_sku';
}

interface FeeBreakdown {
  feeType: string;
  amount: number;
  percentage: number;
}

interface AdSpendBreakdown {
  transactionType: string;
  amount: number;
  percentage: number;
}

interface AdjustmentBreakdown {
  adjustmentType: string;
  amount: number;
  percentage: number;
}

interface FinancialData {
  eventGroups: number;
  uniqueOrders: number;
  totalRevenue: number; // Excludes tax
  totalTax?: number; // Tax collected
  totalTaxRefunded?: number; // Tax refunded
  totalFees: number;
  totalRefunds?: number; // Product refunds only (no tax)
  totalAdSpend?: number;
  totalChargebacks?: number;
  totalCoupons?: number;
  adjustmentCredits?: number;
  adjustmentDebits?: number;
  adjustmentNet?: number;
  netRevenue: number;
  trueNetProfit?: number;
  uniqueSKUs?: number;
  refundRate?: number;
  trueNetMargin?: number;
  marketingROI?: number;
  topSKUs?: SKUData[];
  allSKUs?: SKUData[];
  feeBreakdown?: FeeBreakdown[];
  adSpendBreakdown?: AdSpendBreakdown[];
  adjustmentBreakdown?: {
    credits: AdjustmentBreakdown[];
    debits: AdjustmentBreakdown[];
  };
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
  const [showAdSpendModal, setShowAdSpendModal] = useState(false);
  const [showAdjustmentCreditsModal, setShowAdjustmentCreditsModal] = useState(false);
  const [showAdjustmentDebitsModal, setShowAdjustmentDebitsModal] = useState(false);
  const [showPLModal, setShowPLModal] = useState(false);
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
    await loadFinancialDataWithRange(dateRange.start, dateRange.end);
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
    
    const newRange = {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0]
    };
    
    setDateRange(newRange);
    
    // Auto-reload data with new date range
    loadFinancialDataWithRange(newRange.start, newRange.end);
  }

  async function loadFinancialDataWithRange(start: string, end: string) {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/amazon/financial-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: start,
          endDate: end,
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
          totalRevenue: data.summary.totalRevenue, // Excludes tax
          totalTax: data.summary.totalTax || 0, // Tax collected
          totalFees: data.summary.totalFees,
          totalRefunds: data.summary.totalRefunds || 0,
          totalAdSpend: data.summary.totalAdSpend || 0,
          totalChargebacks: data.summary.totalChargebacks || 0,
          totalCoupons: data.summary.totalCoupons || 0,
          adjustmentCredits: data.summary.adjustmentCredits || 0,
          adjustmentDebits: data.summary.adjustmentDebits || 0,
          adjustmentNet: data.summary.adjustmentNet || 0,
          netRevenue: data.summary.netRevenue,
          trueNetProfit: data.summary.trueNetProfit || 0,
          uniqueSKUs: data.summary.uniqueSKUs,
          refundRate: data.summary.refundRate || 0,
          trueNetMargin: data.summary.trueNetMargin || 0,
          marketingROI: data.summary.marketingROI || 0,
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
        ['Metric', 'Value', 'Notes'],
        ['Total Orders', financialData.uniqueOrders, ''],
        ['Total SKUs', financialData.uniqueSKUs || 0, ''],
        ['Total Revenue', financialData.totalRevenue, 'Excludes tax'],
        ['Total Tax Collected', financialData.totalTax || 0, 'Sales tax from customers'],
        ['Total Fees', financialData.totalFees, 'Amazon fees'],
        ['Total Refunds', financialData.totalRefunds || 0, 'Money refunded'],
        ['Net Revenue', financialData.netRevenue, 'Revenue - Fees'],
        ['Profit Margin', `${((financialData.netRevenue / financialData.totalRevenue) * 100).toFixed(2)}%`, 'Before other costs'],
        ['Fee Percentage', `${((financialData.totalFees / financialData.totalRevenue) * 100).toFixed(2)}%`, 'Fees / Revenue'],
        ['Refund Rate', `${(financialData.refundRate || 0).toFixed(2)}%`, 'Orders with returns'],
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

      // TAB 3: All SKU Line Items (Aggregated with Refunds and BDI SKU Mapping)
      const skuData = [
        ['All SKU Performance - Aggregated with Returns'],
        [''],
        ['Rank', 'Amazon SKU/ASIN', 'BDI SKU', 'Mapping Status', 'Units Sold', 'Returns', 'Net Units', 'Revenue', 'Refunded $', 'Fees', 'Net Profit', 'Profit Margin %'],
        ...financialData.allSKUs.map((sku, index) => [
          index + 1,
          sku.sku,
          sku.bdiSku || '',
          sku.bdiSku ? 'Mapped' : (sku.mappingStatus === 'no_mapping' ? 'No Mappings' : 'No SKU in DB'),
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

      // TAB 4: Transaction Line Items (Detailed - Tax Excluded)
      const transactionLineItems: any[] = [
        ['Transaction-Level Line Items (All Orders)'],
        [''],
        ['Order ID', 'Posted Date', 'SKU', 'ASIN', 'Quantity', 'Item Price', 'Shipping', 'Gift Wrap', 'Promotion', 'Total (excl. tax)', 'Fees', 'Net Amount', 'Fee Types']
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

            // Calculate charges (excluding tax)
            let itemPrice = 0;
            let shipping = 0;
            let giftWrap = 0;
            let promotion = 0;

            item.ItemChargeList?.forEach((charge: any) => {
              const amount = charge.ChargeAmount?.CurrencyAmount || 0;
              const type = charge.ChargeType;
              if (type === 'Principal') itemPrice += amount;
              // Tax excluded
              if (type === 'Shipping') shipping += amount;
              // ShippingTax excluded
              if (type === 'GiftWrap') giftWrap += amount;
              // GiftWrapTax excluded
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

            const totalCharges = itemPrice + shipping + giftWrap + promotion; // No tax
            const netAmount = totalCharges - totalFees;

            transactionLineItems.push([
              orderId,
              postedDate,
              sku,
              asin,
              quantity,
              itemPrice,
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
        ['Order ID', 'Posted Date', 'SKU', 'ASIN', 'Quantity Returned', 'Refund Amount', 'Fees Refunded', 'Fee Types Refunded', 'Net Refund to Customer']
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

            // Calculate refund amount (money back to customer)
            let refundAmount = 0;
            item.ItemChargeAdjustmentList?.forEach((charge: any) => {
              const amount = charge.ChargeAmount?.CurrencyAmount || 0;
              refundAmount += Math.abs(amount);
            });

            // Calculate fees refunded (Amazon credits back to you)
            let feesRefunded = 0;
            const feeTypesRefunded: string[] = [];
            item.ItemFeeAdjustmentList?.forEach((fee: any) => {
              const feeAmount = fee.FeeAmount?.CurrencyAmount || 0;
              feesRefunded += Math.abs(feeAmount);
              if (fee.FeeType) {
                feeTypesRefunded.push(`${fee.FeeType}: $${Math.abs(feeAmount).toFixed(2)}`);
              }
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
              feeTypesRefunded.join(', ') || 'No fees refunded',
              netRefund
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
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Button onClick={loadFinancialData} disabled={loading} className="flex-1 sm:flex-none">
              <RefreshCw className={`h-4 w-4 sm:mr-2 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button 
              variant="outline"
              className="flex-1 sm:flex-none bg-gradient-to-r from-green-50 to-blue-50 hover:from-green-100 hover:to-blue-100"
              onClick={() => setShowPLModal(true)}
              disabled={!financialData}
            >
              <BarChart3 className="h-4 w-4 sm:mr-2 text-green-600" />
              <span className="hidden sm:inline">P&L Statement</span>
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{formatCurrency(financialData.totalRevenue)}</div>
                <p className="text-xs text-gray-500 mt-1">{financialData.uniqueOrders} orders (excl. tax)</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-indigo-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Tax</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-600">
                  {formatCurrency(financialData.totalTax || 0)}
                </div>
                <p className="text-xs text-gray-500 mt-1">Tax collected</p>
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

            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-600">Ad Spend</CardTitle>
                  <button
                    onClick={() => {
                      console.log('Ad Spend button clicked');
                      console.log('financialData:', financialData);
                      console.log('adSpendBreakdown:', financialData?.adSpendBreakdown);
                      setShowAdSpendModal(true);
                    }}
                    className="text-purple-500 hover:text-purple-700 transition-colors"
                    title="View Ad Spend Breakdown"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(financialData.totalAdSpend || 0)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {financialData.marketingROI?.toFixed(0)}% ROI
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-teal-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Tax Refunded</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-teal-600">
                  {formatCurrency(financialData.totalTaxRefunded || 0)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Tax returned to customers
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-600">Amazon Credits</CardTitle>
                  <button
                    onClick={() => setShowAdjustmentCreditsModal(true)}
                    className="text-green-500 hover:text-green-700 transition-colors"
                    title="View Amazon Credits Breakdown"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(financialData.adjustmentCredits || 0)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Amazon owes you
                </p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-500">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-600">Amazon Debits</CardTitle>
                  <button
                    onClick={() => setShowAdjustmentDebitsModal(true)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                    title="View Amazon Debits Breakdown"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(financialData.adjustmentDebits || 0)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  You owe Amazon
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
                      <th className="text-left p-3 font-semibold bg-gray-50">Amazon SKU/ASIN</th>
                      <th className="text-left p-3 font-semibold bg-gray-50">BDI SKU</th>
                      <th className="text-right p-3 font-semibold bg-gray-50">Units</th>
                      <th className="text-right p-3 font-semibold bg-gray-50">Returns</th>
                      <th className="text-right p-3 font-semibold bg-gray-50">Net</th>
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
                        <td className="p-3 font-mono text-xs text-gray-700 break-all">{sku.sku}</td>
                        <td className="p-3">
                          {sku.bdiSku ? (
                            <span className="font-semibold text-green-700">{sku.bdiSku}</span>
                          ) : sku.mappingStatus === 'no_mapping' ? (
                            <span className="text-xs text-gray-400 italic">no mappings</span>
                          ) : (
                            <span className="text-xs text-orange-500 italic">no SKU in DB</span>
                          )}
                        </td>
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

      {/* P&L Statement Modal */}
      {showPLModal && financialData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-green-50 via-blue-50 to-purple-50">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="h-7 w-7 text-green-600" />
                  Complete Profit & Loss Statement
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Comprehensive financial analysis including all costs and adjustments
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPLModal(false)}
                className="hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Income Section */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2 border-b pb-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Revenue & Income
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <span className="font-semibold text-gray-700">Total Revenue (Sales)</span>
                    <span className="font-bold text-blue-600 text-lg">{formatCurrency(financialData.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 pl-8">
                    <span className="text-sm text-gray-600">from {financialData.uniqueOrders} orders</span>
                    <span className="text-sm text-gray-500">{financialData.uniqueSKUs} SKUs</span>
                  </div>
                  {(financialData.adjustmentCredits || 0) > 0 && (
                    <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                      <span className="font-medium text-gray-700">+ Amazon Credits/Adjustments</span>
                      <span className="font-semibold text-green-600">{formatCurrency(financialData.adjustmentCredits || 0)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expenses Section */}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2 border-b pb-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  Costs & Expenses
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <span className="font-semibold text-gray-700">Amazon Fees</span>
                    <span className="font-bold text-red-600">{formatCurrency(financialData.totalFees)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 pl-8">
                    <span className="text-sm text-gray-600">{feePercentage.toFixed(2)}% of revenue</span>
                    <Button variant="link" size="sm" className="text-xs h-auto p-0" onClick={() => { setShowPLModal(false); setShowFeeModal(true); }}>
                      View breakdown →
                    </Button>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                    <span className="font-semibold text-gray-700">Refunds & Returns</span>
                    <span className="font-bold text-orange-600">{formatCurrency(financialData.totalRefunds || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 pl-8">
                    <span className="text-sm text-gray-600">{financialData.refundRate?.toFixed(2)}% refund rate</span>
                  </div>

                  {(financialData.totalAdSpend || 0) > 0 && (
                    <>
                      <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                        <span className="font-semibold text-gray-700">Product Advertising</span>
                        <span className="font-bold text-purple-600">{formatCurrency(financialData.totalAdSpend || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 pl-8">
                        <span className="text-sm text-gray-600">ROI: {financialData.marketingROI?.toFixed(0)}%</span>
                      </div>
                    </>
                  )}

                  {(financialData.totalCoupons || 0) > 0 && (
                    <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                      <span className="font-semibold text-gray-700">Coupons & Promotions</span>
                      <span className="font-bold text-yellow-600">{formatCurrency(financialData.totalCoupons || 0)}</span>
                    </div>
                  )}

                  {(financialData.totalChargebacks || 0) > 0 && (
                    <div className="flex justify-between items-center p-3 bg-red-100 rounded-lg">
                      <span className="font-semibold text-gray-700">Chargebacks (Disputes)</span>
                      <span className="font-bold text-red-700">{formatCurrency(financialData.totalChargebacks || 0)}</span>
                    </div>
                  )}

                  {(financialData.adjustmentDebits || 0) > 0 && (
                    <div className="flex justify-between items-center p-3 bg-gray-100 rounded-lg">
                      <span className="font-semibold text-gray-700">Amazon Debits</span>
                      <span className="font-bold text-gray-700">{formatCurrency(financialData.adjustmentDebits || 0)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Net Profit Summary */}
              <div className="border-t-4 border-gray-300 pt-6">
                <div className="bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-lg p-6 shadow-lg">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-sm opacity-90 mb-1">TRUE NET PROFIT</p>
                      <p className="text-4xl font-bold">{formatCurrency(financialData.trueNetProfit || 0)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm opacity-90 mb-1">Net Margin</p>
                      <p className="text-3xl font-bold">{financialData.trueNetMargin?.toFixed(2)}%</p>
                    </div>
                  </div>
                  <p className="text-xs opacity-80">
                    Revenue - Fees - Refunds - Ads - Coupons - Chargebacks + Adjustments
                  </p>
                </div>
              </div>

              {/* Key Metrics Grid */}
              <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-xs text-blue-800 mb-1">Marketing ROI</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {financialData.marketingROI?.toFixed(0) || '0'}%
                  </p>
                  <p className="text-xs text-gray-600 mt-1">Revenue per ad dollar</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-xs text-green-800 mb-1">Gross Margin</p>
                  <p className="text-2xl font-bold text-green-600">{profitMargin.toFixed(2)}%</p>
                  <p className="text-xs text-gray-600 mt-1">Before marketing costs</p>
                </div>
              </div>

              {/* Detailed Breakdown */}
              <div className="mt-6 bg-gray-50 border rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Calculation Breakdown</h4>
                <div className="space-y-1 text-sm font-mono">
                  <div className="flex justify-between">
                    <span className="text-green-600">Revenue:</span>
                    <span className="text-green-600">+{formatCurrency(financialData.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-600">Amazon Fees:</span>
                    <span className="text-red-600">-{formatCurrency(financialData.totalFees)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-600">Refunds:</span>
                    <span className="text-orange-600">-{formatCurrency(financialData.totalRefunds || 0)}</span>
                  </div>
                  {(financialData.totalAdSpend || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-purple-600">Ad Spend:</span>
                      <span className="text-purple-600">-{formatCurrency(financialData.totalAdSpend || 0)}</span>
                    </div>
                  )}
                  {(financialData.totalCoupons || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-yellow-600">Coupons:</span>
                      <span className="text-yellow-600">-{formatCurrency(financialData.totalCoupons || 0)}</span>
                    </div>
                  )}
                  {(financialData.totalChargebacks || 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-red-700">Chargebacks:</span>
                      <span className="text-red-700">-{formatCurrency(financialData.totalChargebacks || 0)}</span>
                    </div>
                  )}
                  {(financialData.adjustmentNet || 0) !== 0 && (
                    <div className="flex justify-between">
                      <span className={financialData.adjustmentNet! > 0 ? "text-green-600" : "text-red-600"}>
                        Adjustments:
                      </span>
                      <span className={financialData.adjustmentNet! > 0 ? "text-green-600" : "text-red-600"}>
                        {financialData.adjustmentNet! > 0 ? '+' : ''}{formatCurrency(financialData.adjustmentNet || 0)}
                      </span>
                    </div>
                  )}
                  <div className="border-t-2 border-gray-400 mt-2 pt-2 flex justify-between font-bold text-base">
                    <span className="text-gray-900">True Net Profit:</span>
                    <span className={financialData.trueNetProfit! >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatCurrency(financialData.trueNetProfit || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPLModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
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

      {/* Ad Spend Breakdown Modal */}
      {showAdSpendModal && financialData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-purple-50 to-white">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-purple-600" />
                  Ad Spend Breakdown
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Detailed breakdown of advertising spend by transaction type
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdSpendModal(false)}
                className="hover:bg-purple-100"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-semibold bg-gray-50">Transaction Type</th>
                      <th className="text-right p-3 font-semibold bg-gray-50">Amount</th>
                      <th className="text-right p-3 font-semibold bg-gray-50">Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialData.adSpendBreakdown && financialData.adSpendBreakdown.length > 0 ? (
                      financialData.adSpendBreakdown.map((ad, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="p-3 font-medium text-gray-900">{ad.transactionType}</td>
                          <td className="p-3 text-right font-semibold text-purple-600">
                            {formatCurrency(ad.amount)}
                          </td>
                          <td className="p-3 text-right text-gray-600">
                            {ad.percentage.toFixed(2)}%
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="p-8 text-center text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span className="text-sm">No ad spend breakdown data available</span>
                            <span className="text-xs text-gray-400">Check console for debugging info</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2">
                    <tr>
                      <td className="p-3 font-bold text-gray-900">Total</td>
                      <td className="p-3 text-right font-bold text-purple-600">
                        {formatCurrency(financialData.totalAdSpend || 0)}
                      </td>
                      <td className="p-3 text-right font-bold text-gray-600">100.00%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Ad Spend Analysis */}
              <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Ad Spend Analysis
                </h3>
                <div className="space-y-1 text-sm text-purple-800">
                  <p>• Ad spend represents <strong>{((financialData.totalAdSpend || 0) / financialData.totalRevenue * 100).toFixed(2)}%</strong> of your total revenue</p>
                  <p>• Marketing ROI: <strong>{financialData.marketingROI?.toFixed(0)}%</strong> (Revenue generated per $1 spent on ads)</p>
                  <p>• <strong>{financialData.adSpendBreakdown?.length || 0}</strong> different ad transaction types detected</p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowAdSpendModal(false)}
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
