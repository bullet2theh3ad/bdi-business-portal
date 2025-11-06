'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingDown, Calendar, Search, ArrowUpDown, Eye, EyeOff, Download, Upload, Plus, Copy, Trash2 } from 'lucide-react';

// Interfaces
interface MustPayItem {
  id: string;
  weekStart: string;
  category: 'labor' | 'opex' | 'r&d' | 'marketing' | 'cert' | 'other';
  description: string;
  amount: number;
  sourceType?: string;
  sourceReference?: string;
}

interface FundingRequest {
  id: string;
  weekStart: string;
  fundingType: 'lt_notes_payable' | 'st_notes_payable' | 'other';
  description: string;
  amount: number;
  isCalculated?: boolean;
}

interface NonOpDisbursement {
  id: string;
  weekStart: string;
  disbursementType: 'notes_repayment' | 'interest_payments' | 'distributions' | 'other';
  description: string;
  amount: number;
  sourceReference?: string;
}

interface BankBalance {
  id: string;
  weekStart: string;
  beginningBalance: number;
  outstandingChecks: number;
  notes?: string;
}

interface WeeklyAggregate {
  weekStart: string;
  weekEnd: string;
  nreTotal: number;
  inventoryTotal: number;
  mustPayTotal: number;
  fundingTotal: number;
  nonOpTotal: number;
  operatingOutflows: number; // NRE + Inventory + Must Pays
  netCashFlow: number; // -Operating + Funding - NonOp
  total: number; // For chart display (operating outflows)
}

