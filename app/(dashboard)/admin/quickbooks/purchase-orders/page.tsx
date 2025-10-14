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
  Package,
  TrendingUp,
  Calendar,
  PieChart as PieChartIcon,
  FileText
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

interface PurchaseOrder {
  id: string;
  qb_po_id: string;
  vendor_name: string | null;
  doc_number: string | null;
  txn_date: string;
  total_amount: number;
  po_status: string | null;
  ship_date: string | null;
  created_at: string;
}

const COLORS = {
  orange: ['#f97316', '#ea580c', '#c2410c', '#9a3412'],
};

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
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
      
      const response = await fetch('/api/quickbooks/purchase-orders');
      
      if (response.ok) {
        const data = await response.json();
        setOrders(data.purchaseOrders || []);
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load purchase orders');
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
      case 'Open': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Closed': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  const filteredOrders = orders.filter(order => {
    const searchLower = searchQuery.toLowerCase();
    return !searchQuery || 
      (order.vendor_name && order.vendor_name.toLowerCase().includes(searchLower)) ||
      (order.doc_number && order.doc_number.toLowerCase().includes(searchLower)) ||
      (order.po_status && order.po_status.toLowerCase().includes(searchLower));
  });

  const totalPOValue = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const openPOValue = orders.filter(o => o.po_status === 'Open').reduce((sum, o) => sum + o.total_amount, 0);
  const openOrders = orders.filter(o => o.po_status === 'Open').length;
  const closedOrders = orders.filter(o => o.po_status === 'Closed').length;

  // Chart data - POs over time
  const ordersOverTime = orders.reduce((acc, order) => {
    const date = new Date(order.txn_date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!acc[weekKey]) {
      acc[weekKey] = { date: weekKey, amount: 0, count: 0 };
    }
    acc[weekKey].amount += order.total_amount;
    acc[weekKey].count += 1;
    return acc;
  }, {} as Record<string, { date: string; amount: number; count: number }>);

  const timelineData = Object.values(ordersOverTime)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8);

  // Status breakdown
  const statusBreakdown = orders.reduce((acc, order) => {
    const status = order.po_status || 'Unknown';
    if (!acc[status]) {
      acc[status] = { status, amount: 0, count: 0 };
    }
    acc[status].amount += order.total_amount;
    acc[status].count += 1;
    return acc;
  }, {} as Record<string, { status: string; amount: number; count: number }>);

  const statusData = Object.values(statusBreakdown);

  // Top vendors by PO value
  const vendorSpend = orders.reduce((acc, order) => {
    const vendor = order.vendor_name || 'Unknown';
    if (!acc[vendor]) {
      acc[vendor] = 0;
    }
    acc[vendor] += order.total_amount;
    return acc;
  }, {} as Record<string, number>);

  const topVendors = Object.entries(vendorSpend)
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-orange-600 mb-4" />
          <p className="text-gray-600">Loading purchase orders...</p>
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
              <Package className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 flex-shrink-0" />
              <span>Purchase Orders Analytics</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Vendor purchase orders from QuickBooks
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
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total POs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{orders.length}</div>
              <p className="text-xs text-gray-500 mt-1">Purchase orders</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{formatCurrency(totalPOValue)}</div>
              <p className="text-xs text-gray-500 mt-1">All orders</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Open Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{openOrders}</div>
              <p className="text-xs text-gray-500 mt-1">Active</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Closed Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{closedOrders}</div>
              <p className="text-xs text-gray-500 mt-1">Completed</p>
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
                placeholder="Search by vendor, doc number, or status..."
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
        {/* PO Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-orange-600" />
              PO Timeline
            </CardTitle>
            <CardDescription>Purchase orders by week</CardDescription>
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
                  formatter={(value: number) => [formatCurrency(value), 'PO Value']}
                  labelFormatter={(date) => `Week of ${new Date(date).toLocaleDateString()}`}
                  contentStyle={{ fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="amount" stroke="#f97316" strokeWidth={3} name="PO Amount" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5 text-orange-600" />
              Status Breakdown
            </CardTitle>
            <CardDescription>Orders by status</CardDescription>
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
                    <Cell key={`cell-${index}`} fill={COLORS.orange[index % COLORS.orange.length]} />
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

        {/* Purchase Orders Analytics - Comprehensive View */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-orange-600" />
              Purchase Orders Analytics Overview
            </CardTitle>
            <CardDescription>Total POs breakdown: Open vs Closed vs Total Value</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={[
                {
                  category: 'Total PO Value',
                  amount: totalPOValue,
                  color: '#f97316'
                },
                {
                  category: 'Open PO Value',
                  amount: openPOValue,
                  color: '#ef4444'
                },
                {
                  category: 'Closed PO Value',
                  amount: totalPOValue - openPOValue,
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
                <Bar dataKey="amount" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
            
            {/* Summary Stats */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="bg-orange-50 p-3 rounded-lg">
                <div className="text-xs text-orange-600 font-medium">Total PO Value</div>
                <div className="text-sm font-bold text-orange-800">{formatCurrency(totalPOValue)}</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <div className="text-xs text-red-600 font-medium">Open POs</div>
                <div className="text-sm font-bold text-red-800">{formatCurrency(openPOValue)}</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="text-xs text-green-600 font-medium">Closed POs</div>
                <div className="text-sm font-bold text-green-800">{formatCurrency(totalPOValue - openPOValue)}</div>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-xs text-blue-600 font-medium">Completion Rate</div>
                <div className="text-sm font-bold text-blue-800">
                  {totalPOValue > 0 ? `${(((totalPOValue - openPOValue) / totalPOValue) * 100).toFixed(1)}%` : '0%'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Purchase Orders</CardTitle>
          <CardDescription>
            Showing {filteredOrders.length} of {orders.length} purchase orders
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left p-3 font-semibold">Date</th>
                  <th className="text-left p-3 font-semibold">Vendor</th>
                  <th className="text-left p-3 font-semibold hidden sm:table-cell">PO #</th>
                  <th className="text-right p-3 font-semibold">Amount</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                  <th className="text-left p-3 font-semibold hidden md:table-cell">Ship Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      No purchase orders found
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-3 text-gray-900">{formatDate(order.txn_date)}</td>
                      <td className="p-3 font-medium text-gray-900">
                        {order.vendor_name || 'N/A'}
                      </td>
                      <td className="p-3 text-gray-600 hidden sm:table-cell">
                        {order.doc_number || '—'}
                      </td>
                      <td className="p-3 text-right font-semibold text-orange-600">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="p-3">
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getStatusColor(order.po_status || 'Unknown')}`}
                        >
                          {order.po_status || 'Unknown'}
                        </Badge>
                      </td>
                      <td className="p-3 text-gray-600 hidden md:table-cell">
                        {order.ship_date ? formatDate(order.ship_date) : '—'}
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

