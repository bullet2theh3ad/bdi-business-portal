'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw, DollarSign } from 'lucide-react';

interface Deposit {
  id: string;
  txn_date: string;
  doc_number: string | null;
  total_amount: string;
  deposit_to_account_name: string | null;
  line_count: number;
  private_note: string | null;
  line_items: any;
  created_at: string;
}

export default function BankDepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadDeposits();
  }, []);

  async function loadDeposits() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/quickbooks/deposits?limit=1000');
      if (response.ok) {
        const data = await response.json();
        setDeposits(data.deposits || []);
        setTotalCount(data.count || 0);
      } else {
        console.error('Failed to load deposits');
      }
    } catch (error) {
      console.error('Error loading deposits:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredDeposits = deposits.filter(deposit =>
    (deposit.deposit_to_account_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (deposit.doc_number?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (deposit.private_note?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalAmount = filteredDeposits.reduce((sum, d) => sum + parseFloat(d.total_amount || '0'), 0);

  return (
    <div className="container mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Bank Deposits</h1>
        <p className="text-sm sm:text-base text-gray-600">View deposits to bank accounts from QuickBooks</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Deposits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{filteredDeposits.length}</div>
            <p className="text-xs text-gray-500 mt-1">Deposit transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-gray-500 mt-1">Total deposited</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Deposit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              ${filteredDeposits.length > 0 ? (totalAmount / filteredDeposits.length).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
            </div>
            <p className="text-xs text-gray-500 mt-1">Average amount</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by account, doc number, or notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          onClick={loadDeposits}
          variant="outline"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading deposits...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && deposits.length === 0 && (
        <Card className="mt-8">
          <CardContent className="py-12 text-center">
            <DollarSign className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No deposits found</h3>
            <p className="text-gray-500 mb-6">Run a QuickBooks sync to import deposit data</p>
          </CardContent>
        </Card>
      )}

      {/* Deposits Table */}
      {!isLoading && filteredDeposits.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left p-3 text-xs font-semibold text-gray-600">Date</th>
                    <th className="text-left p-3 text-xs font-semibold text-gray-600">Doc #</th>
                    <th className="text-left p-3 text-xs font-semibold text-gray-600">Account</th>
                    <th className="text-right p-3 text-xs font-semibold text-gray-600">Amount</th>
                    <th className="text-center p-3 text-xs font-semibold text-gray-600">Line Items</th>
                    <th className="text-left p-3 text-xs font-semibold text-gray-600">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredDeposits.map((deposit) => (
                    <tr key={deposit.id} className="hover:bg-gray-50">
                      <td className="p-3 text-sm">
                        {new Date(deposit.txn_date).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-sm font-mono">
                        {deposit.doc_number || '-'}
                      </td>
                      <td className="p-3 text-sm">
                        <span className="font-medium text-blue-600">
                          {deposit.deposit_to_account_name || 'Unknown'}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-right">
                        <span className="font-semibold text-green-600">
                          ${parseFloat(deposit.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-center">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                          {deposit.line_count || 0}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-gray-600 max-w-xs truncate">
                        {deposit.private_note || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Search Results */}
      {!isLoading && deposits.length > 0 && filteredDeposits.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No deposits match your search</p>
        </div>
      )}
    </div>
  );
}