export default function CashFlowRunwayPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [showChart, setShowChart] = useState(true);
  const chartRef = useRef<HTMLDivElement>(null);

  // Data state
  const [nrePayments, setNrePayments] = useState<any[]>([]);
  const [inventoryPayments, setInventoryPayments] = useState<any[]>([]);
  const [mustPayItems, setMustPayItems] = useState<MustPayItem[]>([]);
  const [fundingRequests, setFundingRequests] = useState<FundingRequest[]>([]);
  const [nonOpDisbursements, setNonOpDisbursements] = useState<NonOpDisbursement[]>([]);
  const [bankBalances, setBankBalances] = useState<BankBalance[]>([]);

  // UI state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'must-pays' | 'funding' | 'non-op'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [avgPeriodWeeks, setAvgPeriodWeeks] = useState<number>(13); // 3 months default
  const [showCurrentDateLine, setShowCurrentDateLine] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cash-flow-runway-show-current-date');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  // Hover state for tooltips
  const [hoveredWeek, setHoveredWeek] = useState<WeeklyAggregate | null>(null);
  const [hoveredAvg, setHoveredAvg] = useState<{ weekStart: string; average: number } | null>(null);

  // Organization ID
  const [organizationId, setOrganizationId] = useState<string>('');

  // Load user and organization
  useEffect(() => {
    const loadUserOrg = async () => {
      try {
        const userRes = await fetch('/api/user');
        if (userRes.ok) {
          const userData = await userRes.json();
          setOrganizationId(userData.organizationId);
        }
      } catch (error) {
        console.error('Failed to load user organization:', error);
      }
    };
    loadUserOrg();
  }, []);

  // Load all data
  useEffect(() => {
    if (organizationId) {
      loadAllData();
    }
  }, [organizationId]);

  // Set default 13-week range
  useEffect(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (today.getDay() || 7)); // Monday of current week
    const end = new Date(start);
    end.setDate(end.getDate() + (13 * 7)); // 13 weeks forward

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, []);

  const loadAllData = async () => {
    try {
      setIsLoading(true);

      // Load NRE
      const nreRes = await fetch('/api/admin/nre-budget');
      if (nreRes.ok) {
        const nreData = await nreRes.json();
        const nrePaymentsList: any[] = [];
        nreData.forEach((budget: any) => {
          budget.paymentLineItems?.forEach((payment: any) => {
            nrePaymentsList.push({
              date: payment.paymentDate,
              amount: parseFloat(payment.amount) || 0,
            });
          });
        });
        setNrePayments(nrePaymentsList);
      }

      // Load Inventory
      const invRes = await fetch('/api/inventory-payments');
      if (invRes.ok) {
        const invData = await invRes.json();
        const invPaymentsList: any[] = [];
        invData.forEach((plan: any) => {
          plan.lineItems?.forEach((item: any) => {
            invPaymentsList.push({
              date: item.paymentDate,
              amount: parseFloat(item.amount) || 0,
            });
          });
        });
        setInventoryPayments(invPaymentsList);
      }

      // Load Must Pays
      const mustPayRes = await fetch(`/api/cash-flow/must-pays?organizationId=${organizationId}`);
      if (mustPayRes.ok) {
        const mustPayData = await mustPayRes.json();
        setMustPayItems(mustPayData.map((item: any) => ({
          id: item.id,
          weekStart: item.weekStart || item.week_start,
          category: item.category,
          description: item.description || '',
          amount: parseFloat(item.amount) || 0,
          sourceType: item.sourceType || item.source_type,
          sourceReference: item.sourceReference || item.source_reference,
        })));
      }

      // Load Funding Requests
      const fundingRes = await fetch(`/api/cash-flow/funding-requests?organizationId=${organizationId}`);
      if (fundingRes.ok) {
        const fundingData = await fundingRes.json();
        setFundingRequests(fundingData.map((item: any) => ({
          id: item.id,
          weekStart: item.weekStart || item.week_start,
          fundingType: item.fundingType || item.funding_type,
          description: item.description || '',
          amount: parseFloat(item.amount) || 0,
          isCalculated: item.isCalculated || item.is_calculated,
        })));
      }

      // Load Non-Op Disbursements
      const nonOpRes = await fetch(`/api/cash-flow/non-operating-disbursements?organizationId=${organizationId}`);
      if (nonOpRes.ok) {
        const nonOpData = await nonOpRes.json();
        setNonOpDisbursements(nonOpData.map((item: any) => ({
          id: item.id,
          weekStart: item.weekStart || item.week_start,
          disbursementType: item.disbursementType || item.disbursement_type,
          description: item.description || '',
          amount: parseFloat(item.amount) || 0,
          sourceReference: item.sourceReference || item.source_reference,
        })));
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setIsLoading(false);
    }
  };

  // Calculate weekly aggregates
  const getWeeklyData = (): WeeklyAggregate[] => {
    if (!startDate || !endDate) return [];

    const weeks: WeeklyAggregate[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    let currentWeekStart = new Date(start);

    while (currentWeekStart <= end) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const weekStartStr = currentWeekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      // NRE total
      const nreTotal = nrePayments
        .filter(p => p.date >= weekStartStr && p.date <= weekEndStr)
        .reduce((sum, p) => sum + p.amount, 0);

      // Inventory total
      const inventoryTotal = inventoryPayments
        .filter(p => p.date >= weekStartStr && p.date <= weekEndStr)
        .reduce((sum, p) => sum + p.amount, 0);

      // Must Pay total
      const mustPayTotal = mustPayItems
        .filter(item => item.weekStart === weekStartStr)
        .reduce((sum, item) => sum + item.amount, 0);

      // Funding total
      const fundingTotal = fundingRequests
        .filter(item => item.weekStart === weekStartStr)
        .reduce((sum, item) => sum + item.amount, 0);

      // Non-Op total
      const nonOpTotal = nonOpDisbursements
        .filter(item => item.weekStart === weekStartStr)
        .reduce((sum, item) => sum + item.amount, 0);

      const operatingOutflows = nreTotal + inventoryTotal + mustPayTotal;
      const netCashFlow = -operatingOutflows + fundingTotal - nonOpTotal;

      weeks.push({
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        nreTotal,
        inventoryTotal,
        mustPayTotal,
        fundingTotal,
        nonOpTotal,
        operatingOutflows,
        netCashFlow,
        total: operatingOutflows, // For chart display
      });

      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    return sortOrder === 'desc' ? weeks.reverse() : weeks;
  };

  const weeklyData = getWeeklyData();
  const peakWeek = Math.max(...weeklyData.map(w => w.total), 0);
  const totalOutflows = weeklyData.reduce((sum, w) => sum + w.operatingOutflows, 0);
  const totalFunding = weeklyData.reduce((sum, w) => sum + w.fundingTotal, 0);
  const totalNonOp = weeklyData.reduce((sum, w) => sum + w.nonOpTotal, 0);
  const avgWeekly = weeklyData.length > 0 ? totalOutflows / weeklyData.length : 0;
  const overallAvg = avgWeekly;

  // Calculate trailing averages
  const trailingAverages = weeklyData.map((week, index) => {
    const startIndex = Math.max(0, index - avgPeriodWeeks + 1);
    const relevantWeeks = weeklyData.slice(startIndex, index + 1);
    const average = relevantWeeks.reduce((sum, w) => sum + w.total, 0) / relevantWeeks.length;
    
    // Determine color based on burn rate vs overall average
    const burnRate = overallAvg > 0 ? (average / overallAvg) : 1;
    let color = '#10b981'; // Green (low burn, < 100%)
    if (burnRate >= 1.3) {
      color = '#ef4444'; // Red (high burn, >= 130%)
    } else if (burnRate >= 1.0) {
      color = '#f59e0b'; // Orange/Yellow (medium burn, 100-130%)
    }

    return {
      weekStart: week.weekStart,
      average,
      color,
    };
  });

  // Set 13-week view
  const set13WeekView = () => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (today.getDay() || 7));
    const end = new Date(start);
    end.setDate(end.getDate() + (13 * 7));

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Reset to all data
  const resetToAll = () => {
    const allDates = [
      ...nrePayments.map(p => p.date),
      ...inventoryPayments.map(p => p.date),
      ...mustPayItems.map(p => p.weekStart),
    ].filter(Boolean).sort();

    if (allDates.length > 0) {
      setStartDate(allDates[0]);
      setEndDate(allDates[allDates.length - 1]);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      'Week Start',
      'Week End',
      'NRE Total',
      'Inventory Total',
      'Must Pay Total',
      'Total Operating Outflows',
      'Funding Requests',
      'Non-Op Disbursements',
      'Net Cash Flow',
    ];

    const rows = weeklyData.map(week => [
      week.weekStart,
      week.weekEnd,
      week.nreTotal.toFixed(2),
      week.inventoryTotal.toFixed(2),
      week.mustPayTotal.toFixed(2),
      week.operatingOutflows.toFixed(2),
      week.fundingTotal.toFixed(2),
      week.nonOpTotal.toFixed(2),
      week.netCashFlow.toFixed(2),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `cash-flow-runway-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Chart to PNG
  const exportChartToPNG = async () => {
    if (!chartRef.current) return;

    try {
      // @ts-ignore - dom-to-image doesn't have TypeScript definitions
      const { default: domtoimage } = await import('dom-to-image');
      const dataUrl = await domtoimage.toPng(chartRef.current);
      const link = document.createElement('a');
      link.download = `cash-flow-runway-chart-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Failed to export chart:', error);
      alert('Failed to export chart as PNG');
    }
  };

  // Toggle current date line
  const toggleCurrentDateLine = () => {
    const newValue = !showCurrentDateLine;
    setShowCurrentDateLine(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cash-flow-runway-show-current-date', String(newValue));
    }
  };

  // Save Must Pay item
  const saveMustPayItem = async (item: MustPayItem) => {
    try {
      const isNew = item.id.startsWith('mustpay-temp-');
      const url = '/api/cash-flow/must-pays';
      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...item,
          organizationId,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save must pay item');
      }

      await loadAllData();
      return true;
    } catch (error) {
      console.error('Error saving must pay item:', error);
      alert('Failed to save must pay item');
      return false;
    }
  };

  // Delete Must Pay item
  const deleteMustPayItem = async (id: string) => {
    if (!id || id.startsWith('mustpay-temp-')) {
      // Just remove from local state if it's temporary
      setMustPayItems(items => items.filter(item => item.id !== id));
      return;
    }

    try {
      const response = await fetch(`/api/cash-flow/must-pays?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete must pay item');
      }

      await loadAllData();
    } catch (error) {
      console.error('Error deleting must pay item:', error);
      alert('Failed to delete must pay item');
    }
  };

  // Add new Must Pay item
  const addMustPayItem = (weekStart: string) => {
    const newItem: MustPayItem = {
      id: `mustpay-temp-${Date.now()}`,
      weekStart,
      category: 'labor',
      description: '',
      amount: 0,
    };
    setMustPayItems([...mustPayItems, newItem]);
  };

  // Update Must Pay item
  const updateMustPayItem = (id: string, field: keyof MustPayItem, value: any) => {
    setMustPayItems(items =>
      items.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Copy week's Must Pay items to next week
  const copyToNextWeek = (weekStart: string) => {
    const weekItems = mustPayItems.filter(item => item.weekStart === weekStart);
    if (weekItems.length === 0) return;

    const currentDate = new Date(weekStart);
    const nextWeekDate = new Date(currentDate);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStart = nextWeekDate.toISOString().split('T')[0];

    const copiedItems = weekItems.map(item => ({
      ...item,
      id: `mustpay-temp-${Date.now()}-${Math.random()}`,
      weekStart: nextWeekStart,
    }));

    setMustPayItems([...mustPayItems, ...copiedItems]);
  };

  const categoryLabels = {
    labor: 'Labor',
    opex: 'OpEx',
    'r&d': 'R&D',
    marketing: 'Marketing',
    cert: 'Cert',
    other: 'Other',
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bdi-green-1"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Cash Flow Runway</h1>
        <p className="text-sm sm:text-base text-gray-600">
          13-week cash flow projections with NRE, Inventory, and Must Pay expenses
        </p>
      </div>

      {/* Search, Filters, and Controls */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Search and Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Search className="inline w-4 h-4 mr-1" />
                  Search
                </label>
                <Input
                  placeholder="Source, description, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-bdi-green-1"
                >
                  <option value="all">All Categories</option>
                  <option value="must-pays">Must Pays</option>
                  <option value="funding">Funding Requests</option>
                  <option value="non-op">Non-Op Disbursements</option>
                </select>
              </div>

              {/* Start Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Start Date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              {/* End Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  End Date
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Trailing Average Period */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Trailing Average Period</label>
              <div className="flex gap-2">
                <Button
                  onClick={() => setAvgPeriodWeeks(4)}
                  variant={avgPeriodWeeks === 4 ? 'default' : 'outline'}
                  size="sm"
                >
                  4 Weeks
                </Button>
                <Button
                  onClick={() => setAvgPeriodWeeks(13)}
                  variant={avgPeriodWeeks === 13 ? 'default' : 'outline'}
                  size="sm"
                >
                  3 Months (13 weeks)
                </Button>
                <Button
                  onClick={() => setAvgPeriodWeeks(26)}
                  variant={avgPeriodWeeks === 26 ? 'default' : 'outline'}
                  size="sm"
                >
                  6 Months (26 weeks)
                </Button>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>

              <Button onClick={exportChartToPNG} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export PNG
              </Button>

              <Button onClick={set13WeekView} variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-2" />
                13 Weeks
              </Button>

              <Button onClick={resetToAll} variant="outline" size="sm">
                Reset to All
              </Button>

              <Button
                onClick={() => setShowChart(!showChart)}
                variant="outline"
                size="sm"
              >
                {showChart ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                {showChart ? 'Hide' : 'Show'} Chart
              </Button>

              <Button
                onClick={toggleCurrentDateLine}
                variant="outline"
                size="sm"
              >
                {showCurrentDateLine ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                {showCurrentDateLine ? 'Hide' : 'Show'} Current Date
              </Button>

              <Button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                variant="outline"
                size="sm"
              >
                <ArrowUpDown className="w-4 h-4 mr-2" />
                Chart: {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Outflows ({weeklyData.length} weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${totalOutflows.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-gray-500">NRE + Inventory + Must Pays</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Peak Week</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${peakWeek.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-gray-500">Highest single week outflow</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Weekly</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${avgWeekly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-gray-500">Average per week</p>
          </CardContent>
        </Card>
      </div>

      {/* Stacked Bar Chart */}
      {showChart && weeklyData.length > 0 && (
        <Card className="mb-6" ref={chartRef}>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg sm:text-xl">Weekly Cash Flow</CardTitle>
                <p className="text-sm text-gray-600">
                  Stacked bar chart with {avgPeriodWeeks}-week trailing average
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={exportToCSV} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Export CSV</span>
                  <span className="sm:hidden">CSV</span>
                </Button>
                <Button onClick={exportChartToPNG} variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Export PNG</span>
                  <span className="sm:hidden">PNG</span>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Legend */}
              <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-gray-600 pb-4 border-b">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-600"></div>
                  <span>NRE</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-600"></div>
                  <span>Inventory</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-purple-600"></div>
                  <span>OpEx</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-0.5 bg-gray-900"></div>
                  <span>{avgPeriodWeeks}wk Avg (colored by burn rate)</span>
                </div>
              </div>

              {/* Chart */}
              <div className="relative" style={{ height: '400px' }}>
                {/* Custom Tooltip for Bars */}
                {hoveredWeek && (
                  <div
                    className="absolute z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none"
                    style={{
                      left: '50%',
                      top: '20px',
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <div className="font-semibold mb-1">
                      Week of {new Date(hoveredWeek.weekStart).toLocaleDateString()}
                    </div>
                    <div className="text-green-300">NRE: ${hoveredWeek.nreTotal.toLocaleString()}</div>
                    <div className="text-blue-300">Inventory: ${hoveredWeek.inventoryTotal.toLocaleString()}</div>
                    <div className="text-purple-300">Must Pays: ${hoveredWeek.mustPayTotal.toLocaleString()}</div>
                    <div className="text-yellow-300 font-bold mt-1 pt-1 border-t border-gray-700">
                      Total: ${hoveredWeek.total.toLocaleString()}
                    </div>
                  </div>
                )}

                {/* Custom Tooltip for Average Line */}
                {hoveredAvg && (
                  <div
                    className="absolute z-50 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none"
                    style={{
                      left: '50%',
                      top: '60px',
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <div className="font-semibold">
                      {avgPeriodWeeks}-week avg: ${hoveredAvg.average.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                )}

                <svg width="100%" height="100%" viewBox="0 0 1000 400" preserveAspectRatio="none" className="overflow-visible">
                  {/* Burn Rate Legend */}
                  <g transform="translate(20, 20)">
                    <rect
                      x="0"
                      y="0"
                      width="155"
                      height="58"
                      fill="white"
                      stroke="#d1d5db"
                      strokeWidth="1.5"
                      rx="6"
                      opacity="0.98"
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                    />
                    <text x="10" y="16" fontSize="10" fontWeight="700" fill="#111827">
                      Avg Line Burn Rate:
                    </text>
                    <g transform="translate(10, 26)">
                      <circle cx="4" cy="4" r="4" fill="#ef4444" />
                      <text x="13" y="7" fontSize="9" fill="#374151">High ≥130%</text>
                    </g>
                    <g transform="translate(80, 26)">
                      <circle cx="4" cy="4" r="4" fill="#f59e0b" />
                      <text x="13" y="7" fontSize="9" fill="#374151">Med 100-130%</text>
                    </g>
                    <g transform="translate(10, 42)">
                      <circle cx="4" cy="4" r="4" fill="#10b981" />
                      <text x="13" y="7" fontSize="9" fill="#374151">Low &lt;100%</text>
                    </g>
                  </g>

                  {/* Bars and Line */}
                  {weeklyData.map((week, index) => {
                    const barWidth = 100 / weeklyData.length;
                    const barX = index * barWidth;
                    const maxHeight = 350;

                    const nreHeight = peakWeek > 0 ? (week.nreTotal / peakWeek) * maxHeight : 0;
                    const invHeight = peakWeek > 0 ? (week.inventoryTotal / peakWeek) * maxHeight : 0;
                    const mustPayHeight = peakWeek > 0 ? (week.mustPayTotal / peakWeek) * maxHeight : 0;

                    // Check if this week is "today"
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const weekStartDate = new Date(week.weekStart);
                    weekStartDate.setHours(0, 0, 0, 0);
                    const weekEndDate = new Date(week.weekEnd);
                    weekEndDate.setHours(0, 0, 0, 0);
                    const isCurrentWeek = today >= weekStartDate && today <= weekEndDate;

                    return (
                      <g key={week.weekStart}>
                        {/* NRE Bar */}
                        <rect
                          x={`${barX + barWidth * 0.1}%`}
                          y={maxHeight - nreHeight}
                          width={`${barWidth * 0.8}%`}
                          height={nreHeight}
                          fill="#16a34a"
                          className="hover:opacity-80 cursor-pointer"
                          onMouseEnter={() => setHoveredWeek(week)}
                          onMouseLeave={() => setHoveredWeek(null)}
                        />
                        {/* Inventory Bar */}
                        <rect
                          x={`${barX + barWidth * 0.1}%`}
                          y={maxHeight - nreHeight - invHeight}
                          width={`${barWidth * 0.8}%`}
                          height={invHeight}
                          fill="#2563eb"
                          className="hover:opacity-80 cursor-pointer"
                          onMouseEnter={() => setHoveredWeek(week)}
                          onMouseLeave={() => setHoveredWeek(null)}
                        />
                        {/* Must Pay Bar */}
                        <rect
                          x={`${barX + barWidth * 0.1}%`}
                          y={maxHeight - nreHeight - invHeight - mustPayHeight}
                          width={`${barWidth * 0.8}%`}
                          height={mustPayHeight}
                          fill="#9333ea"
                          className="hover:opacity-80 cursor-pointer"
                          onMouseEnter={() => setHoveredWeek(week)}
                          onMouseLeave={() => setHoveredWeek(null)}
                        />

                        {/* Current Date Line */}
                        {showCurrentDateLine && isCurrentWeek && (
                          <g>
                            <line
                              x1={`${barX + barWidth * 0.5}%`}
                              y1="0"
                              x2={`${barX + barWidth * 0.5}%`}
                              y2={maxHeight}
                              stroke="#3b82f6"
                              strokeWidth="2"
                              strokeDasharray="5,5"
                              opacity="0.6"
                            />
                            <text
                              x={`${barX + barWidth * 0.5}%`}
                              y="-5"
                              textAnchor="middle"
                              fill="#3b82f6"
                              fontSize="12"
                              fontWeight="bold"
                            >
                              Today
                            </text>
                          </g>
                        )}

                        {/* Week Label */}
                        <text
                          x={`${barX + barWidth * 0.5}%`}
                          y={maxHeight + 20}
                          textAnchor="middle"
                          fill="#6b7280"
                          fontSize="10"
                        >
                          {new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </text>
                      </g>
                    );
                  })}

                  {/* Trailing Average Line */}
                  <polyline
                    points={trailingAverages
                      .map((avg, index) => {
                        const barWidth = 100 / weeklyData.length;
                        const x = (index * barWidth + barWidth * 0.5);
                        const y = 350 - (peakWeek > 0 ? (avg.average / peakWeek) * 350 : 0);
                        return `${x},${y}`;
                      })
                      .join(' ')}
                    fill="none"
                    stroke="#111827"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                  />

                  {/* Average Line Data Points */}
                  {trailingAverages.map((avg, index) => {
                    const barWidth = 100 / weeklyData.length;
                    const x = (index * barWidth + barWidth * 0.5);
                    const y = 350 - (peakWeek > 0 ? (avg.average / peakWeek) * 350 : 0);

                    return (
                      <circle
                        key={avg.weekStart}
                        cx={`${x}%`}
                        cy={y}
                        r="4"
                        fill={avg.color}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredAvg(avg)}
                        onMouseLeave={() => setHoveredAvg(null)}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Must Pay Entry Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Must Pay Items (Manual Entry)</CardTitle>
          <p className="text-sm text-gray-600">Add labor, OpEx, R&D, marketing, cert, and other expenses by week</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {weeklyData.map((week) => {
              const weekItems = mustPayItems.filter(item => item.weekStart === week.weekStart);
              const weekTotal = weekItems.reduce((sum, item) => sum + item.amount, 0);

              return (
                <div key={week.weekStart} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold">
                        Week of {new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </h3>
                      <p className="text-sm text-gray-600">
                        NRE: ${week.nreTotal.toLocaleString()} | 
                        Inventory: ${week.inventoryTotal.toLocaleString()} | 
                        Must Pays: ${weekTotal.toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => addMustPayItem(week.weekStart)}
                        variant="outline"
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Item
                      </Button>
                      {weekItems.length > 0 && (
                        <Button
                          onClick={() => copyToNextWeek(week.weekStart)}
                          variant="outline"
                          size="sm"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy to Next Week
                        </Button>
                      )}
                    </div>
                  </div>

                  {weekItems.length > 0 && (
                    <div className="space-y-2">
                      {weekItems.map(item => (
                        <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-3">
                            <Select
                              value={item.category}
                              onValueChange={(value) => updateMustPayItem(item.id, 'category', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(categoryLabels).map(([key, label]) => (
                                  <SelectItem key={key} value={key}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-5">
                            <Input
                              placeholder="Description"
                              value={item.description}
                              onChange={(e) => updateMustPayItem(item.id, 'description', e.target.value)}
                              onBlur={() => saveMustPayItem(item)}
                            />
                          </div>
                          <div className="col-span-3">
                            <Input
                              type="number"
                              placeholder="Amount"
                              value={item.amount || ''}
                              onChange={(e) => updateMustPayItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
                              onBlur={() => saveMustPayItem(item)}
                            />
                          </div>
                          <div className="col-span-1">
                            <Button
                              onClick={() => deleteMustPayItem(item.id)}
                              variant="ghost"
                              size="sm"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
