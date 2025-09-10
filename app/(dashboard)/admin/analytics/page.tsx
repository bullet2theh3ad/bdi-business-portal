'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { Separator } from '@/components/ui/separator';
import { useSimpleTranslations, getUserLocale } from '@/lib/i18n/simple-translator';
import { DynamicTranslation } from '@/components/DynamicTranslation';
import useSWR from 'swr';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  AreaChart,
  Area
} from 'recharts';

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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AnalyticsPage() {
  const { data: user } = useSWR('/api/user', fetcher);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  
  // 🌍 Translation hooks for dynamic content
  const userLocale = getUserLocale(user);
  const { tc } = useSimpleTranslations(userLocale);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [invoicesByOrg, setInvoicesByOrg] = useState<InvoiceByOrgData[]>([]);
  const [forecastDeliveries, setForecastDeliveries] = useState<ForecastDeliveryData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [selectedMetric, setSelectedMetric] = useState<'count' | 'value' | 'units'>('count');
  const [askBdiQuery, setAskBdiQuery] = useState('');
  const [showAskBdiModal, setShowAskBdiModal] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{id: string, type: 'user' | 'assistant', content: string, timestamp: Date}>>([]);
  const [isThinking, setIsThinking] = useState(false);

  // Handle Ask BDI question submission
  const handleAskBDI = async () => {
    if (!askBdiQuery.trim()) return;
    
    const userMessage = {
      id: Date.now().toString(),
      type: 'user' as const,
      content: askBdiQuery,
      timestamp: new Date()
    };
    
    setChatHistory(prev => [...prev, userMessage]);
    setIsThinking(true);
    setShowAskBdiModal(true);
    setAskBdiQuery('');
    
    try {
      // Gather business context
      const businessContext = {
        currentPage: 'analytics',
        dateRange: { startDate, endDate },
        totalForecasts: forecastDeliveries.length,
        totalInvoices: invoicesByOrg.reduce((sum, org) => sum + Object.values(org.organizations).reduce((orgSum, orgData) => orgSum + orgData.count, 0), 0),
        organizations: invoicesByOrg.map(org => org.month),
        selectedPeriod,
        selectedMetric
      };
      
      const response = await fetch('/api/admin/ask-bdi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: askBdiQuery,
          context: businessContext,
          chatHistory: chatHistory.slice(-10) // Last 10 messages for context
        })
      });
      
      const result = await response.json();
      
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant' as const,
        content: result.answer || 'I apologize, but I encountered an error processing your question.',
        timestamp: new Date()
      };
      
      setChatHistory(prev => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error('Ask BDI error:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant' as const,
        content: 'I apologize, but I encountered a technical error. Please try again.',
        timestamp: new Date()
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsThinking(false);
    }
  };

  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3); // Default to 3 months ago
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

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
          // User data now handled by SWR
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
          fetch(`/api/admin/analytics?period=${selectedPeriod}&metric=${selectedMetric}&startDate=${startDate}&endDate=${endDate}`),
          fetch(`/api/admin/analytics/invoices-by-org?startDate=${startDate}&endDate=${endDate}`),
          fetch(`/api/admin/analytics/forecast-deliveries?startDate=${startDate}&endDate=${endDate}`)
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
  }, [user, selectedPeriod, selectedMetric, startDate, endDate]);

  // Ultra-Cool Stacked Invoice Chart by Organization
  const InvoicesByOrgChart = ({ data }: { data: InvoiceByOrgData[] }) => {
    if (!data.length) return <div className="h-80 flex items-center justify-center text-gray-500">No invoice data available</div>;

    // Transform data for Recharts stacked bar chart
    const chartData = data.map(monthData => {
      const result: any = { month: monthData.month };
      Object.entries(monthData.organizations).forEach(([orgCode, orgData]) => {
        result[orgCode] = orgData.value;
      });
      return result;
    });

    const allOrgs = Array.from(new Set(data.flatMap(d => Object.keys(d.organizations))));

    return (
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="month" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
            />
            <Tooltip 
              formatter={(value: any, name: string) => [`$${Number(value).toLocaleString()}`, name]}
              labelFormatter={(label) => `Month: ${label}`}
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
            <Legend />
            {allOrgs.map((orgCode) => (
              <Bar
                key={orgCode}
                dataKey={orgCode}
                stackId="invoices"
                fill={orgColors[orgCode] || '#6b7280'}
                radius={[0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Ultra-Cool Forecast Delivery Timeline Chart
  const ForecastDeliveryChart = ({ data }: { data: ForecastDeliveryData[] }) => {
    if (!data.length) return <div className="h-80 flex items-center justify-center text-gray-500">No forecast delivery data available</div>;

    // Transform data for Recharts area chart
    const chartData = data.map(weekData => ({
      week: weekData.deliveryWeek.replace('2025-W', 'W'),
      totalUnits: weekData.totalUnits,
      submittedUnits: weekData.forecasts
        .filter(f => f.status === 'submitted')
        .reduce((sum, f) => sum + f.quantity, 0),
      draftUnits: weekData.forecasts
        .filter(f => f.status === 'draft')
        .reduce((sum, f) => sum + f.quantity, 0),
      forecastCount: weekData.forecasts.length
    }));

    return (
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="submittedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.2}/>
              </linearGradient>
              <linearGradient id="draftGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.2}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="week" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
            />
            <Tooltip 
              formatter={(value: any, name: string) => [
                `${Number(value).toLocaleString()} units`, 
                name === 'submittedUnits' ? 'Submitted' : 
                name === 'draftUnits' ? 'Draft' : 'Total'
              ]}
              labelFormatter={(label) => `Week: ${label}`}
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="submittedUnits"
              stackId="1"
              stroke="#3b82f6"
              fill="url(#submittedGradient)"
              name="Submitted"
            />
            <Area
              type="monotone"
              dataKey="draftUnits"
              stackId="1"
              stroke="#f59e0b"
              fill="url(#draftGradient)"
              name="Draft"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  // Ultra-Cool Multi-Line Trends Chart
  const TrendsChart = ({ data, metric }: { data: TimeSeriesData[], metric: string }) => {
    if (!data.length) return <div className="h-64 flex items-center justify-center text-gray-500">No data available</div>;

    // Transform data for better date formatting
    const chartData = data.map(item => ({
      ...item,
      dateFormatted: new Date(item.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    }));

    const getDataKey = (metric: string) => {
      switch (metric) {
        case 'value': return ['invoiceValue', 'poValue'];
        case 'units': return ['units'];
        default: return ['invoices', 'purchaseOrders', 'forecasts'];
      }
    };

    const dataKeys = getDataKey(metric);
    const formatValue = (value: number) => {
      if (metric === 'value') return `$${(value / 1000).toFixed(0)}K`;
      if (metric === 'units') return `${(value / 1000).toFixed(1)}K`;
      return value.toString();
    };

    return (
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="dateFormatted" 
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={formatValue}
            />
            <Tooltip 
              formatter={(value: any, name: string) => [
                formatValue(Number(value)), 
                name === 'invoiceValue' ? 'Invoice Value' :
                name === 'poValue' ? 'PO Value' :
                name === 'purchaseOrders' ? 'Purchase Orders' :
                name.charAt(0).toUpperCase() + name.slice(1)
              ]}
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
              }}
            />
            <Legend />
            {dataKeys.includes('invoices') && (
              <Line 
                type="monotone" 
                dataKey="invoices" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                name="Invoices"
              />
            )}
            {dataKeys.includes('purchaseOrders') && (
              <Line 
                type="monotone" 
                dataKey="purchaseOrders" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                name="Purchase Orders"
              />
            )}
            {dataKeys.includes('forecasts') && (
              <Line 
                type="monotone" 
                dataKey="forecasts" 
                stroke="#8b5cf6" 
                strokeWidth={3}
                dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#8b5cf6', strokeWidth: 2 }}
                name="Forecasts"
              />
            )}
            {dataKeys.includes('invoiceValue') && (
              <Line 
                type="monotone" 
                dataKey="invoiceValue" 
                stroke="#059669" 
                strokeWidth={3}
                dot={{ fill: '#059669', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#059669', strokeWidth: 2 }}
                name="Invoice Value"
              />
            )}
            {dataKeys.includes('poValue') && (
              <Line 
                type="monotone" 
                dataKey="poValue" 
                stroke="#dc2626" 
                strokeWidth={3}
                dot={{ fill: '#dc2626', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#dc2626', strokeWidth: 2 }}
                name="PO Value"
              />
            )}
            {dataKeys.includes('units') && (
              <Line 
                type="monotone" 
                dataKey="units" 
                stroke="#7c3aed" 
                strokeWidth={3}
                dot={{ fill: '#7c3aed', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, stroke: '#7c3aed', strokeWidth: 2 }}
                name="Total Units"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
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
    <div className="flex-1 p-3 sm:p-4 lg:p-8 space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Comprehensive insights into your CPFR processes and business metrics
          </p>
        </div>
        <Badge variant="outline" className="text-xs sm:text-sm w-fit">
          <SemanticBDIIcon semantic="analytics" size={14} className="mr-1" />
          Real-time Data
        </Badge>
      </div>

      {/* Ask BDI AI Section - Placeholder */}
      <Card className="border-2 border-dashed border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center text-blue-800">
            <SemanticBDIIcon semantic="ai" size={20} className="mr-2" />
            <DynamicTranslation userLanguage={userLocale} context="business">
              Ask BDI (Coming Soon)
            </DynamicTranslation>
          </CardTitle>
          <CardDescription>
            <DynamicTranslation userLanguage={userLocale} context="business">
              Ask questions about your data and get AI-powered insights and analysis
            </DynamicTranslation>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-3">
            <div className="flex-1">
              <Input
                placeholder="e.g., 'What are our top performing SKUs this month?' or 'Show me invoice trends by organization'"
                value={askBdiQuery}
                onChange={(e) => setAskBdiQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAskBDI()}
                className="bg-white"
              />
            </div>
            <Button onClick={handleAskBDI} disabled={!askBdiQuery.trim()} className="bg-blue-600 hover:bg-blue-700">
              <SemanticBDIIcon semantic="query" size={16} className="mr-2" />
              <DynamicTranslation userLanguage={userLocale} context="business">
                Ask BDI
              </DynamicTranslation>
            </Button>
          </div>
          <p className="text-sm text-blue-600 mt-2">
            <DynamicTranslation userLanguage={userLocale} context="technical">
              🚀 This feature integrates with BDI's SecureAI — powered by Retrieval-Augmented Generation (RAG) — to deliver intelligent, secure analysis of your business data.
            </DynamicTranslation>
          </p>
        </CardContent>
      </Card>

      <Separator />

      {/* Controls */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:space-y-0 gap-4 lg:gap-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
        {/* Date Range Picker */}
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3">
          <Label className="font-medium text-sm sm:text-base">📅 Date Range:</Label>
          <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
            <div className="flex flex-col">
              <Label className="text-xs text-gray-500 mb-1">From</Label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              />
            </div>
            <span className="text-gray-400 hidden sm:block">—</span>
            <div className="flex flex-col">
              <Label className="text-xs text-gray-500 mb-1">To</Label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                const threeMonthsAgo = new Date();
                threeMonthsAgo.setMonth(today.getMonth() - 3);
                setStartDate(threeMonthsAgo.toISOString().split('T')[0]);
                setEndDate(today.toISOString().split('T')[0]);
              }}
              className="w-full sm:w-auto"
            >
              Last 3 Months
            </Button>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Label>Period:</Label>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-6">
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
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
                {selectedPeriod === 'day' ? 'Daily' : 
                 selectedPeriod === 'week' ? 'Weekly' : 
                 selectedPeriod === 'month' ? 'Monthly' : 
                 selectedPeriod === 'year' ? 'Yearly' : selectedPeriod} Trends - {selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)}
              </CardTitle>
              <CardDescription>
                {selectedPeriod === 'day' && 'Daily trends over the last 30 days'}
                {selectedPeriod === 'week' && 'Weekly trends over the last 12 weeks'}
                {selectedPeriod === 'month' && 'Monthly trends over the last 12 months'}
                {selectedPeriod === 'year' && 'Yearly trends over the last 5 years'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TrendsChart data={timeSeriesData} metric={selectedMetric} />
            </CardContent>
          </Card>

          {/* Process Health Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
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
                      ${Math.round(analyticsData?.invoices.avgValue || 0).toLocaleString()}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Average PO Value</span>
                    <Badge variant="outline">
                      ${Math.round(analyticsData?.purchaseOrders.avgValue || 0).toLocaleString()}
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
                      {(analyticsData?.shipments.totalUnits || 0).toLocaleString()}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Ask BDI Modal */}
      <Dialog open={showAskBdiModal} onOpenChange={setShowAskBdiModal}>
        <DialogContent className="w-[98vw] h-[98vh] overflow-hidden flex flex-col" style={{ maxWidth: 'none' }}>
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center space-x-3">
              <SemanticBDIIcon semantic="query" size={24} className="text-blue-600" />
              <span>🤖 Ask BDI - Business Intelligence Assistant</span>
            </DialogTitle>
            <DialogDescription>
              AI-powered analysis of your CPFR data, supply chain metrics, and business insights
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {chatHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <SemanticBDIIcon semantic="query" size={48} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">Welcome to Ask BDI!</p>
                  <p className="text-sm">Ask me anything about your business data, supply chain, or analytics.</p>
                  <div className="mt-4 text-xs space-y-1">
                    <p>💡 Try asking: "What are our top performing SKUs?"</p>
                    <p>📊 Or: "Show me invoice trends by organization"</p>
                    <p>🚢 Or: "How are our shipments performing?"</p>
                  </div>
                </div>
              ) : (
                chatHistory.map((message) => (
                  <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      message.type === 'user' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white border border-gray-200 text-gray-900'
                    }`}>
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                      <div className={`text-xs mt-1 ${
                        message.type === 'user' ? 'text-blue-100' : 'text-gray-500'
                      }`}>
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              {/* Thinking indicator */}
              {isThinking && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <SemanticBDIIcon semantic="loading" size={16} className="animate-spin text-blue-600" />
                      <span className="text-sm text-gray-600">BDI is analyzing your data...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* New Question Input */}
            <div className="border-t bg-white p-4">
              <div className="flex space-x-3">
                <div className="flex-1">
                  <Input
                    placeholder="Ask a follow-up question..."
                    value={askBdiQuery}
                    onChange={(e) => setAskBdiQuery(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAskBDI()}
                    className="bg-white"
                    disabled={isThinking}
                  />
                </div>
                <Button 
                  onClick={handleAskBDI} 
                  disabled={!askBdiQuery.trim() || isThinking}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isThinking ? (
                    <SemanticBDIIcon semantic="loading" size={16} className="animate-spin" />
                  ) : (
                    <SemanticBDIIcon semantic="query" size={16} />
                  )}
                </Button>
              </div>
              
              {/* Context Info */}
              <div className="mt-2 text-xs text-gray-500 flex items-center space-x-4">
                <span>📊 Context: {forecastDeliveries.length} forecasts, {invoicesByOrg.reduce((sum, org) => sum + Object.values(org.organizations).reduce((orgSum, orgData) => orgSum + orgData.count, 0), 0)} invoices</span>
                <span>📅 Period: {startDate} to {endDate}</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
