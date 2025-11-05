'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Search, ArrowUpDown, Eye, EyeOff } from 'lucide-react';

interface NREPaymentLineItem {
  id: string;
  paymentNumber: number;
  paymentDate: string;
  amount: number;
  notes: string | null;
  isPaid: boolean;
}

interface NREBudget {
  id: string;
  nreReferenceNumber: string; // NRE-2025-001
  vendorName: string;
  projectName: string | null;
  totalAmount: number;
  paymentStatus: string;
  paymentLineItems: NREPaymentLineItem[];
  createdAt: string;
}

export default function NRESummaryPage() {
  const [nreBudgets, setNreBudgets] = useState<NREBudget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showTimeline, setShowTimeline] = useState(true);
  
  // Date range filter state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [vendorFilter, setVendorFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // Default to newest first
  
  // Current date line toggle (persisted in localStorage)
  const [showCurrentDateLine, setShowCurrentDateLine] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('nre-summary-show-current-date');
      return saved !== null ? saved === 'true' : true; // Default to true
    }
    return true;
  });

  // Initialize date range to show all data by default
  useEffect(() => {
    if (nreBudgets.length > 0) {
      const allDates = nreBudgets
        .flatMap(budget => budget.paymentLineItems.map(item => item.paymentDate))
        .filter(d => d)
        .sort();
      
      if (allDates.length > 0 && !startDate && !endDate) {
        setStartDate(allDates[0]);
        setEndDate(allDates[allDates.length - 1]);
      }
    }
  }, [nreBudgets, startDate, endDate]);

  // Load NRE budgets from database on mount
  useEffect(() => {
    loadNREBudgets();
  }, []);

  const loadNREBudgets = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/nre-budget');
      if (response.ok) {
        const data = await response.json();
        // Filter out budgets with no payment line items (we can't visualize them)
        const budgetsWithPayments = data.filter((budget: any) => 
          budget.paymentLineItems && budget.paymentLineItems.length > 0
        );
        setNreBudgets(budgetsWithPayments);
      }
    } catch (error) {
      console.error('Failed to load NRE budgets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle current date line and persist to localStorage
  const toggleCurrentDateLine = () => {
    const newValue = !showCurrentDateLine;
    setShowCurrentDateLine(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('nre-summary-show-current-date', String(newValue));
    }
  };

  // Get unique vendors and projects for filter dropdowns
  const uniqueVendors = Array.from(new Set(nreBudgets.map(b => b.vendorName))).sort();
  const uniqueProjects = Array.from(new Set(
    nreBudgets.map(b => b.projectName).filter(Boolean) as string[]
  )).sort();
  const uniqueStatuses = Array.from(new Set(nreBudgets.map(b => b.paymentStatus))).sort();

  // Get filtered and sorted budgets
  const getFilteredAndSortedBudgets = () => {
    let filtered = [...nreBudgets];

    // Apply search filter (fuzzy search across NRE number, vendor, project)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(budget => 
        budget.nreReferenceNumber.toLowerCase().includes(query) ||
        budget.vendorName.toLowerCase().includes(query) ||
        (budget.projectName && budget.projectName.toLowerCase().includes(query))
      );
    }

    // Apply vendor filter
    if (vendorFilter !== 'all') {
      filtered = filtered.filter(budget => budget.vendorName === vendorFilter);
    }

    // Apply project filter
    if (projectFilter !== 'all') {
      filtered = filtered.filter(budget => budget.projectName === projectFilter);
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(budget => budget.paymentStatus === statusFilter);
    }

    // Sort by earliest payment date in each budget
    filtered.sort((a, b) => {
      const aEarliestDate = a.paymentLineItems.reduce((earliest, item) => 
        item.paymentDate < earliest ? item.paymentDate : earliest, 
        a.paymentLineItems[0]?.paymentDate || ''
      );
      const bEarliestDate = b.paymentLineItems.reduce((earliest, item) => 
        item.paymentDate < earliest ? item.paymentDate : earliest, 
        b.paymentLineItems[0]?.paymentDate || ''
      );

      if (sortOrder === 'asc') {
        return aEarliestDate.localeCompare(bEarliestDate);
      } else {
        return bEarliestDate.localeCompare(aEarliestDate);
      }
    });

    return filtered;
  };

  const filteredBudgets = getFilteredAndSortedBudgets();

  // Calculate total NRE amount
  const getTotalNREAmount = (budget: NREBudget) => {
    return budget.paymentLineItems.reduce((sum, item) => sum + item.amount, 0);
  };

  // Get color for payment bubble based on date and paid status
  const getBubbleColor = (date: string, isPaid: boolean) => {
    if (isPaid) return 'bg-green-500'; // Paid = Green (only if actually paid)
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const paymentDate = new Date(date);
    paymentDate.setHours(0, 0, 0, 0);
    const daysUntilDue = Math.ceil((paymentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return 'bg-red-500'; // Overdue = Red (not paid and past due)
    return 'bg-yellow-500'; // Unpaid & Future = Yellow (not paid but upcoming)
  };

  // Get status text for bubble
  const getStatusText = (date: string, isPaid: boolean) => {
    if (isPaid) return 'Paid';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const paymentDate = new Date(date);
    paymentDate.setHours(0, 0, 0, 0);
    const daysUntilDue = Math.ceil((paymentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return `Overdue by ${Math.abs(daysUntilDue)} days`;
    if (daysUntilDue === 0) return 'Due today';
    if (daysUntilDue <= 30) return `Due in ${daysUntilDue} days`;
    return 'Upcoming';
  };

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-bdi-green-1 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading NRE payment schedules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">NRE Summary</h1>
        <p className="text-sm sm:text-base text-gray-600">Timeline view of NRE payment schedules by vendor and project</p>
      </div>

      {/* Filters and Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Filters & Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Search className="inline w-4 h-4 mr-1" />
                Search
              </label>
              <Input
                type="text"
                placeholder="NRE number, vendor, project..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Vendor Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Vendors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {uniqueVendors.map(vendor => (
                    <SelectItem key={vendor} value={vendor}>{vendor}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {uniqueProjects.map(project => (
                    <SelectItem key={project} value={project}>{project}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {uniqueStatuses.map(status => (
                    <SelectItem key={status} value={status}>
                      {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
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
        </CardContent>
      </Card>

      {/* Results Count */}
      {searchQuery && (
        <div className="mb-4 text-sm text-gray-600">
          {filteredBudgets.length === 0 ? (
            <p className="text-center py-8 text-gray-500">
              No NRE budgets found matching &quot;{searchQuery}&quot;
            </p>
          ) : (
            <p>
              Found {filteredBudgets.length} NRE budget{filteredBudgets.length !== 1 ? 's' : ''} matching &quot;{searchQuery}&quot;
            </p>
          )}
        </div>
      )}

      {/* Timeline Visualization */}
      {showTimeline && filteredBudgets.length > 0 && startDate && endDate && (
        <Card className="mb-6 overflow-x-auto">
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Payment Timeline</CardTitle>
            <p className="text-sm text-gray-600">Visual representation of NRE payment schedules</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 min-w-[600px]">
              {/* Timeline legend */}
              <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-gray-600 pb-4 border-b">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span>Paid</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span>Unpaid & Upcoming</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span>Overdue (Unpaid & Past Due)</span>
                </div>
              </div>

              {/* Date range display */}
              <div className="flex justify-between text-xs sm:text-sm font-medium text-gray-700">
                <span>{new Date(startDate).toLocaleDateString()}</span>
                <span>{new Date(endDate).toLocaleDateString()}</span>
              </div>

              {/* NRE budget timelines */}
              {filteredBudgets.map((budget) => {
                const totalDays = Math.max(1, Math.ceil(
                  (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
                ));

                // Calculate current date position
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const rangeStart = new Date(startDate);
                rangeStart.setHours(0, 0, 0, 0);
                const rangeEnd = new Date(endDate);
                rangeEnd.setHours(0, 0, 0, 0);
                
                const daysFromStart = Math.ceil((today.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24));
                const currentDatePosition = (daysFromStart / totalDays) * 100;
                const isCurrentDateInRange = today >= rangeStart && today <= rangeEnd;

                // Transform payment line items to bubbles with positions
                const bubbles = budget.paymentLineItems.map((item) => {
                  const itemDate = new Date(item.paymentDate);
                  itemDate.setHours(0, 0, 0, 0);
                  const daysFromRangeStart = Math.ceil(
                    (itemDate.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const position = (daysFromRangeStart / totalDays) * 100;

                  return {
                    ...item,
                    position: Math.max(5, Math.min(95, position)),
                  };
                });

                return (
                  <div key={budget.id} className="relative flex items-center">
                    {/* NRE number, vendor, and total on the left */}
                    <div className="w-[250px] text-left pr-4 flex flex-col gap-1">
                      <div className="relative group">
                        <div className="font-bold text-sm cursor-help">
                          {budget.nreReferenceNumber}
                        </div>
                        {/* Tooltip on hover showing Project + Vendor */}
                        <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block z-50">
                          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                            <div className="font-semibold">{budget.projectName || 'No Project'}</div>
                            <div className="text-gray-300">{budget.vendorName}</div>
                          </div>
                          <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-600">{budget.vendorName}</div>
                      <div className="font-semibold text-sm text-gray-600">
                        ${getTotalNREAmount(budget).toLocaleString()}
                      </div>
                    </div>
                    
                    {/* Timeline with horizontal line and bubbles centered on it */}
                    <div className="flex-1">
                      <div className="relative h-16">
                        {/* Horizontal center line */}
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-300 -translate-y-1/2"></div>
                        
                        {/* Current date line (if enabled and in range) */}
                        {showCurrentDateLine && isCurrentDateInRange && (
                          <div
                            className="absolute top-0 bottom-0 z-10"
                            style={{ left: `${currentDatePosition}%` }}
                          >
                            {/* Vertical dashed line */}
                            <div className="absolute top-0 bottom-0 border-l-2 border-dashed border-blue-500 opacity-60" />
                            
                            {/* "Today" label at top (only show on first budget row) */}
                            {budget.id === filteredBudgets[0].id && (
                              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap shadow-md">
                                Today
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* Payment bubbles */}
                        {bubbles.map((bubble) => (
                          <div
                            key={bubble.id}
                            className="absolute top-1/2 -translate-y-1/2 group"
                            style={{ left: `${bubble.position}%`, transform: 'translate(-50%, -50%)' }}
                          >
                            {/* Bubble */}
                            <div className={`w-10 h-10 rounded-full ${getBubbleColor(bubble.paymentDate, bubble.isPaid)} flex items-center justify-center text-white text-xs font-bold shadow-lg cursor-pointer transition-all hover:scale-110 relative z-20`}>
                              ${(bubble.amount / 1000).toFixed(0)}k
                            </div>
                            
                            {/* Tooltip on hover */}
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-30">
                              <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                                <div className="font-semibold">Payment #{bubble.paymentNumber}</div>
                                <div className="text-gray-300">${bubble.amount.toLocaleString()}</div>
                                <div className="text-gray-400">{new Date(bubble.paymentDate).toLocaleDateString()}</div>
                                <div className="text-yellow-300">{getStatusText(bubble.paymentDate, bubble.isPaid)}</div>
                                {bubble.notes && <div className="text-gray-400 mt-1">{bubble.notes}</div>}
                              </div>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table View of All Payment Line Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">All NRE Payments</CardTitle>
          <p className="text-sm text-gray-600">Detailed view of all payment line items</p>
        </CardHeader>
        <CardContent>
          {filteredBudgets.length === 0 ? (
            <p className="text-center py-8 text-gray-500">No NRE budgets found</p>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-semibold">NRE #</th>
                      <th className="text-left p-3 font-semibold">Vendor</th>
                      <th className="text-left p-3 font-semibold">Project</th>
                      <th className="text-left p-3 font-semibold">Payment #</th>
                      <th className="text-left p-3 font-semibold">Amount</th>
                      <th className="text-left p-3 font-semibold">Date</th>
                      <th className="text-left p-3 font-semibold">Status</th>
                      <th className="text-left p-3 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBudgets.map((budget) => (
                      budget.paymentLineItems.map((item, idx) => (
                        <tr key={`${budget.id}-${item.id}`} className="border-b hover:bg-gray-50">
                          {idx === 0 && (
                            <>
                              <td className="p-3 font-medium" rowSpan={budget.paymentLineItems.length}>
                                {budget.nreReferenceNumber}
                              </td>
                              <td className="p-3" rowSpan={budget.paymentLineItems.length}>
                                {budget.vendorName}
                              </td>
                              <td className="p-3" rowSpan={budget.paymentLineItems.length}>
                                {budget.projectName || '—'}
                              </td>
                            </>
                          )}
                          <td className="p-3">Payment #{item.paymentNumber}</td>
                          <td className="p-3 font-semibold">${item.amount.toLocaleString()}</td>
                          <td className="p-3">{new Date(item.paymentDate).toLocaleDateString()}</td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              item.isPaid 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {item.isPaid ? 'Paid' : 'Pending'}
                            </span>
                          </td>
                          <td className="p-3 text-gray-600">{item.notes || '—'}</td>
                        </tr>
                      ))
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="sm:hidden space-y-4">
                {filteredBudgets.map((budget) => (
                  budget.paymentLineItems.map((item) => (
                    <div key={`${budget.id}-${item.id}`} className="border rounded-lg p-4 space-y-2">
                      <div className="font-bold text-sm">{budget.nreReferenceNumber}</div>
                      <div className="text-xs text-gray-600">{budget.vendorName}</div>
                      {budget.projectName && (
                        <div className="text-xs text-gray-600">{budget.projectName}</div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t">
                        <span className="text-xs text-gray-600">Payment #{item.paymentNumber}</span>
                        <span className="font-semibold">${item.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-600">{new Date(item.paymentDate).toLocaleDateString()}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.isPaid 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.isPaid ? 'Paid' : 'Pending'}
                        </span>
                      </div>
                      {item.notes && (
                        <div className="text-xs text-gray-600 pt-2 border-t">{item.notes}</div>
                      )}
                    </div>
                  ))
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

