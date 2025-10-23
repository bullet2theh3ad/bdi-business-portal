'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// import { Progress } from '@/components/ui/progress'; // Component not available
import { 
  Building2, 
  Package, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle,
  Clock,
  Warehouse,
  BarChart3,
  PieChart,
  Upload,
  FileUp,
  RefreshCw,
  Cloud
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface WarehouseSummaryData {
  emg: {
    totals: {
      totalSkus: number;
      totalOnHand: number;
      totalAllocated: number;
      totalBackorder: number;
      totalNetStock: number;
    };
    inventory: Array<{
      model: string;
      description: string;
      location: string;
      qtyOnHand: number;
      qtyAllocated: number;
      qtyBackorder: number;
      netStock: number;
    }>;
    allSkus: Array<{
      model: string;
      description: string;
      location: string;
      qtyOnHand: number;
      netStock: number;
      hasCost: boolean;
      standardCost: number;
      bdiSku?: string;
      mappingStatus?: 'mapped' | 'direct_match' | 'no_mapping' | 'no_sku';
      totalValue: number;
    }>;
    topSkus: Array<{
      model: string;
      description: string;
      location: string;
      qtyOnHand: number;
      netStock: number;
    }>;
    inventoryValue: {
      totalValue: number;
      skusWithCost: number;
      skusWithoutCost: number;
      hasCostData: boolean;
    };
  };
  catv: {
    totals: {
      totalWeeks: number;
      totalReceivedIn: number;
      totalShippedJiraOut: number;
      totalShippedEmgOut: number;
      totalWipInHouse: number;
    };
    wipTotals: {
      totalUnits: number;
      byStage: Record<string, number>;
      bySku: Record<string, number>;
      bySource: Record<string, number>;
    };
    metrics: {
      totalIntake: number;
      activeWip: number;
      rma: number;
      outflow: number;
      avgAging: number;
    };
    allSkus: Array<{
      sku: string;
      totalUnits: number;
      stages: Record<string, number>;
      hasCost: boolean;
      standardCost: number;
      bdiSku?: string;
      mappingStatus?: 'mapped' | 'direct_match' | 'no_mapping' | 'no_sku';
      totalValue: number;
    }>;
    topSkus: Array<{
      sku: string;
      totalUnits: number;
      stages: Record<string, number>;
    }>;
    inventoryValue: {
      totalValue: number;
      skusWithCost: number;
      skusWithoutCost: number;
      hasCostData: boolean;
    };
  };
  amazon: {
    allSkus: Array<{
      sku: string;
      asin: string;
      fnsku: string;
      condition: string;
      totalQuantity: number;
      fulfillableQuantity: number;
      unsellableQuantity: number;
      reservedQuantity: number;
      inboundQuantity: number;
      hasCost: boolean;
      standardCost: number;
      bdiSku?: string;
      mappingStatus?: 'mapped' | 'direct_match' | 'no_mapping' | 'no_sku';
      totalValue: number;
    }>;
    topSkus: Array<{
      sku: string;
      asin: string;
      totalQuantity: number;
      fulfillableQuantity: number;
    }>;
    lastUpdated: string | null;
    totalSkus: number;
    totalUnits: number;
    inventoryValue: {
      totalValue: number;
      skusWithCost: number;
      skusWithoutCost: number;
      hasCostData: boolean;
    };
  };
  summary: {
    totalWarehouses: number;
    totalSkus: number;
    totalUnits: number;
    lastUpdated: number;
  };
}

interface WarehouseSummaryContentProps {
  emgData: any;
  catvData: any;
  onClose: () => void;
}

const COLORS = {
  emg: {
    primary: '#3B82F6', // Blue
    secondary: '#60A5FA',
    accent: '#DBEAFE'
  },
  catv: {
    primary: '#10B981', // Green
    secondary: '#34D399',
    accent: '#D1FAE5'
  },
  chart: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4']
};

export default function WarehouseSummaryContent({ emgData, catvData, onClose }: WarehouseSummaryContentProps) {
  const [summaryData, setSummaryData] = useState<WarehouseSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [fetchingFromAmazon, setFetchingFromAmazon] = useState(false);
  const [fetchProgress, setFetchProgress] = useState<string>('');

  useEffect(() => {
    fetchSummaryData();
  }, []);

  const fetchSummaryData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/inventory/warehouse-summary');
      const result = await response.json();
      
      if (result.success) {
        setSummaryData(result.data);
      }
    } catch (error) {
      console.error('Error fetching warehouse summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchFromAmazon = async () => {
    try {
      setFetchingFromAmazon(true);
      setFetchProgress('🔄 Fetching inventory from Amazon FBA...');

      // Fetch FBA inventory summaries
      const inventoryResponse = await fetch('/api/amazon/inventory/summaries?details=true');
      const inventoryData = await inventoryResponse.json();

      if (!inventoryData.success) {
        throw new Error(inventoryData.error || 'Failed to fetch inventory');
      }

      setFetchProgress('🔄 Fetching inbound shipments...');

      // Fetch inbound shipments
      const inboundResponse = await fetch('/api/amazon/inbound/shipments');
      const inboundData = await inboundResponse.json();

      if (!inboundData.success) {
        throw new Error(inboundData.error || 'Failed to fetch inbound shipments');
      }

      setFetchProgress('🔄 Processing inventory data...');

      // Transform the API data to match the expected format
      const inventorySummaries = inventoryData.data?.inventorySummaries || [];
      const inboundShipments = inboundData.data?.shipments || [];

      // Build a map of inbound quantities by SKU
      const inboundMap: Record<string, number> = {};
      inboundShipments.forEach((shipment: any) => {
        shipment.items?.forEach((item: any) => {
          const sku = item.SellerSKU;
          const qty = parseInt(item.QuantityShipped || 0) || parseInt(item.QuantityReceived || 0) || 0;
          inboundMap[sku] = (inboundMap[sku] || 0) + qty;
        });
      });

      // Transform inventory summaries to match database format
      const transformedInventory = inventorySummaries.map((item: any) => {
        const fulfillable = parseInt(String(item.inventoryDetails?.fulfillableQuantity || 0));
        const unsellable = parseInt(String(item.inventoryDetails?.unfulfillableQuantity || 0));
        const reserved = parseInt(String(item.inventoryDetails?.reservedQuantity?.totalReservedQuantity || 0));
        const inbound = inboundMap[item.sellerSku] || 0;
        
        return {
          sku: item.sellerSku || '',
          asin: item.asin || '',
          fnsku: item.fnSku || '',
          condition: item.condition || 'NewItem',
          totalQuantity: fulfillable + unsellable + reserved,
          fulfillableQuantity: fulfillable,
          unsellableQuantity: unsellable,
          reservedQuantity: reserved,
          inboundQuantity: inbound,
        };
      });

      setFetchProgress('🔄 Saving to database...');

      // Save to database
      const saveResponse = await fetch('/api/inventory/amazon-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory: transformedInventory }),
      });

      const saveResult = await saveResponse.json();

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save inventory');
      }

      setFetchProgress(`✅ Successfully fetched and saved ${transformedInventory.length} SKUs from Amazon!`);

      // Refresh the summary data
      setTimeout(() => {
        fetchSummaryData();
        setFetchProgress('');
      }, 2000);

    } catch (error) {
      console.error('Error fetching from Amazon:', error);
      setFetchProgress(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setFetchingFromAmazon(false);
    }
  };

  const handleAmazonUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setUploadProgress('Uploading file...');

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/amazon/inventory/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setUploadProgress(`✅ Upload complete! ${result.totalSkus} SKUs, ${result.totalUnits} units`);
        
        // Refresh data after successful upload
        setTimeout(() => {
          fetchSummaryData();
          setUploadProgress('');
        }, 2000);
      } else {
        setUploadProgress(`❌ Upload failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadProgress(`❌ Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading warehouse summary...</p>
        </div>
      </div>
    );
  }

  if (!summaryData) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">Failed to load warehouse summary data</p>
        <Button onClick={fetchSummaryData} className="mt-4">
          Retry
        </Button>
      </div>
    );
  }

  // Prepare chart data
  const emgChartData = summaryData.emg.topSkus.slice(0, 8).map(item => ({
    name: item.model,
    value: item.qtyOnHand,
    netStock: item.netStock
  }));

  // CATV Top SKUs Chart (replacing pie chart with bar chart)
  const catvChartData = summaryData.catv.topSkus.slice(0, 8).map(item => ({
    name: item.sku,
    value: item.totalUnits
  }));

  return (
    <div className="space-y-6">
      {/* Header Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Warehouses</p>
                <p className="text-2xl font-bold">{summaryData.summary.totalWarehouses}</p>
              </div>
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total SKUs</p>
                <p className="text-2xl font-bold">{formatNumber(summaryData.summary.totalSkus)}</p>
              </div>
              <Package className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Units</p>
                <p className="text-2xl font-bold">{formatNumber(summaryData.summary.totalUnits)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                <p className="text-sm font-bold">{formatDate(summaryData.summary.lastUpdated)}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inventory Value Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* EMG Inventory Value */}
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center">
                  <Warehouse className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">EMG Warehouse</p>
                  <p className="text-xs text-muted-foreground">Inventory Value</p>
                </div>
              </div>
            </div>
            {summaryData.emg.inventoryValue.hasCostData ? (
              <div>
                <p className="text-4xl font-bold text-blue-600">
                  ${formatNumber(Math.round(summaryData.emg.inventoryValue.totalValue))}
                </p>
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">SKUs with cost data:</span>
                    <span className="font-medium text-green-600">{summaryData.emg.inventoryValue.skusWithCost}</span>
                  </div>
                  {summaryData.emg.inventoryValue.skusWithoutCost > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">SKUs without cost:</span>
                      <span className="font-medium text-orange-600">{summaryData.emg.inventoryValue.skusWithoutCost}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground">No Cost Data Available</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add standard costs to SKUs in Inventory → SKUs
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* CATV Inventory Value */}
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-green-600 flex items-center justify-center">
                  <Warehouse className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">CATV Warehouse</p>
                  <p className="text-xs text-muted-foreground">Inventory Value</p>
                </div>
              </div>
            </div>
            {summaryData.catv.inventoryValue.hasCostData ? (
              <div>
                <p className="text-4xl font-bold text-green-600">
                  ${formatNumber(Math.round(summaryData.catv.inventoryValue.totalValue))}
                </p>
                <div className="mt-3 pt-3 border-t border-green-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">SKUs with cost data:</span>
                    <span className="font-medium text-green-600">{summaryData.catv.inventoryValue.skusWithCost}</span>
                  </div>
                  {summaryData.catv.inventoryValue.skusWithoutCost > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-muted-foreground">SKUs without cost:</span>
                      <span className="font-medium text-orange-600">{summaryData.catv.inventoryValue.skusWithoutCost}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground">No Cost Data Available</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add standard costs to SKUs in Inventory → SKUs
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Amazon Inventory Value */}
        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold">
                  A
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Amazon FBA</p>
                  <p className="text-xs text-muted-foreground">Inventory Value</p>
                </div>
              </div>
            </div>
            {summaryData.amazon.allSkus.length > 0 ? (
              summaryData.amazon.inventoryValue.hasCostData ? (
                <div>
                  <p className="text-4xl font-bold text-orange-600">
                    ${formatNumber(Math.round(summaryData.amazon.inventoryValue.totalValue))}
                  </p>
                  <div className="mt-3 pt-3 border-t border-orange-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">SKUs with cost data:</span>
                      <span className="font-medium text-green-600">{summaryData.amazon.inventoryValue.skusWithCost}</span>
                    </div>
                    {summaryData.amazon.inventoryValue.skusWithoutCost > 0 && (
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-muted-foreground">SKUs without cost:</span>
                        <span className="font-medium text-orange-600">{summaryData.amazon.inventoryValue.skusWithoutCost}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4">
                  <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-2" />
                  <p className="text-sm font-medium text-muted-foreground">No Cost Data Available</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add standard costs to SKUs in Inventory → SKUs
                  </p>
                </div>
              )
            ) : (
              <div className="text-center py-4">
                <FileUp className="h-12 w-12 text-orange-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground">No Data</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload Amazon FBA CSV in the Amazon tab
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2 h-auto">
          <TabsTrigger 
            value="overview"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-xs sm:text-sm px-2 py-2"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="emg"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-blue-600 data-[state=active]:text-white text-xs sm:text-sm px-2 py-2"
          >
            <span className="hidden sm:inline">EMG Warehouse</span>
            <span className="inline sm:hidden">EMG</span>
          </TabsTrigger>
          <TabsTrigger 
            value="catv"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-green-600 data-[state=active]:text-white text-xs sm:text-sm px-2 py-2"
          >
            <span className="hidden sm:inline">CATV Warehouse</span>
            <span className="inline sm:hidden">CATV</span>
          </TabsTrigger>
          <TabsTrigger 
            value="amazon"
            className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-orange-600 data-[state=active]:text-white text-xs sm:text-sm px-2 py-2"
          >
            Amazon
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Warehouse Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* EMG Warehouse Card */}
            <Card className="border-blue-200">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
                <CardTitle className="flex items-center justify-between text-blue-800">
                  <div className="flex items-center">
                    <Warehouse className="h-6 w-6 mr-2" />
                    EMG Warehouse
                  </div>
                  <div className="flex flex-col items-end">
                    {(summaryData.emg as any).lastUpdated && (
                      <span className="text-xs font-normal text-blue-600">
                        Updated: {new Date((summaryData.emg as any).lastUpdated).toLocaleDateString()}
                      </span>
                    )}
                    <span className="text-xs text-blue-500 font-medium">updated daily</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-600">{formatNumber(summaryData.emg.totals.totalSkus)}</p>
                      <p className="text-sm text-muted-foreground">SKUs</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-600">{formatNumber(summaryData.emg.totals.totalOnHand)}</p>
                      <p className="text-sm text-muted-foreground">On Hand</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Net Stock</span>
                      <span className="font-medium">{formatNumber(summaryData.emg.totals.totalNetStock)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${Math.min((summaryData.emg.totals.totalNetStock / summaryData.emg.totals.totalOnHand) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      Allocated: {formatNumber(summaryData.emg.totals.totalAllocated)}
                    </Badge>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      Backorder: {formatNumber(summaryData.emg.totals.totalBackorder)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CATV Warehouse Card */}
            <Card className="border-green-200">
              <CardHeader className="bg-gradient-to-r from-green-50 to-green-100">
                <CardTitle className="flex items-center justify-between text-green-800">
                  <div className="flex items-center">
                    <Warehouse className="h-6 w-6 mr-2" />
                    CATV Warehouse
                  </div>
                  <div className="flex flex-col items-end">
                    {(summaryData.catv as any).lastUpdated && (
                      <span className="text-xs font-normal text-green-600">
                        Updated: {new Date((summaryData.catv as any).lastUpdated).toLocaleDateString()}
                      </span>
                    )}
                    <span className="text-xs text-green-500 font-medium">updated Sunday 02:00 Eastern Time</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-600">{formatNumber(summaryData.catv.metrics.totalIntake)}</p>
                      <p className="text-sm text-muted-foreground">Total Intake</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-600">{formatNumber(summaryData.catv.metrics.activeWip)}</p>
                      <p className="text-sm text-muted-foreground">Active WIP</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>WIP Completion</span>
                      <span className="font-medium">{formatNumber(summaryData.catv.metrics.outflow)}/{formatNumber(summaryData.catv.metrics.totalIntake)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${Math.min((summaryData.catv.metrics.outflow / summaryData.catv.metrics.totalIntake) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      WIP: {formatNumber(summaryData.catv.metrics.activeWip)}
                    </Badge>
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      RMA: {formatNumber(summaryData.catv.metrics.rma)}
                    </Badge>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Out: {formatNumber(summaryData.catv.metrics.outflow)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Amazon Warehouse Card */}
            <Card className="border-orange-200">
              <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100">
                <CardTitle className="flex items-center justify-between text-orange-800">
                  <div className="flex items-center">
                    <Cloud className="h-6 w-6 mr-2" />
                    Amazon FBA
                  </div>
                  <div className="flex flex-col items-end">
                    {(summaryData.amazon as any).lastUpdated && (
                      <span className="text-xs font-normal text-orange-600">
                        Updated: {new Date((summaryData.amazon as any).lastUpdated).toLocaleDateString()}
                      </span>
                    )}
                    <span className="text-xs text-orange-500 font-medium">updated daily</span>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-orange-600">{formatNumber(summaryData.amazon?.totalSkus || 0)}</p>
                      <p className="text-sm text-muted-foreground">SKUs</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-orange-600">{formatNumber(summaryData.amazon?.totalUnits || 0)}</p>
                      <p className="text-sm text-muted-foreground">Total Units</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Fulfillable</span>
                      <span className="font-medium">{formatNumber(summaryData.amazon?.allSkus?.reduce((sum: number, item: any) => sum + (item.fulfillableQuantity || 0), 0) || 0)}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-orange-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${Math.min(((summaryData.amazon?.allSkus?.reduce((sum: number, item: any) => sum + (item.fulfillableQuantity || 0), 0) || 0) / (summaryData.amazon?.totalUnits || 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800">
                      Reserved: {formatNumber(summaryData.amazon?.allSkus?.reduce((sum: number, item: any) => sum + (item.reservedQuantity || 0), 0) || 0)}
                    </Badge>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      Inbound: {formatNumber(summaryData.amazon?.allSkus?.reduce((sum: number, item: any) => sum + (item.inboundQuantity || 0), 0) || 0)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* EMG Top SKUs Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  EMG Top SKUs by Quantity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={emgChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value) => formatNumber(Number(value))} />
                    <Bar dataKey="value" fill={COLORS.emg.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* CATV Top SKUs Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  CATV Top SKUs by Quantity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={catvChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      fontSize={12}
                    />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value) => formatNumber(Number(value))} />
                    <Bar dataKey="value" fill={COLORS.catv.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="emg" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>EMG Warehouse Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{formatNumber(summaryData.emg.totals.totalSkus)}</p>
                    <p className="text-sm text-muted-foreground">Total SKUs</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{formatNumber(summaryData.emg.totals.totalOnHand)}</p>
                    <p className="text-sm text-muted-foreground">On Hand</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">{formatNumber(summaryData.emg.totals.totalAllocated)}</p>
                    <p className="text-sm text-muted-foreground">Allocated</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">{formatNumber(summaryData.emg.totals.totalBackorder)}</p>
                    <p className="text-sm text-muted-foreground">Backorder</p>
                  </div>
                </div>

                <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-2 sm:p-3 sticky left-0 bg-gray-50 z-10">Model</th>
                          <th className="text-left p-2 sm:p-3 hidden md:table-cell">BDI SKU</th>
                          <th className="text-left p-2 sm:p-3 hidden lg:table-cell">Description</th>
                          <th className="text-right p-2 sm:p-3 whitespace-nowrap">On Hand</th>
                          <th className="text-right p-2 sm:p-3 hidden md:table-cell whitespace-nowrap">Cost</th>
                          <th className="text-right p-2 sm:p-3 whitespace-nowrap">Value</th>
                          <th className="text-right p-2 sm:p-3 hidden sm:table-cell">Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaryData.emg.allSkus.map((item: any, index) => (
                          <tr 
                            key={index} 
                            className={`border-b hover:bg-gray-50 transition-colors ${
                              item.hasCost ? 'bg-green-50/30' : ''
                            }`}
                          >
                            <td className="p-2 sm:p-3 font-medium font-mono text-xs sticky left-0 bg-white">{item.model}</td>
                            <td className="p-2 sm:p-3 hidden md:table-cell">
                              {item.bdiSku ? (
                                <span className={`font-semibold px-2 py-1 rounded text-xs ${
                                  item.mappingStatus === 'mapped' 
                                    ? 'text-green-700 bg-green-100' 
                                    : 'text-blue-700 bg-blue-100'
                                }`}>
                                  {item.bdiSku}
                                </span>
                              ) : item.mappingStatus === 'no_mapping' ? (
                                <span className="text-xs text-gray-400 italic">no map</span>
                              ) : (
                                <span className="text-xs text-orange-500 italic">no SKU</span>
                              )}
                            </td>
                            <td className="p-2 sm:p-3 text-muted-foreground text-xs hidden lg:table-cell">{item.description}</td>
                            <td className="p-2 sm:p-3 text-right font-medium">{formatNumber(item.qtyOnHand)}</td>
                            <td className="p-2 sm:p-3 text-right hidden md:table-cell">
                              {item.hasCost ? (
                                <span className="text-green-700 font-semibold">
                                  ${item.standardCost.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-orange-500 text-xs italic">no cost</span>
                              )}
                            </td>
                            <td className="p-2 sm:p-3 text-right">
                              {item.hasCost ? (
                                <span className="text-blue-700 font-bold">
                                  ${formatNumber(Math.round(item.totalValue))}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="p-2 sm:p-3 text-right text-muted-foreground text-xs hidden sm:table-cell">{item.location}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="catv" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>CATV Warehouse Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{formatNumber(summaryData.catv.metrics.totalIntake)}</p>
                    <p className="text-sm text-muted-foreground">Total Intake</p>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{formatNumber(summaryData.catv.metrics.activeWip)}</p>
                    <p className="text-sm text-muted-foreground">Active WIP</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">{formatNumber(summaryData.catv.metrics.rma)}</p>
                    <p className="text-sm text-muted-foreground">RMA</p>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <p className="text-2xl font-bold text-purple-600">{formatNumber(summaryData.catv.metrics.outflow)}</p>
                    <p className="text-sm text-muted-foreground">Outflow</p>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-600">{Math.round(summaryData.catv.metrics.avgAging)}</p>
                    <p className="text-sm text-muted-foreground">Avg. Aging (days)</p>
                  </div>
                </div>

                {/* WIP by Source */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">WIP by Source</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {Object.entries(summaryData.catv.wipTotals.bySource).map(([source, count]) => (
                        <div key={source} className="text-center p-3 bg-gray-50 rounded-lg">
                          <p className="text-xl font-bold">{formatNumber(count)}</p>
                          <p className="text-sm text-muted-foreground">{source}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <div className="overflow-x-auto -mx-2 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50">
                          <th className="text-left p-2 sm:p-3 sticky left-0 bg-gray-50 z-10">Model</th>
                          <th className="text-left p-2 sm:p-3 hidden md:table-cell">BDI SKU</th>
                          <th className="text-right p-2 sm:p-3 whitespace-nowrap">Total</th>
                          <th className="text-right p-2 sm:p-3 hidden sm:table-cell">WIP</th>
                          <th className="text-right p-2 sm:p-3 hidden sm:table-cell">RMA</th>
                          <th className="text-right p-2 sm:p-3 hidden lg:table-cell">Outflow</th>
                          <th className="text-right p-2 sm:p-3 hidden md:table-cell whitespace-nowrap">Cost</th>
                          <th className="text-right p-2 sm:p-3 whitespace-nowrap">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summaryData.catv.allSkus.map((item: any, index) => (
                          <tr 
                            key={index} 
                            className={`border-b hover:bg-gray-50 transition-colors ${
                              item.hasCost ? 'bg-green-50/30' : ''
                            }`}
                          >
                            <td className="p-2 sm:p-3 font-medium font-mono text-xs sticky left-0 bg-white">{item.sku}</td>
                            <td className="p-2 sm:p-3 hidden md:table-cell">
                              {item.bdiSku ? (
                                <span className={`font-semibold px-2 py-1 rounded text-xs ${
                                  item.mappingStatus === 'mapped' 
                                    ? 'text-green-700 bg-green-100' 
                                    : 'text-blue-700 bg-blue-100'
                                }`}>
                                  {item.bdiSku}
                                </span>
                              ) : item.mappingStatus === 'no_mapping' ? (
                                <span className="text-xs text-gray-400 italic">no map</span>
                              ) : (
                                <span className="text-xs text-orange-500 italic">no SKU</span>
                              )}
                            </td>
                            <td className="p-2 sm:p-3 text-right font-medium">{formatNumber(item.totalUnits)}</td>
                            <td className="p-2 sm:p-3 text-right hidden sm:table-cell">{formatNumber(item.stages.WIP || 0)}</td>
                            <td className="p-2 sm:p-3 text-right hidden sm:table-cell">{formatNumber(item.stages.RMA || 0)}</td>
                            <td className="p-2 sm:p-3 text-right hidden lg:table-cell">{formatNumber(item.stages.Outflow || 0)}</td>
                            <td className="p-2 sm:p-3 text-right hidden md:table-cell">
                              {item.hasCost ? (
                                <span className="text-green-700 font-semibold">
                                  ${item.standardCost.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-orange-500 text-xs italic">no cost</span>
                              )}
                            </td>
                            <td className="p-2 sm:p-3 text-right">
                              {item.hasCost ? (
                                <span className="text-blue-700 font-bold">
                                  ${formatNumber(Math.round(item.totalValue))}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="amazon" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold">
                    A
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base sm:text-lg">Amazon FBA Inventory</span>
                    {(summaryData.amazon as any).lastUpdated && (
                      <span className="text-xs font-normal text-muted-foreground">
                        Updated: {new Date((summaryData.amazon as any).lastUpdated).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </CardTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="default"
                    size="sm"
                    disabled={fetchingFromAmazon || uploading}
                    onClick={handleFetchFromAmazon}
                    className="flex-1 sm:flex-none"
                  >
                    {fetchingFromAmazon ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        <span className="hidden sm:inline">Fetching...</span>
                        <span className="inline sm:hidden">Fetching</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Fetch from Amazon</span>
                        <span className="inline sm:hidden">Fetch</span>
                      </>
                    )}
                  </Button>
                  <input
                    type="file"
                    id="amazon-upload"
                    accept=".csv"
                    onChange={handleAmazonUpload}
                    disabled={uploading || fetchingFromAmazon}
                    className="hidden"
                  />
                  <label htmlFor="amazon-upload" className="flex-1 sm:flex-none">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={uploading || fetchingFromAmazon}
                      asChild
                      className="w-full"
                    >
                      <span className="cursor-pointer">
                        {uploading ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            <span className="hidden sm:inline">Uploading...</span>
                            <span className="inline sm:hidden">Upload</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-1 sm:mr-2" />
                            <span className="hidden sm:inline">Upload CSV</span>
                            <span className="inline sm:hidden">CSV</span>
                          </>
                        )}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
              {fetchProgress && (
                <div className={`mt-2 text-sm ${fetchProgress.startsWith('✅') ? 'text-green-600' : fetchProgress.startsWith('❌') ? 'text-red-600' : 'text-blue-600'}`}>
                  {fetchProgress}
                </div>
              )}
              {uploadProgress && (
                <div className={`mt-2 text-sm ${uploadProgress.startsWith('✅') ? 'text-green-600' : uploadProgress.startsWith('❌') ? 'text-red-600' : 'text-blue-600'}`}>
                  {uploadProgress}
                </div>
              )}
            </CardHeader>
            <CardContent>
              {summaryData.amazon.allSkus.length === 0 ? (
                <div className="text-center py-12">
                  <div className="h-16 w-16 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 flex items-center justify-center text-white font-bold text-2xl mx-auto mb-4">
                    <FileUp className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No Amazon Inventory Data</h3>
                  <p className="text-muted-foreground mb-4">
                    Click "Fetch from Amazon" to get real-time inventory, or upload a CSV file
                  </p>
                  <div className="max-w-md mx-auto text-left bg-gray-50 rounded-lg p-4 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-green-600 mb-1">✨ Recommended: Fetch from Amazon</p>
                      <p className="text-xs text-muted-foreground">
                        Get real-time inventory including FBA units and inbound shipments
                      </p>
                    </div>
                    <div className="border-t pt-2">
                      <p className="text-sm font-medium mb-1">Alternative: Upload CSV</p>
                      <ol className="text-xs text-muted-foreground space-y-1 ml-4 list-decimal">
                        <li>Go to Amazon Data → Reports</li>
                        <li>Download "FBA Inventory" report</li>
                        <li>Upload the CSV file here</li>
                      </ol>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">{formatNumber(summaryData.amazon.totalSkus)}</p>
                      <p className="text-sm text-muted-foreground">Total SKUs</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">{formatNumber(summaryData.amazon.totalUnits)}</p>
                      <p className="text-sm text-muted-foreground">Fulfillable Units</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        ${formatNumber(Math.round(summaryData.amazon.inventoryValue.totalValue))}
                      </p>
                      <p className="text-sm text-muted-foreground">Inventory Value</p>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-600">
                        {summaryData.amazon.lastUpdated ? new Date(summaryData.amazon.lastUpdated).toLocaleDateString() : 'N/A'}
                      </p>
                      <p className="text-sm text-muted-foreground">Last Updated</p>
                    </div>
                  </div>

                  {/* Inventory Value Card */}
                  {summaryData.amazon.inventoryValue.hasCostData && (
                    <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-white">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <div className="h-10 w-10 rounded-full bg-orange-600 flex items-center justify-center">
                              <Package className="h-6 w-6 text-white" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Amazon FBA</p>
                              <p className="text-xs text-muted-foreground">Inventory Value</p>
                            </div>
                          </div>
                        </div>
                        <p className="text-4xl font-bold text-orange-600">
                          ${formatNumber(Math.round(summaryData.amazon.inventoryValue.totalValue))}
                        </p>
                        <div className="mt-3 pt-3 border-t border-orange-200">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">SKUs with cost data:</span>
                            <span className="font-medium text-green-600">{summaryData.amazon.inventoryValue.skusWithCost}</span>
                          </div>
                          {summaryData.amazon.inventoryValue.skusWithoutCost > 0 && (
                            <div className="flex justify-between text-sm mt-1">
                              <span className="text-muted-foreground">SKUs without cost:</span>
                              <span className="font-medium text-orange-600">{summaryData.amazon.inventoryValue.skusWithoutCost}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* SKU Table */}
                  <div className="overflow-x-auto -mx-2 sm:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <table className="w-full text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="text-left p-2 sm:p-3 sticky left-0 bg-gray-50 z-10">Amazon SKU</th>
                            <th className="text-left p-2 sm:p-3 hidden md:table-cell">BDI SKU</th>
                            <th className="text-left p-2 sm:p-3 hidden lg:table-cell">ASIN</th>
                            <th className="text-right p-2 sm:p-3 whitespace-nowrap">Fulfill.</th>
                            <th className="text-right p-2 sm:p-3 hidden sm:table-cell whitespace-nowrap">Reserved</th>
                            <th className="text-right p-2 sm:p-3 hidden lg:table-cell whitespace-nowrap">Unsell.</th>
                            <th className="text-right p-2 sm:p-3 whitespace-nowrap">Inbound</th>
                            <th className="text-right p-2 sm:p-3 hidden md:table-cell whitespace-nowrap">Cost</th>
                            <th className="text-right p-2 sm:p-3 whitespace-nowrap">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summaryData.amazon.allSkus.map((item: any, index) => (
                            <tr 
                              key={index} 
                              className={`border-b hover:bg-gray-50 ${item.hasCost ? 'bg-green-50/30' : ''}`}
                            >
                              <td className="p-2 sm:p-3 font-medium sticky left-0 bg-white text-xs sm:text-sm">{item.sku}</td>
                              <td className="p-2 sm:p-3 hidden md:table-cell">
                                {item.bdiSku && item.mappingStatus === 'mapped' ? (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300 text-xs">
                                    {item.bdiSku}
                                  </Badge>
                                ) : item.bdiSku && item.mappingStatus === 'direct_match' ? (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 text-xs">
                                    {item.bdiSku}
                                  </Badge>
                                ) : item.mappingStatus === 'no_mapping' ? (
                                  <span className="text-gray-400 italic text-xs">no map</span>
                                ) : (
                                  <span className="text-orange-500 italic text-xs">no SKU</span>
                                )}
                              </td>
                              <td className="p-2 sm:p-3 text-gray-600 text-xs hidden lg:table-cell">{item.asin || '—'}</td>
                              <td className="p-2 sm:p-3 text-right font-medium">{formatNumber(item.fulfillableQuantity)}</td>
                              <td className="p-2 sm:p-3 text-right text-gray-600 hidden sm:table-cell">{formatNumber(item.reservedQuantity)}</td>
                              <td className="p-2 sm:p-3 text-right text-orange-600 hidden lg:table-cell">{formatNumber(item.unsellableQuantity)}</td>
                              <td className="p-2 sm:p-3 text-right text-blue-600">{formatNumber(item.inboundQuantity)}</td>
                              <td className="p-2 sm:p-3 text-right hidden md:table-cell">
                                {item.hasCost ? (
                                  <span className="text-green-600 font-medium">${item.standardCost.toFixed(2)}</span>
                                ) : (
                                  <span className="text-orange-500 italic text-xs">no cost</span>
                                )}
                              </td>
                              <td className="p-2 sm:p-3 text-right">
                                {item.hasCost ? (
                                  <span className="text-blue-700 font-bold">
                                    ${formatNumber(Math.round(item.totalValue))}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer Actions */}
      <div className="flex justify-end space-x-4 pt-6 border-t">
        <Button variant="outline" onClick={fetchSummaryData}>
          Refresh Data
        </Button>
        <Button onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
