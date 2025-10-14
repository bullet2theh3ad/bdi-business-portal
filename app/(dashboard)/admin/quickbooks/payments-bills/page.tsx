'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  Search,
  RefreshCw,
  Download,
  Loader2,
  AlertCircle,
  CreditCard,
  Receipt,
  TrendingUp,
  TrendingDown,
  Calendar,
  PieChart as PieChartIcon
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

interface Payment {
  id: string;
  qb_payment_id: string;
  customer_name: string | null;
  payment_date: string;
  total_amount: number;
  unapplied_amount: number;
  payment_method: string | null;
  reference_number: string | null;
  created_at: string;
}

interface Bill {
  id: string;
  qb_bill_id: string;
  vendor_name: string | null;
  bill_number: string | null;
  bill_date: string;
  due_date: string | null;
  total_amount: number;
  balance: number;
  payment_status: string | null;
  created_at: string;
}

const COLORS = {
  green: ['#10b981', '#059669', '#047857', '#065f46'],
  red: ['#ef4444', '#dc2626', '#b91c1c', '#991b1b'],
  blue: ['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'],
  purple: ['#a855f7', '#9333ea', '#7e22ce', '#6b21a8'],
  orange: ['#f97316', '#ea580c', '#c2410c', '#9a3412'],
};

