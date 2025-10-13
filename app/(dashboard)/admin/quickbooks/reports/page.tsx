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
  AlertCircle
} from 'lucide-react';

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
        <TabsList className="grid w-full grid-cols-5 lg:w-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ar">AR Aging</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
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

            {/* Top Customers */}
            <Card>
              <CardHeader>
                <CardTitle>Top Customers by Balance</CardTitle>
                <CardDescription>Customers with outstanding balances</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {customers
                    .filter(c => c.balance > 0)
                    .sort((a, b) => b.balance - a.balance)
                    .slice(0, 5)
                    .map((customer) => (
                      <div key={customer.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                        <div>
                          <p className="font-medium text-sm">{customer.displayName}</p>
                          <p className="text-xs text-gray-500">{customer.totalInvoices} invoices</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-600">{formatCurrency(customer.balance)}</p>
                          {customer.overdueAmount > 0 && (
                            <p className="text-xs text-red-600">Overdue: {formatCurrency(customer.overdueAmount)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  {customers.filter(c => c.balance > 0).length === 0 && (
                    <p className="text-center text-gray-500 py-4">No outstanding balances</p>
                  )}
                </div>
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
        <TabsContent value="ar">
          <Card>
            <CardHeader>
              <CardTitle>Accounts Receivable Aging Report</CardTitle>
              <CardDescription>Outstanding invoices by age buckets</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {arAging.map((bucket, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-lg">{bucket.label}</h3>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{formatCurrency(bucket.amount)}</p>
                        <p className="text-xs text-gray-500">{bucket.count} invoice{bucket.count !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
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
        <TabsContent value="customers">
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
        <TabsContent value="vendors">
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
        <TabsContent value="expenses">
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

