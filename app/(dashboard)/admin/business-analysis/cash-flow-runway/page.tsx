'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Plus, Copy, Trash2, Download } from 'lucide-react';

interface MustPayItem {
  id: string;
  weekStart: string;
  category: 'labor' | 'opex' | 'r&d' | 'marketing' | 'cert' | 'other';
  description: string;
  amount: number;
}

interface WeeklyData {
  weekStart: string;
  weekEnd: string;
  nreTotal: number;
  inventoryTotal: number;
  mustPayTotal: number;
  total: number;
}

export default function CashFlowRunwayPage() {
  const [mustPayItems, setMustPayItems] = useState<MustPayItem[]>([]);
  const [nrePayments, setNrePayments] = useState<any[]>([]);
  const [inventoryPayments, setInventoryPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Date range (default to 13 weeks)
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Load Inventory and NRE data
  useEffect(() => {
    loadPaymentData();
  }, []);

  // Set default 13-week range
  useEffect(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (today.getDay() || 7)); // Start of current week (Monday)
    
    const end = new Date(start);
    end.setDate(end.getDate() + (13 * 7)); // 13 weeks forward
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, []);

  const loadPaymentData = async () => {
    try {
      setIsLoading(true);
      
      // Load NRE data
      const nreResponse = await fetch('/api/admin/nre-budget');
      if (nreResponse.ok) {
        const nreData = await nreResponse.json();
        const nrePaymentsList: any[] = [];
        nreData.forEach((budget: any) => {
          budget.paymentLineItems?.forEach((payment: any) => {
            nrePaymentsList.push({
              date: payment.paymentDate,
              amount: payment.amount,
              category: 'NRE',
            });
          });
        });
        setNrePayments(nrePaymentsList);
      }

      // Load Inventory data
      const invResponse = await fetch('/api/inventory-payments');
      if (invResponse.ok) {
        const invData = await invResponse.json();
        const invPaymentsList: any[] = [];
        invData.forEach((plan: any) => {
          plan.lineItems?.forEach((item: any) => {
            invPaymentsList.push({
              date: item.paymentDate,
              amount: parseFloat(item.amount) || 0,
              category: 'Inventory',
            });
          });
        });
        setInventoryPayments(invPaymentsList);
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Error loading payment data:', error);
      setIsLoading(false);
    }
  };

  // Generate weekly buckets
  const getWeeklyData = (): WeeklyData[] => {
    if (!startDate || !endDate) return [];

    const weeks: WeeklyData[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    let currentWeekStart = new Date(start);
    
    while (currentWeekStart <= end) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const weekStartStr = currentWeekStart.toISOString().split('T')[0];
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      
      // Calculate NRE total for this week
      const nreTotal = nrePayments
        .filter(p => p.date >= weekStartStr && p.date <= weekEndStr)
        .reduce((sum, p) => sum + p.amount, 0);
      
      // Calculate Inventory total for this week
      const inventoryTotal = inventoryPayments
        .filter(p => p.date >= weekStartStr && p.date <= weekEndStr)
        .reduce((sum, p) => sum + p.amount, 0);
      
      // Calculate Must Pay total for this week
      const mustPayTotal = mustPayItems
        .filter(item => item.weekStart === weekStartStr)
        .reduce((sum, item) => sum + item.amount, 0);
      
      weeks.push({
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        nreTotal,
        inventoryTotal,
        mustPayTotal,
        total: nreTotal + inventoryTotal + mustPayTotal,
      });
      
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }
    
    return weeks;
  };

  const weeklyData = getWeeklyData();
  const peakWeek = Math.max(...weeklyData.map(w => w.total), 0);

  // Add new Must Pay item
  const addMustPayItem = (weekStart: string) => {
    const newItem: MustPayItem = {
      id: `mustpay-${Date.now()}`,
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

  // Delete Must Pay item
  const deleteMustPayItem = (id: string) => {
    setMustPayItems(items => items.filter(item => item.id !== id));
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
      id: `mustpay-${Date.now()}-${Math.random()}`,
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
        <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">13-Week Cash Flow Runway</h1>
        <p className="text-sm sm:text-base text-gray-600">
          Consolidated view: NRE + Inventory + Must Pays
        </p>
      </div>

      {/* Date Range Controls */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Date Range</CardTitle>
        </CardHeader>
        <CardContent>
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
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total NRE</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${weeklyData.reduce((sum, w) => sum + w.nreTotal, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Inventory</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              ${weeklyData.reduce((sum, w) => sum + w.inventoryTotal, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Must Pays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              ${weeklyData.reduce((sum, w) => sum + w.mustPayTotal, 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">Weekly Outflows</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-gray-600 pb-4 border-b mb-4">
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
              <span>Must Pays</span>
            </div>
          </div>

          {/* Simple Chart */}
          <div className="relative" style={{ height: '400px' }}>
            <svg width="100%" height="100%" className="overflow-visible">
              {weeklyData.map((week, index) => {
                const barWidth = 100 / weeklyData.length;
                const barX = index * barWidth;
                const maxHeight = 350;

                const nreHeight = peakWeek > 0 ? (week.nreTotal / peakWeek) * maxHeight : 0;
                const invHeight = peakWeek > 0 ? (week.inventoryTotal / peakWeek) * maxHeight : 0;
                const mustPayHeight = peakWeek > 0 ? (week.mustPayTotal / peakWeek) * maxHeight : 0;

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
                    />
                    {/* Inventory Bar */}
                    <rect
                      x={`${barX + barWidth * 0.1}%`}
                      y={maxHeight - nreHeight - invHeight}
                      width={`${barWidth * 0.8}%`}
                      height={invHeight}
                      fill="#2563eb"
                      className="hover:opacity-80 cursor-pointer"
                    />
                    {/* Must Pay Bar */}
                    <rect
                      x={`${barX + barWidth * 0.1}%`}
                      y={maxHeight - nreHeight - invHeight - mustPayHeight}
                      width={`${barWidth * 0.8}%`}
                      height={mustPayHeight}
                      fill="#9333ea"
                      className="hover:opacity-80 cursor-pointer"
                    />
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
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* Must Pay Entry Section */}
      <Card>
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
                            />
                          </div>
                          <div className="col-span-3">
                            <Input
                              type="number"
                              placeholder="Amount"
                              value={item.amount || ''}
                              onChange={(e) => updateMustPayItem(item.id, 'amount', parseFloat(e.target.value) || 0)}
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

