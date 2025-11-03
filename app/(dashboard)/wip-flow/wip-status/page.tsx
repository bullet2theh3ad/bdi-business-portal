'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Filter, X, TrendingUp, Clock, AlertCircle, Package, Info } from 'lucide-react';

interface WIPStatusData {
  summary: {
    totalUnits: number;
    avgDaysInWip: number;
    thisWeekReceipts: number;
    stuckUnits: number;
  };
  statusTotals: Record<string, number>;
  statusPercentages: Record<string, number>;
  statusGroups: Record<string, any[]>;
  skuBreakdown: Record<string, Record<string, number>>;
  topSkus: { sku: string; count: number }[];
  allSkus: string[];
  statusOrder: string[];
}

export default function WIPStatusPage() {
  const [data, setData] = useState<WIPStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSku, setSelectedSku] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [expandedStatus, setExpandedStatus] = useState<Set<string>>(new Set());

  // Load data
  async function loadData() {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (selectedSku && selectedSku !== 'all') {
        params.append('sku', selectedSku);
      }
      // DON'T send selectedStatus to API - keep full data for bubble flow
      // Filtering by status happens in the UI only

      const response = await fetch(`/api/warehouse/wip/status?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch WIP status data');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('[WIP Status] Error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [selectedSku]); // Only reload on SKU change, not status (status is UI-only filter)

  const handleClearFilters = () => {
    setSelectedSku('all');
    setSelectedStatus(null);
  };

  const toggleExpandStatus = (status: string) => {
    const newExpanded = new Set(expandedStatus);
    if (newExpanded.has(status)) {
      newExpanded.delete(status);
    } else {
      newExpanded.add(status);
    }
    setExpandedStatus(newExpanded);
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return 'bg-blue-500';
      case 'PASSED':
        return 'bg-green-500';
      case 'FAILED':
        return 'bg-yellow-500';
      case 'RTS-NEW':
        return 'bg-teal-500';
      case 'RTS-KITTED':
        return 'bg-cyan-500';
      case 'RECYCLED':
        return 'bg-gray-500';
      case 'SHIPPED':
        return 'bg-emerald-500';
      case 'RMA_SHIPPED':
        return 'bg-purple-500';
      case 'MISSING':
        return 'bg-red-500';
      case 'UNASSIGNED':
        return 'bg-gray-400';
      default:
        return 'bg-gray-300';
    }
  };

  // Get status definition for tooltip
  const getStatusDefinition = (status: string) => {
    switch (status) {
      case 'RECEIVED':
        return 'Intake performed and serial number entered. (To Triage).';
      case 'PASSED':
        return 'Triaged as good – Next process – Kitting.';
      case 'FAILED':
        return 'Triaged as failed – Next process either REPAIR or RECYCLED.';
      case 'RTS-NEW':
        return 'Unit unopened, resealed and in gaylord.';
      case 'RTS-KITTED':
        return 'Unit recovered, accessories added, sealed and single packed. Next is to be packed in gaylord or held for RMA.';
      case 'RECYCLED':
        return 'Unit failed triage/repair process and are flagged to be recycled.';
      case 'SHIPPED':
        return 'Units are out of our facility.';
      case 'RMA_SHIPPED':
        return 'Shipped via Jira RMA process.';
      case 'MISSING':
        return 'Box returned but device was not returned (missing actual device or wrong item returned) – Next process - recover any accessories and maybe recycle to get it out of WIP.';
      default:
        return 'Status definition not available.';
    }
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'FAILED':
      case 'MISSING':
        return 'destructive';
      case 'PASSED':
      case 'SHIPPED':
        return 'default';
      case 'UNASSIGNED':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          <span className="ml-2 text-gray-600">Loading WIP status data...</span>
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">WIP Status Flow</h1>
          <p className="text-gray-600 mt-1">Track units through processing stages</p>
        </div>
        <Button onClick={loadData} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-blue-600" />
              Total WIP Units
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.summary.totalUnits.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-600" />
              Avg Days in WIP
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.summary.avgDaysInWip}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              This Week Receipts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{data.summary.thisWeekReceipts.toLocaleString()}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              Stuck Units (30+ days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{data.summary.stuckUnits.toLocaleString()}</div>
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

            {(selectedSku !== 'all' || selectedStatus) && (
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

      {/* Bubble Flow Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Process Flow Overview</CardTitle>
          <CardDescription>Click a bubble to filter the breakdown below</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status labels */}
            <div className="flex justify-between items-center text-xs font-medium text-gray-600">
              {data.statusOrder
                .filter(status => data.statusTotals[status] > 0 || status === 'RECEIVED')
                .map((status, idx) => (
                  <div key={status} className="text-center" style={{ flex: 1 }}>
                    {status.replace('_', ' ')}
                  </div>
                ))}
            </div>

            {/* Bubble timeline */}
            <div className="relative h-24">
              {/* Horizontal line - with margins to contain bubbles */}
              <div className="absolute left-[50px] right-[50px] top-1/2 border-t-2 border-gray-300" />

              {/* Bubbles */}
              {data.statusOrder
                .filter(status => data.statusTotals[status] > 0 || status === 'RECEIVED')
                .map((status, idx, arr) => {
                  const count = data.statusTotals[status] || 0;
                  const percentage = data.statusPercentages[status] || 0;
                  
                  // Scale bubble size based on count (min 30px, max 70px)
                  const maxCount = Math.max(...Object.values(data.statusTotals));
                  const bubbleSize = maxCount > 0 
                    ? Math.max(30, Math.min(70, (count / maxCount) * 70))
                    : 30;
                  
                  // Calculate position with padding to keep bubbles within bounds
                  // Reserve 50px on each side for the largest bubble radius
                  const padding = 50;
                  const availableWidth = `calc(100% - ${padding * 2}px)`;
                  const position = arr.length === 1 ? 50 : (idx / (arr.length - 1)) * 100;
                  const leftPosition = `calc(${padding}px + (${availableWidth}) * ${position / 100})`;

                  const color = getStatusColor(status);
                  const isSelected = selectedStatus === status;

                  return (
                    <button
                      key={status}
                      className={`absolute group transition-all hover:scale-110 ${isSelected ? 'ring-4 ring-blue-400' : ''}`}
                      style={{
                        left: leftPosition,
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                      }}
                      onClick={() => setSelectedStatus(isSelected ? null : status)}
                    >
                      <div
                        className={`${color} rounded-full shadow-lg cursor-pointer flex items-center justify-center border-2 border-white`}
                        style={{
                          width: `${bubbleSize}px`,
                          height: `${bubbleSize}px`,
                        }}
                      >
                        <span className="text-white text-xs font-bold">
                          {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : count}
                        </span>
                      </div>

                      {/* Tooltip */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                        <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                          <div className="font-semibold">{status.replace('_', ' ')}</div>
                          <div className="text-green-300">{count.toLocaleString()} units</div>
                          <div className="text-gray-400">{percentage}%</div>
                        </div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                      </div>
                    </button>
                  );
                })}
            </div>

            {/* Percentage labels below */}
            <div className="flex justify-between items-center text-xs text-gray-500">
              {data.statusOrder
                .filter(status => data.statusTotals[status] > 0 || status === 'RECEIVED')
                .map(status => (
                  <div key={status} className="text-center" style={{ flex: 1 }}>
                    {data.statusPercentages[status]?.toFixed(1) || '0'}%
                  </div>
                ))}
            </div>

            {selectedStatus && (
              <div className="text-center text-sm text-blue-600 font-medium">
                Filtered by: {selectedStatus.replace('_', ' ')} • Click bubble again to clear
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Kanban-style Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Status Breakdown by SKU</CardTitle>
          <CardDescription>Click "View All" to see full unit list for each status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.statusOrder
              .filter(status => {
                // Filter by selectedStatus if set
                if (selectedStatus) return status === selectedStatus;
                // Otherwise show statuses with units
                return data.statusTotals[status] > 0;
              })
              .map(status => {
                const count = data.statusTotals[status];
                const percentage = data.statusPercentages[status];
                const skus = data.skuBreakdown[status];
                const topSkusForStatus = Object.entries(skus)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5);
                
                const isExpanded = expandedStatus.has(status);
                const displaySkus = isExpanded ? Object.entries(skus).sort(([, a], [, b]) => b - a) : topSkusForStatus;

                return (
                  <Card key={status} className="border-2">
                    <CardHeader className={`${getStatusColor(status)} text-white pb-3 pt-4`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-bold">
                            {status.replace('_', ' ')}
                          </CardTitle>
                          {/* Info icon with tooltip */}
                          <div className="group relative">
                            <Info className="h-4 w-4 text-white/80 hover:text-white cursor-help" />
                            {/* Tooltip */}
                            <div className="absolute left-0 top-6 hidden group-hover:block z-50 w-64">
                              <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl">
                                {getStatusDefinition(status)}
                              </div>
                              <div className="absolute -top-1 left-4 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-gray-900"></div>
                            </div>
                          </div>
                        </div>
                        <Badge variant={getStatusBadgeVariant(status)} className="bg-white/20 text-white border-white/30">
                          {percentage.toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="text-2xl font-bold">{count.toLocaleString()}</div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {displaySkus.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No units</p>
                      ) : (
                        <div className="space-y-2">
                          {displaySkus.map(([sku, skuCount]) => (
                            <div key={sku} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                              <span className="text-sm font-medium">{sku}</span>
                              <Badge variant="outline">{skuCount}</Badge>
                            </div>
                          ))}
                          
                          {Object.keys(skus).length > 5 && (
                            <Button
                              onClick={() => toggleExpandStatus(status)}
                              variant="ghost"
                              size="sm"
                              className="w-full mt-2"
                            >
                              {isExpanded ? 'Show Less' : `View All (${Object.keys(skus).length} SKUs)`}
                            </Button>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>

          {data.statusOrder.filter(status => {
            if (selectedStatus) return status === selectedStatus;
            return data.statusTotals[status] > 0;
          }).length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No units found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

