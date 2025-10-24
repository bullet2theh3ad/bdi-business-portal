'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Database, 
  Users, 
  FileText,
  DollarSign,
  AlertCircle,
  ExternalLink,
  Loader2,
  Package,
  CreditCard
} from 'lucide-react';

interface QuickBooksConnection {
  id: string;
  realm_id: string;
  company_name: string;
  company_email: string;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  token_expires_at: string;
  connected_at: string;
}

interface SyncStats {
  customers: number;
  invoices: number;
  vendors: number;
  expenses: number;
  items: number;
  payments: number;
  bills: number;
  salesReceipts: number;
  creditMemos: number;
  purchaseOrders: number;
}

export default function QuickBooksIntegrationPage() {
  const [connection, setConnection] = useState<QuickBooksConnection | null>(null);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Sync logs for debugging
  const [syncLogs, setSyncLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  
  // Date range options
  const [dateRange, setDateRange] = useState<'60' | '30' | 'custom'>('60');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  useEffect(() => {
    loadConnection();
    loadSyncStats();
  }, []);

  async function loadConnection() {
    try {
      setLoading(true);
      const response = await fetch('/api/quickbooks/connection');
      
      if (response.ok) {
        const data = await response.json();
        setConnection(data.connection);
      } else if (response.status === 404) {
        setConnection(null); // No connection yet
      } else {
        throw new Error('Failed to load connection');
      }
    } catch (err) {
      console.error('Error loading connection:', err);
      setError('Failed to load QuickBooks connection');
    } finally {
      setLoading(false);
    }
  }

  async function loadSyncStats() {
    try {
      const response = await fetch('/api/quickbooks/stats');
      if (response.ok) {
        const data = await response.json();
        setSyncStats(data.stats);
      }
    } catch (err) {
      console.error('Error loading sync stats:', err);
    }
  }

  function handleConnectToQuickBooks() {
    // Redirect to OAuth flow
    window.location.href = '/api/quickbooks/auth';
  }

  async function handleDisconnect() {
    if (!confirm('Are you sure you want to disconnect from QuickBooks?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/quickbooks/disconnect', {
        method: 'POST',
      });

      if (response.ok) {
        setConnection(null);
        setSyncStats(null);
      } else {
        throw new Error('Failed to disconnect');
      }
    } catch (err) {
      console.error('Error disconnecting:', err);
      setError('Failed to disconnect from QuickBooks');
    } finally {
      setLoading(false);
    }
  }

  async function handleSync(mode: 'delta' | 'full' = 'delta') {
    try {
      setSyncing(true);
      setError(null);
      setSyncLogs([]);
      setShowLogs(true);
      
      const addLog = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        setSyncLogs(prev => [...prev, `[${timestamp}] ${message}`]);
      };
      
      addLog(`🚀 Starting ${mode.toUpperCase()} sync...`);
      
      const response = await fetch('/api/quickbooks/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          syncMode: mode,
        }),
      });

      addLog(`📡 API Response Status: ${response.status} ${response.statusText}`);

      if (response.ok) {
        const data = await response.json();
        addLog(`✅ Sync completed successfully!`);
        addLog(`📊 Total Records: ${data.totalRecords}`);
        addLog(`📋 Details:`);
        addLog(`  - Customers: ${data.details.customers.fetched} fetched, ${data.details.customers.created} created, ${data.details.customers.updated} updated`);
        addLog(`  - Invoices: ${data.details.invoices.fetched} fetched, ${data.details.invoices.created} created, ${data.details.invoices.updated} updated`);
        addLog(`  - Vendors: ${data.details.vendors.fetched} fetched, ${data.details.vendors.created} created, ${data.details.vendors.updated} updated`);
        addLog(`  - Expenses: ${data.details.expenses.fetched} fetched, ${data.details.expenses.created} created, ${data.details.expenses.updated} updated`);
        addLog(`  - Items: ${data.details.items.fetched} fetched, ${data.details.items.created} created, ${data.details.items.updated} updated`);
        addLog(`  - Payments: ${data.details.payments.fetched} fetched, ${data.details.payments.created} created, ${data.details.payments.updated} updated`);
        addLog(`  - Bills: ${data.details.bills.fetched} fetched, ${data.details.bills.created} created, ${data.details.bills.updated} updated`);
        addLog(`  - Sales Receipts: ${data.details.salesReceipts.fetched} fetched, ${data.details.salesReceipts.created} created, ${data.details.salesReceipts.updated} updated`);
        addLog(`  - Credit Memos: ${data.details.creditMemos.fetched} fetched, ${data.details.creditMemos.created} created, ${data.details.creditMemos.updated} updated`);
        addLog(`  - Purchase Orders: ${data.details.purchaseOrders.fetched} fetched, ${data.details.purchaseOrders.created} created, ${data.details.purchaseOrders.updated} updated`);
        addLog(`  - Deposits: ${data.details.deposits.fetched} fetched, ${data.details.deposits.created} created, ${data.details.deposits.updated} updated`);
        addLog(`  - Bill Payments: ${data.details.billPayments.fetched} fetched, ${data.details.billPayments.created} created, ${data.details.billPayments.updated} updated`);
        addLog(`  - Estimates: ${data.details.estimates.fetched} fetched, ${data.details.estimates.created} created, ${data.details.estimates.updated} updated`);
        addLog(`  - Journal Entries: ${data.details.journalEntries.fetched} fetched, ${data.details.journalEntries.created} created, ${data.details.journalEntries.updated} updated`);
        addLog(`  - Accounts: ${data.details.accounts.fetched} fetched, ${data.details.accounts.created} created, ${data.details.accounts.updated} updated`);
        addLog(`  - Vendor Credits: ${data.details.vendorCredits.fetched} fetched, ${data.details.vendorCredits.created} created, ${data.details.vendorCredits.updated} updated`);
        addLog(`  - Refund Receipts: ${data.details.refundReceipts.fetched} fetched, ${data.details.refundReceipts.created} created, ${data.details.refundReceipts.updated} updated`);
        addLog(`  - Transfers: ${data.details.transfers.fetched} fetched, ${data.details.transfers.created} created, ${data.details.transfers.updated} updated`);
        addLog(`  - Classes: ${data.details.classes.fetched} fetched, ${data.details.classes.created} created, ${data.details.classes.updated} updated`);
        addLog(`  - Terms: ${data.details.terms.fetched} fetched, ${data.details.terms.created} created, ${data.details.terms.updated} updated`);
        
        await loadConnection();
        await loadSyncStats();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        addLog(`❌ Sync failed: ${errorData.error || response.statusText}`);
        throw new Error(errorData.error || 'Sync failed');
      }
    } catch (err) {
      console.error('Error syncing:', err);
      setSyncLogs(prev => [...prev, `❌ ERROR: ${(err as Error).message}`]);
      setError('Failed to sync data from QuickBooks');
    } finally {
      setSyncing(false);
    }
  }

  const isTokenExpired = connection
    ? new Date(connection.token_expires_at).getTime() < Date.now()
    : false;

  const isTokenExpiringSoon = connection 
    ? new Date(connection.token_expires_at).getTime() - Date.now() < 24 * 60 * 60 * 1000 
    : false;

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600 mb-4" />
          <p className="text-gray-600">Loading QuickBooks integration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Database className="h-8 w-8 text-green-600" />
          <h1 className="text-3xl font-bold">QuickBooks Integration</h1>
          <Badge variant="outline" className="text-xs">BETA</Badge>
        </div>
        <p className="text-gray-600">
          Connect your QuickBooks Online account to sync financial data and generate comprehensive reports.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Connection Status Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Connection Status</CardTitle>
              <CardDescription>Manage your QuickBooks Online connection</CardDescription>
            </div>
            <div>
              {connection && connection.is_active ? (
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="text-gray-600">
                  <XCircle className="h-3 w-3 mr-1" />
                  Not Connected
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {connection && connection.is_active ? (
            <div className="space-y-4">
              {/* Company Info */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">Connected Company</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div className="overflow-hidden">
                    <span className="text-gray-600">Company Name:</span>
                    <p className="font-medium break-words">{connection.company_name || 'N/A'}</p>
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-gray-600">Company Email:</span>
                    <p className="font-medium break-all">{connection.company_email || 'N/A'}</p>
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-gray-600">Realm ID:</span>
                    <p className="font-mono text-xs break-all">{connection.realm_id}</p>
                  </div>
                  <div className="overflow-hidden">
                    <span className="text-gray-600">Connected Since:</span>
                    <p className="font-medium">
                      {new Date(connection.connected_at).toLocaleDateString()}
                    </p>
                  </div>
                  {connection.last_sync_at && (
                    <div className="overflow-hidden col-span-2">
                      <span className="text-gray-600">Last Synced:</span>
                      <p className="font-medium">
                        {new Date(connection.last_sync_at).toLocaleString()} 
                        <span className="ml-2 text-xs text-green-600">✓ {connection.last_sync_status}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        ⚡ Next sync will use Delta mode (only changed records)
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Token Expired Warning */}
              {isTokenExpired && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span className="font-semibold">Your QuickBooks access token has expired. Please reconnect to continue syncing data.</span>
                    <Button
                      onClick={handleConnectToQuickBooks}
                      variant="outline"
                      size="sm"
                      className="ml-4 bg-white text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Reconnect Now
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {/* Token Expiry Warning */}
              {!isTokenExpired && isTokenExpiringSoon && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Your access token will expire soon. The system will automatically refresh it, but you may need to re-authenticate if issues occur.
                  </AlertDescription>
                </Alert>
              )}

              {/* Last Sync Info */}
              {connection.last_sync_at && (
                <div className="bg-gray-50 p-4 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-600">Last Sync:</span>
                      <p className="font-medium">
                        {new Date(connection.last_sync_at).toLocaleString()}
                      </p>
                    </div>
                    {connection.last_sync_status && (
                      <Badge 
                        variant={connection.last_sync_status === 'success' ? 'default' : 'destructive'}
                      >
                        {connection.last_sync_status}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Sync Date Range Options */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
                <div>
                  <Label className="text-sm font-semibold text-blue-900">Sync Date Range</Label>
                  <p className="text-xs text-blue-700 mt-1">Select the date range for syncing transactions and records</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={dateRange === '60'}
                        onChange={() => setDateRange('60')}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium">Last 60 days (Recommended)</span>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={dateRange === '30'}
                        onChange={() => setDateRange('30')}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium">Last 30 days</span>
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={dateRange === 'custom'}
                        onChange={() => setDateRange('custom')}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium">Custom Range</span>
                    </label>
                  </div>
                  
                  {dateRange === 'custom' && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div>
                        <Label className="text-xs text-gray-600">Start Date</Label>
                        <Input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-gray-600">End Date</Label>
                        <Input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="mt-1"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-4">
                <Button 
                  onClick={() => handleSync('delta')} 
                  disabled={syncing || isTokenExpired}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isTokenExpired ? "Token expired - please reconnect" : "Smart sync - only fetches changed records"}
                >
                  {syncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      ⚡ Sync Now (Delta)
                    </>
                  )}
                </Button>
                <Button 
                  onClick={() => handleSync('full')}
                  disabled={syncing || isTokenExpired}
                  variant="outline"
                  className="border-blue-300 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isTokenExpired ? "Token expired - please reconnect" : "Full sync - re-imports all data from day 1"}
                >
                  {syncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      🔄 Full Sync (All Data)
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleDisconnect}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Disconnect
                </Button>
              </div>

              {/* Sync Logs Viewer */}
              {syncLogs.length > 0 && (
                <div className="mt-6 border rounded-lg overflow-hidden">
                  <div 
                    className="bg-gray-100 px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-200"
                    onClick={() => setShowLogs(!showLogs)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">🔍 Sync Logs</span>
                      {syncing && <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>
                    <span className="text-sm text-gray-600">
                      {showLogs ? '▼ Hide' : '▶ Show'} ({syncLogs.length} entries)
                    </span>
                  </div>
                  {showLogs && (
                    <div className="bg-black text-green-400 p-4 font-mono text-xs max-h-96 overflow-y-auto">
                      {syncLogs.map((log, index) => (
                        <div key={index} className="mb-1">
                          {log}
                        </div>
                      ))}
                      {syncing && (
                        <div className="mt-2 text-yellow-400 animate-pulse">
                          ⏳ Sync in progress...
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Database className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Not Connected to QuickBooks</h3>
              <p className="text-gray-600 mb-6">
                Connect your QuickBooks Online account to start syncing financial data.
              </p>
              <Button 
                onClick={handleConnectToQuickBooks}
                className="bg-green-600 hover:bg-green-700"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Connect to QuickBooks
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Statistics */}
      {syncStats && connection?.is_active && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Customers</CardTitle>
                <Users className="h-4 w-4 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{syncStats.customers.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">Synced from QuickBooks</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Invoices</CardTitle>
                <FileText className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{syncStats.invoices.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">Synced from QuickBooks</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Vendors</CardTitle>
                <Users className="h-4 w-4 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{syncStats.vendors.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">Synced from QuickBooks</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Expenses</CardTitle>
                <DollarSign className="h-4 w-4 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{syncStats.expenses.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">Synced from QuickBooks</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Products/Items</CardTitle>
                <Package className="h-4 w-4 text-indigo-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{syncStats.items.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">Product catalog</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Payments</CardTitle>
                <CreditCard className="h-4 w-4 text-green-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{syncStats.payments.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">Customer payments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-600">Bills</CardTitle>
                <FileText className="h-4 w-4 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{syncStats.bills.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">Vendor bills</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Setup Instructions */}
      {!connection && (
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Follow these steps to set up the QuickBooks integration</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4 text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">1</span>
                <div>
                  <p className="font-medium">Create QuickBooks App</p>
                  <p className="text-gray-600">Visit the QuickBooks Developer Portal and create a new app</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">2</span>
                <div>
                  <p className="font-medium">Configure OAuth Settings</p>
                  <p className="text-gray-600">Add redirect URI and get your Client ID & Secret</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">3</span>
                <div>
                  <p className="font-medium">Add Environment Variables</p>
                  <p className="text-gray-600">Add credentials to your .env.local file</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">4</span>
                <div>
                  <p className="font-medium">Connect Your Account</p>
                  <p className="text-gray-600">Click the "Connect to QuickBooks" button above</p>
                </div>
              </li>
            </ol>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>📚 Need Help?</strong> Check the <code className="bg-yellow-100 px-2 py-1 rounded">QUICKBOOKS_INTEGRATION_GUIDE.md</code> file for detailed setup instructions.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

