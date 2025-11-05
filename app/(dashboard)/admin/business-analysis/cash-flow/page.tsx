'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DollarSign, TrendingDown, Calendar, Search, ArrowUpDown, Eye, EyeOff, ChevronDown, ChevronUp } from 'lucide-react';

// Interfaces for data structures
interface PaymentItem {
  id: string;
  category: 'NRE' | 'Inventory' | 'OpEx';
  source: string; // NRE number, Payment plan number, or OpEx category
  description: string;
  amount: number;
  date: string;
  isPaid: boolean;
}

interface WeeklyAggregate {
  weekStart: string;
  weekEnd: string;
  nreTotal: number;
  inventoryTotal: number;
  opexTotal: number;
  total: number;
  items: PaymentItem[];
}

export default function CashFlowAnalysisPage() {
  const [allPayments, setAllPayments] = useState<PaymentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  
  // Date range filter state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'NRE' | 'Inventory' | 'OpEx'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc'); // Default to oldest first for cash flow
  
  // Current date line toggle (persisted in localStorage)
  const [showCurrentDateLine, setShowCurrentDateLine] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('cash-flow-show-current-date');
      return saved !== null ? saved === 'true' : true; // Default to true
    }
    return true;
  });

  // Expandable table state
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

  // Load all payment data from both APIs
  useEffect(() => {
    loadAllPaymentData();
  }, []);

  const loadAllPaymentData = async () => {
    try {
      setIsLoading(true);
      const payments: PaymentItem[] = [];

      // 1. Fetch NRE payments
      const nreResponse = await fetch('/api/admin/nre-budget');
      if (nreResponse.ok) {
        const nreData = await nreResponse.json();
        nreData.forEach((budget: any) => {
          if (budget.paymentLineItems && budget.paymentLineItems.length > 0) {
            budget.paymentLineItems.forEach((item: any) => {
              payments.push({
                id: `nre-${item.id}`,
                category: 'NRE',
                source: budget.nreReferenceNumber,
                description: `${budget.projectName || 'No Project'} - ${budget.vendorName}`,
                amount: parseFloat(item.amount),
                date: item.paymentDate,
                isPaid: item.isPaid || false,
              });
            });
          }
        });
      }

      // 2. Fetch Inventory payments
      const invResponse = await fetch('/api/inventory-payments');
      if (invResponse.ok) {
        const invData = await invResponse.json();
        invData.forEach((plan: any) => {
          if (plan.lineItems && plan.lineItems.length > 0) {
            plan.lineItems.forEach((item: any) => {
              payments.push({
                id: `inv-${item.id}`,
                category: 'Inventory',
                source: plan.planNumber,
                description: item.description || plan.name,
                amount: parseFloat(item.amount),
                date: item.paymentDate,
                isPaid: item.isPaid || false,
              });
            });
          }
        });
      }

      // 3. OpEx payments (placeholder - empty for now)
      // TODO: Add OpEx API integration when available

      setAllPayments(payments);

      // Initialize date range to show all data
      if (payments.length > 0) {
        const allDates = payments.map(p => p.date).filter(Boolean).sort();
        if (allDates.length > 0 && !startDate && !endDate) {
          setStartDate(allDates[0]);
          setEndDate(allDates[allDates.length - 1]);
        }
      }
    } catch (error) {
      console.error('Failed to load payment data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle current date line and persist to localStorage
  const toggleCurrentDateLine = () => {
    const newValue = !showCurrentDateLine;
    setShowCurrentDateLine(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cash-flow-show-current-date', String(newValue));
    }
  };

  // Set date range to 13 weeks from today
  const set13WeekView = () => {
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + (13 * 7));
    
    setStartDate(today.toISOString().split('T')[0]);
    setEndDate(endDate.toISOString().split('T')[0]);
  };

  // Reset to show all data
  const resetToAll = () => {
    if (allPayments.length > 0) {
      const allDates = allPayments.map(p => p.date).filter(Boolean).sort();
      if (allDates.length > 0) {
        setStartDate(allDates[0]);
        setEndDate(allDates[allDates.length - 1]);
      }
    }
  };

  // Get filtered payments
  const getFilteredPayments = () => {
    let filtered = [...allPayments];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(payment => 
        payment.source.toLowerCase().includes(query) ||
        payment.description.toLowerCase().includes(query) ||
        payment.category.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(payment => payment.category === categoryFilter);
    }

    // Apply date range filter
    if (startDate && endDate) {
      filtered = filtered.filter(payment => 
        payment.date >= startDate && payment.date <= endDate
      );
    }

    return filtered;
  };

  const filteredPayments = getFilteredPayments();

  // Aggregate payments by week
  const aggregateByWeek = (): WeeklyAggregate[] => {
    if (!startDate || !endDate || filteredPayments.length === 0) return [];

    const weekMap = new Map<string, WeeklyAggregate>();

    filteredPayments.forEach(payment => {
      const paymentDate = new Date(payment.date);
      
      // Find the Monday of the week for this payment
      const dayOfWeek = paymentDate.getDay();
      const diff = paymentDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const monday = new Date(paymentDate.setDate(diff));
      const weekStart = monday.toISOString().split('T')[0];
      
      // Calculate Sunday of the same week
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const weekEnd = sunday.toISOString().split('T')[0];

      if (!weekMap.has(weekStart)) {
        weekMap.set(weekStart, {
          weekStart,
          weekEnd,
          nreTotal: 0,
          inventoryTotal: 0,
          opexTotal: 0,
          total: 0,
          items: [],
        });
      }

      const week = weekMap.get(weekStart)!;
      week.items.push(payment);
      week.total += payment.amount;
      
      if (payment.category === 'NRE') week.nreTotal += payment.amount;
      else if (payment.category === 'Inventory') week.inventoryTotal += payment.amount;
      else if (payment.category === 'OpEx') week.opexTotal += payment.amount;
    });

    // Convert to array and sort
    const weeks = Array.from(weekMap.values());
    weeks.sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.weekStart.localeCompare(b.weekStart);
      } else {
        return b.weekStart.localeCompare(a.weekStart);
      }
    });

    return weeks;
  };

  const weeklyData = aggregateByWeek();

  // Calculate summary metrics
  const totalOutflows = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
  const peakWeek = weeklyData.length > 0 
    ? Math.max(...weeklyData.map(w => w.total)) 
    : 0;
  const avgWeekly = weeklyData.length > 0 
    ? totalOutflows / weeklyData.length 
    : 0;

  // Get color for bubble based on total amount (relative to peak)
  const getBubbleColor = (amount: number) => {
    if (peakWeek === 0) return 'bg-gray-500';
    const percentage = (amount / peakWeek) * 100;
    
    if (percentage >= 75) return 'bg-red-500'; // High burn (>75% of peak)
    if (percentage >= 40) return 'bg-yellow-500'; // Medium burn (40-75%)
    return 'bg-green-500'; // Low burn (<40%)
  };

  // Toggle week expansion
  const toggleWeekExpansion = (weekStart: string) => {
    const newExpanded = new Set(expandedWeeks);
    if (newExpanded.has(weekStart)) {
      newExpanded.delete(weekStart);
    } else {
      newExpanded.add(weekStart);
    }
    setExpandedWeeks(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bdi-green-1 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading cash flow data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2 flex items-center gap-3">
          <DollarSign className="h-8 w-8 text-green-600" />
          Cash Flow Analysis
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Unified view of cash outflows: NRE, Inventory, and Operating Expenses
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-600" />
              Total Outflows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">
              ${totalOutflows.toLocaleString()}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              {weeklyData.length} week{weeklyData.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Peak Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">
              ${peakWeek.toLocaleString()}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Highest burn week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Avg Weekly
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-bold text-gray-900">
              ${avgWeekly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Average per week</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Filters & Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and Category Filter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Search className="inline w-4 h-4 mr-1" />
                  Search
                </label>
                <Input
                  type="text"
                  placeholder="Source, description, category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-bdi-green-1"
                >
                  <option value="all">All Categories</option>
                  <option value="NRE">NRE Only</option>
                  <option value="Inventory">Inventory Only</option>
                  <option value="OpEx">OpEx Only</option>
                </select>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  Start Date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Calendar className="inline w-4 h-4 mr-1" />
                  End Date
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex flex-wrap gap-2">
              <Button onClick={set13WeekView} variant="outline" size="sm">
                <Calendar className="w-4 h-4 mr-2" />
                13 Weeks
              </Button>

              <Button onClick={resetToAll} variant="outline" size="sm">
                Reset to All
              </Button>

              <Button
                onClick={() => setShowTimeline(!showTimeline)}
                variant="outline"
                size="sm"
              >
                {showTimeline ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                {showTimeline ? 'Hide' : 'Show'} Timeline
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
                Sort: {sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Count */}
      {searchQuery && (
        <div className="mb-4 text-sm text-gray-600">
          {filteredPayments.length === 0 ? (
            <p className="text-center py-8 text-gray-500">
              No payments found matching &quot;{searchQuery}&quot;
            </p>
          ) : (
            <p>
              Found {filteredPayments.length} payment{filteredPayments.length !== 1 ? 's' : ''} matching &quot;{searchQuery}&quot;
            </p>
          )}
        </div>
      )}

      {/* Timeline Visualization */}
      {showTimeline && weeklyData.length > 0 && startDate && endDate && (
        <Card className="mb-6 overflow-x-auto">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Weekly Cash Flow Timeline</CardTitle>
            <p className="text-sm text-gray-600">Combined view of all payment categories</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 min-w-[600px]">
              {/* Timeline legend */}
              <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-gray-600 pb-4 border-b">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Low Burn (&lt;40%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span>Medium Burn (40-75%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>High Burn (&gt;75%)</span>
                </div>
              </div>

              {/* Date range display */}
              <div className="flex justify-between text-xs sm:text-sm font-medium text-gray-700">
                <span>{new Date(startDate).toLocaleDateString()}</span>
                <span>{new Date(endDate).toLocaleDateString()}</span>
              </div>

              {/* Weekly timelines */}
              {weeklyData.map((week) => {
                const totalDays = Math.max(1, Math.ceil(
                  (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
                ));

                // Calculate position for this week
                const weekDate = new Date(week.weekStart);
                const rangeStart = new Date(startDate);
                rangeStart.setHours(0, 0, 0, 0);
                
                const daysFromStart = Math.ceil((weekDate.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
                const position = (daysFromStart / totalDays) * 100;

                // Calculate current date position
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const daysFromStartToToday = Math.ceil((today.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
                const currentDatePosition = (daysFromStartToToday / totalDays) * 100;
                const isCurrentDateInRange = today >= rangeStart && today <= new Date(endDate);

                return (
                  <div key={week.weekStart} className="relative flex items-center">
                    {/* Week label on the left */}
                    <div className="w-[200px] text-left pr-4">
                      <div className="font-bold text-sm">
                        Week of {new Date(week.weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="font-semibold text-sm text-gray-600">
                        ${week.total.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {week.items.length} payment{week.items.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                    
                    {/* Timeline with horizontal line and bubble */}
                    <div className="flex-1">
                      <div className="relative h-16">
                        {/* Horizontal center line */}
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-300 -translate-y-1/2"></div>
                        
                        {/* Current date line (if enabled and in range) */}
                        {showCurrentDateLine && isCurrentDateInRange && week.weekStart === weeklyData[0].weekStart && (
                          <div
                            className="absolute top-0 bottom-0 z-10"
                            style={{ left: `${currentDatePosition}%` }}
                          >
                            <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-blue-500 opacity-60" />
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap shadow-md">
                              Today
                            </div>
                          </div>
                        )}
                        
                        {/* Week bubble */}
                        <div
                          className="absolute top-1/2 -translate-y-1/2 group"
                          style={{ left: `${Math.max(5, Math.min(95, position))}%`, transform: 'translate(-50%, -50%)' }}
                        >
                          {/* Bubble */}
                          <div className={`w-12 h-12 rounded-full ${getBubbleColor(week.total)} flex items-center justify-center text-white text-xs font-bold shadow-lg cursor-pointer transition-all hover:scale-110 relative z-20`}>
                            ${(week.total / 1000).toFixed(0)}k
                          </div>
                          
                          {/* Tooltip on hover */}
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-30">
                            <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                              <div className="font-semibold">Week of {new Date(week.weekStart).toLocaleDateString()}</div>
                              <div className="text-green-300">NRE: ${week.nreTotal.toLocaleString()}</div>
                              <div className="text-blue-300">Inventory: ${week.inventoryTotal.toLocaleString()}</div>
                              <div className="text-purple-300">OpEx: ${week.opexTotal.toLocaleString()}</div>
                              <div className="text-yellow-300 font-bold mt-1 pt-1 border-t border-gray-700">
                                Total: ${week.total.toLocaleString()}
                              </div>
                            </div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expandable Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Payment Details by Week</CardTitle>
          <p className="text-sm text-gray-600">Click to expand/collapse week details</p>
        </CardHeader>
        <CardContent>
          {weeklyData.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No payment data available for selected date range</p>
          ) : (
            <div className="space-y-2">
              {weeklyData.map((week) => {
                const isExpanded = expandedWeeks.has(week.weekStart);
                
                return (
                  <div key={week.weekStart} className="border rounded-lg overflow-hidden">
                    {/* Week Summary Row (Clickable) */}
                    <div
                      className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                      onClick={() => toggleWeekExpansion(week.weekStart)}
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-600" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm sm:text-base">
                            Week of {new Date(week.weekStart).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="text-xs sm:text-sm text-gray-600 mt-1">
                            <span className="inline-flex items-center gap-4">
                              <span>NRE: ${week.nreTotal.toLocaleString()}</span>
                              <span>Inventory: ${week.inventoryTotal.toLocaleString()}</span>
                              <span>OpEx: ${week.opexTotal.toLocaleString()}</span>
                            </span>
                          </div>
                        </div>
                        <div className="font-bold text-base sm:text-lg text-gray-900">
                          ${week.total.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="p-4 bg-white border-t">
                        {/* Desktop Table */}
                        <div className="hidden sm:block overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left p-2 font-semibold">Category</th>
                                <th className="text-left p-2 font-semibold">Source</th>
                                <th className="text-left p-2 font-semibold">Description</th>
                                <th className="text-left p-2 font-semibold">Date</th>
                                <th className="text-right p-2 font-semibold">Amount</th>
                                <th className="text-center p-2 font-semibold">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {week.items.map((item) => (
                                <tr key={item.id} className="border-b hover:bg-gray-50">
                                  <td className="p-2">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      item.category === 'NRE' ? 'bg-green-100 text-green-800' :
                                      item.category === 'Inventory' ? 'bg-blue-100 text-blue-800' :
                                      'bg-purple-100 text-purple-800'
                                    }`}>
                                      {item.category}
                                    </span>
                                  </td>
                                  <td className="p-2 font-medium">{item.source}</td>
                                  <td className="p-2 text-gray-600">{item.description}</td>
                                  <td className="p-2">{new Date(item.date).toLocaleDateString()}</td>
                                  <td className="p-2 text-right font-semibold">${item.amount.toLocaleString()}</td>
                                  <td className="p-2 text-center">
                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                      item.isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {item.isPaid ? 'Paid' : 'Pending'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="sm:hidden space-y-3">
                          {week.items.map((item) => (
                            <div key={item.id} className="border rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  item.category === 'NRE' ? 'bg-green-100 text-green-800' :
                                  item.category === 'Inventory' ? 'bg-blue-100 text-blue-800' :
                                  'bg-purple-100 text-purple-800'
                                }`}>
                                  {item.category}
                                </span>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  item.isPaid ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {item.isPaid ? 'Paid' : 'Pending'}
                                </span>
                              </div>
                              <div className="font-semibold text-sm">{item.source}</div>
                              <div className="text-xs text-gray-600">{item.description}</div>
                              <div className="flex justify-between items-center pt-2 border-t">
                                <span className="text-xs text-gray-600">{new Date(item.date).toLocaleDateString()}</span>
                                <span className="font-bold">${item.amount.toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
