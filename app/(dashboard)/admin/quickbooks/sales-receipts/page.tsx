'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  DollarSign, 
  Search,
  RefreshCw,
  Download,
  Loader2,
  AlertCircle,
  Receipt,
  TrendingUp,
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

interface SalesReceipt {
  id: string;
  qb_sales_receipt_id: string;
  customer_name: string | null;
  doc_number: string | null;
  txn_date: string;
  total_amount: number;
  payment_method_name: string | null;
  created_at: string;
}

const COLORS = {
  blue: ['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af'],
};

export default function SalesReceiptsPage() {
  const [receipts, setReceipts] = useState<SalesReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/quickbooks/sales-receipts');
      
      if (response.ok) {
        const data = await response.json();
        setReceipts(data.salesReceipts || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load sales receipts');
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

  const filteredReceipts = receipts.filter(receipt => {
    const searchLower = searchQuery.toLowerCase();
    return !searchQuery || 
      (receipt.customer_name && receipt.customer_name.toLowerCase().includes(searchLower)) ||
      (receipt.doc_number && receipt.doc_number.toLowerCase().includes(searchLower)) ||
      (receipt.payment_method_name && receipt.payment_method_name.toLowerCase().includes(searchLower));
  });

  const totalRevenue = receipts.reduce((sum, r) => sum + r.total_amount, 0);

  // Chart data - Receipts over time
  const receiptsOverTime = receipts.reduce((acc, receipt) => {
    const date = new Date(receipt.txn_date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!acc[weekKey]) {
      acc[weekKey] = { date: weekKey, amount: 0, count: 0 };
    }
    acc[weekKey].amount += receipt.total_amount;
    acc[weekKey].count += 1;
    return acc;
  }, {} as Record<string, { date: string; amount: number; count: number }>);

  const timelineData = Object.values(receiptsOverTime)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8);

  // Payment methods breakdown
  const paymentMethods = receipts.reduce((acc, receipt) => {
    const method = receipt.payment_method_name || 'Unknown';
    if (!acc[method]) {
      acc[method] = { method, amount: 0, count: 0 };
    }
    acc[method].amount += receipt.total_amount;
    acc[method].count += 1;
    return acc;
  }, {} as Record<string, { method: string; amount: number; count: number }>);

  const methodData = Object.values(paymentMethods).sort((a, b) => b.amount - a.amount);

  // Top customers
  const customerRevenue = receipts.reduce((acc, receipt) => {
    const customer = receipt.customer_name || 'Unknown';
    if (!acc[customer]) {
      acc[customer] = 0;
    }
    acc[customer] += receipt.total_amount;
    return acc;
  }, {} as Record<string, number>);

  const topCustomers = Object.entries(customerRevenue)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-gray-600">Loading sales receipts...</p>
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
              <Receipt className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
              <span>Sales Receipts Analytics</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Cash sales and receipt analytics from QuickBooks
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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Receipts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{receipts.length}</div>
              <p className="text-xs text-gray-500 mt-1">Cash sales</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</div>
              <p className="text-xs text-gray-500 mt-1">From receipts</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Avg Receipt</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {receipts.length > 0 ? formatCurrency(totalRevenue / receipts.length) : '$0.00'}
              </div>
              <p className="text-xs text-gray-500 mt-1">Average value</p>
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
                placeholder="Search by customer, doc number, or payment method..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Revenue Timeline
            </CardTitle>
            <CardDescription>Sales receipts by week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineData}>
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
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  labelFormatter={(date) => `Week of ${new Date(date).toLocaleDateString()}`}
                  contentStyle={{ fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={3} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-blue-600" />
              Payment Methods
            </CardTitle>
            <CardDescription>Revenue by payment method</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={methodData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {methodData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS.blue[index % COLORS.blue.length]} />
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

        {/* Top Customers */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Top Customers by Revenue
            </CardTitle>
            <CardDescription>Highest revenue from sales receipts</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topCustomers} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  type="number" 
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  style={{ fontSize: '11px' }}
                />
                <YAxis 
                  type="category" 
                  dataKey="name" 
                  width={150}
                  style={{ fontSize: '11px' }}
                />
                <Tooltip 
                  formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  contentStyle={{ fontSize: '12px' }}
                />
                <Bar dataKey="amount" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Sales Receipts</CardTitle>
          <CardDescription>
            Showing {filteredReceipts.length} of {receipts.length} receipts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left p-3 font-semibold">Date</th>
                  <th className="text-left p-3 font-semibold">Customer</th>
                  <th className="text-left p-3 font-semibold hidden sm:table-cell">Doc #</th>
                  <th className="text-right p-3 font-semibold">Amount</th>
                  <th className="text-left p-3 font-semibold hidden md:table-cell">Method</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      No sales receipts found
                    </td>
                  </tr>
                ) : (
                  filteredReceipts.map((receipt) => (
                    <tr key={receipt.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-3 text-gray-900">{formatDate(receipt.txn_date)}</td>
                      <td className="p-3 font-medium text-gray-900">
                        {receipt.customer_name || 'N/A'}
                      </td>
                      <td className="p-3 text-gray-600 hidden sm:table-cell">
                        {receipt.doc_number || '—'}
                      </td>
                      <td className="p-3 text-right font-semibold text-blue-600">
                        {formatCurrency(receipt.total_amount)}
                      </td>
                      <td className="p-3 hidden md:table-cell">
                        {receipt.payment_method_name ? (
                          <Badge variant="outline" className="text-xs">
                            {receipt.payment_method_name}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

