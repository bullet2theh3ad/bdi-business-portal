'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { Separator } from '@/components/ui/separator';

interface AnalyticsData {
  invoices: {
    count: number;
    totalValue: number;
    avgValue: number;
    units: number;
  };
  purchaseOrders: {
    count: number;
    totalValue: number;
    avgValue: number;
    units: number;
  };
  forecasts: {
    count: number;
    totalUnits: number;
    avgUnits: number;
    skuCount: number;
  };
  skus: {
    totalCount: number;
    activeCount: number;
  };
  organizations: {
    totalCount: number;
    activeCount: number;
  };
  shipments: {
    count: number;
    totalUnits: number;
  };
}

interface TimeSeriesData {
  date: string;
  invoices: number;
  purchaseOrders: number;
  forecasts: number;
  invoiceValue: number;
  poValue: number;
  units: number;
}

interface InvoiceByOrgData {
  month: string;
  organizations: {
    [orgCode: string]: {
      value: number;
      count: number;
      color: string;
    };
  };
  total: number;
}

interface ForecastDeliveryData {
  deliveryWeek: string;
  deliveryDate: string;
  forecasts: Array<{
    id: string;
    skuName: string;
    quantity: number;
    organization: string;
    status: string;
    confidence: string;
  }>;
  totalUnits: number;
}

