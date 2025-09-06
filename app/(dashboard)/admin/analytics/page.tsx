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

export default function AnalyticsPage() {
  const [user, setUser] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [selectedMetric, setSelectedMetric] = useState<'count' | 'value' | 'units'>('count');
  const [askBdiQuery, setAskBdiQuery] = useState('');

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
        const response = await fetch(`/api/admin/analytics?period=${selectedPeriod}&metric=${selectedMetric}`);
        if (response.ok) {
          const data = await response.json();
          setAnalyticsData(data.summary);
          setTimeSeriesData(data.timeSeries);
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

  // Simple chart component
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

          {/* Main Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <SemanticBDIIcon semantic="analytics" size={20} className="mr-2" />
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

          {/* Additional Charts Grid */}
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
