'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Users, 
  FileText,
  Building2,
  Receipt,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
  PieChart as PieChartIcon
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
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

interface FinancialMetrics {
  totalRevenue: number;
  totalAR: number;
  totalAP: number;
  totalExpenses: number;
  activeCustomers: number;
  activeVendors: number;
  unpaidInvoices: number;
  overdueInvoices: number;
  avgInvoiceValue: number;
  monthlyBurnRate: number;
}

interface MasterMetrics {
  summary: {
    netRevenue: number;
    totalInvoiceRevenue: number;
    totalSalesReceiptRevenue: number;
    totalCreditMemos: number;
    totalPaymentsReceived: number;
    totalExpensesPaid: number;
    netCashFlow: number;
    totalAR: number;
    totalAP: number;
    netPosition: number;
    totalOpenPOValue: number;
    totalUnpaidBills: number;
    availableCredits: number;
    avgInvoiceValue: number;
    avgPaymentValue: number;
    avgBillValue: number;
    activeCustomers: number;
    activeVendors: number;
    openPOsCount: number;
    unpaidBillsCount: number;
  };
  timelines: {
    revenue: Array<{ week: string; invoices: number; salesReceipts: number; credits: number }>;
    cashFlow: Array<{ week: string; inflow: number; outflow: number }>;
  };
  top: {
    customers: Array<{ name: string; revenue: number }>;
    vendors: Array<{ name: string; spend: number }>;
  };
  cashFlowBreakdown: {
    inflows: { payments: number; salesReceipts: number };
    outflows: { expenses: number; bills: number };
  };
}

interface ARAgingBucket {
  label: string;
  amount: number;
  count: number;
  percentage: number;
}

interface Customer {
  id: string;
  displayName: string;
  email: string;
  balance: number;
  totalInvoices: number;
  paidInvoices: number;
  overdueAmount: number;
}

interface Vendor {
  id: string;
  displayName: string;
  email: string;
  balance: number;
  totalSpent: number;
  expenseCount: number;
}

interface Invoice {
  id: string;
  docNumber: string;
  customerName: string;
  date: string;
  dueDate: string;
  amount: number;
  balance: number;
  status: string;
  paymentStatus: string;
  daysOverdue: number;
}

interface Expense {
  id: string;
  vendorName: string;
  date: string;
  amount: number;
  paymentType: string;
  category: string;
}

