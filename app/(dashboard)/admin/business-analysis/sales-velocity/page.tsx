'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, ResponsiveContainer } from 'recharts';
import { RefreshCw, Loader2, TrendingUp, Download, FileDown, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [warehouseInventory, setWarehouseInventory] = useState<Record<string, number>>({}); // SKU -> total quantity
  const [weeksToShow, setWeeksToShow] = useState<number>(12); // Default: last 12 weeks
  const [selectedSkus, setSelectedSkus] = useState<Set<string>>(new Set()); // Track selected SKUs
  const [expandedSkus, setExpandedSkus] = useState<Set<string>>(new Set()); // Track expanded rows
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchVelocityData();
    fetchWarehouseInventory();
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
        
        // Select all SKUs by default
        const allSkus = new Set<string>(data.velocityData.map((v: VelocityData) => v.bdiSku));
        setSelectedSkus(allSkus);
      }
    } catch (error) {
      console.error('❌ Error fetching velocity:', error);
    } finally {
      setLoading(false);
    }
  }

  async function fetchWarehouseInventory() {
    try {
      console.log('🔄 Fetching warehouse inventory...');
      const response = await fetch('/api/inventory/warehouse-summary');
      const data = await response.json();
      
      if (data.success) {
        const inventoryMap: Record<string, number> = {};
        
        // Aggregate inventory from all warehouses (EMG, CATV, Amazon)
        // EMG
        data.data.emg.allSkus.forEach((item: any) => {
          const sku = item.bdiSku || item.model;
          if (sku) {
            inventoryMap[sku] = (inventoryMap[sku] || 0) + (item.qtyOnHand || 0);
          }
        });
        
        // CATV (WIP only - units in warehouse)
        data.data.catv.allSkus.forEach((item: any) => {
          const sku = item.bdiSku || item.sku;
          if (sku) {
            const wipQty = item.stages?.WIP || 0;
            inventoryMap[sku] = (inventoryMap[sku] || 0) + wipQty;
          }
        });
        
        // Amazon (Fulfillable only)
        data.data.amazon.allSkus.forEach((item: any) => {
          const sku = item.bdiSku || item.sku;
          if (sku) {
            inventoryMap[sku] = (inventoryMap[sku] || 0) + (item.fulfillableQuantity || 0);
          }
        });
        
        console.log('✅ Warehouse inventory loaded:', Object.keys(inventoryMap).length, 'SKUs');
        console.log('📦 Sample inventory:', Object.entries(inventoryMap).slice(0, 5));
        
        setWarehouseInventory(inventoryMap);
      }
    } catch (error) {
      console.error('❌ Error fetching warehouse inventory:', error);
    }
  }

  // Toggle individual SKU selection
  function toggleSku(sku: string) {
    const newSelected = new Set(selectedSkus);
    if (newSelected.has(sku)) {
      newSelected.delete(sku);
    } else {
      newSelected.add(sku);
    }
    setSelectedSkus(newSelected);
  }

  // Toggle all SKUs
  function toggleAll() {
    if (selectedSkus.size === velocityData.length) {
      // Deselect all
      setSelectedSkus(new Set());
    } else {
      // Select all
      const allSkus = new Set(velocityData.map(v => v.bdiSku));
      setSelectedSkus(allSkus);
    }
  }

  // Toggle SKU expansion
  function toggleExpanded(sku: string) {
    const newExpanded = new Set(expandedSkus);
    if (newExpanded.has(sku)) {
      newExpanded.delete(sku);
    } else {
      newExpanded.add(sku);
    }
    setExpandedSkus(newExpanded);
  }

  // Download chart as PNG
  async function downloadChartAsPNG() {
    if (!chartRef.current) return;

    try {
      // Dynamically import html2canvas
      const html2canvas = (await import('html2canvas')).default;
      
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
        allowTaint: true,
        ignoreElements: (element) => {
          // Skip elements that might have unsupported colors
          return false;
        },
        onclone: (clonedDoc) => {
          // Fix any oklch colors in the cloned document
          const allElements = clonedDoc.querySelectorAll('*');
          allElements.forEach((el: any) => {
            const computed = window.getComputedStyle(el);
            
            // Replace oklch colors with fallback colors
            if (computed.backgroundColor && computed.backgroundColor.includes('oklch')) {
              el.style.backgroundColor = '#ffffff';
            }
            if (computed.color && computed.color.includes('oklch')) {
              el.style.color = '#000000';
            }
            if (computed.borderColor && computed.borderColor.includes('oklch')) {
              el.style.borderColor = '#e5e7eb';
            }
          });
          
          // Add padding to the captured element
          const targetElement = clonedDoc.querySelector('[data-chart-content]');
          if (targetElement) {
            (targetElement as HTMLElement).style.padding = '30px 80px 30px 30px'; // top right bottom left - extra right for week labels
            (targetElement as HTMLElement).style.boxSizing = 'content-box';
            (targetElement as HTMLElement).style.overflow = 'visible'; // Ensure nothing is clipped
          }
          
          // Also ensure the parent container doesn't clip content
          const parentCard = clonedDoc.querySelector('[data-chart-content]')?.parentElement;
          if (parentCard) {
            (parentCard as HTMLElement).style.overflow = 'visible';
          }
        }
      });

      // Convert to PNG and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `sales-velocity-${new Date().toISOString().split('T')[0]}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      });
    } catch (error) {
      console.error('Error downloading chart:', error);
      alert('Failed to download chart. Please try again.');
    }
  }

  // Export data as CSV
  function exportDataAsCSV() {
    const selectedVelocityData = velocityData.filter(sku => selectedSkus.has(sku.bdiSku));
    
    // CSV Header
    const headers = ['SKU', 'Daily Velocity', 'Total Units', 'Gross Revenue', 'Net Revenue', 'Days Active', 'First Sale', 'Last Sale'];
    
    // Summary rows
    const summaryRows = selectedVelocityData.map(sku => [
      sku.bdiSku,
      calculateVelocityForPeriod(sku).toFixed(2),
      sku.totalUnits,
      `$${sku.totalGrossRevenue.toFixed(2)}`,
      `$${sku.totalNetRevenue.toFixed(2)}`,
      sku.daysActive,
      sku.firstSaleDate,
      sku.lastSaleDate
    ]);
    
    // Weekly detail headers
    const weeklyHeaders = ['', '', 'Week', 'Units', 'Gross Revenue', 'Net Revenue'];
    
    // Build CSV content
    let csvContent = '# Sales Velocity Summary\n';
    csvContent += headers.join(',') + '\n';
    csvContent += summaryRows.map(row => row.join(',')).join('\n');
    csvContent += '\n\n# Weekly Details\n';
    csvContent += weeklyHeaders.join(',') + '\n';
    
    // Add weekly details for each SKU
    selectedVelocityData.forEach(sku => {
      const weeklyData = groupByWeek(sku.dailyTimeline, sku.bdiSku);
      const sortedWeeks = weeklyData.sort((a, b) => b.weekLabel.localeCompare(a.weekLabel));
      const filteredWeeks = weeksToShow === 999 ? sortedWeeks : sortedWeeks.slice(0, weeksToShow);
      
      filteredWeeks.reverse().forEach((week, idx) => {
        csvContent += [
          idx === 0 ? sku.bdiSku : '',
          idx === 0 ? `(${calculateVelocityForPeriod(sku).toFixed(1)}/day)` : '',
          week.weekLabel,
          week.units,
          `$${week.grossRevenue.toFixed(2)}`,
          `$${week.netRevenue.toFixed(2)}`
        ].join(',') + '\n';
      });
      csvContent += '\n';
    });
    
    // Download CSV
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sales-velocity-data-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

  // Calculate velocity for the selected time period
  function calculateVelocityForPeriod(sku: VelocityData): number {
    // Get weekly data
    const weeklyData = groupByWeek(sku.dailyTimeline, sku.bdiSku);
    
    // Sort by week (most recent first)
    const sortedWeeks = weeklyData.sort((a, b) => b.weekLabel.localeCompare(a.weekLabel));
    
    // Filter to selected weeks
    const filteredWeeks = weeksToShow === 999 ? sortedWeeks : sortedWeeks.slice(0, weeksToShow);
    
    if (filteredWeeks.length === 0) return 0;
    
    // Calculate total units in the selected period
    const totalUnits = filteredWeeks.reduce((sum, week) => sum + week.units, 0);
    
    // Calculate total days in the selected period
    const allDates = new Set<string>();
    filteredWeeks.forEach(week => {
      week.dates.forEach(date => allDates.add(date));
    });
    const daysInPeriod = allDates.size;
    
    // Calculate velocity: units per day
    return daysInPeriod > 0 ? totalUnits / daysInPeriod : 0;
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

      {/* SKU Selection Panel */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
            <CardTitle className="text-base sm:text-lg">Select SKUs to Display</CardTitle>
            <Button
              onClick={toggleAll}
              variant="outline"
              size="sm"
              className="text-xs w-full sm:w-auto"
            >
              {selectedSkus.size === velocityData.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
            {velocityData.map(sku => (
              <label
                key={sku.bdiSku}
                className="flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedSkus.has(sku.bdiSku)}
                  onChange={() => toggleSku(sku.bdiSku)}
                  className="h-4 w-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 flex-shrink-0"
                />
                <span className="text-xs font-medium truncate">{sku.bdiSku}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-600">
            {selectedSkus.size} of {velocityData.length} SKUs selected
          </div>
        </CardContent>
      </Card>

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
            
            {/* Week Range Selector & Export Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
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
              
              <Button
                onClick={downloadChartAsPNG}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Chart PNG</span>
              </Button>
              
              <Button
                onClick={exportDataAsCSV}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <FileDown className="h-4 w-4" />
                <span className="hidden sm:inline">Export CSV</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div ref={chartRef} data-chart-content className="space-y-1">
            {(() => {
              // Filter to only show selected SKUs
              const selectedVelocityData = velocityData.filter(sku => selectedSkus.has(sku.bdiSku));
              
              // Calculate GLOBAL maximum across ALL SELECTED SKUs for consistent bubble sizing
              const allWeeklyData = selectedVelocityData.map(sku => 
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
                  {selectedVelocityData.map((sku, skuIndex) => {
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
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[150px] text-right pr-3 flex items-center justify-end gap-2">
                      <div className="font-bold text-xs leading-tight whitespace-nowrap">{sku.bdiSku}</div>
                      <div 
                        className="font-bold text-xs leading-tight whitespace-nowrap"
                        style={{
                          color: calculateVelocityForPeriod(sku) < 10 ? '#ef4444' : calculateVelocityForPeriod(sku) < 15 ? '#eab308' : '#22c55e'
                        }}
                      >
                        ({calculateVelocityForPeriod(sku).toFixed(1)}/day)
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={60}>
                      <ScatterChart margin={{ top: 10, right: 0, bottom: 0, left: 160 }}>
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
              <div className="flex items-center" style={{ marginLeft: '160px' }}>
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

      {/* Data Table */}
      {!loading && velocityData.length > 0 && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Sales Data Table</CardTitle>
            <p className="text-xs sm:text-sm text-gray-600">Detailed metrics for selected SKUs</p>
          </CardHeader>
          <CardContent className="p-2 sm:p-6">
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <table className="w-full text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-2 sm:p-3 font-semibold sticky left-0 bg-gray-50 z-10">SKU</th>
                      <th className="text-right p-2 sm:p-3 font-semibold whitespace-nowrap">Velocity</th>
                      <th className="text-right p-2 sm:p-3 font-semibold hidden sm:table-cell">Units</th>
                      <th className="text-right p-2 sm:p-3 font-semibold whitespace-nowrap">DSOH</th>
                      <th className="text-right p-2 sm:p-3 font-semibold hidden md:table-cell whitespace-nowrap">Gross $</th>
                      <th className="text-right p-2 sm:p-3 font-semibold hidden lg:table-cell whitespace-nowrap">Net $</th>
                      <th className="text-right p-2 sm:p-3 font-semibold hidden lg:table-cell">Days</th>
                      <th className="text-center p-2 sm:p-3 font-semibold"></th>
                    </tr>
                  </thead>
                <tbody>
                  {velocityData.filter(sku => selectedSkus.has(sku.bdiSku)).map(sku => {
                    const isExpanded = expandedSkus.has(sku.bdiSku);
                    const weeklyData = groupByWeek(sku.dailyTimeline, sku.bdiSku);
                    const sortedWeeks = weeklyData.sort((a, b) => b.weekLabel.localeCompare(a.weekLabel));
                    const filteredWeeks = weeksToShow === 999 ? sortedWeeks : sortedWeeks.slice(0, weeksToShow);
                    
                    return (
                      <React.Fragment key={sku.bdiSku}>
                        <tr className="border-b hover:bg-gray-50">
                          <td className="p-2 sm:p-3 font-medium sticky left-0 bg-white text-xs sm:text-sm">{sku.bdiSku}</td>
                          <td 
                            className="p-2 sm:p-3 text-right font-semibold text-xs sm:text-sm"
                            style={{
                              color: calculateVelocityForPeriod(sku) < 10 ? '#ef4444' : calculateVelocityForPeriod(sku) < 15 ? '#eab308' : '#22c55e'
                            }}
                          >
                            <span className="hidden sm:inline">{calculateVelocityForPeriod(sku).toFixed(1)}/day</span>
                            <span className="inline sm:hidden">{calculateVelocityForPeriod(sku).toFixed(1)}/d</span>
                          </td>
                          <td className="p-2 sm:p-3 text-right hidden sm:table-cell">{sku.totalUnits.toLocaleString()}</td>
                          <td className="p-2 sm:p-3 text-right text-xs sm:text-sm">
                            {(() => {
                              const warehouseQty = warehouseInventory[sku.bdiSku] || 0;
                              const velocity = calculateVelocityForPeriod(sku);
                              const dsoh = velocity > 0 ? warehouseQty / velocity : 0;
                              
                              if (warehouseQty === 0) {
                                return <span className="text-gray-400">—</span>;
                              }
                              
                              // Color code based on days of supply
                              let color = '#22c55e'; // green (good)
                              if (dsoh < 30) color = '#ef4444'; // red (critical)
                              else if (dsoh < 60) color = '#eab308'; // yellow (warning)
                              
                              return (
                                <span className="font-semibold" style={{ color }}>
                                  <span className="hidden sm:inline">{Math.round(dsoh)} days</span>
                                  <span className="inline sm:hidden">{Math.round(dsoh)}d</span>
                                </span>
                              );
                            })()}
                          </td>
                          <td className="p-2 sm:p-3 text-right hidden md:table-cell">${sku.totalGrossRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                          <td className="p-2 sm:p-3 text-right hidden lg:table-cell">${sku.totalNetRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                          <td className="p-2 sm:p-3 text-right hidden lg:table-cell">{sku.daysActive}</td>
                          <td className="p-2 sm:p-3 text-center">
                            <Button
                              onClick={() => toggleExpanded(sku.bdiSku)}
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 sm:h-8 sm:w-8 p-0"
                            >
                              {isExpanded ? <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4" /> : <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4" />}
                            </Button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={8} className="p-0">
                              <div className="bg-gray-50 p-2 sm:p-4">
                                <h4 className="font-semibold text-xs sm:text-sm mb-2 sm:mb-3">Weekly Breakdown for {sku.bdiSku}</h4>
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-gray-300 bg-white">
                                        <th className="text-left p-2 font-semibold">Week</th>
                                        <th className="text-right p-2 font-semibold">Units</th>
                                        <th className="text-right p-2 font-semibold hidden sm:table-cell">Gross $</th>
                                        <th className="text-right p-2 font-semibold">Net $</th>
                                        <th className="text-right p-2 font-semibold hidden md:table-cell">Fees</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {filteredWeeks.reverse().map(week => (
                                        <tr key={week.weekLabel} className="border-b border-gray-200 bg-white">
                                          <td className="p-2 whitespace-nowrap">{week.weekLabel}</td>
                                          <td className="p-2 text-right font-medium">{week.units}</td>
                                          <td className="p-2 text-right hidden sm:table-cell">${week.grossRevenue.toFixed(2)}</td>
                                          <td className="p-2 text-right text-green-700 font-semibold">${week.netRevenue.toFixed(2)}</td>
                                          <td className="p-2 text-right text-red-600 hidden md:table-cell">${(week.grossRevenue - week.netRevenue).toFixed(2)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}
    </div>
  );
}
