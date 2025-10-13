'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Package, 
  Search,
  RefreshCw,
  Download,
  Loader2,
  AlertCircle,
  DollarSign,
  ShoppingCart,
  Layers
} from 'lucide-react';

interface QuickBooksItem {
  id: string;
  qb_item_id: string;
  name: string;
  sku: string | null;
  description: string | null;
  type: string;
  unit_price: number;
  purchase_cost: number;
  qty_on_hand: number;
  reorder_point: number;
  is_active: boolean;
  taxable: boolean;
  qb_created_at: string;
  qb_updated_at: string;
}

interface ItemStats {
  total: number;
  active: number;
  inactive: number;
  byType: Record<string, number>;
}

export default function QuickBooksProductsPage() {
  const [items, setItems] = useState<QuickBooksItem[]>([]);
  const [stats, setStats] = useState<ItemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  useEffect(() => {
    loadItems();
  }, [typeFilter, activeFilter]);

  async function loadItems() {
    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (activeFilter === 'active') params.append('activeOnly', 'true');
      
      const response = await fetch(`/api/quickbooks/items?${params}`);
      
      if (response.ok) {
        const data = await response.json();
        setItems(data.items || []);
        setStats(data.stats || null);
      } else {
        throw new Error('Failed to load items');
      }
    } catch (err) {
      console.error('Error loading items:', err);
      setError('Failed to load product catalog');
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

  function getTypeColor(type: string): string {
    switch (type) {
      case 'Inventory': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Service': return 'bg-green-100 text-green-800 border-green-300';
      case 'NonInventory': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-purple-100 text-purple-800 border-purple-300';
    }
  }

  // Filter items by search query
  const filteredItems = items.filter(item => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      item.name.toLowerCase().includes(searchLower) ||
      (item.sku && item.sku.toLowerCase().includes(searchLower)) ||
      (item.description && item.description.toLowerCase().includes(searchLower));
    
    const matchesActive = activeFilter === 'all' || 
      (activeFilter === 'active' && item.is_active) ||
      (activeFilter === 'inactive' && !item.is_active);
    
    return matchesSearch && matchesActive;
  });

  if (loading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-indigo-600 mb-4" />
          <p className="text-gray-600">Loading product catalog...</p>
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
              <Package className="h-6 w-6 sm:h-8 sm:w-8 text-indigo-600 flex-shrink-0" />
              <span>QuickBooks Products</span>
            </h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">
              Product catalog and inventory from QuickBooks
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Button onClick={loadItems} variant="outline" size="sm" className="flex-1 sm:flex-none">
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
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-l-4 border-l-indigo-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-600">{stats.total}</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Inventory Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.byType['Inventory'] || 0}</div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.byType['Service'] || 0}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="bg-gray-50">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Search
                </Label>
                <Input
                  placeholder="Search by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Type
                </Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Inventory">Inventory</SelectItem>
                    <SelectItem value="Service">Service</SelectItem>
                    <SelectItem value="NonInventory">Non-Inventory</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  Status
                </Label>
                <Select value={activeFilter} onValueChange={setActiveFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Items</SelectItem>
                    <SelectItem value="active">Active Only</SelectItem>
                    <SelectItem value="inactive">Inactive Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Catalog</CardTitle>
          <CardDescription>
            Showing {filteredItems.length} of {items.length} products
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-semibold">Name</th>
                  <th className="text-left p-3 font-semibold">SKU</th>
                  <th className="text-left p-3 font-semibold">Type</th>
                  <th className="text-right p-3 font-semibold">Price</th>
                  <th className="text-right p-3 font-semibold">Cost</th>
                  <th className="text-right p-3 font-semibold">QOH</th>
                  <th className="text-left p-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-500">
                      No products found matching your filters
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          {item.description && (
                            <p className="text-xs text-gray-500 mt-1 max-w-md truncate">{item.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        {item.sku ? (
                          <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">{item.sku}</code>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className={`text-xs ${getTypeColor(item.type)}`}>
                          {item.type}
                        </Badge>
                      </td>
                      <td className="p-3 text-right font-medium text-green-600">
                        {formatCurrency(item.unit_price)}
                      </td>
                      <td className="p-3 text-right text-gray-600">
                        {formatCurrency(item.purchase_cost)}
                      </td>
                      <td className="p-3 text-right">
                        {item.type === 'Inventory' ? (
                          <span className={item.qty_on_hand <= item.reorder_point ? 'text-red-600 font-semibold' : 'text-gray-900'}>
                            {item.qty_on_hand}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge 
                          variant={item.is_active ? 'default' : 'secondary'}
                          className="text-xs"
                        >
                          {item.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Package className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">SKU Matching Coming Soon</h3>
              <p className="text-sm text-blue-700">
                Products with SKUs can be matched to BDI SKUs for profitability analysis and cost tracking. 
                The SKU matching interface will allow you to link QuickBooks items to your BDI product catalog.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

