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
          // Organization ID is in the first organization
          const orgId = userData.organizations?.[0]?.organization?.id || userData.organizationId;
          console.log('🔍 Organization ID:', orgId);
          setOrganizationId(orgId);
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
      console.log('🚀 Loading all cash flow data for org:', organizationId);
      setIsLoading(true);

      // Load NRE
      console.log('📊 Fetching NRE data...');
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
      console.log('💰 Fetching Must Pays...');
      const mustPayRes = await fetch(`/api/cash-flow/must-pays?organizationId=${organizationId}`);
      console.log('💰 Must Pays response:', mustPayRes.status, mustPayRes.ok);
      if (mustPayRes.ok) {
        const mustPayData = await mustPayRes.json();
        console.log('💰 Must Pays data:', mustPayData);
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

      console.log('✅ All data loaded successfully');
      setIsLoading(false);
    } catch (error) {
      console.error('❌ Error loading data:', error);
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

      // Operating total
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
      'Operating Total',
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

  // Funding Request CRUD functions
  const saveFundingRequest = async (item: FundingRequest) => {
    try {
      const isNew = item.id.startsWith('funding-temp-');
      const url = '/api/cash-flow/funding-requests';
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
        throw new Error('Failed to save funding request');
      }

      await loadAllData();
      return true;
    } catch (error) {
      console.error('Error saving funding request:', error);
      alert('Failed to save funding request');
      return false;
    }
  };

  const deleteFundingRequest = async (id: string) => {
    if (!id || id.startsWith('funding-temp-')) {
      setFundingRequests(items => items.filter(item => item.id !== id));
      return;
    }

    try {
      const response = await fetch(`/api/cash-flow/funding-requests?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete funding request');
      }

      await loadAllData();
    } catch (error) {
      console.error('Error deleting funding request:', error);
      alert('Failed to delete funding request');
    }
  };

  const addFundingRequest = (weekStart: string) => {
    const newItem: FundingRequest = {
      id: `funding-temp-${Date.now()}`,
      weekStart,
      fundingType: 'lt_notes_payable',
      description: '',
      amount: 0,
    };
    setFundingRequests([...fundingRequests, newItem]);
  };

  const updateFundingRequest = (id: string, field: keyof FundingRequest, value: any) => {
    setFundingRequests(items =>
      items.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const copyFundingToNextWeek = (weekStart: string) => {
    const weekItems = fundingRequests.filter(item => item.weekStart === weekStart);
    if (weekItems.length === 0) return;

    const currentDate = new Date(weekStart);
    const nextWeekDate = new Date(currentDate);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStart = nextWeekDate.toISOString().split('T')[0];

    const copiedItems = weekItems.map(item => ({
      ...item,
      id: `funding-temp-${Date.now()}-${Math.random()}`,
      weekStart: nextWeekStart,
    }));

    setFundingRequests([...fundingRequests, ...copiedItems]);
  };

  // Non-Operating Disbursements CRUD functions
  const saveNonOpDisbursement = async (item: NonOpDisbursement) => {
    try {
      const isNew = item.id.startsWith('nonop-temp-');
      const url = '/api/cash-flow/non-operating-disbursements';
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
        throw new Error('Failed to save cash disbursement');
      }

      await loadAllData();
      return true;
    } catch (error) {
      console.error('Error saving cash disbursement:', error);
      alert('Failed to save cash disbursement');
      return false;
    }
  };

  const deleteNonOpDisbursement = async (id: string) => {
    if (!id || id.startsWith('nonop-temp-')) {
      setNonOpDisbursements(items => items.filter(item => item.id !== id));
      return;
    }

    try {
      const response = await fetch(`/api/cash-flow/non-operating-disbursements?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete cash disbursement');
      }

      await loadAllData();
    } catch (error) {
      console.error('Error deleting cash disbursement:', error);
      alert('Failed to delete cash disbursement');
    }
  };

  const addNonOpDisbursement = (weekStart: string) => {
    const newItem: NonOpDisbursement = {
      id: `nonop-temp-${Date.now()}`,
      weekStart,
      disbursementType: 'notes_repayment',
      description: '',
      amount: 0,
    };
    setNonOpDisbursements([...nonOpDisbursements, newItem]);
  };

  const updateNonOpDisbursement = (id: string, field: keyof NonOpDisbursement, value: any) => {
    setNonOpDisbursements(items =>
      items.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const copyNonOpToNextWeek = (weekStart: string) => {
    const weekItems = nonOpDisbursements.filter(item => item.weekStart === weekStart);
    if (weekItems.length === 0) return;

    const currentDate = new Date(weekStart);
    const nextWeekDate = new Date(currentDate);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekStart = nextWeekDate.toISOString().split('T')[0];

    const copiedItems = weekItems.map(item => ({
      ...item,
      id: `nonop-temp-${Date.now()}-${Math.random()}`,
      weekStart: nextWeekStart,
    }));

    setNonOpDisbursements([...nonOpDisbursements, ...copiedItems]);
  };

  const categoryLabels = {
    labor: 'Labor',
    opex: 'OpEx',
    'r&d': 'R&D',
    marketing: 'Marketing',
    cert: 'Cert',
    other: 'Other',
  };

  const fundingTypeLabels = {
    'lt_notes_payable': 'TR Capital Funding (LT Notes Payable)',
    'st_notes_payable': 'TR Cashflow Funding (ST Notes Payable)',
    'other': 'Other Funding Request',
  };

  const disbursementTypeLabels = {
    'notes_repayment': 'TR Notes Repayment',
    'interest_payments': 'TR Interest Payments',
    'distributions': 'TR Distributions',
    'other': 'Other',
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
          13-week cash flow projections with NRE, Inventory, and Operating expenses
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
                  <option value="must-pays">Operating</option>
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
            <p className="text-xs text-gray-500">NRE + Inventory + Operating</p>
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
                {/* Burn Rate Legend (HTML positioned) */}
                <div className="absolute top-4 left-4 z-20 bg-white border border-gray-300 rounded-lg px-3 py-2 shadow-md">
                  <div className="text-xs font-bold text-gray-800 mb-2">Avg Line Burn Rate:</div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-xs text-gray-700">High ≥130%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      <span className="text-xs text-gray-700">Med 100-130%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-xs text-gray-700">Low &lt;100%</span>
                    </div>
                  </div>
                </div>

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
                    <div className="text-purple-300">Operating: ${hoveredWeek.mustPayTotal.toLocaleString()}</div>
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
                        {/* Operating Bar */}
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

                  {/* Trailing Average Line - Colored Segments */}
                  {trailingAverages.map((avg, index) => {
                    if (index === 0) return null; // Skip first point (no line before it)
                    
                    const barWidth = 100 / weeklyData.length;
                    const prevAvg = trailingAverages[index - 1];
                    
                    const x1 = ((index - 1) * barWidth + barWidth * 0.5);
                    const y1 = 350 - (peakWeek > 0 ? (prevAvg.average / peakWeek) * 350 : 0);
                    const x2 = (index * barWidth + barWidth * 0.5);
                    const y2 = 350 - (peakWeek > 0 ? (avg.average / peakWeek) * 350 : 0);

                    return (
                      <line
                        key={`line-${avg.weekStart}`}
                        x1={`${x1}%`}
                        y1={y1}
                        x2={`${x2}%`}
                        y2={y2}
                        stroke={avg.color}
                        strokeWidth="3"
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}

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
                        r="5"
                        fill={avg.color}
                        stroke="white"
                        strokeWidth="2"
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

      {/* Consolidated Weekly Summary Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Weekly Cash Flow Summary</CardTitle>
          <p className="text-sm text-gray-600">Consolidated view of all cash inflows and outflows</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-3 px-2 font-semibold">Week Starting</th>
                  {weeklyData.map((week) => (
                    <th key={week.weekStart} className="text-right py-3 px-2 font-semibold">
                      {new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Total Incoming Cash */}
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-2 font-semibold text-green-700">Total Incoming Cash</td>
                  {weeklyData.map((week) => (
                    <td key={week.weekStart} className="text-right py-2 px-2 text-green-700">
                      ${(0).toLocaleString()}
                    </td>
                  ))}
                </tr>

                {/* Total Operating Cash Disbursements */}
                <tr className="border-b border-gray-200 bg-gray-50">
                  <td className="py-2 px-2 font-semibold text-red-700">Total Operating Cash Disbursements</td>
                  {weeklyData.map((week) => (
                    <td key={week.weekStart} className="text-right py-2 px-2 text-red-700">
                      ${(week.nreTotal + week.inventoryTotal + week.mustPayTotal).toLocaleString()}
                    </td>
                  ))}
                </tr>

                {/* Operating Cash Flow */}
                <tr className="border-b-2 border-gray-300 bg-blue-50">
                  <td className="py-2 px-2 font-bold text-blue-900">Operating Cash Flow</td>
                  {weeklyData.map((week) => {
                    const operatingCashFlow = 0 - (week.nreTotal + week.inventoryTotal + week.mustPayTotal);
                    return (
                      <td key={week.weekStart} className="text-right py-2 px-2 font-bold text-blue-900">
                        ${operatingCashFlow.toLocaleString()}
                      </td>
                    );
                  })}
                </tr>

                {/* Funding Request Total */}
                <tr className="border-b border-gray-200">
                  <td className="py-2 px-2 font-semibold text-purple-700">Funding Request Total</td>
                  {weeklyData.map((week) => {
                    const fundingTotal = fundingRequests
                      .filter(item => item.weekStart === week.weekStart)
                      .reduce((sum, item) => sum + item.amount, 0);
                    return (
                      <td key={week.weekStart} className="text-right py-2 px-2 text-purple-700">
                        ${fundingTotal.toLocaleString()}
                      </td>
                    );
                  })}
                </tr>

                {/* Cash Disbursements Total */}
                <tr className="border-b-2 border-gray-300 bg-gray-50">
                  <td className="py-2 px-2 font-semibold text-red-700">Cash Disbursements Total</td>
                  {weeklyData.map((week) => {
                    const nonOpTotal = nonOpDisbursements
                      .filter(item => item.weekStart === week.weekStart)
                      .reduce((sum, item) => sum + item.amount, 0);
                    return (
                      <td key={week.weekStart} className="text-right py-2 px-2 text-red-700">
                        ${nonOpTotal.toLocaleString()}
                      </td>
                    );
                  })}
                </tr>

                {/* Net Cash Flow */}
                <tr className="border-b-2 border-gray-400 bg-yellow-50">
                  <td className="py-3 px-2 font-bold text-lg text-gray-900">Net Cash Flow</td>
                  {weeklyData.map((week) => {
                    const operatingTotal = week.nreTotal + week.inventoryTotal + week.mustPayTotal;
                    const fundingTotal = fundingRequests
                      .filter(item => item.weekStart === week.weekStart)
                      .reduce((sum, item) => sum + item.amount, 0);
                    const nonOpTotal = nonOpDisbursements
                      .filter(item => item.weekStart === week.weekStart)
                      .reduce((sum, item) => sum + item.amount, 0);
                    const netCashFlow = 0 - operatingTotal + fundingTotal - nonOpTotal;
                    return (
                      <td key={week.weekStart} className={`text-right py-3 px-2 font-bold text-lg ${netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ${netCashFlow.toLocaleString()}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Operating Cash Disbursements Entry Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Operating Cash Disbursements</CardTitle>
          <p className="text-sm text-gray-600">Add labor, OpEx, R&D, marketing, cert, and other operating expenses by week</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {weeklyData.map((week) => {
              const weekItems = mustPayItems.filter(item => item.weekStart === week.weekStart);
              const weekTotal = weekItems.reduce((sum, item) => sum + item.amount, 0);
              const weekFunding = fundingRequests.filter(item => item.weekStart === week.weekStart);
              const fundingTotal = weekFunding.reduce((sum, item) => sum + item.amount, 0);
              const weekNonOp = nonOpDisbursements.filter(item => item.weekStart === week.weekStart);
              const nonOpTotal = weekNonOp.reduce((sum, item) => sum + item.amount, 0);

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
                        Operating: ${weekTotal.toLocaleString()} | 
                        Funding: ${fundingTotal.toLocaleString()} | 
                        Cash Disb.: ${nonOpTotal.toLocaleString()}
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

                  {/* Funding Request Section */}
                  <div className="mt-6 pt-6 border-t">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-purple-700">Funding Requests</h4>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => addFundingRequest(week.weekStart)}
                          variant="outline"
                          size="sm"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Funding
                        </Button>
                        {weekFunding.length > 0 && (
                          <Button
                            onClick={() => copyFundingToNextWeek(week.weekStart)}
                            variant="outline"
                            size="sm"
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy to Next Week
                          </Button>
                        )}
                      </div>
                    </div>

                    {weekFunding.length > 0 && (
                      <div className="space-y-2">
                        {weekFunding.map(item => (
                          <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-3">
                              <Select
                                value={item.fundingType}
                                onValueChange={(value) => updateFundingRequest(item.id, 'fundingType', value)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(fundingTypeLabels).map(([key, label]) => (
                                    <SelectItem key={key} value={key}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-5">
                              <Input
                                placeholder="Description / Notes"
                                value={item.description}
                                onChange={(e) => updateFundingRequest(item.id, 'description', e.target.value)}
                                onBlur={() => saveFundingRequest(item)}
                              />
                            </div>
                            <div className="col-span-3">
                              <Input
                                type="number"
                                placeholder="Amount"
                                value={item.amount || ''}
                                onChange={(e) => updateFundingRequest(item.id, 'amount', parseFloat(e.target.value) || 0)}
                                onBlur={() => saveFundingRequest(item)}
                              />
                            </div>
                            <div className="col-span-1">
                              <Button
                                onClick={() => deleteFundingRequest(item.id)}
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

                  {/* Cash Disbursements Section */}
                  <div className="mt-6 pt-6 border-t">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-red-700">Cash Disbursements (Non-Operating)</h4>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => addNonOpDisbursement(week.weekStart)}
                          variant="outline"
                          size="sm"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Disbursement
                        </Button>
                        {(() => {
                          const weekNonOp = nonOpDisbursements.filter(item => item.weekStart === week.weekStart);
                          return weekNonOp.length > 0 && (
                            <Button
                              onClick={() => copyNonOpToNextWeek(week.weekStart)}
                              variant="outline"
                              size="sm"
                            >
                              <Copy className="w-4 h-4 mr-2" />
                              Copy to Next Week
                            </Button>
                          );
                        })()}
                      </div>
                    </div>

                    {(() => {
                      const weekNonOp = nonOpDisbursements.filter(item => item.weekStart === week.weekStart);
                      return weekNonOp.length > 0 && (
                        <div className="space-y-2">
                          {weekNonOp.map(item => (
                            <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                              <div className="col-span-3">
                                <Select
                                  value={item.disbursementType}
                                  onValueChange={(value) => updateNonOpDisbursement(item.id, 'disbursementType', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(disbursementTypeLabels).map(([key, label]) => (
                                      <SelectItem key={key} value={key}>{label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-5">
                                <Input
                                  placeholder="Description / Notes"
                                  value={item.description}
                                  onChange={(e) => updateNonOpDisbursement(item.id, 'description', e.target.value)}
                                  onBlur={() => saveNonOpDisbursement(item)}
                                />
                              </div>
                              <div className="col-span-3">
                                <Input
                                  type="number"
                                  placeholder="Amount"
                                  value={item.amount || ''}
                                  onChange={(e) => updateNonOpDisbursement(item.id, 'amount', parseFloat(e.target.value) || 0)}
                                  onBlur={() => saveNonOpDisbursement(item)}
                                />
                              </div>
                              <div className="col-span-1">
                                <Button
                                  onClick={() => deleteNonOpDisbursement(item.id)}
                                  variant="ghost"
                                  size="sm"
                                >
                                  <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
