'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart as LineChartIcon, TrendingUp, Calendar, Search, Download, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Interfaces
interface Forecast {
  id: string;
  skuId: string;
  sku: {
    sku: string;
    name: string;
  };
  deliveryWeek: string; // ISO week format: 2025-W12
  quantity: number;
  salesSignal: 'unknown' | 'draft' | 'submitted' | 'confirmed' | 'rejected';
  factorySignal: 'unknown' | 'reviewing' | 'confirmed' | 'rejected';
  shippingSignal: 'unknown' | 'draft' | 'submitted' | 'confirmed' | 'rejected';
  shippingPreference: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

interface WeeklyData {
  weekStart: string; // ISO date: 2025-10-06
  weekLabel: string; // Display: W40 2025
  totalQuantity: number;
  skuBreakdown: { [skuCode: string]: number };
}

export default function SalesForecastAnalysisPage() {
  const router = useRouter();
  
  // Data state
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [skus, setSkus] = useState<any[]>([]);
  const [organizationId, setOrganizationId] = useState<string>('');
  
  // UI state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedSKU, setSelectedSKU] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showWorksheetModal, setShowWorksheetModal] = useState(false);
  
  // Chart ref
  const chartRef = useRef<HTMLDivElement>(null);

  // Initialize date range (13 weeks from today)
  useEffect(() => {
    const today = new Date();
    const thirteenWeeksLater = new Date(today);
    thirteenWeeksLater.setDate(today.getDate() + (13 * 7));
    
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(thirteenWeeksLater.toISOString().split('T')[0]);
  }, []);

  // Fetch user data
  useEffect(() => {
    async function fetchUserData() {
      try {
        const response = await fetch('/api/user');
        if (response.ok) {
          const userData = await response.json();
          const orgId = userData.organizations?.[0]?.organization?.id;
          console.log('Organization ID:', orgId);
          setOrganizationId(orgId);
        }
      } catch (error) {
        console.error('Failed to fetch user data:', error);
      }
    }
    fetchUserData();
  }, []);

  // Fetch forecasts and SKUs
  useEffect(() => {
    if (!organizationId) return;
    
    async function loadData() {
      try {
        setLoading(true);
        
        // Fetch forecasts
        const forecastsRes = await fetch('/api/cpfr/forecasts');
        if (forecastsRes.ok) {
          const forecastsData = await forecastsRes.json();
          console.log('Forecasts loaded:', forecastsData.length);
          setForecasts(forecastsData);
        }
        
        // Fetch SKUs
        const skusRes = await fetch('/api/admin/skus');
        if (skusRes.ok) {
          const skusData = await skusRes.json();
          console.log('SKUs loaded:', skusData.length);
          setSkus(skusData);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [organizationId]);

  // Convert ISO week (2025-W12) to date
  const isoWeekToDate = (isoWeek: string): Date => {
    const [year, week] = isoWeek.split('-W').map(Number);
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
  };

  // Filter forecasts
  const filteredForecasts = forecasts.filter(f => {
    if (!f.deliveryWeek) return false;
    
    const weekDate = isoWeekToDate(f.deliveryWeek);
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (weekDate < start || weekDate > end) return false;
    if (selectedSKU !== 'all' && f.sku?.sku !== selectedSKU) return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        f.sku?.sku?.toLowerCase().includes(query) ||
        f.sku?.name?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  // Aggregate forecasts by week
  const weeklyData: WeeklyData[] = [];
  const weekMap = new Map<string, WeeklyData>();

  filteredForecasts.forEach(f => {
    const weekDate = isoWeekToDate(f.deliveryWeek);
    const weekStart = weekDate.toISOString().split('T')[0];
    
    if (!weekMap.has(weekStart)) {
      weekMap.set(weekStart, {
        weekStart,
        weekLabel: f.deliveryWeek,
        totalQuantity: 0,
        skuBreakdown: {},
      });
    }
    
    const week = weekMap.get(weekStart)!;
    week.totalQuantity += f.quantity;
    
    const skuCode = f.sku?.sku || 'Unknown';
    week.skuBreakdown[skuCode] = (week.skuBreakdown[skuCode] || 0) + f.quantity;
  });

  weeklyData.push(...Array.from(weekMap.values()).sort((a, b) => 
    a.weekStart.localeCompare(b.weekStart)
  ));

  // Debug logging
  console.log('📊 Sales Forecast Debug:');
  console.log('Total forecasts:', forecasts.length);
  console.log('Filtered forecasts:', filteredForecasts.length);
  console.log('Weekly data:', weeklyData.length);
  console.log('Weekly data sample:', weeklyData.slice(0, 3));

  // Calculate summary stats
  const totalQuantity = filteredForecasts.reduce((sum, f) => sum + f.quantity, 0);
  const avgWeeklyQuantity = weeklyData.length > 0 ? totalQuantity / weeklyData.length : 0;
  const peakWeek = weeklyData.reduce((max, week) => 
    week.totalQuantity > max.totalQuantity ? week : max, 
    { totalQuantity: 0, weekLabel: '-', weekStart: '', skuBreakdown: {} }
  );
  const uniqueSKUs = new Set(filteredForecasts.map(f => f.sku?.sku).filter(Boolean)).size;

  // Handle 13-week button
  const handleThirteenWeeks = () => {
    const today = new Date();
    const thirteenWeeksLater = new Date(today);
    thirteenWeeksLater.setDate(today.getDate() + (13 * 7));
    
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(thirteenWeeksLater.toISOString().split('T')[0]);
  };

  // Handle reset to all
  const handleResetToAll = () => {
    if (forecasts.length === 0) return;
    
    const allWeeks = forecasts.map(f => isoWeekToDate(f.deliveryWeek));
    const minDate = new Date(Math.min(...allWeeks.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allWeeks.map(d => d.getTime())));
    
    setStartDate(minDate.toISOString().split('T')[0]);
    setEndDate(maxDate.toISOString().split('T')[0]);
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Week', 'SKU', 'Quantity', 'Sales Signal', 'Factory Signal', 'Shipping Signal'];
    const rows = filteredForecasts.map(f => [
      f.deliveryWeek,
      f.sku?.sku || '',
      f.quantity,
      f.salesSignal,
      f.factorySignal,
      f.shippingSignal,
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-forecast-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading forecast data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => router.push('/admin/business-analysis')}
            variant="ghost"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <LineChartIcon className="h-8 w-8 text-blue-600" />
              Sales Forecast Analysis
            </h1>
            <p className="text-gray-600 mt-1">Timeline visualization of CPFR forecast data</p>
          </div>
        </div>
      </div>

      {/* Filters & Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filters & Date Range</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* SKU Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <Select value={selectedSKU} onValueChange={setSelectedSKU}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All SKUs</SelectItem>
                  {skus.map(sku => (
                    <SelectItem key={sku.id} value={sku.sku}>
                      {sku.sku} - {sku.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search SKU or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col justify-end gap-2">
              <Button onClick={handleThirteenWeeks} variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-2" />
                13-Week
              </Button>
              <Button onClick={handleResetToAll} variant="outline" size="sm">
                Reset to All
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Total Forecast</div>
            <div className="text-2xl font-bold text-blue-600">{totalQuantity.toLocaleString()}</div>
            <div className="text-xs text-gray-500">units</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Avg Weekly</div>
            <div className="text-2xl font-bold text-green-600">{Math.round(avgWeeklyQuantity).toLocaleString()}</div>
            <div className="text-xs text-gray-500">units/week</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">Peak Week</div>
            <div className="text-2xl font-bold text-orange-600">{peakWeek.totalQuantity.toLocaleString()}</div>
            <div className="text-xs text-gray-500">{peakWeek.weekLabel}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600 mb-1">SKUs</div>
            <div className="text-2xl font-bold text-purple-600">{uniqueSKUs}</div>
            <div className="text-xs text-gray-500">unique products</div>
          </CardContent>
        </Card>
      </div>

      {/* Chart Card */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Weekly Forecast Timeline
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={() => setShowWorksheetModal(true)} variant="default" size="sm" className="bg-green-600 hover:bg-green-700">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Worksheet
              </Button>
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {weeklyData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No forecast data available for the selected period
            </div>
          ) : (
            <div ref={chartRef} className="overflow-x-auto bg-white p-4">
              <div className="min-w-[800px]">
                {/* Simple Stacked Bar Chart */}
                <div className="relative" style={{ height: '400px' }}>
                  {/* Y-axis */}
                  <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-gray-600 text-right pr-2">
                    {(() => {
                      const maxQty = Math.max(...weeklyData.map(w => w.totalQuantity), 1);
                      const steps = 5;
                      return Array.from({ length: steps + 1 }, (_, i) => {
                        const value = Math.round((maxQty / steps) * (steps - i));
                        return <div key={i}>{value.toLocaleString()}</div>;
                      });
                    })()}
                  </div>

                  {/* Chart bars */}
                  <div className="absolute left-12 right-0 top-0 bottom-8 border-l-2 border-b-2 border-gray-300">
                    <div className="flex items-end justify-around h-full gap-2 px-4">
                      {weeklyData.map((week, idx) => {
                        const maxQty = Math.max(...weeklyData.map(w => w.totalQuantity), 1);
                        const barHeightPx = (week.totalQuantity / maxQty) * 350; // 350px max height
                        
                        // Define colors
                        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'];
                        const skus = Object.keys(week.skuBreakdown);
                        
                        return (
                          <div key={idx} className="flex flex-col items-center flex-1 max-w-[80px]">
                            {/* Bar container */}
                            <div 
                              className="w-full relative group cursor-pointer"
                              style={{ 
                                height: `${barHeightPx}px`,
                                minHeight: barHeightPx > 0 ? '5px' : '0px'
                              }}
                            >
                              {/* Stacked segments */}
                              <div className="w-full h-full flex flex-col-reverse rounded-t-md overflow-hidden border border-gray-200">
                                {skus.map((sku, skuIdx) => {
                                  const qty = week.skuBreakdown[sku];
                                  const segmentHeightPercent = (qty / week.totalQuantity) * 100;
                                  return (
                                    <div
                                      key={sku}
                                      style={{
                                        height: `${segmentHeightPercent}%`,
                                        backgroundColor: colors[skuIdx % colors.length],
                                        minHeight: '2px'
                                      }}
                                      title={`${sku}: ${qty}`}
                                    />
                                  );
                                })}
                              </div>
                              
                              {/* Tooltip */}
                              <div className="hidden group-hover:block absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs rounded py-2 px-3 whitespace-nowrap z-20 shadow-lg">
                                <div className="font-bold mb-1">{week.weekLabel}</div>
                                <div className="text-blue-300 mb-2">{week.totalQuantity.toLocaleString()} units</div>
                                <div className="border-t border-gray-600 pt-1 space-y-1">
                                  {Object.entries(week.skuBreakdown)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([sku, qty], i) => (
                                      <div key={sku} className="flex items-center gap-2">
                                        <div 
                                          className="w-2 h-2 rounded-full" 
                                          style={{ backgroundColor: colors[skus.indexOf(sku) % colors.length] }}
                                        />
                                        <span>{sku}: {qty.toLocaleString()}</span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </div>
                            
                            {/* Week label */}
                            <div className="text-xs text-gray-600 mt-2 font-medium">
                              {week.weekLabel}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-8 flex flex-wrap gap-4 justify-center">
                  {(() => {
                    const allSkus = Array.from(new Set(
                      filteredForecasts.map(f => f.sku?.sku).filter(Boolean)
                    ));
                    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'];
                    
                    return allSkus.map((sku, i) => (
                      <div key={sku} className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded" 
                          style={{ backgroundColor: colors[i % colors.length] }}
                        />
                        <span className="text-sm font-mono font-medium">{sku}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Forecast Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Week</th>
                  <th className="px-4 py-2 text-left font-semibold">SKU</th>
                  <th className="px-4 py-2 text-right font-semibold">Quantity</th>
                  <th className="px-4 py-2 text-center font-semibold">Sales</th>
                  <th className="px-4 py-2 text-center font-semibold">Factory</th>
                  <th className="px-4 py-2 text-center font-semibold">Shipping</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredForecasts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No forecasts match your filters
                    </td>
                  </tr>
                ) : (
                  filteredForecasts.slice(0, 100).map((forecast, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{forecast.deliveryWeek}</td>
                      <td className="px-4 py-2 font-mono text-xs">
                        {forecast.sku?.sku || '-'}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold">
                        {forecast.quantity.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          forecast.salesSignal === 'confirmed' ? 'bg-green-100 text-green-800' :
                          forecast.salesSignal === 'submitted' ? 'bg-blue-100 text-blue-800' :
                          forecast.salesSignal === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {forecast.salesSignal}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          forecast.factorySignal === 'confirmed' ? 'bg-green-100 text-green-800' :
                          forecast.factorySignal === 'reviewing' ? 'bg-yellow-100 text-yellow-800' :
                          forecast.factorySignal === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {forecast.factorySignal}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          forecast.shippingSignal === 'confirmed' ? 'bg-green-100 text-green-800' :
                          forecast.shippingSignal === 'submitted' ? 'bg-blue-100 text-blue-800' :
                          forecast.shippingSignal === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {forecast.shippingSignal}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {filteredForecasts.length > 100 && (
              <div className="text-center py-4 text-sm text-gray-500">
                Showing first 100 of {filteredForecasts.length} forecasts
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Worksheet Modal */}
      {showWorksheetModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-green-50 to-white">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FileSpreadsheet className="h-7 w-7 text-green-600" />
                  Sales Forecast Worksheet
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Configure channel scenarios, cash flow timing, and sales velocity
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowWorksheetModal(false)}
                className="hover:bg-green-100"
              >
                <span className="text-2xl">&times;</span>
              </Button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Instructions Card */}
                <Card className="border-l-4 border-l-blue-500 bg-blue-50">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-blue-900 mb-2">📊 Worksheet Overview</h3>
                    <p className="text-sm text-blue-800">
                      For each forecast, configure the channel type (D2C or B2B), link to a SKU financial scenario,
                      set sales velocity, and define cash flow timing. This will generate detailed cash flow projections
                      showing booked vs. received revenue, and calculate reorder triggers based on inventory levels.
                    </p>
                  </CardContent>
                </Card>

                {/* Forecast List */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Configure Forecasts ({filteredForecasts.length} items)
                  </h3>
                  
                  {filteredForecasts.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center text-gray-500">
                        No forecasts in the selected date range. Adjust your filters to see forecasts.
                      </CardContent>
                    </Card>
                  ) : (
                    filteredForecasts.slice(0, 20).map((forecast) => (
                      <Card key={forecast.id} className="border-l-4 border-l-green-500">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base font-semibold flex items-center gap-2">
                                📦 {forecast.sku?.sku || 'Unknown SKU'}
                              </CardTitle>
                              <p className="text-sm text-gray-600 mt-1">
                                {forecast.deliveryWeek} • {forecast.quantity.toLocaleString()} units
                              </p>
                            </div>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                            >
                              Configure →
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-600">Channel:</span>
                              <span className="ml-2 font-medium text-gray-400">Not configured</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Scenario:</span>
                              <span className="ml-2 font-medium text-gray-400">Not linked</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Velocity:</span>
                              <span className="ml-2 font-medium text-gray-400">Not set</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Cash Timing:</span>
                              <span className="ml-2 font-medium text-gray-400">Not set</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                  
                  {filteredForecasts.length > 20 && (
                    <Card className="bg-gray-50">
                      <CardContent className="py-4 text-center text-sm text-gray-600">
                        Showing first 20 of {filteredForecasts.length} forecasts. 
                        Use filters above to narrow down results.
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Coming Soon Features */}
                <Card className="border-l-4 border-l-yellow-500 bg-yellow-50">
                  <CardContent className="pt-6">
                    <h3 className="font-semibold text-yellow-900 mb-2">🚧 Coming Next</h3>
                    <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                      <li>Channel configuration (D2C / B2B)</li>
                      <li>SKU Financial Scenario linking (ASP, margins, costs)</li>
                      <li>Sales velocity input (units/day or units/week)</li>
                      <li>Cash flow timing rules (days to receive cash)</li>
                      <li>B2B factoring options (85/15 splits, etc.)</li>
                      <li>Reorder triggers based on DSOH</li>
                      <li>Individual forecast graphs (booked vs. received revenue)</li>
                      <li>Consolidated dashboard (all forecasts stacked)</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="border-t p-4 bg-gray-50 flex justify-between">
              <div className="text-sm text-gray-600">
                💡 <strong>Tip:</strong> Start by configuring your most critical forecasts first
              </div>
              <Button
                onClick={() => setShowWorksheetModal(false)}
                variant="outline"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

