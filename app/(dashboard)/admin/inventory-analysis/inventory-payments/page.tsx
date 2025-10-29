'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Plus, Calendar, Trash2, Edit, Save, X, Check, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';

interface PaymentLineItem {
  id: string;
  description: string;
  amount: number;
  date: string;
  reference: string;
  referenceType: 'po' | 'shipment' | 'other';
  isPaid: boolean;
}

interface PaymentPlan {
  id: string;
  planNumber: string; // PAY-2025-001
  name: string;
  lineItems: PaymentLineItem[];
  createdAt: string;
  status: 'draft' | 'active';
}

export default function InventoryPaymentsPage() {
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<PaymentPlan | null>(null);
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [showTimeline, setShowTimeline] = useState(true);

  // Generate new plan number
  const generatePlanNumber = () => {
    const year = new Date().getFullYear();
    const nextNum = (paymentPlans.length + 1).toString().padStart(3, '0');
    return `PAY-${year}-${nextNum}`;
  };

  // Create new payment plan
  const createNewPlan = () => {
    const newPlan: PaymentPlan = {
      id: `plan-${Date.now()}`,
      planNumber: generatePlanNumber(),
      name: `Payment Plan ${paymentPlans.length + 1}`,
      lineItems: [],
      createdAt: new Date().toISOString(),
      status: 'draft',
    };
    setCurrentPlan(newPlan);
  };

  // Edit existing plan
  const editPlan = (plan: PaymentPlan) => {
    setCurrentPlan(plan);
  };

  // Save plan
  const savePlan = () => {
    if (!currentPlan) return;

    const existingIndex = paymentPlans.findIndex(p => p.id === currentPlan.id);
    if (existingIndex >= 0) {
      const updated = [...paymentPlans];
      updated[existingIndex] = currentPlan;
      setPaymentPlans(updated);
    } else {
      setPaymentPlans([...paymentPlans, currentPlan]);
    }

    setCurrentPlan(null);
  };

  // Cancel editing
  const cancelEdit = () => {
    setCurrentPlan(null);
  };

  // Delete plan
  const deletePlan = (planId: string) => {
    if (confirm('Are you sure you want to delete this payment plan?')) {
      setPaymentPlans(paymentPlans.filter(p => p.id !== planId));
    }
  };

  // Add line item
  const addLineItem = () => {
    if (!currentPlan) return;

    const newLine: PaymentLineItem = {
      id: `line-${Date.now()}`,
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      reference: '',
      referenceType: 'other',
      isPaid: false,
    };

    setCurrentPlan({
      ...currentPlan,
      lineItems: [...currentPlan.lineItems, newLine],
    });
  };

  // Update line item
  const updateLineItem = (lineId: string, field: keyof PaymentLineItem, value: any) => {
    if (!currentPlan) return;

    const updatedLines = currentPlan.lineItems.map(line =>
      line.id === lineId ? { ...line, [field]: value } : line
    );

    setCurrentPlan({
      ...currentPlan,
      lineItems: updatedLines,
    });
  };

  // Delete line item
  const deleteLineItem = (lineId: string) => {
    if (!currentPlan) return;

    setCurrentPlan({
      ...currentPlan,
      lineItems: currentPlan.lineItems.filter(line => line.id !== lineId),
    });
  };

  // Toggle expanded plan
  const toggleExpanded = (planNumber: string) => {
    const newExpanded = new Set(expandedPlans);
    if (newExpanded.has(planNumber)) {
      newExpanded.delete(planNumber);
    } else {
      newExpanded.add(planNumber);
    }
    setExpandedPlans(newExpanded);
  };

  // Calculate total for a plan
  const getPlanTotal = (plan: PaymentPlan) => {
    return plan.lineItems.reduce((sum, item) => sum + parseFloat(item.amount.toString() || '0'), 0);
  };

  // Calculate paid/unpaid totals
  const getPlanPaidUnpaid = (plan: PaymentPlan) => {
    let paid = 0;
    let unpaid = 0;
    plan.lineItems.forEach(item => {
      const amount = parseFloat(item.amount.toString() || '0');
      if (item.isPaid) {
        paid += amount;
      } else {
        unpaid += amount;
      }
    });
    return { paid, unpaid };
  };

  // Calculate totals for floating summary (editor view)
  const calculateTotals = () => {
    if (!currentPlan) return { total: 0, count: 0, minDate: '', maxDate: '' };

    const total = currentPlan.lineItems.reduce((sum, line) => sum + parseFloat(line.amount.toString() || '0'), 0);
    const count = currentPlan.lineItems.length;
    const dates = currentPlan.lineItems.map(line => line.date).filter(d => d).sort();
    const minDate = dates[0] || '';
    const maxDate = dates[dates.length - 1] || '';

    return { total, count, minDate, maxDate };
  };

  // Calculate payment positions on timeline (editor view)
  const getTimelineData = () => {
    if (!currentPlan || currentPlan.lineItems.length === 0) return null;

    const sortedItems = [...currentPlan.lineItems]
      .filter(item => item.date)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (sortedItems.length === 0) return null;

    const minDate = new Date(sortedItems[0].date);
    const maxDate = new Date(sortedItems[sortedItems.length - 1].date);
    const dateRange = maxDate.getTime() - minDate.getTime();
    const dayRange = dateRange / (1000 * 60 * 60 * 24);

    // Position each payment as a percentage along the timeline
    const positions = sortedItems.map(item => {
      const itemDate = new Date(item.date);
      const position = dateRange === 0 ? 50 : ((itemDate.getTime() - minDate.getTime()) / dateRange) * 100;
      return {
        ...item,
        position: Math.max(5, Math.min(95, position)), // Keep within 5-95% range for visibility
      };
    });

    return { positions, minDate, maxDate, dayRange };
  };


  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      {/* Page Header */}
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Inventory Payments</h1>
          <p className="text-gray-600">Timeline view of payment schedules</p>
        </div>
        <Button onClick={createNewPlan}>
          <Plus className="h-4 w-4 mr-2" />
          New Payment Plan
        </Button>
      </div>

      {/* Summary Stats Cards */}
      {paymentPlans.length > 0 && (() => {
        const allPayments = paymentPlans.flatMap(plan => plan.lineItems);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Paid: All payments that have been marked as paid
        const totalPaid = allPayments
          .filter(p => p.isPaid)
          .reduce((sum, p) => sum + p.amount, 0);

        // Past Due: Unpaid payments where the date has passed
        const totalPastDue = allPayments
          .filter(p => !p.isPaid && new Date(p.date) < today)
          .reduce((sum, p) => sum + p.amount, 0);

        const pastDueCount = allPayments.filter(p => !p.isPaid && new Date(p.date) < today).length;

        // Owed: Unpaid payments that are not yet due (date >= today)
        const totalOwed = allPayments
          .filter(p => !p.isPaid && new Date(p.date) >= today)
          .reduce((sum, p) => sum + p.amount, 0);

        const owedPaymentCount = allPayments.filter(p => !p.isPaid && new Date(p.date) >= today).length;

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Inventory Paid */}
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600 mb-1">Inventory Paid</p>
                    <p className="text-3xl font-bold text-green-700">
                      ${totalPaid.toLocaleString()}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-green-500 rounded-full flex items-center justify-center">
                    <Check className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inventory Owed */}
            <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-600 mb-1">Inventory Owed</p>
                    <p className="text-3xl font-bold text-yellow-700">
                      ${totalOwed.toLocaleString()}
                    </p>
                    <p className="text-xs text-yellow-600 mt-1">
                      {owedPaymentCount} payment{owedPaymentCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-yellow-500 rounded-full flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Inventory Past Due */}
            <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-600 mb-1">Inventory Past Due</p>
                    <p className="text-3xl font-bold text-red-700">
                      ${totalPastDue.toLocaleString()}
                    </p>
                    <p className="text-xs text-red-600 mt-1">
                      {pastDueCount} overdue payment{pastDueCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="h-12 w-12 bg-red-500 rounded-full flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Timeline Visualization */}
      {paymentPlans.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Payment Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(() => {
                // Calculate GLOBAL date range from ALL payments across ALL plans
                const allPayments = paymentPlans.flatMap(plan => 
                  plan.lineItems.filter(item => item.date)
                );

                if (allPayments.length === 0) return <div className="text-center text-gray-500 py-8">No payments scheduled</div>;

                const allDates = allPayments.map(p => new Date(p.date).getTime());
                const globalMinDate = new Date(Math.min(...allDates));
                const globalMaxDate = new Date(Math.max(...allDates));
                const globalDateRange = globalMaxDate.getTime() - globalMinDate.getTime();

                // Calculate global max amount for consistent bubble sizing
                const globalMaxAmount = Math.max(...allPayments.map(p => Math.abs(p.amount)));

                return (
                  <>
                    {/* Global date range display */}
                    <div className="ml-[210px] mb-2 flex justify-between text-xs text-gray-600 font-semibold px-2">
                      <div>{globalMinDate.toLocaleDateString()}</div>
                      <div>{globalMaxDate.toLocaleDateString()}</div>
                    </div>

                    {paymentPlans.map((plan) => {
                      const sortedItems = [...plan.lineItems]
                        .filter(item => item.date)
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

                      if (sortedItems.length === 0) return null;

                      // Calculate position for each payment relative to GLOBAL date range
                      const positions = sortedItems.map(item => {
                        const itemDate = new Date(item.date);
                        const position = globalDateRange === 0 ? 50 : ((itemDate.getTime() - globalMinDate.getTime()) / globalDateRange) * 100;
                        return {
                          ...item,
                          position: Math.max(5, Math.min(95, position)),
                        };
                      });

                      return (
                        <div key={plan.id} className="border-b last:border-b-0 pb-4">
                          <div className="flex items-center mb-2">
                            <div className="w-[200px] text-right pr-4 flex items-center justify-end gap-2">
                              <div className="font-bold text-sm">{plan.planNumber}</div>
                              <div className="font-semibold text-sm text-gray-600">
                                ${getPlanTotal(plan).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          
                          <div className="ml-[210px]">
                            <div className="relative h-24 bg-gradient-to-r from-blue-100 via-gray-100 to-green-100 rounded-lg pt-6 pb-3">
                              {positions.map((payment) => {
                                const amount = parseFloat(payment.amount.toString() || '0');
                                const bubbleSize = globalMaxAmount === 0 ? 35 : Math.max(25, Math.min(50, (Math.abs(amount) / globalMaxAmount) * 50));
                                
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const paymentDate = new Date(payment.date);
                                paymentDate.setHours(0, 0, 0, 0);
                                
                                const color = payment.isPaid 
                                  ? 'bg-green-500'  // Paid = Green
                                  : paymentDate < today
                                    ? 'bg-red-500'   // Unpaid & Past Due = Red
                                    : 'bg-yellow-400'; // Unpaid & Future = Yellow

                                return (
                                  <div
                                    key={payment.id}
                                    className="absolute group"
                                    style={{ 
                                      left: `${payment.position}%`, 
                                      top: '50%',
                                      transform: 'translate(-50%, -50%)'
                                    }}
                                  >
                                    <div
                                      className={`${color} rounded-full shadow-lg cursor-pointer transition-all hover:scale-110 flex items-center justify-center`}
                                      style={{
                                        width: `${bubbleSize}px`,
                                        height: `${bubbleSize}px`,
                                      }}
                                    >
                                      <span className="text-white text-[10px] font-bold">
                                        ${amount >= 1000 ? `${(Math.abs(amount) / 1000).toFixed(0)}k` : Math.abs(amount).toFixed(0)}
                                      </span>
                                    </div>

                                    <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 text-[9px] text-gray-700 font-medium whitespace-nowrap">
                                      {new Date(payment.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                                    </div>

                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                                      <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                                        <div className="font-semibold">{payment.description || 'Payment'}</div>
                                        <div className="text-green-300">${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                                        <div className="text-gray-400">{new Date(payment.date).toLocaleDateString()}</div>
                                        {payment.reference && (
                                          <div className="text-blue-300 text-[10px] mt-1">Ref: {payment.reference}</div>
                                        )}
                                        <div className={`text-[10px] mt-1 ${payment.isPaid ? 'text-green-400' : 'text-yellow-400'}`}>
                                          {payment.isPaid ? 'Paid' : 'Unpaid'}
                                        </div>
                                      </div>
                                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment Plans Table */}
      {paymentPlans.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium mb-2">No payment plans yet</p>
            <p className="text-sm text-gray-600 mb-4">Create your first payment plan to get started</p>
            <Button onClick={createNewPlan} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create Payment Plan
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Payment Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-semibold">Plan #</th>
                  <th className="text-left p-3 font-semibold">Name</th>
                  <th className="text-right p-3 font-semibold">Total Amount</th>
                  <th className="text-right p-3 font-semibold">Paid</th>
                  <th className="text-right p-3 font-semibold">Unpaid</th>
                  <th className="text-center p-3 font-semibold">Payments</th>
                  <th className="text-center p-3 font-semibold">Actions</th>
                  <th className="text-center p-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {paymentPlans.map((plan) => {
                  const isExpanded = expandedPlans.has(plan.planNumber);
                  const total = getPlanTotal(plan);
                  const { paid, unpaid } = getPlanPaidUnpaid(plan);

                  return (
                    <React.Fragment key={plan.id}>
                      <tr className="border-b hover:bg-gray-50">
                        <td className="p-3 font-mono text-xs">{plan.planNumber}</td>
                        <td className="p-3 font-medium">{plan.name}</td>
                        <td className="p-3 text-right font-semibold">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right text-green-600 font-semibold">${paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-right text-yellow-600 font-semibold">${unpaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="p-3 text-center">{plan.lineItems.length}</td>
                        <td className="p-3 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button onClick={() => editPlan(plan)} variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button onClick={() => deletePlan(plan.id)} variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            onClick={() => toggleExpanded(plan.planNumber)}
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="p-4 bg-gray-50">
                            <div className="text-sm">
                              <div className="font-semibold mb-3">Payment Line Items:</div>
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b">
                                    <th className="text-left p-2">Description</th>
                                    <th className="text-right p-2">Amount</th>
                                    <th className="text-left p-2">Date</th>
                                    <th className="text-left p-2">Reference</th>
                                    <th className="text-center p-2">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {plan.lineItems.map((item) => (
                                    <tr key={item.id} className="border-b">
                                      <td className="p-2">{item.description || '—'}</td>
                                      <td className="p-2 text-right font-medium">${parseFloat(item.amount.toString()).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                      <td className="p-2">{new Date(item.date).toLocaleDateString()}</td>
                                      <td className="p-2">{item.reference || '—'}</td>
                                      <td className="p-2 text-center">
                                        {item.isPaid ? (
                                          <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">Paid</span>
                                        ) : (
                                          <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs">Unpaid</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Editor View with Floating Windows */}
      {currentPlan && (() => {
        const totals = calculateTotals();
        const timelineData = getTimelineData();
        
        return (
          <div className="fixed inset-0 bg-white z-50 overflow-y-auto p-6">
            {/* Floating Summary */}
            <div className="fixed top-4 right-4 z-50 w-[300px] bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-300 rounded-lg shadow-lg backdrop-blur-sm bg-opacity-95 p-3">
              <div className="mb-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-sm">{currentPlan.planNumber}</h3>
                </div>
                <div className="space-y-1">
                  <div>
                    <div className="text-[10px] text-gray-600">Total</div>
                    <div className={`text-lg font-bold ${totals.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-600">Count</div>
                    <div className="text-sm font-bold text-blue-600">
                      {totals.count} payment{totals.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Editor Content */}
            <div className="max-w-[1800px] mx-auto pr-[320px]">
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold">Edit Payment Plan: {currentPlan.planNumber}</h1>
                  <Input
                    value={currentPlan.name}
                    onChange={(e) => setCurrentPlan({ ...currentPlan, name: e.target.value })}
                    className="mt-2 max-w-md"
                    placeholder="Plan name..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={addLineItem} variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Line Item
                  </Button>
                  <Button onClick={cancelEdit} variant="outline">
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={savePlan}>
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>

              {/* Payment Timeline (like Sales Velocity) */}
              {timelineData && timelineData.positions.length > 0 && (
                <Card className="mb-6">
                  <CardHeader>
                    <CardTitle className="text-base">Payment Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="relative h-28 bg-gradient-to-r from-blue-100 via-gray-100 to-green-100 rounded-lg pt-8 pb-4">
                      <div className="absolute top-2 left-3 text-xs text-gray-700 font-semibold">
                        {timelineData.minDate.toLocaleDateString()}
                      </div>
                      <div className="absolute top-2 right-3 text-xs text-gray-700 font-semibold">
                        {timelineData.maxDate.toLocaleDateString()}
                      </div>

                      {timelineData.positions.map((payment) => {
                        const amount = parseFloat(payment.amount.toString() || '0');
                        const maxAmount = Math.max(...timelineData.positions.map(p => parseFloat(p.amount.toString() || '0')));
                        const bubbleSize = maxAmount === 0 ? 40 : Math.max(30, Math.min(60, (Math.abs(amount) / maxAmount) * 60));
                        
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        const paymentDate = new Date(payment.date);
                        paymentDate.setHours(0, 0, 0, 0);
                        
                        const color = payment.isPaid 
                          ? 'bg-green-500'  // Paid = Green
                          : paymentDate < today
                            ? 'bg-red-500'   // Unpaid & Past Due = Red
                            : 'bg-yellow-400'; // Unpaid & Future = Yellow

                        return (
                          <div
                            key={payment.id}
                            className="absolute group"
                            style={{ 
                              left: `${payment.position}%`, 
                              top: '50%',
                              transform: 'translate(-50%, -50%)'
                            }}
                          >
                            <div
                              className={`${color} rounded-full shadow-lg cursor-pointer transition-all hover:scale-110 flex items-center justify-center`}
                              style={{
                                width: `${bubbleSize}px`,
                                height: `${bubbleSize}px`,
                              }}
                            >
                              <span className="text-white text-xs font-bold">
                                ${amount >= 1000 ? `${(amount / 1000).toFixed(0)}k` : amount.toFixed(0)}
                              </span>
                            </div>

                            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 text-[10px] text-gray-700 font-medium whitespace-nowrap">
                              {new Date(payment.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                            </div>

                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block z-50">
                              <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl">
                                <div className="font-semibold">{payment.description || 'Payment'}</div>
                                <div className="text-green-300">${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                                <div className="text-gray-400">{new Date(payment.date).toLocaleDateString()}</div>
                                {payment.reference && (
                                  <div className="text-blue-300 text-[10px] mt-1">Ref: {payment.reference}</div>
                                )}
                              </div>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent className="pt-6">
                  {currentPlan.lineItems.length === 0 ? (
                    <div className="text-center text-gray-500 py-12">
                      <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-medium mb-2">No line items yet</p>
                      <p className="text-sm mb-4">Click "Add Line Item" to start adding payments</p>
                      <Button onClick={addLineItem} variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Line Item
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-12 gap-2 pb-2 border-b font-semibold text-sm text-gray-600">
                        <div className="col-span-2">Description</div>
                        <div className="col-span-2">Amount ($)</div>
                        <div className="col-span-2">Date</div>
                        <div className="col-span-2">Reference Type</div>
                        <div className="col-span-2">Reference #</div>
                        <div className="col-span-1">Status</div>
                        <div className="col-span-1">Actions</div>
                      </div>

                      {currentPlan.lineItems.map((line) => (
                        <div key={line.id} className="grid grid-cols-12 gap-2 items-center py-2 border-b">
                          <div className="col-span-2">
                            <Input
                              value={line.description}
                              onChange={(e) => updateLineItem(line.id, 'description', e.target.value)}
                              placeholder="e.g., Deposit"
                              className="h-9"
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={line.amount || ''}
                              onChange={(e) => updateLineItem(line.id, 'amount', parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              className="h-9"
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="date"
                              value={line.date}
                              onChange={(e) => updateLineItem(line.id, 'date', e.target.value)}
                              className="h-9"
                            />
                          </div>
                          <div className="col-span-2">
                            <Select
                              value={line.referenceType}
                              onValueChange={(value) => updateLineItem(line.id, 'referenceType', value)}
                            >
                              <SelectTrigger className="h-9">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="po">Purchase Order</SelectItem>
                                <SelectItem value="shipment">Shipment</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2">
                            <Input
                              value={line.reference}
                              onChange={(e) => updateLineItem(line.id, 'reference', e.target.value)}
                              placeholder="PO-123"
                              className="h-9"
                            />
                          </div>
                          <div className="col-span-1">
                            <Button
                              variant={line.isPaid ? "default" : "outline"}
                              size="sm"
                              onClick={() => updateLineItem(line.id, 'isPaid', !line.isPaid)}
                              className={`h-9 w-full ${line.isPaid ? "bg-green-600 hover:bg-green-700 text-white" : "border-yellow-500 text-yellow-700 hover:bg-yellow-50"}`}
                            >
                              {line.isPaid ? <Check className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
                            </Button>
                          </div>
                          <div className="col-span-1">
                            <Button
                              onClick={() => deleteLineItem(line.id)}
                              variant="ghost"
                              size="sm"
                              className="h-9 w-9 p-0"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-6 pt-4 border-t flex justify-between items-center">
                    <div className="text-sm text-gray-600">
                      Total: <span className="font-bold text-lg text-gray-900">${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {totals.count} line {totals.count === 1 ? 'item' : 'items'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

