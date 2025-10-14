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
  PieChart
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
    topSkus: Array<{
      model: string;
      description: string;
      location: string;
      qtyOnHand: number;
      netStock: number;
    }>;
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
    topSkus: Array<{
      sku: string;
      totalUnits: number;
      stages: Record<string, number>;
    }>;
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

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="emg">EMG Warehouse</TabsTrigger>
          <TabsTrigger value="catv">CATV Warehouse</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Warehouse Comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* EMG Warehouse Card */}
            <Card className="border-blue-200">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
                <CardTitle className="flex items-center text-blue-800">
                  <Warehouse className="h-6 w-6 mr-2" />
                  EMG Warehouse
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
                <CardTitle className="flex items-center text-green-800">
                  <Warehouse className="h-6 w-6 mr-2" />
                  CATV Warehouse
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

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Model</th>
                        <th className="text-left p-2">Description</th>
                        <th className="text-right p-2">On Hand</th>
                        <th className="text-right p-2">Net Stock</th>
                        <th className="text-right p-2">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.emg.topSkus.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-medium">{item.model}</td>
                          <td className="p-2 text-muted-foreground">{item.description}</td>
                          <td className="p-2 text-right">{formatNumber(item.qtyOnHand)}</td>
                          <td className="p-2 text-right">{formatNumber(item.netStock)}</td>
                          <td className="p-2 text-right text-muted-foreground">{item.location}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">SKU</th>
                        <th className="text-right p-2">Total Units</th>
                        <th className="text-right p-2">WIP</th>
                        <th className="text-right p-2">RMA</th>
                        <th className="text-right p-2">Outflow</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryData.catv.topSkus.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="p-2 font-medium">{item.sku}</td>
                          <td className="p-2 text-right">{formatNumber(item.totalUnits)}</td>
                          <td className="p-2 text-right">{formatNumber(item.stages.WIP || 0)}</td>
                          <td className="p-2 text-right">{formatNumber(item.stages.RMA || 0)}</td>
                          <td className="p-2 text-right">{formatNumber(item.stages.Outflow || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