export default function AnalyticsPage() {
  const [user, setUser] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [invoicesByOrg, setInvoicesByOrg] = useState<InvoiceByOrgData[]>([]);
  const [forecastDeliveries, setForecastDeliveries] = useState<ForecastDeliveryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [selectedMetric, setSelectedMetric] = useState<'count' | 'value' | 'units'>('count');
  const [askBdiQuery, setAskBdiQuery] = useState('');

  // Organization colors for consistent branding
  const orgColors: { [key: string]: string } = {
    'BDI': '#1e3a8a', // Blue
    'MTN': '#059669', // Green  
    'TC1': '#dc2626', // Red
    'OLM': '#7c3aed', // Purple
    'EMG': '#ea580c', // Orange
    'GPN': '#0891b2', // Cyan
    'HSN': '#be185d', // Pink
    'QVC': '#65a30d', // Lime
  };

  // Fetch user data
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/user');
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };
    fetchUser();
  }, []);

  // Fetch analytics data
  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const [basicResponse, invoicesResponse, forecastsResponse] = await Promise.all([
          fetch(`/api/admin/analytics?period=${selectedPeriod}&metric=${selectedMetric}`),
          fetch('/api/admin/analytics/invoices-by-org'),
          fetch('/api/admin/analytics/forecast-deliveries')
        ]);
        
        if (basicResponse.ok) {
          const data = await basicResponse.json();
          setAnalyticsData(data.summary);
          setTimeSeriesData(data.timeSeries);
        }
        
        if (invoicesResponse.ok) {
          const invoicesData = await invoicesResponse.json();
          setInvoicesByOrg(invoicesData);
        }
        
        if (forecastsResponse.ok) {
          const forecastsData = await forecastsResponse.json();
          setForecastDeliveries(forecastsData);
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchAnalytics();
    }
  }, [user, selectedPeriod, selectedMetric]);

  // Stacked Invoice Chart by Organization
  const InvoicesByOrgChart = ({ data }: { data: InvoiceByOrgData[] }) => {
    if (!data.length) return <div className="h-80 flex items-center justify-center text-gray-500">No invoice data available</div>;

    const maxValue = Math.max(...data.map(d => d.total));
    const allOrgs = Array.from(new Set(data.flatMap(d => Object.keys(d.organizations))));

    return (
      <div className="h-80 relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 w-16 flex flex-col justify-between text-xs text-gray-500 pr-2">
          <span>${(maxValue / 1000).toFixed(0)}K</span>
          <span>${(maxValue * 0.75 / 1000).toFixed(0)}K</span>
          <span>${(maxValue * 0.5 / 1000).toFixed(0)}K</span>
          <span>${(maxValue * 0.25 / 1000).toFixed(0)}K</span>
          <span>$0</span>
        </div>
        
        {/* Chart bars */}
        <div className="ml-16 h-full flex items-end space-x-2">
          {data.map((monthData, index) => (
            <div key={index} className="flex-1 flex flex-col items-center">
              {/* Stacked bar */}
              <div className="w-full flex flex-col justify-end" style={{ height: '85%' }}>
                {allOrgs.map((orgCode, orgIndex) => {
                  const orgData = monthData.organizations[orgCode];
                  if (!orgData || orgData.value === 0) return null;
                  
                  const height = (orgData.value / maxValue) * 100;
                  const color = orgColors[orgCode] || '#6b7280';
                  
                  return (
                    <div
                      key={orgCode}
                      className="w-full transition-all duration-300 hover:opacity-80 border-r border-white"
                      style={{ 
                        height: `${height}%`,
                        backgroundColor: color,
                        borderTopLeftRadius: orgIndex === 0 ? '4px' : '0',
                        borderTopRightRadius: orgIndex === 0 ? '4px' : '0'
                      }}
                      title={`${orgCode}: $${orgData.value.toLocaleString()} (${orgData.count} invoices)`}
                    />
                  );
                })}
              </div>
              
              {/* Month label */}
              <span className="text-xs text-gray-500 mt-2 font-medium">
                {monthData.month}
              </span>
              
              {/* Total value */}
              <span className="text-xs text-gray-700 font-semibold">
                ${(monthData.total / 1000).toFixed(0)}K
              </span>
            </div>
          ))}
        </div>
        
        {/* Legend */}
        <div className="absolute top-0 right-0 flex flex-wrap gap-2">
          {allOrgs.map(orgCode => (
            <div key={orgCode} className="flex items-center space-x-1">
              <div 
                className="w-3 h-3 rounded"
                style={{ backgroundColor: orgColors[orgCode] || '#6b7280' }}
              />
              <span className="text-xs font-medium">{orgCode}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Forecast Delivery Timeline Chart
  const ForecastDeliveryChart = ({ data }: { data: ForecastDeliveryData[] }) => {
    if (!data.length) return <div className="h-80 flex items-center justify-center text-gray-500">No forecast delivery data available</div>;

    const maxUnits = Math.max(...data.map(d => d.totalUnits));

    return (
      <div className="h-80 relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 w-16 flex flex-col justify-between text-xs text-gray-500 pr-2">
          <span>{(maxUnits / 1000).toFixed(0)}K</span>
          <span>{(maxUnits * 0.75 / 1000).toFixed(0)}K</span>
          <span>{(maxUnits * 0.5 / 1000).toFixed(0)}K</span>
          <span>{(maxUnits * 0.25 / 1000).toFixed(0)}K</span>
          <span>0</span>
        </div>
        
        {/* Timeline bars */}
        <div className="ml-16 h-full flex items-end space-x-1">
          {data.map((weekData, index) => {
            const height = (weekData.totalUnits / maxUnits) * 100;
            const statusCounts = weekData.forecasts.reduce((acc, f) => {
              acc[f.status] = (acc[f.status] || 0) + 1;
              return acc;
            }, {} as { [key: string]: number });
            
            const isSubmitted = statusCounts.submitted > 0;
            const isDraft = statusCounts.draft > 0;
            
            return (
              <div key={index} className="flex-1 flex flex-col items-center group">
                {/* Bar with gradient based on status */}
                <div 
                  className={`w-full rounded-t transition-all duration-300 hover:scale-105 ${
                    isSubmitted ? 'bg-gradient-to-t from-blue-600 to-blue-400' :
                    isDraft ? 'bg-gradient-to-t from-orange-500 to-orange-300' :
                    'bg-gradient-to-t from-gray-400 to-gray-300'
                  }`}
                  style={{ height: `${Math.max(height, 2)}%` }}
                  title={`${weekData.deliveryWeek}: ${weekData.totalUnits.toLocaleString()} units (${weekData.forecasts.length} forecasts)`}
                />
                
                {/* Week label */}
                <span className="text-xs text-gray-500 mt-1 transform -rotate-45 origin-left">
                  {weekData.deliveryWeek.replace('2025-W', 'W')}
                </span>
                
                {/* Units count */}
                <span className="text-xs text-gray-700 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                  {(weekData.totalUnits / 1000).toFixed(1)}K
                </span>
                
                {/* Status indicators */}
                <div className="flex space-x-1 mt-1">
                  {isSubmitted && <div className="w-2 h-2 bg-blue-500 rounded-full" title="Submitted forecasts" />}
                  {isDraft && <div className="w-2 h-2 bg-orange-500 rounded-full" title="Draft forecasts" />}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Status legend */}
        <div className="absolute top-0 right-0 flex space-x-4">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-500 rounded" />
            <span className="text-xs font-medium">Submitted</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-orange-500 rounded" />
            <span className="text-xs font-medium">Draft</span>
          </div>
        </div>
      </div>
    );
  };

  // Simple chart component (existing)
  const SimpleChart = ({ data, metric }: { data: TimeSeriesData[], metric: string }) => {
    if (!data.length) return <div className="h-64 flex items-center justify-center text-gray-500">No data available</div>;

    const maxValue = Math.max(...data.map(d => {
      switch (metric) {
        case 'count': return Math.max(d.invoices, d.purchaseOrders, d.forecasts);
        case 'value': return Math.max(d.invoiceValue, d.poValue);
        case 'units': return d.units;
        default: return 0;
      }
    }));

    return (
      <div className="h-64 relative">
        <div className="absolute inset-0 flex flex-col">
          {/* Y-axis labels */}
          <div className="flex-1 flex flex-col justify-between text-xs text-gray-500 pr-2">
            <span>{maxValue.toLocaleString()}</span>
            <span>{(maxValue * 0.75).toLocaleString()}</span>
            <span>{(maxValue * 0.5).toLocaleString()}</span>
            <span>{(maxValue * 0.25).toLocaleString()}</span>
            <span>0</span>
          </div>
        </div>
        <div className="ml-12 h-full flex items-end space-x-1">
          {data.map((item, index) => {
            let height = 0;
            let color = 'bg-blue-500';
            
            switch (metric) {
              case 'count':
                height = (item.invoices / maxValue) * 100;
                color = 'bg-blue-500';
                break;
              case 'value':
                height = (item.invoiceValue / maxValue) * 100;
                color = 'bg-green-500';
                break;
              case 'units':
                height = (item.units / maxValue) * 100;
                color = 'bg-purple-500';
                break;
            }
            
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className={`w-full ${color} rounded-t transition-all duration-300 hover:opacity-80`}
                  style={{ height: `${Math.max(height, 2)}%` }}
                  title={`${item.date}: ${height.toFixed(0)}%`}
                />
                <span className="text-xs text-gray-500 mt-1 transform -rotate-45 origin-left">
                  {new Date(item.date).toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Access control
  if (!user || !['super_admin', 'admin'].includes(user.role)) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="analytics" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Admin access required for analytics dashboard.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive insights into your CPFR processes and business metrics
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          <SemanticBDIIcon semantic="analytics" size={14} className="mr-1" />
          Real-time Data
        </Badge>
      </div>

      {/* Ask BDI AI Section - Placeholder */}
      <Card className="border-2 border-dashed border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-800">
            <SemanticBDIIcon semantic="ai" size={20} className="mr-2" />
            Ask BDI (Coming Soon)
          </CardTitle>
          <CardDescription>
            Ask questions about your data and get AI-powered insights and analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-3">
            <div className="flex-1">
              <Input
                placeholder="e.g., 'What are our top performing SKUs this month?' or 'Show me invoice trends by organization'"
                value={askBdiQuery}
                onChange={(e) => setAskBdiQuery(e.target.value)}
                disabled
                className="bg-white"
              />
            </div>
            <Button disabled className="bg-blue-600 hover:bg-blue-700">
              <SemanticBDIIcon semantic="query" size={16} className="mr-2" />
              Ask BDI
            </Button>
          </div>
          <p className="text-sm text-blue-600 mt-2">
            🚀 This feature integrates with BDI's SecureAI — powered by Retrieval-Augmented Generation (RAG) — to deliver intelligent, secure analysis of your business data.
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <Label>Time Period:</Label>
          <div className="flex space-x-1">
            {[
              { key: 'day', label: 'Daily' },
              { key: 'week', label: 'Weekly' },
              { key: 'month', label: 'Monthly' },
              { key: 'year', label: 'Yearly' }
            ].map((period) => (
              <Button
                key={period.key}
                variant={selectedPeriod === period.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPeriod(period.key as any)}
              >
                {period.label}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Label>Metric:</Label>
          <div className="flex space-x-1">
            {[
              { key: 'count', label: 'Count', icon: 'orders' },
              { key: 'value', label: 'Value', icon: 'analytics' },
              { key: 'units', label: 'Units', icon: 'inventory' }
            ].map((metric) => (
              <Button
                key={metric.key}
                variant={selectedMetric === metric.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedMetric(metric.key as any)}
              >
                <SemanticBDIIcon semantic={metric.icon as any} size={14} className="mr-1" />
                {metric.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading analytics data...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          {analyticsData && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
                  <SemanticBDIIcon semantic="orders" size={16} className="text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsData.invoices.count.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    ${analyticsData.invoices.totalValue.toLocaleString()} total value
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analyticsData.invoices.units.toLocaleString()} total units
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Purchase Orders</CardTitle>
                  <SemanticBDIIcon semantic="orders" size={16} className="text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsData.purchaseOrders.count.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    ${analyticsData.purchaseOrders.totalValue.toLocaleString()} total value
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analyticsData.purchaseOrders.units.toLocaleString()} total units
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Forecasts</CardTitle>
                  <SemanticBDIIcon semantic="analytics" size={16} className="text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsData.forecasts.count.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    {analyticsData.forecasts.totalUnits.toLocaleString()} total units
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analyticsData.forecasts.skuCount} unique SKUs
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active SKUs</CardTitle>
                  <SemanticBDIIcon semantic="inventory" size={16} className="text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analyticsData.skus.activeCount.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    of {analyticsData.skus.totalCount} total SKUs
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {analyticsData.organizations.activeCount} active organizations
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Cool Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Invoice Values by Organization - Stacked Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <SemanticBDIIcon semantic="analytics" size={20} className="mr-2 text-blue-600" />
                  Invoice Values by Organization
                </CardTitle>
                <CardDescription>Monthly breakdown showing invoice amounts per organization (stacked view)</CardDescription>
              </CardHeader>
              <CardContent>
                <InvoicesByOrgChart data={invoicesByOrg} />
              </CardContent>
            </Card>

            {/* Forecast Delivery Timeline - Super Cool! */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-lg">
                  <SemanticBDIIcon semantic="calendar" size={20} className="mr-2 text-purple-600" />
                  Forecast Delivery Timeline
                </CardTitle>
                <CardDescription>Weekly forecast deliveries with status indicators - the future pipeline!</CardDescription>
              </CardHeader>
              <CardContent>
                <ForecastDeliveryChart data={forecastDeliveries} />
              </CardContent>
            </Card>
          </div>

          {/* Main Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <SemanticBDIIcon semantic="charts" size={20} className="mr-2" />
                {selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}ly Trends - {selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}
              </CardTitle>
              <CardDescription>
                {selectedPeriod === 'day' && 'Daily trends over the last 30 days'}
                {selectedPeriod === 'week' && 'Weekly trends over the last 12 weeks'}
                {selectedPeriod === 'month' && 'Monthly trends over the last 12 months'}
                {selectedPeriod === 'year' && 'Yearly trends over the last 5 years'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SimpleChart data={timeSeriesData} metric={selectedMetric} />
            </CardContent>
          </Card>

          {/* Process Health Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">CPFR Process Health</CardTitle>
                <CardDescription>Overview of collaborative planning metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Forecasts vs Invoices Ratio</span>
                    <Badge variant="outline">
                      {analyticsData ? (analyticsData.forecasts.count / Math.max(analyticsData.invoices.count, 1)).toFixed(2) : '0'} : 1
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Forecast Units</span>
                    <Badge variant="outline">
                      {analyticsData?.forecasts.avgUnits.toLocaleString() || '0'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average Invoice Value</span>
                    <Badge variant="outline">
                      ${analyticsData?.invoices.avgValue.toLocaleString() || '0'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average PO Value</span>
                    <Badge variant="outline">
                      ${analyticsData?.purchaseOrders.avgValue.toLocaleString() || '0'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Organization Activity</CardTitle>
                <CardDescription>Partner engagement and collaboration metrics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Organizations</span>
                    <Badge className="bg-bdi-green-1 text-white">
                      {analyticsData?.organizations.activeCount || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Organizations</span>
                    <Badge variant="outline">
                      {analyticsData?.organizations.totalCount || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Shipments</span>
                    <Badge variant="outline">
                      {analyticsData?.shipments.count || 0}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Units in Transit</span>
                    <Badge variant="outline">
                      {analyticsData?.shipments.totalUnits.toLocaleString() || '0'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
