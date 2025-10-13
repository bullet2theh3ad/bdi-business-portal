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
  Receipt
} from 'lucide-react';

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
      
      // Fetch payments and bills (we'll need to create these API routes)
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
              <span>Payments & Bills</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Cash flow and accounts payable from QuickBooks
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
              <CardTitle className="text-sm font-medium text-gray-600">Outstanding Balance</CardTitle>
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
              <div className="text-2xl font-bold text-purple-600">
                {bills.filter(b => b.payment_status === 'Paid').length}
              </div>
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

      {/* Tabs */}
      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            <span>Payments ({filteredPayments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="bills" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span>Bills ({filteredBills.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Customer Payments</CardTitle>
              <CardDescription>
                Showing {filteredPayments.length} of {payments.length} payments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
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
        <TabsContent value="bills">
          <Card>
            <CardHeader>
              <CardTitle>Vendor Bills</CardTitle>
              <CardDescription>
                Showing {filteredBills.length} of {bills.length} bills
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-gray-50">
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

