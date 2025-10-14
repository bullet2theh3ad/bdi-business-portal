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
  FileText,
  TrendingDown,
  Calendar,
  PieChart as PieChartIcon,
  Receipt
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

interface CreditMemo {
  id: string;
  qb_credit_memo_id: string;
  customer_name: string | null;
  doc_number: string | null;
  txn_date: string;
  total_amount: number;
  balance: number;
  remaining_credit: number;
  created_at: string;
}

const COLORS = {
  red: ['#ef4444', '#dc2626', '#b91c1c', '#991b1b'],
};

export default function CreditMemosPage() {
  const [memos, setMemos] = useState<CreditMemo[]>([]);
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
      
      const response = await fetch('/api/quickbooks/credit-memos');
      
      if (response.ok) {
        const data = await response.json();
        setMemos(data.creditMemos || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load credit memos');
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

  const filteredMemos = memos.filter(memo => {
    const searchLower = searchQuery.toLowerCase();
    return !searchQuery || 
      (memo.customer_name && memo.customer_name.toLowerCase().includes(searchLower)) ||
      (memo.doc_number && memo.doc_number.toLowerCase().includes(searchLower));
  });

  const totalCredits = memos.reduce((sum, m) => sum + m.total_amount, 0);
  const totalRemainingCredit = memos.reduce((sum, m) => sum + m.remaining_credit, 0);

  // Chart data - Memos over time
  const memosOverTime = memos.reduce((acc, memo) => {
    const date = new Date(memo.txn_date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!acc[weekKey]) {
      acc[weekKey] = { date: weekKey, amount: 0, count: 0 };
    }
    acc[weekKey].amount += memo.total_amount;
    acc[weekKey].count += 1;
    return acc;
  }, {} as Record<string, { date: string; amount: number; count: number }>);

  const timelineData = Object.values(memosOverTime)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8);

  // Credit status breakdown
  const creditStatus = memos.reduce((acc, memo) => {
    const status = memo.remaining_credit > 0 ? 'Available Credit' : 'Fully Applied';
    if (!acc[status]) {
      acc[status] = { status, amount: 0, count: 0 };
    }
    if (status === 'Available Credit') {
      acc[status].amount += memo.remaining_credit;
    } else {
      acc[status].amount += memo.total_amount;
    }
    acc[status].count += 1;
    return acc;
  }, {} as Record<string, { status: string; amount: number; count: number }>);

  const statusData = Object.values(creditStatus);

  // Top customers by credit amount
  const customerCredits = memos.reduce((acc, memo) => {
    const customer = memo.customer_name || 'Unknown';
    if (!acc[customer]) {
      acc[customer] = 0;
    }
    acc[customer] += memo.total_amount;
    return acc;
  }, {} as Record<string, number>);

  const topCustomers = Object.entries(customerCredits)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-red-600 mb-4" />
          <p className="text-gray-600">Loading credit memos...</p>
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
              <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-red-600 flex-shrink-0" />
              <span>Credit Memos Analytics</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Customer credits and refunds from QuickBooks
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
          <Card className="border-l-4 border-l-red-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Memos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{memos.length}</div>
              <p className="text-xs text-gray-500 mt-1">Credit memos</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Credits</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(totalCredits)}</div>
              <p className="text-xs text-gray-500 mt-1">Issued</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-yellow-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Available Credit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {formatCurrency(totalRemainingCredit)}
              </div>
              <p className="text-xs text-gray-500 mt-1">Unapplied</p>
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
                placeholder="Search by customer or doc number..."
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
        {/* Credits Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-red-600" />
              Credits Timeline
            </CardTitle>
            <CardDescription>Credit memos issued by week</CardDescription>
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
                  formatter={(value: number) => [formatCurrency(value), 'Credits']}
                  labelFormatter={(date) => `Week of ${new Date(date).toLocaleDateString()}`}
                  contentStyle={{ fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="amount" stroke="#ef4444" strokeWidth={3} name="Credit Amount" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Credit Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-red-600" />
              Credit Status
            </CardTitle>
            <CardDescription>Available vs. applied credits</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="amount"
                >
                  {statusData.map((entry, index) => (
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

        {/* Credit Memos Analytics - Comprehensive View */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-red-600" />
              Credit Memos Analytics Overview
            </CardTitle>
            <CardDescription>Total credits breakdown: Issued vs Available vs Applied</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                {
                  category: 'Total Credits Issued',
                  amount: totalCredits,
                  color: '#ef4444'
                },
                {
                  category: 'Available Credits',
                  amount: totalRemainingCredit,
                  color: '#f59e0b'
                },
                {
                  category: 'Applied Credits',
                  amount: totalCredits - totalRemainingCredit,
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
                <Bar dataKey="amount" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
            
            {/* Summary Stats */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="text-xs text-red-600 font-medium">Total Issued</div>
                <div className="text-sm font-bold text-red-800">{formatCurrency(totalCredits)}</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <div className="text-xs text-yellow-600 font-medium">Available</div>
                <div className="text-sm font-bold text-yellow-800">{formatCurrency(totalRemainingCredit)}</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-xs text-green-600 font-medium">Applied</div>
                <div className="text-sm font-bold text-green-800">{formatCurrency(totalCredits - totalRemainingCredit)}</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-xs text-blue-600 font-medium">Usage Rate</div>
                <div className="text-sm font-bold text-blue-800">
                  {totalCredits > 0 ? `${(((totalCredits - totalRemainingCredit) / totalCredits) * 100).toFixed(1)}%` : '0%'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Credit Memos</CardTitle>
          <CardDescription>
            Showing {filteredMemos.length} of {memos.length} credit memos
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
                  <th className="text-right p-3 font-semibold hidden md:table-cell">Available</th>
                </tr>
              </thead>
              <tbody>
                {filteredMemos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-gray-500">
                      No credit memos found
                    </td>
                  </tr>
                ) : (
                  filteredMemos.map((memo) => (
                    <tr key={memo.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-3 text-gray-900">{formatDate(memo.txn_date)}</td>
                      <td className="p-3 font-medium text-gray-900">
                        {memo.customer_name || 'N/A'}
                      </td>
                      <td className="p-3 text-gray-600 hidden sm:table-cell">
                        {memo.doc_number || '—'}
                      </td>
                      <td className="p-3 text-right font-semibold text-red-600">
                        {formatCurrency(memo.total_amount)}
                      </td>
                      <td className="p-3 text-right text-yellow-600 font-semibold hidden md:table-cell">
                        {formatCurrency(memo.remaining_credit)}
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

