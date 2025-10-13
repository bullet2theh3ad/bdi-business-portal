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
      const [metricsRes, arAgingRes, customersRes, vendorsRes, invoicesRes, expensesRes] = await Promise.all([
        fetch(`/api/quickbooks/reports/metrics?days=${dateRange === 'all' ? 365 : dateRange}`),
        fetch(`/api/quickbooks/reports/ar-aging`),
        fetch(`/api/quickbooks/reports/customers`),
        fetch(`/api/quickbooks/reports/vendors`),
        fetch(`/api/quickbooks/reports/invoices?days=${dateRange === 'all' ? 365 : dateRange}`),
        fetch(`/api/quickbooks/reports/expenses?days=${dateRange === 'all' ? 365 : dateRange}`),
      ]);

      if (metricsRes.ok) setMetrics(await metricsRes.json());
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
    <div className="container mx-auto p-6 max-w-[1800px]">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              QuickBooks Reports
            </h1>
            <p className="text-gray-600 mt-1">
              Comprehensive financial insights and analytics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={loadAllData} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg border">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-600" />
            <Label className="text-sm font-semibold text-gray-700">Date Range:</Label>
          </div>
          <div className="flex gap-2">
            {(['30', '60', '90', 'all'] as const).map((range) => (
              <Button
                key={range}
                variant={dateRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDateRange(range)}
              >
                {range === 'all' ? 'All Time' : `Last ${range} days`}
              </Button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-600" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
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
              <div className="text-3xl font-bold text-green-600">{formatCurrency(metrics.totalRevenue)}</div>
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
              <div className="text-3xl font-bold text-blue-600">{formatCurrency(metrics.totalAR)}</div>
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
              <div className="text-3xl font-bold text-orange-600">{formatCurrency(metrics.totalExpenses)}</div>
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
              <div className="text-3xl font-bold text-red-600">{metrics.overdueInvoices}</div>
              <p className="text-xs text-gray-500 mt-2">
                Requires immediate attention
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabbed Reports */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 gap-2 h-auto p-2 bg-transparent">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg border border-blue-200 data-[state=active]:border-blue-500"
          >
            <FileText className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="ar" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-lg border border-green-200 data-[state=active]:border-green-500"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            AR Aging
          </TabsTrigger>
          <TabsTrigger 
            value="customers" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white data-[state=active]:shadow-lg border border-purple-200 data-[state=active]:border-purple-500"
          >
            <Users className="h-4 w-4 mr-2" />
            Customers
          </TabsTrigger>
          <TabsTrigger 
            value="vendors" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white data-[state=active]:shadow-lg border border-orange-200 data-[state=active]:border-orange-500"
          >
            <Building2 className="h-4 w-4 mr-2" />
            Vendors
          </TabsTrigger>
          <TabsTrigger 
            value="expenses" 
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg border border-red-200 data-[state=active]:border-red-500"
          >
            <Receipt className="h-4 w-4 mr-2" />
            Expenses
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
                <CardDescription>Key business metrics at a glance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {metrics && (
                  <>
                    <div className="flex items-center justify-between border-b pb-3">
                      <span className="text-sm text-gray-600">Active Customers</span>
                      <span className="font-bold">{metrics.activeCustomers}</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-3">
                      <span className="text-sm text-gray-600">Active Vendors</span>
                      <span className="font-bold">{metrics.activeVendors}</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-3">
                      <span className="text-sm text-gray-600">Average Invoice Value</span>
                      <span className="font-bold">{formatCurrency(metrics.avgInvoiceValue)}</span>
                    </div>
                    <div className="flex items-center justify-between border-b pb-3">
                      <span className="text-sm text-gray-600">Monthly Burn Rate</span>
                      <span className="font-bold text-orange-600">{formatCurrency(metrics.monthlyBurnRate)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Net Position (AR - AP)</span>
                      <span className={`font-bold ${metrics.totalAR - metrics.totalAP >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(metrics.totalAR - metrics.totalAP)}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Revenue vs Expenses Chart */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle>Revenue vs Expenses</CardTitle>
                <CardDescription>Financial performance comparison</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart
                    data={[
                      {
                        name: 'Financial Overview',
                        Revenue: metrics?.totalRevenue || 0,
                        Expenses: metrics?.totalExpenses || 0,
                        Outstanding: metrics?.totalAR || 0,
                      }
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" style={{ fontSize: '11px' }} />
                    <YAxis style={{ fontSize: '11px' }} />
                    <Tooltip 
                      formatter={(value: any) => formatCurrency(Number(value))}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="Revenue" fill="#10b981" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                    <Bar dataKey="Outstanding" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Customers Chart */}
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader>
                <CardTitle>Top 10 Customers by Balance</CardTitle>
                <CardDescription>Customers with highest outstanding balances</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={customers
                      .filter(c => c.balance > 0)
                      .sort((a, b) => b.balance - a.balance)
                      .slice(0, 10)
                      .map(c => ({
                        name: c.displayName.length > 12 ? c.displayName.substring(0, 12) + '...' : c.displayName,
                        fullName: c.displayName,
                        balance: c.balance,
                        overdue: c.overdueAmount,
                      }))}
                    layout="vertical"
                    margin={{ left: 120, right: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" style={{ fontSize: '11px' }} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={110} 
                      style={{ fontSize: '11px' }}
                      tick={{ fill: '#374151' }}
                    />
                    <Tooltip 
                      formatter={(value: any) => formatCurrency(Number(value))}
                      labelFormatter={(label: any, payload: any) => {
                        return payload?.[0]?.payload?.fullName || label;
                      }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="balance" fill="#8b5cf6" name="Total Balance" radius={[0, 8, 8, 0]} />
                    <Bar dataKey="overdue" fill="#ef4444" name="Overdue" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Vendors by Spending Chart */}
            <Card className="border-l-4 border-l-orange-500">
              <CardHeader>
                <CardTitle>Top 10 Vendors by Spending</CardTitle>
                <CardDescription>Highest vendor expenses</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={vendors
                      .sort((a, b) => b.totalSpent - a.totalSpent)
                      .slice(0, 10)
                      .map(v => ({
                        name: v.displayName.length > 12 ? v.displayName.substring(0, 12) + '...' : v.displayName,
                        fullName: v.displayName,
                        spent: v.totalSpent,
                        balance: v.balance,
                      }))}
                    layout="vertical"
                    margin={{ left: 120, right: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis type="number" style={{ fontSize: '11px' }} />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={110} 
                      style={{ fontSize: '11px' }}
                      tick={{ fill: '#374151' }}
                    />
                    <Tooltip 
                      formatter={(value: any) => formatCurrency(Number(value))}
                      labelFormatter={(label: any, payload: any) => {
                        return payload?.[0]?.payload?.fullName || label;
                      }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="spent" fill="#f97316" name="Total Spent" radius={[0, 8, 8, 0]} />
                    <Bar dataKey="balance" fill="#dc2626" name="Balance Due" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Invoices */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Invoices</CardTitle>
              <CardDescription>Latest invoices from QuickBooks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
                    <tr>
                      <th className="text-left p-3 font-semibold">Invoice #</th>
                      <th className="text-left p-3 font-semibold">Customer</th>
                      <th className="text-left p-3 font-semibold">Date</th>
                      <th className="text-left p-3 font-semibold">Due Date</th>
                      <th className="text-right p-3 font-semibold">Amount</th>
                      <th className="text-right p-3 font-semibold">Balance</th>
                      <th className="text-left p-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.slice(0, 10).map((invoice) => (
                      <tr key={invoice.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono text-xs">{invoice.docNumber}</td>
                        <td className="p-3">{invoice.customerName}</td>
                        <td className="p-3">{new Date(invoice.date).toLocaleDateString()}</td>
                        <td className="p-3">{new Date(invoice.dueDate).toLocaleDateString()}</td>
                        <td className="p-3 text-right">{formatCurrency(invoice.amount)}</td>
                        <td className="p-3 text-right font-semibold">{formatCurrency(invoice.balance)}</td>
                        <td className="p-3">
                          <Badge
                            variant={
                              invoice.paymentStatus === 'Paid' ? 'default' :
                              invoice.paymentStatus === 'Partial' ? 'secondary' :
                              invoice.daysOverdue > 0 ? 'destructive' : 'outline'
                            }
                            className="text-xs"
                          >
                            {invoice.daysOverdue > 0 ? `Overdue ${invoice.daysOverdue}d` : invoice.paymentStatus}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
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
                      label={(entry: any) => `${entry.name}: ${formatCurrency(entry.value || 0)}`}
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
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
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
              <CardTitle>Top Vendor Spending</CardTitle>
              <CardDescription>Top 15 vendors by total spending</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart
                  data={vendors
                    .sort((a, b) => b.totalSpent - a.totalSpent)
                    .slice(0, 15)
                    .map(v => ({
                      name: v.displayName.length > 20 ? v.displayName.substring(0, 20) + '...' : v.displayName,
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
                    formatter={(value: any, name: string) => {
                      if (name === 'Expense Count') return value;
                      return formatCurrency(Number(value));
                    }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line type="monotone" dataKey="spent" stroke="#f97316" strokeWidth={3} dot={{ r: 6 }} name="Total Spent" />
                  <Line type="monotone" dataKey="balance" stroke="#dc2626" strokeWidth={2} dot={{ r: 4 }} name="Balance Due" />
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
                      label={(entry: any) => entry.name.length > 12 ? entry.name.substring(0, 12) + '...' : entry.name}
                      style={{ fontSize: '10px' }}
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

