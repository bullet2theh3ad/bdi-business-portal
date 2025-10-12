'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Loader2
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
}

export default function QuickBooksIntegrationPage() {
  const [connection, setConnection] = useState<QuickBooksConnection | null>(null);
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  async function handleSync() {
    try {
      setSyncing(true);
      setError(null);
      
      const response = await fetch('/api/quickbooks/sync', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Sync completed! Synced ${data.totalRecords} records.`);
        await loadConnection();
        await loadSyncStats();
      } else {
        throw new Error('Sync failed');
      }
    } catch (err) {
      console.error('Error syncing:', err);
      setError('Failed to sync data from QuickBooks');
    } finally {
      setSyncing(false);
    }
  }

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
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Company Name:</span>
                    <p className="font-medium">{connection.company_name || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Company Email:</span>
                    <p className="font-medium">{connection.company_email || 'N/A'}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Realm ID:</span>
                    <p className="font-mono text-xs">{connection.realm_id}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Connected Since:</span>
                    <p className="font-medium">
                      {new Date(connection.connected_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Token Expiry Warning */}
              {isTokenExpiringSoon && (
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

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button 
                  onClick={handleSync} 
                  disabled={syncing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync Now
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
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