export default function QuickBooksReportsPage() {
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [masterMetrics, setMasterMetrics] = useState<MasterMetrics | null>(null);
  const [arAging, setARAging] = useState<ARAgingBucket[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [dateRange, setDateRange] = useState<'30' | '60' | '90' | 'all'>('60');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadAllData();
  }, [dateRange]);

  async function loadAllData() {
    try {
      setLoading(true);
      setError(null);
      
      // Load all data in parallel
      const [metricsRes, masterMetricsRes, arAgingRes, customersRes, vendorsRes, invoicesRes, expensesRes] = await Promise.all([
        fetch(`/api/quickbooks/reports/metrics?days=${dateRange === 'all' ? 365 : dateRange}`),
        fetch(`/api/quickbooks/reports/master-metrics`),
        fetch(`/api/quickbooks/reports/ar-aging`),
        fetch(`/api/quickbooks/reports/customers`),
        fetch(`/api/quickbooks/reports/vendors`),
        fetch(`/api/quickbooks/reports/invoices?days=${dateRange === 'all' ? 365 : dateRange}`),
        fetch(`/api/quickbooks/reports/expenses?days=${dateRange === 'all' ? 365 : dateRange}`),
      ]);

      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (masterMetricsRes.ok) setMasterMetrics(await masterMetricsRes.json());
      if (arAgingRes.ok) setARAging(await arAgingRes.json());
      if (customersRes.ok) setCustomers(await customersRes.json());
      if (vendorsRes.ok) setVendors(await vendorsRes.json());
      if (invoicesRes.ok) setInvoices(await invoicesRes.json());
      if (expensesRes.ok) setExpenses(await expensesRes.json());
      
    } catch (err) {
      console.error('Error loading reports:', err);
      setError('Failed to load reports. Please try again.');
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

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
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
              <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
              <span>QuickBooks Reports</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Comprehensive financial insights and analytics
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button onClick={loadAllData} variant="outline" size="sm" className="flex-1 sm:flex-none">
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-gray-50 p-4 rounded-lg border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-600 flex-shrink-0" />
              <Label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Date Range:</Label>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['30', '60', '90', 'all'] as const).map((range) => (
                <Button
                  key={range}
                  variant={dateRange === range ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDateRange(range)}
                  className="text-xs sm:text-sm"
                >
                  {range === 'all' ? 'All Time' : `${range}d`}
                  <span className="hidden sm:inline">{range === 'all' ? '' : 'ays'}</span>
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-600 flex-shrink-0" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Financial Overview Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-green-600 break-words">{formatCurrency(metrics.totalRevenue)}</div>
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Avg: {formatCurrency(metrics.avgInvoiceValue)}/invoice
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Outstanding AR</CardTitle>
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-blue-600 break-words">{formatCurrency(metrics.totalAR)}</div>
              <p className="text-xs text-gray-500 mt-2">
                {metrics.unpaidInvoices} unpaid invoice{metrics.unpaidInvoices !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Total Expenses</CardTitle>
                <Receipt className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-orange-600 break-words">{formatCurrency(metrics.totalExpenses)}</div>
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                Burn: {formatCurrency(metrics.monthlyBurnRate)}/month
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Overdue Invoices</CardTitle>
                <AlertCircle className="h-4 w-4 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl lg:text-3xl font-bold text-red-600 break-words">{metrics.overdueInvoices}</div>
              <p className="text-xs text-gray-500 mt-2">
                Requires immediate attention
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabbed Reports */}
      <Tabs defaultValue="overview" className="space-y-6">
        <div className="overflow-x-auto pb-2">
          <TabsList className="inline-flex w-full lg:grid lg:grid-cols-5 gap-2 h-auto p-2 bg-transparent min-w-max lg:min-w-0">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg border border-blue-200 data-[state=active]:border-blue-500 whitespace-nowrap"
            >
              <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">Overview</span>
              <span className="sm:hidden">Overview</span>
            </TabsTrigger>
            <TabsTrigger 
              value="ar" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-lg border border-green-200 data-[state=active]:border-green-500 whitespace-nowrap"
            >
              <TrendingUp className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">AR Aging</span>
              <span className="sm:hidden">AR</span>
            </TabsTrigger>
            <TabsTrigger 
              value="customers" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg border border-purple-200 data-[state=active]:border-purple-500 whitespace-nowrap"
            >
              <Users className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>Customers</span>
            </TabsTrigger>
            <TabsTrigger 
              value="vendors" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-lg border border-orange-200 data-[state=active]:border-orange-500 whitespace-nowrap"
            >
              <Building2 className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>Vendors</span>
            </TabsTrigger>
            <TabsTrigger 
              value="expenses" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg border border-red-200 data-[state=active]:border-red-500 whitespace-nowrap"
            >
              <Receipt className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>Expenses</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab - MASTER FINANCIAL DASHBOARD */}
        <TabsContent value="overview" className="space-y-6">
          {masterMetrics && (
            <>
              {/* Executive KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                <Card className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-gray-600">Net Revenue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm sm:text-base lg:text-lg font-bold text-green-600 break-words">{formatCurrency(masterMetrics.summary.netRevenue)}</div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-gray-600">Cash Flow</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-sm sm:text-base lg:text-lg font-bold break-words ${masterMetrics.summary.netCashFlow >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatCurrency(masterMetrics.summary.netCashFlow)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-purple-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-gray-600">Net Position</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-sm sm:text-base lg:text-lg font-bold break-words ${masterMetrics.summary.netPosition >= 0 ? 'text-purple-600' : 'text-red-600'}`}>
                      {formatCurrency(masterMetrics.summary.netPosition)}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-orange-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-gray-600">Total AR</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm sm:text-base lg:text-lg font-bold text-orange-600 break-words">{formatCurrency(masterMetrics.summary.totalAR)}</div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-red-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-gray-600">Total AP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm sm:text-base lg:text-lg font-bold text-red-600 break-words">{formatCurrency(masterMetrics.summary.totalAP)}</div>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-yellow-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-gray-600">Open POs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm sm:text-base lg:text-lg font-bold text-yellow-600 break-words">{formatCurrency(masterMetrics.summary.totalOpenPOValue)}</div>
                    <p className="text-xs text-gray-500">{masterMetrics.summary.openPOsCount} orders</p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-pink-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-gray-600">Unpaid Bills</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm sm:text-base lg:text-lg font-bold text-pink-600 break-words">{formatCurrency(masterMetrics.summary.totalUnpaidBills)}</div>
                    <p className="text-xs text-gray-500">{masterMetrics.summary.unpaidBillsCount} bills</p>
                  </CardContent>
                </Card>

                <Card className="border-l-4 border-l-indigo-500">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-gray-600">Credits Available</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm sm:text-base lg:text-lg font-bold text-indigo-600 break-words">{formatCurrency(masterMetrics.summary.availableCredits)}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Revenue Timeline - Stacked Area Chart */}
              <Card className="border-l-4 border-l-green-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    Revenue Timeline (Last 12 Weeks)
                  </CardTitle>
                  <CardDescription>Invoices + Sales Receipts - Credit Memos</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={masterMetrics.timelines.revenue}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="week" 
                        tickFormatter={(week) => new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        style={{ fontSize: '11px' }}
                      />
                      <YAxis 
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        style={{ fontSize: '11px' }}
                      />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), '']}
                        labelFormatter={(week) => `Week of ${new Date(week).toLocaleDateString()}`}
                        contentStyle={{ fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Area type="monotone" dataKey="invoices" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Invoices" />
                      <Area type="monotone" dataKey="salesReceipts" stackId="1" stroke="#10b981" fill="#10b981" name="Sales Receipts" />
                      <Area type="monotone" dataKey="credits" stackId="2" stroke="#ef4444" fill="#ef4444" name="Credit Memos" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Cash Flow Timeline - Dual Line Chart */}
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                    Cash Flow Timeline (Last 12 Weeks)
                  </CardTitle>
                  <CardDescription>Payments received vs expenses paid</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={masterMetrics.timelines.cashFlow}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="week" 
                        tickFormatter={(week) => new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        style={{ fontSize: '11px' }}
                      />
                      <YAxis 
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                        style={{ fontSize: '11px' }}
                      />
                      <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), '']}
                        labelFormatter={(week) => `Week of ${new Date(week).toLocaleDateString()}`}
                        contentStyle={{ fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Line type="monotone" dataKey="inflow" stroke="#10b981" strokeWidth={3} name="Cash Inflow" />
                      <Line type="monotone" dataKey="outflow" stroke="#ef4444" strokeWidth={3} name="Cash Outflow" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Combined Row: AR vs AP + Cash Flow Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* AR vs AP Comparison */}
                <Card className="border-l-4 border-l-purple-500">
                  <CardHeader>
                    <CardTitle>AR vs AP Comparison</CardTitle>
                    <CardDescription>Accounts receivable vs accounts payable</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={[
                          { name: 'Receivable', AR: masterMetrics.summary.totalAR, AP: 0 },
                          { name: 'Payable', AR: 0, AP: masterMetrics.summary.totalAP },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="name" style={{ fontSize: '11px' }} />
                        <YAxis 
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                          style={{ fontSize: '11px' }}
                        />
                        <Tooltip 
                          formatter={(value: number) => [formatCurrency(value), '']}
                          contentStyle={{ fontSize: '12px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="AR" fill="#8b5cf6" name="Accounts Receivable" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="AP" fill="#ef4444" name="Accounts Payable" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Cash Flow Breakdown */}
                <Card className="border-l-4 border-l-cyan-500">
                  <CardHeader>
                    <CardTitle>Cash Flow Breakdown</CardTitle>
                    <CardDescription>Inflows vs outflows</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={[
                          { category: 'Inflows', Payments: masterMetrics.cashFlowBreakdown.inflows.payments, SalesReceipts: masterMetrics.cashFlowBreakdown.inflows.salesReceipts },
                          { category: 'Outflows', Expenses: masterMetrics.cashFlowBreakdown.outflows.expenses, Bills: masterMetrics.cashFlowBreakdown.outflows.bills },
                        ]}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="category" style={{ fontSize: '11px' }} />
                        <YAxis 
                          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                          style={{ fontSize: '11px' }}
                        />
                        <Tooltip 
                          formatter={(value: number) => [formatCurrency(value), '']}
                          contentStyle={{ fontSize: '12px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="Payments" fill="#10b981" stackId="a" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="SalesReceipts" fill="#3b82f6" stackId="a" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="Expenses" fill="#f97316" stackId="a" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="Bills" fill="#ef4444" stackId="a" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Top 10 Combined - Customers & Vendors */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Customers by Total Revenue */}
                <Card className="border-l-4 border-l-green-500">
                  <CardHeader>
                    <CardTitle>Top 10 Customers by Revenue</CardTitle>
                    <CardDescription>Combined: Invoices + Sales Receipts - Credits</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart
                        data={masterMetrics.top.customers.map(c => ({
                          name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
                          fullName: c.name,
                          revenue: c.revenue,
                        }))}
                        layout="vertical"
                        margin={{ left: 120, right: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" style={{ fontSize: '11px' }} />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          width={110}
                          style={{ fontSize: '11px' }}
                        />
                        <Tooltip 
                          formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                          labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.fullName || label}
                          contentStyle={{ fontSize: '12px' }}
                        />
                        <Bar dataKey="revenue" fill="#10b981" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Top Vendors by Total Spend */}
                <Card className="border-l-4 border-l-orange-500">
                  <CardHeader>
                    <CardTitle>Top 10 Vendors by Spend</CardTitle>
                    <CardDescription>Combined: Expenses + Bills + POs</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart
                        data={masterMetrics.top.vendors.map(v => ({
                          name: v.name.length > 15 ? v.name.substring(0, 15) + '...' : v.name,
                          fullName: v.name,
                          spend: v.spend,
                        }))}
                        layout="vertical"
                        margin={{ left: 120, right: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis type="number" style={{ fontSize: '11px' }} />
                        <YAxis 
                          type="category" 
                          dataKey="name" 
                          width={110}
                          style={{ fontSize: '11px' }}
                        />
                        <Tooltip 
                          formatter={(value: number) => [formatCurrency(value), 'Spend']}
                          labelFormatter={(label: any, payload: any) => payload?.[0]?.payload?.fullName || label}
                          contentStyle={{ fontSize: '12px' }}
                        />
                        <Bar dataKey="spend" fill="#f97316" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          {!masterMetrics && (
            <Card>
              <CardContent className="pt-6">
                <p className="text-gray-600 text-center">Loading master financial dashboard...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* AR Aging Tab */}
        <TabsContent value="ar" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* AR Aging Pie Chart */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle>AR Aging Distribution</CardTitle>
                <CardDescription>Outstanding invoices by age buckets</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <PieChart>
                    <Pie
                      data={arAging.map((bucket, index) => ({
                        name: bucket.label,
                        value: bucket.amount,
                        count: bucket.count,
                      }))}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={120}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {arAging.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={
                            index === 0 ? '#10b981' :
                            index === 1 ? '#fbbf24' :
                            index === 2 ? '#f97316' : '#ef4444'
                          } 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => formatCurrency(Number(value))}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '11px' }}
                      formatter={(value, entry: any) => {
                        const data = entry.payload;
                        return `${value}: ${formatCurrency(data.value || 0)}`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* AR Aging Bar Chart */}
            <Card className="border-l-4 border-l-green-500">
              <CardHeader>
                <CardTitle>AR Aging Details</CardTitle>
                <CardDescription>Amount and count by bucket</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={arAging.map((bucket, index) => ({
                      label: bucket.label,
                      amount: bucket.amount,
                      count: bucket.count,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="label" 
                      angle={-45} 
                      textAnchor="end" 
                      height={100} 
                      style={{ fontSize: '11px' }}
                    />
                    <YAxis yAxisId="left" orientation="left" stroke="#10b981" style={{ fontSize: '11px' }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" style={{ fontSize: '11px' }} />
                    <Tooltip 
                      formatter={(value: any, name: string) => {
                        if (name === 'Amount') return formatCurrency(Number(value));
                        return value;
                      }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar yAxisId="left" dataKey="amount" fill="#10b981" name="Amount" radius={[8, 8, 0, 0]} />
                    <Bar yAxisId="right" dataKey="count" fill="#3b82f6" name="Invoice Count" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* AR Aging Details Cards */}
          <Card>
            <CardHeader>
              <CardTitle>Aging Buckets Breakdown</CardTitle>
              <CardDescription>Detailed view of each aging bucket</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {arAging.map((bucket, index) => (
                  <div 
                    key={index} 
                    className={`border-2 rounded-lg p-4 ${
                      index === 0 ? 'border-green-300 bg-green-50' :
                      index === 1 ? 'border-yellow-300 bg-yellow-50' :
                      index === 2 ? 'border-orange-300 bg-orange-50' : 'border-red-300 bg-red-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">{bucket.label}</h3>
                      <div className={`w-3 h-3 rounded-full ${
                        index === 0 ? 'bg-green-500' :
                        index === 1 ? 'bg-yellow-500' :
                        index === 2 ? 'bg-orange-500' : 'bg-red-500'
                      }`} />
                    </div>
                    <p className={`text-2xl font-bold mb-1 ${
                      index === 0 ? 'text-green-700' :
                      index === 1 ? 'text-yellow-700' :
                      index === 2 ? 'text-orange-700' : 'text-red-700'
                    }`}>
                      {formatCurrency(bucket.amount)}
                    </p>
                    <p className="text-xs text-gray-600">{bucket.count} invoice{bucket.count !== 1 ? 's' : ''}</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full ${
                          index === 0 ? 'bg-green-500' :
                          index === 1 ? 'bg-yellow-500' :
                          index === 2 ? 'bg-orange-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${bucket.percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{bucket.percentage.toFixed(1)}% of total AR</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-6">
          {/* Customer Balance Distribution */}
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader>
              <CardTitle>Customer Balance Distribution</CardTitle>
              <CardDescription>Top 15 customers by outstanding balance</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart
                  data={customers
                    .filter(c => c.balance > 0)
                    .sort((a, b) => b.balance - a.balance)
                    .slice(0, 15)
                    .map(c => ({
                      name: c.displayName.length > 20 ? c.displayName.substring(0, 20) + '...' : c.displayName,
                      balance: c.balance,
                      overdue: c.overdueAmount,
                    }))}
                >
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                    </linearGradient>
                    <linearGradient id="colorOverdue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={120} 
                    style={{ fontSize: '10px' }}
                    interval={0}
                  />
                  <YAxis style={{ fontSize: '11px' }} />
                  <Tooltip 
                    formatter={(value: any) => formatCurrency(Number(value))}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="balance" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorBalance)" name="Total Balance" />
                  <Area type="monotone" dataKey="overdue" stroke="#ef4444" fillOpacity={1} fill="url(#colorOverdue)" name="Overdue" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Customer Table */}
          <Card>
            <CardHeader>
              <CardTitle>Customer List</CardTitle>
              <CardDescription>All customers with balances and payment history</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-semibold">Customer</th>
                      <th className="text-left p-3 font-semibold">Email</th>
                      <th className="text-right p-3 font-semibold">Balance</th>
                      <th className="text-right p-3 font-semibold">Total Invoices</th>
                      <th className="text-right p-3 font-semibold">Paid</th>
                      <th className="text-right p-3 font-semibold">Overdue Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers
                      .filter(c => !searchQuery || c.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((customer) => (
                      <tr key={customer.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{customer.displayName}</td>
                        <td className="p-3 text-gray-600">{customer.email || '—'}</td>
                        <td className="p-3 text-right font-semibold text-blue-600">{formatCurrency(customer.balance)}</td>
                        <td className="p-3 text-right">{customer.totalInvoices}</td>
                        <td className="p-3 text-right text-green-600">{customer.paidInvoices}</td>
                        <td className="p-3 text-right">
                          {customer.overdueAmount > 0 ? (
                            <span className="text-red-600 font-semibold">{formatCurrency(customer.overdueAmount)}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendors Tab */}
        <TabsContent value="vendors" className="space-y-6">
          {/* Vendor Spending Chart */}
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader>
              <CardTitle>Top Vendors by Balance Due</CardTitle>
              <CardDescription>Top 15 vendors by outstanding balance (AP)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={vendors
                    .filter(v => v.balance > 0 || v.totalSpent > 0)
                    .sort((a, b) => b.balance - a.balance)
                    .slice(0, 15)
                    .map(v => ({
                      name: v.displayName.length > 20 ? v.displayName.substring(0, 20) + '...' : v.displayName,
                      fullName: v.displayName,
                      spent: v.totalSpent,
                      balance: v.balance,
                      count: v.expenseCount,
                    }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    height={120} 
                    style={{ fontSize: '10px' }}
                    interval={0}
                  />
                  <YAxis style={{ fontSize: '11px' }} />
                  <Tooltip 
                    labelFormatter={(label: string, payload: any) => {
                      // Show full name in tooltip
                      if (payload && payload[0]) {
                        return payload[0].payload.fullName;
                      }
                      return label;
                    }}
                    formatter={(value: any, name: string) => {
                      if (name === 'Expense Count') return value;
                      return formatCurrency(Number(value));
                    }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="balance" stroke="#dc2626" strokeWidth={3} dot={{ r: 6 }} name="Balance Due" />
                  <Line type="monotone" dataKey="spent" stroke="#f97316" strokeWidth={2} dot={{ r: 4 }} name="Total Spent" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Vendor Table */}
          <Card>
            <CardHeader>
              <CardTitle>Vendor List</CardTitle>
              <CardDescription>All vendors with spending totals</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-semibold">Vendor</th>
                      <th className="text-left p-3 font-semibold">Email</th>
                      <th className="text-right p-3 font-semibold">Balance Due</th>
                      <th className="text-right p-3 font-semibold">Total Spent</th>
                      <th className="text-right p-3 font-semibold">Expenses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendors
                      .filter(v => !searchQuery || v.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((vendor) => (
                      <tr key={vendor.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{vendor.displayName}</td>
                        <td className="p-3 text-gray-600">{vendor.email || '—'}</td>
                        <td className="p-3 text-right text-orange-600 font-semibold">{formatCurrency(vendor.balance)}</td>
                        <td className="p-3 text-right font-semibold">{formatCurrency(vendor.totalSpent)}</td>
                        <td className="p-3 text-right">{vendor.expenseCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Expenses Over Time */}
            <Card className="border-l-4 border-l-red-500">
              <CardHeader>
                <CardTitle>Expenses Over Time</CardTitle>
                <CardDescription>Daily expense totals</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart
                    data={expenses
                      .reduce((acc: any[], expense) => {
                        const date = new Date(expense.date).toLocaleDateString();
                        const existing = acc.find(item => item.date === date);
                        if (existing) {
                          existing.amount += expense.amount;
                          existing.count += 1;
                        } else {
                          acc.push({ date, amount: expense.amount, count: 1 });
                        }
                        return acc;
                      }, [])
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                      .slice(-30) // Last 30 days
                    }
                  >
                    <defs>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      angle={-45} 
                      textAnchor="end" 
                      height={80} 
                      style={{ fontSize: '10px' }}
                      interval={'preserveStartEnd'}
                    />
                    <YAxis style={{ fontSize: '11px' }} />
                    <Tooltip 
                      formatter={(value: any, name: string) => {
                        if (name === 'Amount') return formatCurrency(Number(value));
                        return value;
                      }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Area type="monotone" dataKey="amount" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" name="Amount" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Expenses by Vendor (Pie) */}
            <Card className="border-l-4 border-l-red-500">
              <CardHeader>
                <CardTitle>Expenses by Top Vendors</CardTitle>
                <CardDescription>Distribution of spending</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={(() => {
                        const vendorTotals = expenses.reduce((acc: any, expense) => {
                          const vendor = expense.vendorName || 'Unknown';
                          if (!acc[vendor]) acc[vendor] = 0;
                          acc[vendor] += expense.amount;
                          return acc;
                        }, {});
                        
                        return Object.entries(vendorTotals)
                          .sort(([, a]: any, [, b]: any) => b - a)
                          .slice(0, 8)
                          .map(([name, value]) => ({ name, value }));
                      })()}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={false}
                    >
                      {expenses.map((_, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={[
                            '#ef4444', '#f97316', '#f59e0b', '#eab308', 
                            '#84cc16', '#22c55e', '#10b981', '#14b8a6'
                          ][index % 8]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: any) => formatCurrency(Number(value))}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '10px' }}
                      formatter={(value, entry: any) => {
                        const data = entry.payload;
                        const shortName = value.length > 15 ? value.substring(0, 15) + '...' : value;
                        return `${shortName}: ${formatCurrency(data.value || 0)}`;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Expense Table */}
          <Card>
            <CardHeader>
              <CardTitle>Expense List</CardTitle>
              <CardDescription>All expenses and purchases</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-semibold">Date</th>
                      <th className="text-left p-3 font-semibold">Vendor</th>
                      <th className="text-left p-3 font-semibold">Category</th>
                      <th className="text-left p-3 font-semibold">Payment Type</th>
                      <th className="text-right p-3 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses
                      .filter(e => !searchQuery || e.vendorName?.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((expense) => (
                      <tr key={expense.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">{new Date(expense.date).toLocaleDateString()}</td>
                        <td className="p-3 font-medium">{expense.vendorName || '—'}</td>
                        <td className="p-3">{expense.category || '—'}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">
                            {expense.paymentType}
                          </Badge>
                        </td>
                        <td className="p-3 text-right font-semibold">{formatCurrency(expense.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

