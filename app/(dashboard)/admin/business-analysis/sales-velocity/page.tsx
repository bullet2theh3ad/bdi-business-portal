'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Package, 
  Warehouse, 
  TrendingUp,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

// =====================================================
// Type Definitions
// =====================================================
interface AmazonInventoryStats {
  totalSKUs: number;
  totalUnits: number;
  lastSyncDate: string | null;
  skuDetails: Array<{
    sku: string;
    asin: string;
    fnsku: string;
    condition: string;
    totalQuantity: number;
  }>;
}

interface WarehouseInventoryStats {
  warehouseName: string;
  totalSKUs: number;
  totalUnits: number;
  totalCost: number;
  skuDetails: Array<{
    sku: string;
    units: number;
    standardCost: number | null;
    totalValue: number;
  }>;
}

interface SalesVelocityData {
  sku: string;
  totalSales: number;
  totalRevenue: number;
  firstSaleDate: string | null;
  lastSaleDate: string | null;
  daysInPeriod: number;
  dailyVelocity: number;
}

// =====================================================
// Main Component
// =====================================================
export default function SalesVelocityPage() {
  const [loading, setLoading] = useState(false);
  const [amazonInventory, setAmazonInventory] = useState<AmazonInventoryStats | null>(null);
  const [emgInventory, setEmgInventory] = useState<WarehouseInventoryStats | null>(null);
  const [catvInventory, setCatvInventory] = useState<WarehouseInventoryStats | null>(null);
  const [salesVelocity, setSalesVelocity] = useState<SalesVelocityData[]>([]);
  
  // Expandable sections
  const [expandedSections, setExpandedSections] = useState<{
    amazon: boolean;
    emg: boolean;
    catv: boolean;
    velocity: boolean;
  }>({
    amazon: false,
    emg: false,
    catv: false,
    velocity: false,
  });

  // Fetch all data on mount
  useEffect(() => {
    fetchAllData();
  }, []);

  async function fetchAllData() {
    setLoading(true);
    
    // Fetch all three data sources in parallel
    await Promise.all([
      fetchAmazonInventory(),
      fetchWarehouseInventory('EMG'),
      fetchWarehouseInventory('CATV'),
      fetchSalesVelocity(),
    ]);
    
    setLoading(false);
  }

  async function fetchAmazonInventory() {
    try {
      const response = await fetch('/api/sales-velocity/amazon-inventory');
      if (response.ok) {
        const data = await response.json();
        setAmazonInventory(data);
      }
    } catch (error) {
      console.error('Error fetching Amazon inventory:', error);
    }
  }

  async function fetchWarehouseInventory(warehouse: 'EMG' | 'CATV') {
    try {
      const response = await fetch(`/api/sales-velocity/warehouse-inventory?warehouse=${warehouse}`);
      if (response.ok) {
        const data = await response.json();
        if (warehouse === 'EMG') {
          setEmgInventory(data);
        } else {
          setCatvInventory(data);
        }
      }
    } catch (error) {
      console.error(`Error fetching ${warehouse} inventory:`, error);
    }
  }

  async function fetchSalesVelocity() {
    try {
      const response = await fetch('/api/sales-velocity/calculate-from-db');
      if (response.ok) {
        const data = await response.json();
        setSalesVelocity(data.velocityData || []);
      }
    } catch (error) {
      console.error('Error fetching sales velocity:', error);
    }
  }

  function toggleSection(section: keyof typeof expandedSections) {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="h-7 w-7 text-purple-600" />
              Sales Velocity Analysis
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Real-time inventory and sales velocity tracking
            </p>
          </div>
          <Button
            onClick={fetchAllData}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh All
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Amazon Inventory Card */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-blue-600" />
                Amazon FBA Inventory
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('amazon')}
              >
                {expandedSections.amazon ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading && !amazonInventory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : amazonInventory ? (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total SKUs</p>
                    <p className="text-2xl font-bold text-blue-600">{amazonInventory.totalSKUs}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Units</p>
                    <p className="text-2xl font-bold text-blue-600">{amazonInventory.totalUnits.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Last Sync</p>
                    <p className="text-sm font-medium text-gray-900">
                      {amazonInventory.lastSyncDate 
                        ? new Date(amazonInventory.lastSyncDate).toLocaleDateString()
                        : 'Never'}
                    </p>
                  </div>
                </div>

                {/* Expandable Details */}
                {expandedSections.amazon && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">SKU Details</h4>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left p-2">SKU</th>
                            <th className="text-left p-2">ASIN</th>
                            <th className="text-left p-2">Condition</th>
                            <th className="text-right p-2">Quantity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {amazonInventory.skuDetails.map((item, idx) => (
                            <tr key={idx} className="border-b">
                              <td className="p-2 font-mono text-xs">{item.sku}</td>
                              <td className="p-2 font-mono text-xs">{item.asin}</td>
                              <td className="p-2">{item.condition}</td>
                              <td className="p-2 text-right font-semibold">{item.totalQuantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* EMG Warehouse Card */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-green-600" />
                EMG Warehouse Inventory
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('emg')}
              >
                {expandedSections.emg ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading && !emgInventory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-green-600" />
              </div>
            ) : emgInventory ? (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total SKUs</p>
                    <p className="text-2xl font-bold text-green-600">{emgInventory.totalSKUs}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Units</p>
                    <p className="text-2xl font-bold text-green-600">{emgInventory.totalUnits.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Value</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(emgInventory.totalCost)}</p>
                  </div>
                </div>

                {/* Expandable Details */}
                {expandedSections.emg && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">SKU Details</h4>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left p-2">SKU</th>
                            <th className="text-right p-2">Units</th>
                            <th className="text-right p-2">Std Cost</th>
                            <th className="text-right p-2">Total Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {emgInventory.skuDetails.map((item, idx) => (
                            <tr key={idx} className="border-b">
                              <td className="p-2 font-mono text-xs">{item.sku}</td>
                              <td className="p-2 text-right">{item.units}</td>
                              <td className="p-2 text-right">
                                {item.standardCost ? formatCurrency(item.standardCost) : '-'}
                              </td>
                              <td className="p-2 text-right font-semibold">
                                {formatCurrency(item.totalValue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* CATV Warehouse Card */}
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Warehouse className="h-5 w-5 text-orange-600" />
                CATV Warehouse Inventory
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('catv')}
              >
                {expandedSections.catv ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading && !catvInventory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
              </div>
            ) : catvInventory ? (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total SKUs</p>
                    <p className="text-2xl font-bold text-orange-600">{catvInventory.totalSKUs}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Units</p>
                    <p className="text-2xl font-bold text-orange-600">{catvInventory.totalUnits.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Value</p>
                    <p className="text-2xl font-bold text-orange-600">{formatCurrency(catvInventory.totalCost)}</p>
                  </div>
                </div>

                {/* Expandable Details */}
                {expandedSections.catv && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">SKU Details</h4>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left p-2">SKU</th>
                            <th className="text-right p-2">Units</th>
                            <th className="text-right p-2">Std Cost</th>
                            <th className="text-right p-2">Total Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {catvInventory.skuDetails.map((item, idx) => (
                            <tr key={idx} className="border-b">
                              <td className="p-2 font-mono text-xs">{item.sku}</td>
                              <td className="p-2 text-right">{item.units}</td>
                              <td className="p-2 text-right">
                                {item.standardCost ? formatCurrency(item.standardCost) : '-'}
                              </td>
                              <td className="p-2 text-right font-semibold">
                                {formatCurrency(item.totalValue)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Sales Velocity Card */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                Sales Velocity (DB Data)
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection('velocity')}
              >
                {expandedSections.velocity ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading && salesVelocity.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : salesVelocity.length > 0 ? (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total SKUs</p>
                    <p className="text-2xl font-bold text-purple-600">{salesVelocity.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Sales</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {salesVelocity.reduce((sum, item) => sum + item.totalSales, 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatCurrency(salesVelocity.reduce((sum, item) => sum + item.totalRevenue, 0))}
                    </p>
                  </div>
                </div>

                {/* Expandable Details */}
                {expandedSections.velocity && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">SKU Velocity Details</h4>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left p-2">SKU</th>
                            <th className="text-right p-2">Total Sales</th>
                            <th className="text-right p-2">Revenue</th>
                            <th className="text-right p-2">Days</th>
                            <th className="text-right p-2">Daily Velocity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesVelocity.map((item, idx) => (
                            <tr key={idx} className="border-b">
                              <td className="p-2 font-mono text-xs">{item.sku}</td>
                              <td className="p-2 text-right">{item.totalSales}</td>
                              <td className="p-2 text-right">{formatCurrency(item.totalRevenue)}</td>
                              <td className="p-2 text-right">{item.daysInPeriod}</td>
                              <td className="p-2 text-right font-semibold text-purple-600">
                                {item.dailyVelocity.toFixed(2)} units/day
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

