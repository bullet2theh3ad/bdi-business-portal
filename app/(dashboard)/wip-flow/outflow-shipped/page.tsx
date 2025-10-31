'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Filter, X, TrendingUp, Package, MapPin, Calendar } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';

interface OutflowData {
  summary: {
    totalShipped: number;
    thisWeekShipped: number;
    thisMonthShipped: number;
    topDestination: string;
    destinationCount: number;
  };
  destinationTotals: Record<string, number>;
  destinationPercentages: Record<string, number>;
  sortedDestinations: Array<{
    destination: string;
    count: number;
    percentage: number;
  }>;
  destinationGroups: Record<string, any[]>;
  skuBreakdownByDestination: Record<string, Record<string, number>>;
  topSkus: { sku: string; count: number }[];
  allDestinations: string[];
  allSkus: string[];
}

export default function OutflowShippedPage() {
  const [data, setData] = useState<OutflowData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDestination, setSelectedDestination] = useState<string>('all');
  const [selectedSku, setSelectedSku] = useState<string>('all');
  const [expandedDestination, setExpandedDestination] = useState<Set<string>>(new Set());

  // Color palette for bars
  const COLORS = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
    '#6366f1', // indigo
  ];

  // Load data
  async function loadData() {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedDestination && selectedDestination !== 'all') {
        params.append('destination', selectedDestination);
      }
      if (selectedSku && selectedSku !== 'all') {
        params.append('sku', selectedSku);
      }

      const response = await fetch(`/api/warehouse/wip/outflow?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch outflow data');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('[Outflow Shipped] Error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedDestination, selectedSku]);

  const handleClearFilters = () => {
    setSelectedDestination('all');
    setSelectedSku('all');
  };

  const toggleExpandDestination = (destination: string) => {
    const newExpanded = new Set(expandedDestination);
    if (newExpanded.has(destination)) {
      newExpanded.delete(destination);
    } else {
      newExpanded.add(destination);
    }
    setExpandedDestination(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          <span className="ml-2 text-gray-600">Loading outflow data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Error Loading Data</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error}</p>
            <Button onClick={loadData} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Prepare chart data (top 10 destinations)
  const chartData = data.sortedDestinations.slice(0, 10).map(item => ({
    name: item.destination,
    units: item.count,
    percentage: item.percentage,
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Outflow Shipped</h1>
          <p className="text-gray-600 mt-1">Track where units are shipped</p>
        </div>
        <Button onClick={loadData} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              Total Shipped
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.summary.totalShipped.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4 text-green-600" />
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{data.summary.thisWeekShipped.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-orange-600" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">{data.summary.thisMonthShipped.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-purple-600" />
              Top Destination
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{data.summary.topDestination}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-teal-600" />
              Destinations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.summary.destinationCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Filter by Destination</label>
              <Select value={selectedDestination} onValueChange={setSelectedDestination}>
                <SelectTrigger>
                  <SelectValue placeholder="All Destinations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Destinations</SelectItem>
                  {data.allDestinations.map(dest => (
                    <SelectItem key={dest} value={dest}>
                      {dest} ({data.destinationTotals[dest].toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Filter by SKU</label>
              <Select value={selectedSku} onValueChange={setSelectedSku}>
                <SelectTrigger>
                  <SelectValue placeholder="All SKUs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All SKUs</SelectItem>
                  {data.allSkus.map(sku => (
                    <SelectItem key={sku} value={sku}>
                      {sku}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {(selectedDestination !== 'all' || selectedSku !== 'all') && (
              <div className="flex items-end">
                <Button onClick={handleClearFilters} variant="outline" size="sm">
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Shipments by Destination (Top 10)</CardTitle>
          <CardDescription>Total units shipped to each destination</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No shipment data</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-white p-3 border rounded-lg shadow-lg">
                          <p className="font-bold">{payload[0].payload.name}</p>
                          <p className="text-blue-600">
                            Units: {payload[0].value?.toLocaleString()}
                          </p>
                          <p className="text-gray-600">
                            {payload[0].payload.percentage.toFixed(1)}% of total
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="units" name="Units Shipped" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Detailed Table with SKU Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Destination Details</CardTitle>
          <CardDescription>Click "View SKU Breakdown" to see which models were shipped to each destination</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.sortedDestinations.map((dest, idx) => {
              const isExpanded = expandedDestination.has(dest.destination);
              const skus = data.skuBreakdownByDestination[dest.destination];
              const topSkusForDest = Object.entries(skus || {})
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5);

              return (
                <Card key={dest.destination} className="border">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <div>
                          <CardTitle className="text-lg">{dest.destination}</CardTitle>
                          <p className="text-sm text-gray-600 mt-1">
                            {dest.count.toLocaleString()} units ({dest.percentage.toFixed(1)}%)
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => toggleExpandDestination(dest.destination)}
                        variant="ghost"
                        size="sm"
                      >
                        {isExpanded ? 'Hide SKU Breakdown' : 'View SKU Breakdown'}
                      </Button>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {Object.entries(skus || {})
                          .sort(([, a], [, b]) => b - a)
                          .map(([sku, count]) => (
                            <div
                              key={sku}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded border"
                            >
                              <span className="font-medium text-sm">{sku}</span>
                              <Badge variant="secondary">{count.toLocaleString()}</Badge>
                            </div>
                          ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}

            {data.sortedDestinations.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No shipments found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top SKUs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top SKUs Shipped</CardTitle>
          <CardDescription>Most frequently shipped models across all destinations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {data.topSkus.map((sku, idx) => (
              <Card key={sku.sku} className="border bg-gradient-to-br from-blue-50 to-white">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Badge variant="outline" className="mb-2">
                        #{idx + 1}
                      </Badge>
                      <p className="font-bold text-lg">{sku.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-blue-600">{sku.count.toLocaleString()}</p>
                      <p className="text-xs text-gray-600">units</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {data.topSkus.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No SKU data available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

