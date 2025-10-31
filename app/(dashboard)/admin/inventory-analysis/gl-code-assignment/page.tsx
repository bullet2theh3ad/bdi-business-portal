'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, RefreshCw, Save, Search, Download, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface GLCode {
  id: string; // UUID from database
  qbAccountId: string;
  code: string;
  name: string;
  fullyQualifiedName: string;
  accountType: string;
  classification: string;
  description?: string;
  category: 'opex' | 'cogs' | 'inventory' | 'nre' | 'ignore' | 'unassigned';
  includeInCashFlow: boolean;
  isActive: boolean;
  currentBalance?: number;
}

export default function GLCodeAssignmentPage() {
  const [glCodes, setGLCodes] = useState<GLCode[]>([]);
  const [filteredCodes, setFilteredCodes] = useState<GLCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load GL codes from QuickBooks on mount
  useEffect(() => {
    loadGLCodes();
  }, []);

  async function loadGLCodes() {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch QuickBooks accounts
      const qbResponse = await fetch('/api/quickbooks/accounts');
      if (!qbResponse.ok) {
        throw new Error('Failed to fetch QuickBooks accounts');
      }
      const qbAccounts = await qbResponse.json();

      // Fetch existing assignments
      const assignmentsResponse = await fetch('/api/gl-code-assignments');
      const assignments = assignmentsResponse.ok ? await assignmentsResponse.json() : [];

      // Create a map of assignments by QB account ID
      const assignmentMap = new Map(
        assignments.map((a: any) => [a.qbAccountId, a])
      );

      // Merge QuickBooks accounts with assignments
      const mergedGLCodes: GLCode[] = qbAccounts.map((account: any) => {
        const assignment: any = assignmentMap.get(account.qb_account_id);
        
        return {
          id: assignment?.id || account.id,
          qbAccountId: account.qb_account_id,
          code: account.account_number || account.qb_account_id,
          name: account.name,
          fullyQualifiedName: account.fully_qualified_name || account.name,
          accountType: account.account_type,
          classification: account.classification,
          description: account.description,
          category: (assignment?.category as GLCode['category']) || 'unassigned',
          includeInCashFlow: assignment?.include_in_cash_flow ?? true,
          isActive: account.is_active,
          currentBalance: parseFloat(account.current_balance || '0'),
        };
      });

      setGLCodes(mergedGLCodes);
      setFilteredCodes(mergedGLCodes);
      setLastSyncTime(new Date().toISOString());
    } catch (err) {
      console.error('Error loading GL codes:', err);
      setError('Failed to load GL codes from QuickBooks. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    // Apply filters
    let filtered = glCodes;

    if (searchTerm) {
      filtered = filtered.filter(code =>
        code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        code.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterCategory !== 'all') {
      filtered = filtered.filter(code => code.category === filterCategory);
    }

    setFilteredCodes(filtered);
  }, [searchTerm, filterCategory, glCodes]);

  // Handle refresh from QuickBooks
  const handleRefresh = async () => {
    await loadGLCodes();
    alert('GL codes refreshed from QuickBooks');
  };

  // Update GL code category
  const handleCategoryChange = (qbAccountId: string, newCategory: string) => {
    setGLCodes(glCodes.map(glCode =>
      glCode.qbAccountId === qbAccountId
        ? { ...glCode, category: newCategory as GLCode['category'] }
        : glCode
    ));
  };

  // Toggle cash flow inclusion
  const handleToggleCashFlow = (qbAccountId: string) => {
    setGLCodes(glCodes.map(glCode =>
      glCode.qbAccountId === qbAccountId
        ? { ...glCode, includeInCashFlow: !glCode.includeInCashFlow }
        : glCode
    ));
  };

  // Save mappings
  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Prepare assignments data
      const assignments = glCodes.map(code => ({
        qbAccountId: code.qbAccountId,
        category: code.category,
        includeInCashFlow: code.includeInCashFlow,
      }));

      const response = await fetch('/api/gl-code-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignments }),
      });

      if (!response.ok) {
        throw new Error('Failed to save GL code assignments');
      }

      alert('GL code assignments saved successfully');
    } catch (err) {
      console.error('Error saving GL code assignments:', err);
      setError('Failed to save GL code assignments. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Export mappings
  const handleExport = () => {
    const csvContent = [
      ['GL Code', 'Name', 'Description', 'Category', 'Include in Cash Flow'].join(','),
      ...glCodes.map(code =>
        [
          code.code,
          `"${code.name}"`,
          `"${code.description || ''}"`,
          code.category,
          code.includeInCashFlow ? 'Yes' : 'No'
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gl-code-mappings-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const getCategoryBadge = (category: GLCode['category']) => {
    const styles = {
      opex: 'bg-orange-100 text-orange-800',
      cogs: 'bg-purple-100 text-purple-800',
      inventory: 'bg-blue-100 text-blue-800',
      nre: 'bg-green-100 text-green-800',
      ignore: 'bg-gray-100 text-gray-800',
      unassigned: 'bg-yellow-100 text-yellow-800',
    };

    return <Badge className={styles[category]}>{category.toUpperCase()}</Badge>;
  };

  const getCategoryStats = () => {
    const stats = {
      opex: glCodes.filter(c => c.category === 'opex').length,
      cogs: glCodes.filter(c => c.category === 'cogs').length,
      inventory: glCodes.filter(c => c.category === 'inventory').length,
      nre: glCodes.filter(c => c.category === 'nre').length,
      ignore: glCodes.filter(c => c.category === 'ignore').length,
      unassigned: glCodes.filter(c => c.category === 'unassigned').length,
    };
    return stats;
  };

  const stats = getCategoryStats();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Settings className="h-8 w-8 text-blue-600" />
          GL Code Assignment
        </h1>
        <p className="text-gray-600 mt-2">
          Map QuickBooks GL codes to categories for cash flow analysis
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <p className="font-semibold">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && glCodes.length === 0 && (
        <div className="text-center py-12">
          <RefreshCw className="h-12 w-12 mx-auto mb-4 text-blue-600 animate-spin" />
          <p className="text-gray-600">Loading GL codes from QuickBooks...</p>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.opex}</div>
              <div className="text-xs text-gray-600">OpEx</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{stats.cogs}</div>
              <div className="text-xs text-gray-600">COGS</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.inventory}</div>
              <div className="text-xs text-gray-600">Inventory</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.nre}</div>
              <div className="text-xs text-gray-600">NRE</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.ignore}</div>
              <div className="text-xs text-gray-600">Ignore</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.unassigned}</div>
              <div className="text-xs text-gray-600">Unassigned</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="mb-6 flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3">
          <Button onClick={handleRefresh} disabled={isLoading} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh from QuickBooks
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Mappings'}
          </Button>
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
        {lastSyncTime && (
          <div className="text-sm text-gray-600">
            Last synced: {new Date(lastSyncTime).toLocaleString()}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search GL codes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="opex">OpEx</SelectItem>
            <SelectItem value="cogs">COGS</SelectItem>
            <SelectItem value="inventory">Inventory</SelectItem>
            <SelectItem value="nre">NRE</SelectItem>
            <SelectItem value="ignore">Ignore</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* GL Codes Table */}
      <Card>
        <CardHeader>
          <CardTitle>GL Code Mappings ({filteredCodes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg font-semibold text-sm">
              <div className="col-span-1">Code</div>
              <div className="col-span-3">Name</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-2">Cash Flow</div>
              <div className="col-span-1">Actions</div>
            </div>

            {/* Rows */}
            {filteredCodes.map((code) => (
              <div
                key={code.qbAccountId}
                className="grid grid-cols-12 gap-4 px-4 py-3 border rounded-lg hover:bg-gray-50 transition-colors items-center"
              >
                <div className="col-span-1 font-mono font-semibold text-xs">{code.code}</div>
                <div className="col-span-3">
                  <div className="font-medium text-sm">{code.name}</div>
                  <div className="text-xs text-gray-500">{code.fullyQualifiedName}</div>
                </div>
                <div className="col-span-3 text-sm text-gray-600">
                  {code.classification && (
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded mr-2">{code.classification}</span>
                  )}
                  {code.accountType}
                </div>
                <div className="col-span-2">
                  <Select
                    value={code.category}
                    onValueChange={(value) => handleCategoryChange(code.qbAccountId, value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="opex">OpEx</SelectItem>
                      <SelectItem value="cogs">COGS</SelectItem>
                      <SelectItem value="inventory">Inventory</SelectItem>
                      <SelectItem value="nre">NRE</SelectItem>
                      <SelectItem value="ignore">Ignore</SelectItem>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <button
                    onClick={() => handleToggleCashFlow(code.qbAccountId)}
                    className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      code.includeInCashFlow
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {code.includeInCashFlow && <CheckCircle2 className="h-3 w-3" />}
                    {code.includeInCashFlow ? 'Included' : 'Excluded'}
                  </button>
                </div>
                <div className="col-span-1">
                  {getCategoryBadge(code.category)}
                </div>
              </div>
            ))}
          </div>

          {filteredCodes.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Settings className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p>No GL codes found matching your filters</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="mt-6 border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2 text-blue-900">Category Descriptions:</h3>
          <ul className="text-sm space-y-1 text-blue-800">
            <li><strong>OpEx:</strong> Operating expenses that will be included in cash flow analysis</li>
            <li><strong>COGS:</strong> Cost of goods sold - direct product costs</li>
            <li><strong>Inventory:</strong> Inventory purchases tracked via PO payment schedules</li>
            <li><strong>NRE:</strong> Non-recurring engineering expenses tracked separately</li>
            <li><strong>Ignore:</strong> Revenue, depreciation, and other non-cash items</li>
            <li><strong>Unassigned:</strong> Codes that haven't been categorized yet</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

