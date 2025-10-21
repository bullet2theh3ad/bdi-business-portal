'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, ResponsiveContainer } from 'recharts';
import { RefreshCw, Loader2, TrendingUp } from 'lucide-react';

// =====================================================
// Type Definitions
// =====================================================
interface DailyDataPoint {
  date: string;
  units: number;
  grossRevenue: number;
  netRevenue: number;
}

interface VelocityData {
  bdiSku: string;
  amazonSku: string;
  totalUnits: number;
  totalGrossRevenue: number;
  totalNetRevenue: number;
  daysActive: number;
  dailyVelocity: number;
  firstSaleDate: string;
  lastSaleDate: string;
  dailyTimeline: DailyDataPoint[];
}

interface BubbleDataPoint {
  date: string;
  dayIndex: number;
  value: number;
  revenue: number;
}

// =====================================================
// Main Component
// =====================================================
export default function SalesVelocityPage() {
  const [loading, setLoading] = useState(false);
  const [velocityData, setVelocityData] = useState<VelocityData[]>([]);
  const [weeksToShow, setWeeksToShow] = useState<number>(12); // Default: last 12 weeks

  useEffect(() => {
    fetchVelocityData();
  }, []);

  async function fetchVelocityData() {
    setLoading(true);
    try {
      console.log('🔄 Fetching velocity data...');
      const response = await fetch('/api/sales-velocity/calculate-from-db');
      const data = await response.json();
      
      if (data.success) {
        console.log('✅ Velocity data loaded:', data.velocityData.length, 'SKUs');
        
        // Debug: Show first SKU's daily timeline
        if (data.velocityData.length > 0) {
          const firstSku = data.velocityData[0];
          console.log(`🔍 Sample SKU: ${firstSku.bdiSku}`);
          console.log(`   Total Units: ${firstSku.totalUnits}`);
          console.log(`   Days Active: ${firstSku.daysActive}`);
          console.log(`   Daily Velocity: ${firstSku.dailyVelocity}`);
          console.log(`   First 5 days of timeline:`, firstSku.dailyTimeline.slice(0, 5));
        }
        
        setVelocityData(data.velocityData);
      }
    } catch (error) {
      console.error('❌ Error fetching velocity:', error);
    } finally {
      setLoading(false);
    }
  }

  // Group daily data into weeks
  function groupByWeek(timeline: DailyDataPoint[], skuName: string) {
    console.log(`📦 [${skuName}] Grouping ${timeline.length} daily records into weeks...`);
    
    const weeks = new Map<string, { units: number; grossRevenue: number; netRevenue: number; dates: string[] }>();
    
    timeline.forEach(point => {
      const date = new Date(point.date);
      // Get ISO week number
      const weekNumber = getISOWeek(date);
      const year = date.getFullYear();
      const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`;
      
      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, { units: 0, grossRevenue: 0, netRevenue: 0, dates: [] });
      }
      
      const week = weeks.get(weekKey)!;
      week.units += point.units;
      week.grossRevenue += point.grossRevenue;
      week.netRevenue += point.netRevenue;
      week.dates.push(point.date);
    });
    
    // Convert to array format for chart
    const weeklyData = Array.from(weeks.entries()).map(([weekKey, data]) => ({
      weekLabel: weekKey,
      index: 1, // Fixed Y position for this SKU's row
      units: data.units,
      grossRevenue: data.grossRevenue,
      netRevenue: data.netRevenue,
      dates: data.dates,
    }));
    
    console.log(`📊 [${skuName}] Created ${weeklyData.length} weeks:`);
    weeklyData.forEach(week => {
      console.log(`   ${week.weekLabel}: ${week.units} units, Gross: $${week.grossRevenue.toFixed(2)}, Net: $${week.netRevenue.toFixed(2)}`);
    });
    
    const maxUnits = Math.max(...weeklyData.map(w => w.units), 0);
    const minUnits = Math.min(...weeklyData.map(w => w.units), 0);
    console.log(`   📈 Range: ${minUnits} - ${maxUnits} units`);
    
    return weeklyData;
  }
  
  // Get ISO week number
  function getISOWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const fees = data.grossRevenue - data.netRevenue;
      return (
        <div className="bg-white border border-gray-300 rounded-lg p-3 shadow-lg min-w-[200px]">
          <p className="font-semibold text-sm mb-2">{data.weekLabel}</p>
          <p className="text-sm">
            <span className="text-gray-600">Units: </span>
            <span className="font-bold text-blue-600">{data.units}</span>
          </p>
          <div className="border-t mt-2 pt-2 space-y-1">
            <p className="text-sm">
              <span className="text-gray-600">Gross Revenue: </span>
              <span className="font-bold text-green-700">
                ${Math.round(data.grossRevenue).toLocaleString()}
              </span>
            </p>
            <p className="text-sm">
              <span className="text-gray-600">Fees: </span>
              <span className="font-bold text-red-600">
                -${Math.round(fees).toLocaleString()}
              </span>
            </p>
            <p className="text-sm border-t pt-1">
              <span className="text-gray-600">Net Revenue: </span>
              <span className="font-bold text-green-600">
                ${Math.round(data.netRevenue).toLocaleString()}
              </span>
            </p>
          </div>
          {data.dates && (
            <p className="text-xs text-gray-500 mt-2 border-t pt-1">
              {data.dates.length} days
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <TrendingUp className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            Sales Velocity Analysis
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">
            Daily sales velocity per SKU from Amazon financial data
          </p>
        </div>
        <Button
          onClick={fetchVelocityData}
          disabled={loading}
          className="flex items-center gap-2 w-full sm:w-auto"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm sm:text-base">Loading...</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span className="text-sm sm:text-base">Refresh</span>
            </>
          )}
        </Button>
      </div>

      {/* Summary Cards - Dynamic based on week selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {(() => {
          // Calculate metrics for the selected week range
          const allWeeklyData = velocityData.map(sku => {
            const allWeeks = groupByWeek(sku.dailyTimeline, sku.bdiSku);
            const sortedWeeks = allWeeks.sort((a, b) => b.weekLabel.localeCompare(a.weekLabel));
            return weeksToShow === 999 ? sortedWeeks : sortedWeeks.slice(0, weeksToShow);
          });
          
          const totalUnits = allWeeklyData.flat().reduce((sum, w) => sum + w.units, 0);
          const totalGrossRevenue = allWeeklyData.flat().reduce((sum, w) => sum + w.grossRevenue, 0);
          const totalNetRevenue = allWeeklyData.flat().reduce((sum, w) => sum + w.netRevenue, 0);
          const totalFees = totalGrossRevenue - totalNetRevenue;
          
          // Calculate average daily velocity for the selected period
          const totalDays = allWeeklyData.flat().reduce((sum, w) => sum + (w.dates?.length || 0), 0);
          const avgDailyVelocity = totalDays > 0 ? totalUnits / totalDays : 0;
          
          return (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total SKUs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{velocityData.length}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Units Sold</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {totalUnits.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Gross Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-700">
                    ${totalGrossRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total Fees</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    ${totalFees.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Net Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    ${totalNetRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Avg Daily Velocity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {avgDailyVelocity.toFixed(1)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    units/day
                  </div>
                </CardContent>
              </Card>
            </>
          );
        })()}
      </div>

      {/* Bubble Chart - SKUs as Rows, Weeks as Columns */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg sm:text-xl">Weekly Sales Velocity by SKU</CardTitle>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">
                Each row is a SKU, each column is a week. Bubble size = units sold that week.
              </p>
            </div>
            
            {/* Week Range Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs sm:text-sm font-medium text-gray-600 whitespace-nowrap">Show:</label>
              <select
                value={weeksToShow}
                onChange={(e) => setWeeksToShow(Number(e.target.value))}
                className="px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
              >
                <option value={4}>Last 4 weeks</option>
                <option value={8}>Last 8 weeks</option>
                <option value={12}>Last 12 weeks</option>
                <option value={16}>Last 16 weeks</option>
                <option value={26}>Last 26 weeks</option>
                <option value={52}>Last 52 weeks</option>
                <option value={999}>All time</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {(() => {
              // Calculate GLOBAL maximum across ALL SKUs for consistent bubble sizing
              const allWeeklyData = velocityData.slice(0, 10).map(sku => 
                groupByWeek(sku.dailyTimeline, sku.bdiSku)
              );
              
              // Filter to show only the selected number of weeks (most recent)
              const filteredWeeklyData = allWeeklyData.map(weekData => {
                const sorted = weekData.sort((a, b) => b.weekLabel.localeCompare(a.weekLabel));
                return weeksToShow === 999 ? sorted : sorted.slice(0, weeksToShow);
              });
              
              const globalMaxUnits = Math.max(
                ...filteredWeeklyData.flat().map(w => w.units),
                1
              );
              
              // Generate week labels: Find most recent week and work backwards
              const generateWeekLabels = (numWeeks: number) => {
                // Get the most recent week from any SKU
                const allWeeks = filteredWeeklyData.flat().map(w => w.weekLabel);
                if (allWeeks.length === 0) return [];
                
                const mostRecentWeek = allWeeks.sort((a, b) => b.localeCompare(a))[0]; // e.g., "2025-W42"
                
                // Parse the year and week number
                const [yearStr, weekStr] = mostRecentWeek.split('-W');
                let year = parseInt(yearStr);
                let week = parseInt(weekStr);
                
                // Generate labels by working backwards
                const labels: string[] = [];
                for (let i = 0; i < numWeeks; i++) {
                  labels.unshift(`${year}-W${String(week).padStart(2, '0')}`);
                  week--;
                  if (week < 1) {
                    week = 52; // Assume 52 weeks per year (simplified)
                    year--;
                  }
                }
                
                return labels;
              };
              
              const globalWeekLabels = weeksToShow === 999 
                ? Array.from(new Set(filteredWeeklyData.flat().map(w => w.weekLabel))).sort()
                : generateWeekLabels(weeksToShow);
              
              console.log(`🌍 Global max units across all SKUs: ${globalMaxUnits} (showing ${weeksToShow} weeks)`);
              console.log(`📅 Global week labels (${globalWeekLabels.length}):`, globalWeekLabels);
              
              return (
                <>
                  {velocityData.slice(0, 10).map((sku, skuIndex) => {
                // Group daily data into weeks and filter to selected range
                const allWeeks = groupByWeek(sku.dailyTimeline, sku.bdiSku);
                const sortedWeeks = allWeeks.sort((a, b) => b.weekLabel.localeCompare(a.weekLabel));
                const weeklyData = weeksToShow === 999 ? sortedWeeks : sortedWeeks.slice(0, weeksToShow);
                
                // Reverse to show oldest to newest (left to right)
                weeklyData.reverse();
                const skuMaxUnits = Math.max(...weeklyData.map(w => w.units), 1);
                
                console.log(`🎯 [${sku.bdiSku}] Max: ${skuMaxUnits} (global: ${globalMaxUnits})`);
                
                return (
                  <div key={sku.bdiSku} className="border-b last:border-b-0 relative">
                    {/* Custom SKU Label with Units/Day */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[70px] text-right pr-2">
                      <div className="font-bold text-xs leading-tight">{sku.bdiSku}</div>
                      <div className="font-bold text-[10px] text-gray-600 leading-tight">
                        ({sku.dailyVelocity.toFixed(1)}/day)
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={60}>
                      <ScatterChart margin={{ top: 10, right: 0, bottom: 0, left: 80 }}>
                        <XAxis
                          type="category"
                          dataKey="weekLabel"
                          name="week"
                          tick={false}  // Hide all Recharts ticks - we'll add our own
                          tickLine={false}
                          axisLine={true}
                        />
                        <YAxis
                          type="number"
                          dataKey="index"
                          name={sku.bdiSku}
                          height={10}
                          width={70}
                          tick={false}
                          tickLine={false}
                          axisLine={false}
                        />
                        <ZAxis 
                          type="number" 
                          dataKey="units" 
                          domain={[0, globalMaxUnits]}  // Use GLOBAL max for all SKUs
                          range={[16, 400]} 
                        />
                      <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                      <Scatter data={weeklyData} fill="#3b82f6" fillOpacity={0.6} />
                    </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                );
              })}
              
              {/* Custom Week Labels - Full Control */}
              <div className="flex items-center" style={{ marginLeft: '80px' }}>
                <div className="flex-1 flex justify-between px-2">
                  {globalWeekLabels.map((weekLabel, idx) => {
                    // Show every other label for 26+ weeks to avoid crowding
                    const shouldShow = globalWeekLabels.length < 26 || idx % 2 === 0;
                    
                    return (
                      <div 
                        key={idx} 
                        className="text-xs text-gray-600"
                        style={{ 
                          flex: 1, 
                          textAlign: 'center',
                          fontSize: '10px',
                          visibility: shouldShow ? 'visible' : 'hidden'
                        }}
                      >
                        {weekLabel}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}
    </div>
  );
}