export default function PaymentsBillsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      
      const [paymentsRes, billsRes] = await Promise.all([
        fetch('/api/quickbooks/payments'),
        fetch('/api/quickbooks/bills'),
      ]);
      
      if (paymentsRes.ok) {
        const paymentsData = await paymentsRes.json();
        setPayments(paymentsData.payments || []);
      }
      
      if (billsRes.ok) {
        const billsData = await billsRes.json();
        setBills(billsData.bills || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load payments and bills');
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

  function getStatusColor(status: string): string {
    switch (status) {
      case 'Paid': return 'bg-green-100 text-green-800 border-green-300';
      case 'Partial': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Unpaid': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  // Filter payments by search query
  const filteredPayments = payments.filter(payment => {
    const searchLower = searchQuery.toLowerCase();
    return !searchQuery || 
      (payment.customer_name && payment.customer_name.toLowerCase().includes(searchLower)) ||
      (payment.reference_number && payment.reference_number.toLowerCase().includes(searchLower)) ||
      (payment.payment_method && payment.payment_method.toLowerCase().includes(searchLower));
  });

  // Filter bills by search query
  const filteredBills = bills.filter(bill => {
    const searchLower = searchQuery.toLowerCase();
    return !searchQuery || 
      (bill.vendor_name && bill.vendor_name.toLowerCase().includes(searchLower)) ||
      (bill.bill_number && bill.bill_number.toLowerCase().includes(searchLower));
  });

  // Calculate totals
  const totalPayments = payments.reduce((sum, p) => sum + p.total_amount, 0);
  const totalBillsAmount = bills.reduce((sum, b) => sum + b.total_amount, 0);
  const totalBillsBalance = bills.reduce((sum, b) => sum + b.balance, 0);
  const paidBillsCount = bills.filter(b => b.payment_status === 'Paid').length;

  // Prepare chart data - Payments by method
  const paymentsByMethod = payments.reduce((acc, payment) => {
    const method = payment.payment_method || 'Unknown';
    if (!acc[method]) {
      acc[method] = { method, amount: 0, count: 0 };
    }
    acc[method].amount += payment.total_amount;
    acc[method].count += 1;
    return acc;
  }, {} as Record<string, { method: string; amount: number; count: number }>);

  const paymentMethodData = Object.values(paymentsByMethod).sort((a, b) => b.amount - a.amount);

  // Prepare chart data - Payments over time (last 30 days grouped by week)
  const paymentsOverTime = payments.reduce((acc, payment) => {
    const date = new Date(payment.payment_date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start of week
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!acc[weekKey]) {
      acc[weekKey] = { date: weekKey, amount: 0, count: 0 };
    }
    acc[weekKey].amount += payment.total_amount;
    acc[weekKey].count += 1;
    return acc;
  }, {} as Record<string, { date: string; amount: number; count: number }>);

  const paymentTimelineData = Object.values(paymentsOverTime)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8); // Last 8 weeks

  // Prepare chart data - Bills by status
  const billsByStatus = bills.reduce((acc, bill) => {
    const status = bill.payment_status || 'Unpaid';
    if (!acc[status]) {
      acc[status] = { status, amount: 0, count: 0 };
    }
    acc[status].amount += bill.total_amount;
    acc[status].count += 1;
    return acc;
  }, {} as Record<string, { status: string; amount: number; count: number }>);

  const billStatusData = Object.values(billsByStatus);

  // Prepare chart data - Bills aging
  const billsAging = bills.reduce((acc, bill) => {
    const dueDate = bill.due_date ? new Date(bill.due_date) : null;
    const today = new Date();
    
    let agingCategory = 'Current';
    if (dueDate && bill.balance > 0) {
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysOverdue > 90) {
        agingCategory = '90+ days';
      } else if (daysOverdue > 60) {
        agingCategory = '61-90 days';
      } else if (daysOverdue > 30) {
        agingCategory = '31-60 days';
      } else if (daysOverdue > 0) {
        agingCategory = '1-30 days';
      }
    }
    
    if (!acc[agingCategory]) {
      acc[agingCategory] = { category: agingCategory, amount: 0, count: 0 };
    }
    acc[agingCategory].amount += bill.balance;
    acc[agingCategory].count += 1;
    return acc;
  }, {} as Record<string, { category: string; amount: number; count: number }>);

  const billAgingData = ['Current', '1-30 days', '31-60 days', '61-90 days', '90+ days']
    .map(cat => billsAging[cat] || { category: cat, amount: 0, count: 0 });

  // Top customers by payment amount
  const customerPayments = payments.reduce((acc, payment) => {
    // Use customer_name if available, otherwise use 'Unknown Customer'
    const customer = payment.customer_name || 'Unknown Customer';
    if (!acc[customer]) {
      acc[customer] = 0;
    }
    acc[customer] += payment.total_amount;
    return acc;
  }, {} as Record<string, number>);

  const topCustomersData = Object.entries(customerPayments)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-green-600 mb-4" />
          <p className="text-gray-600">Loading payments and bills...</p>
        </div>
      </div>
    );
  }

  if (error) {
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
              <DollarSign className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 flex-shrink-0" />
              <span>Payments & Bills Analytics</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Cash flow and accounts payable insights from QuickBooks
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button onClick={loadData} variant="outline" size="sm" className="flex-1 sm:flex-none">
              <RefreshCw className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
              <Download className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Payments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{payments.length}</div>
              <p className="text-xs text-gray-500 mt-1">{formatCurrency(totalPayments)}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Bills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{bills.length}</div>
              <p className="text-xs text-gray-500 mt-1">{formatCurrency(totalBillsAmount)}</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Outstanding</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatCurrency(totalBillsBalance)}</div>
              <p className="text-xs text-gray-500 mt-1">Amount due</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Paid Bills</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{paidBillsCount}</div>
              <p className="text-xs text-gray-500 mt-1">Fully paid</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card className="bg-gray-50">
          <CardContent className="pt-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search
              </Label>
              <Input
                placeholder="Search by customer, vendor, or reference..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs with Gradient Colors */}
      <Tabs defaultValue="payments" className="space-y-6">
        <div className="overflow-x-auto pb-2">
          <TabsList className="inline-flex w-full lg:grid lg:grid-cols-2 gap-2 h-auto p-2 bg-transparent min-w-max lg:min-w-0">
            <TabsTrigger 
              value="payments" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white data-[state=active]:shadow-lg border border-green-200 data-[state=active]:border-green-500 whitespace-nowrap"
            >
              <CreditCard className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>Payments Analytics ({filteredPayments.length})</span>
            </TabsTrigger>
            <TabsTrigger 
              value="bills" 
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-red-500 data-[state=active]:to-red-600 data-[state=active]:text-white data-[state=active]:shadow-lg border border-red-200 data-[state=active]:border-red-500 whitespace-nowrap"
            >
              <Receipt className="h-4 w-4 mr-2 flex-shrink-0" />
              <span>Bills Analytics ({filteredBills.length})</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-6">
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payments Over Time */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-green-600" />
                  Payments Timeline
                </CardTitle>
                <CardDescription>Payment amounts by week</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={paymentTimelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      style={{ fontSize: '11px' }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      style={{ fontSize: '11px' }}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Amount']}
                      labelFormatter={(date) => `Week of ${new Date(date).toLocaleDateString()}`}
                      contentStyle={{ fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={3} name="Payment Amount" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Payment Methods Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-green-600" />
                  Payment Methods
                </CardTitle>
                <CardDescription>Distribution by payment method</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentMethodData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {paymentMethodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS.green[index % COLORS.green.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontSize: '12px' }} />
                    <Legend 
                      formatter={(value, entry: any) => `${entry.payload.method}: ${formatCurrency(entry.payload.amount)}`}
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Bills Analytics - Comprehensive View */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-blue-600" />
                  Bills Analytics Overview
                </CardTitle>
                <CardDescription>Total bills breakdown: Amount vs Balance vs Payment Status</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    {
                      category: 'Total Amount',
                      amount: totalBillsAmount,
                      color: '#3b82f6'
                    },
                    {
                      category: 'Outstanding Balance',
                      amount: totalBillsBalance,
                      color: '#ef4444'
                    },
                    {
                      category: 'Paid Amount',
                      amount: totalBillsAmount - totalBillsBalance,
                      color: '#10b981'
                    }
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
                
                {/* Summary Stats */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-xs text-blue-600 font-medium">Total Bills</div>
                    <div className="text-sm font-bold text-blue-800">{formatCurrency(totalBillsAmount)}</div>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg">
                    <div className="text-xs text-red-600 font-medium">Outstanding</div>
                    <div className="text-sm font-bold text-red-800">{formatCurrency(totalBillsBalance)}</div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-xs text-green-600 font-medium">Paid</div>
                    <div className="text-sm font-bold text-green-800">{formatCurrency(totalBillsAmount - totalBillsBalance)}</div>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <div className="text-xs text-orange-600 font-medium">Payment Rate</div>
                    <div className="text-sm font-bold text-orange-800">
                      {totalBillsAmount > 0 ? `${(((totalBillsAmount - totalBillsBalance) / totalBillsAmount) * 100).toFixed(1)}%` : '0%'}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payments Table */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Payments</CardTitle>
              <CardDescription>
                Showing {filteredPayments.length} of {payments.length} payments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold">Date</th>
                      <th className="text-left p-3 font-semibold">Customer</th>
                      <th className="text-right p-3 font-semibold">Amount</th>
                      <th className="text-left p-3 font-semibold hidden md:table-cell">Method</th>
                      <th className="text-left p-3 font-semibold hidden sm:table-cell">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-gray-500">
                          No payments found
                        </td>
                      </tr>
                    ) : (
                      filteredPayments.map((payment) => (
                        <tr key={payment.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="p-3 text-gray-900">{formatDate(payment.payment_date)}</td>
                          <td className="p-3 font-medium text-gray-900">
                            {payment.customer_name || 'N/A'}
                          </td>
                          <td className="p-3 text-right font-semibold text-green-600">
                            {formatCurrency(payment.total_amount)}
                          </td>
                          <td className="p-3 hidden md:table-cell">
                            {payment.payment_method ? (
                              <Badge variant="outline" className="text-xs">
                                {payment.payment_method}
                              </Badge>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="p-3 text-gray-600 hidden sm:table-cell">
                            {payment.reference_number || '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bills Tab */}
        <TabsContent value="bills" className="space-y-6">
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bills by Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5 text-red-600" />
                  Bills by Status
                </CardTitle>
                <CardDescription>Payment status breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={billStatusData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="amount"
                    >
                      {billStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS.red[index % COLORS.red.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ fontSize: '12px' }} />
                    <Legend 
                      formatter={(value, entry: any) => `${entry.payload.status}: ${formatCurrency(entry.payload.amount)}`}
                      wrapperStyle={{ fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Bills Aging Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  Bills Aging
                </CardTitle>
                <CardDescription>Outstanding bills by due date</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={billAgingData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="category"
                      style={{ fontSize: '11px' }}
                    />
                    <YAxis 
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      style={{ fontSize: '11px' }}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Amount']}
                      contentStyle={{ fontSize: '12px' }}
                    />
                    <Bar dataKey="amount" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Bills Table */}
          <Card>
            <CardHeader>
              <CardTitle>Outstanding Bills</CardTitle>
              <CardDescription>
                Showing {filteredBills.length} of {bills.length} bills
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold">Date</th>
                      <th className="text-left p-3 font-semibold">Vendor</th>
                      <th className="text-right p-3 font-semibold">Amount</th>
                      <th className="text-right p-3 font-semibold hidden sm:table-cell">Balance</th>
                      <th className="text-left p-3 font-semibold">Status</th>
                      <th className="text-left p-3 font-semibold hidden md:table-cell">Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBills.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-500">
                          No bills found
                        </td>
                      </tr>
                    ) : (
                      filteredBills.map((bill) => (
                        <tr key={bill.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="p-3 text-gray-900">{formatDate(bill.bill_date)}</td>
                          <td className="p-3 font-medium text-gray-900">
                            {bill.vendor_name || 'N/A'}
                          </td>
                          <td className="p-3 text-right font-semibold text-gray-900">
                            {formatCurrency(bill.total_amount)}
                          </td>
                          <td className="p-3 text-right text-red-600 font-semibold hidden sm:table-cell">
                            {formatCurrency(bill.balance)}
                          </td>
                          <td className="p-3">
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getStatusColor(bill.payment_status || 'Unpaid')}`}
                            >
                              {bill.payment_status || 'Unpaid'}
                            </Badge>
                          </td>
                          <td className="p-3 text-gray-600 hidden md:table-cell">
                            {bill.due_date ? formatDate(bill.due_date) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
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
