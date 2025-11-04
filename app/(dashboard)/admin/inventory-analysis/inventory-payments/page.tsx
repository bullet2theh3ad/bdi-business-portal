'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Plus, Calendar, Trash2, Edit, Save, X, Check, ChevronDown, ChevronUp, Eye, EyeOff, Download, Upload, FileText } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

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

interface PaymentDocument {
  id: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
}

export default function InventoryPaymentsPage() {
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<PaymentPlan | null>(null);
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [showTimeline, setShowTimeline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState<PaymentDocument[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  
  // Date range filter state
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Initialize date range to show all data by default
  useEffect(() => {
    if (paymentPlans.length > 0) {
      const allDates = paymentPlans
        .flatMap(plan => plan.lineItems.map(item => item.date))
        .filter(d => d)
        .sort();
      
      if (allDates.length > 0 && !startDate && !endDate) {
        setStartDate(allDates[0]);
        setEndDate(allDates[allDates.length - 1]);
      }
    }
  }, [paymentPlans, startDate, endDate]);

  // Load payment plans from database on mount
  useEffect(() => {
    loadPaymentPlans();
  }, []);

  const loadPaymentPlans = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/inventory-payments');
      if (response.ok) {
        const data = await response.json();
        // Transform database format to frontend format
        const transformedPlans = data.map((plan: any) => ({
          id: plan.id.toString(),
          planNumber: plan.planNumber,
          name: plan.name,
          status: plan.status,
          createdAt: plan.createdAt,
          lineItems: plan.lineItems.map((item: any) => ({
            id: item.id.toString(),
            description: item.description || '',
            amount: parseFloat(item.amount),
            date: item.paymentDate,
            reference: item.reference || '',
            referenceType: item.referenceType,
            isPaid: item.isPaid,
          })),
        }));
        setPaymentPlans(transformedPlans);
      }
    } catch (error) {
      console.error('Failed to load payment plans:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load existing documents when editing a payment plan
  useEffect(() => {
    if (currentPlan && currentPlan.id) {
      fetch(`/api/inventory-payments/${currentPlan.id}/documents`)
        .then(res => res.json())
        .then(docs => {
          console.log('📁 Loaded payment plan documents:', docs);
          setUploadedFiles(docs || []);
        })
        .catch(err => console.error('Error loading payment plan documents:', err));
    } else {
      // Clear files when modal closes
      setUploadedFiles([]);
      setPendingFiles([]);
    }
  }, [currentPlan]);

  // Dropzone for payment plan documents
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setPendingFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg']
    },
    maxSize: 10 * 1024 * 1024 // 10MB limit
  });

  // Remove pending file from list
  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Upload files to server
  const uploadFiles = async (paymentPlanId: string) => {
    if (pendingFiles.length === 0) return;

    setIsUploadingFiles(true);
    try {
      const formData = new FormData();
      pendingFiles.forEach(file => formData.append('files', file));

      const response = await fetch(`/api/inventory-payments/${paymentPlanId}/documents`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Files uploaded:', result);
        setUploadedFiles(prev => [...prev, ...result.files]);
        setPendingFiles([]);
      } else {
        console.error('File upload failed:', await response.text());
        alert('Failed to upload some files. Please try again.');
      }
    } catch (error) {
      console.error('File upload error:', error);
      alert('Error uploading files. Please try again.');
    } finally {
      setIsUploadingFiles(false);
    }
  };

  // Download a document
  const downloadDocument = async (doc: PaymentDocument) => {
    try {
      // Request a signed URL from our API for private bucket access
      const response = await fetch(
        `/api/inventory-payments/documents/download?filePath=${encodeURIComponent(doc.filePath)}&fileName=${encodeURIComponent(doc.fileName)}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to get download URL');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file');
    }
  };

  // Delete a document
  const deleteDocument = async (doc: PaymentDocument) => {
    if (!confirm(`Are you sure you want to delete "${doc.fileName}"?`)) return;

    try {
      const response = await fetch(
        `/api/inventory-payments/${currentPlan?.id}/documents?documentId=${doc.id}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        setUploadedFiles(prev => prev.filter(f => f.id !== doc.id));
        console.log('✅ Document deleted');
      } else {
        alert('Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Error deleting document');
    }
  };

  // Filter payments by date range
  const filterPaymentsByDateRange = (payments: PaymentLineItem[]) => {
    if (!startDate || !endDate) return payments;
    
    return payments.filter(payment => {
      const paymentDate = new Date(payment.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return paymentDate >= start && paymentDate <= end;
    });
  };

  // CSV Export function
  const exportToCSV = () => {
    const allLineItems = paymentPlans.flatMap(plan => 
      plan.lineItems.map(item => ({
        planNumber: plan.planNumber,
        planName: plan.name,
        planStatus: plan.status,
        description: item.description,
        amount: item.amount,
        date: item.date,
        reference: item.reference,
        referenceType: item.referenceType,
        isPaid: item.isPaid ? 'Yes' : 'No',
      }))
    );

    if (allLineItems.length === 0) {
      alert('No payment data to export');
      return;
    }

    // Create CSV headers
    const headers = [
      'Plan Number',
      'Plan Name',
      'Plan Status',
      'Description',
      'Amount',
      'Payment Date',
      'Reference',
      'Reference Type',
      'Is Paid',
    ];

    // Create CSV rows
    const rows = allLineItems.map(item => [
      item.planNumber,
      item.planName,
      item.planStatus,
      item.description,
      item.amount.toFixed(2),
      item.date,
      item.reference,
      item.referenceType,
      item.isPaid,
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `inventory-payments-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
  const savePlan = async () => {
    if (!currentPlan || isSaving) return;

    try {
      setIsSaving(true);
      const isNewPlan = currentPlan.id.startsWith('plan-');

      const payload = {
        planNumber: currentPlan.planNumber,
        name: currentPlan.name,
        status: currentPlan.status,
        lineItems: currentPlan.lineItems,
      };

      let planId = currentPlan.id;

      if (isNewPlan) {
        // Create new plan
        const response = await fetch('/api/inventory-payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error('Failed to create payment plan');
        }

        const result = await response.json();
        planId = result.plan.id.toString();
      } else {
        // Update existing plan
        const response = await fetch(`/api/inventory-payments/${currentPlan.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error('Failed to update payment plan');
        }
      }

      // Upload pending files if any
      if (pendingFiles.length > 0) {
        await uploadFiles(planId);
      }

      // Reload plans from database
      await loadPaymentPlans();
      setCurrentPlan(null);
    } catch (error) {
      console.error('Error saving payment plan:', error);
      alert('Failed to save payment plan. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel editing
  const cancelEdit = () => {
    setCurrentPlan(null);
  };

  // Delete plan
  const deletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this payment plan?')) return;

    try {
      const response = await fetch(`/api/inventory-payments/${planId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete payment plan');
      }

      // Reload plans from database
      await loadPaymentPlans();
    } catch (error) {
      console.error('Error deleting payment plan:', error);
      alert('Failed to delete payment plan. Please try again.');
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


  // Show loading state
  if (isLoading) {
    return (
      <div className="p-6 max-w-[1800px] mx-auto">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading payment plans...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-[1800px] mx-auto">
      {/* Page Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1 sm:mb-2">Inventory/Major Payments</h1>
            <p className="text-sm sm:text-base text-gray-600">Timeline view of payment schedules with document management</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={exportToCSV} variant="outline" className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Export CSV</span>
              <span className="sm:hidden">Export</span>
            </Button>
            <Button onClick={createNewPlan} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              New Payment Plan
            </Button>
          </div>
        </div>

        {/* Date Range Filter */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardContent className="pt-3 pb-3 sm:pt-4 sm:pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                <span className="text-sm sm:text-base font-semibold text-gray-700">Date Range:</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="start-date" className="text-xs sm:text-sm font-medium text-gray-600 whitespace-nowrap">From:</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full sm:w-40 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="end-date" className="text-xs sm:text-sm font-medium text-gray-600 whitespace-nowrap">To:</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full sm:w-40 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = new Date();
                    const start = new Date(today);
                    start.setDate(today.getDate() - (3 * 7)); // 3 weeks back
                    const end = new Date(today);
                    end.setDate(today.getDate() + (13 * 7)); // 13 weeks forward
                    
                    setStartDate(start.toISOString().split('T')[0]);
                    setEndDate(end.toISOString().split('T')[0]);
                  }}
                  className="bg-blue-50 hover:bg-blue-100 border-blue-300 text-blue-700 font-semibold flex-1 sm:flex-none text-xs sm:text-sm"
                >
                  13-Week
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allDates = paymentPlans
                      .flatMap(plan => plan.lineItems.map(item => item.date))
                      .filter(d => d)
                      .sort();
                    if (allDates.length > 0) {
                      setStartDate(allDates[0]);
                      setEndDate(allDates[allDates.length - 1]);
                    }
                  }}
                  className="flex-1 sm:flex-none text-xs sm:text-sm"
                >
                  Reset to All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Stats Cards */}
      {paymentPlans.length > 0 && (() => {
        // Filter payments by date range
        const allPayments = paymentPlans.flatMap(plan => plan.lineItems);
        const filteredPayments = filterPaymentsByDateRange(allPayments);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Paid: All payments that have been marked as paid (within date range)
        const totalPaid = filteredPayments
          .filter(p => p.isPaid)
          .reduce((sum, p) => sum + p.amount, 0);

        // Past Due: Unpaid payments where the date has passed (within date range)
        const totalPastDue = filteredPayments
          .filter(p => !p.isPaid && new Date(p.date) < today)
          .reduce((sum, p) => sum + p.amount, 0);

        const pastDueCount = filteredPayments.filter(p => !p.isPaid && new Date(p.date) < today).length;

        // Owed: Unpaid payments that are not yet due (date >= today) (within date range)
        const totalOwed = filteredPayments
          .filter(p => !p.isPaid && new Date(p.date) >= today)
          .reduce((sum, p) => sum + p.amount, 0);

        const owedPaymentCount = filteredPayments.filter(p => !p.isPaid && new Date(p.date) >= today).length;

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
                // Calculate GLOBAL date range from FILTERED payments
                const allPayments = paymentPlans.flatMap(plan => 
                  plan.lineItems.filter(item => item.date)
                );
                
                // Apply date range filter
                const filteredPayments = filterPaymentsByDateRange(allPayments);

                if (filteredPayments.length === 0) return <div className="text-center text-gray-500 py-8">No payments in selected date range</div>;

                // Use filtered date range for timeline
                const globalMinDate = new Date(startDate || filteredPayments[0].date);
                const globalMaxDate = new Date(endDate || filteredPayments[filteredPayments.length - 1].date);
                const globalDateRange = globalMaxDate.getTime() - globalMinDate.getTime();

                // Calculate global max amount for consistent bubble sizing
                const globalMaxAmount = Math.max(...allPayments.map(p => Math.abs(p.amount)));

                return (
                  <>
                    {paymentPlans.map((plan) => {
                      // Filter plan items by date range
                      const sortedItems = [...plan.lineItems]
                        .filter(item => item.date)
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                      
                      const filteredItems = filterPaymentsByDateRange(sortedItems);

                      if (filteredItems.length === 0) return null;

                      // Calculate position for each payment relative to GLOBAL date range
                      const positions = filteredItems.map(item => {
                        const itemDate = new Date(item.date);
                        const position = globalDateRange === 0 ? 50 : ((itemDate.getTime() - globalMinDate.getTime()) / globalDateRange) * 100;
                        return {
                          ...item,
                          position: Math.max(5, Math.min(95, position)),
                        };
                      });

                      return (
                        <div key={plan.id} className="relative flex items-center">
                          {/* Plan name and total on the left */}
                          <div className="w-[200px] text-left pr-4 flex items-center gap-2">
                            <div className="font-bold text-sm">{plan.planNumber}</div>
                            <div className="font-semibold text-sm text-gray-600">
                              ${getPlanTotal(plan).toLocaleString()}
                            </div>
                          </div>
                          
                          {/* Timeline with horizontal line and bubbles centered on it */}
                          <div className="flex-1">
                            <div className="relative h-16">
                              {/* Horizontal center line */}
                              <div className="absolute left-0 right-0 top-1/2 border-t border-gray-300" />
                              
                              {/* Bubbles positioned on the line */}
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
                                      className={`${color} rounded-full shadow-lg cursor-pointer transition-all hover:scale-110 flex items-center justify-center border-2 border-white`}
                                      style={{
                                        width: `${bubbleSize}px`,
                                        height: `${bubbleSize}px`,
                                      }}
                                    >
                                      <span className="text-white text-[10px] font-bold">
                                        ${amount >= 1000 ? `${(Math.abs(amount) / 1000).toFixed(0)}k` : Math.abs(amount).toFixed(0)}
                                      </span>
                                    </div>

                                    {/* Tooltip on hover */}
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
                    
                    {/* Global date range display at bottom */}
                    <div className="flex">
                      <div className="w-[200px]"></div>
                      <div className="flex-1 flex justify-between text-xs text-gray-500 font-medium px-2 mt-2">
                        <div>{globalMinDate.toLocaleDateString()}</div>
                        <div>{globalMaxDate.toLocaleDateString()}</div>
                      </div>
                    </div>
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
            <CardTitle className="text-lg sm:text-xl">Payment Plans</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2 sm:p-3 font-semibold">Plan #</th>
                    <th className="text-left p-2 sm:p-3 font-semibold">Name</th>
                    <th className="text-right p-2 sm:p-3 font-semibold">Total</th>
                    <th className="text-right p-2 sm:p-3 font-semibold hidden sm:table-cell">Paid</th>
                    <th className="text-right p-2 sm:p-3 font-semibold hidden sm:table-cell">Unpaid</th>
                    <th className="text-center p-2 sm:p-3 font-semibold hidden md:table-cell">Payments</th>
                    <th className="text-center p-2 sm:p-3 font-semibold">Actions</th>
                    <th className="text-center p-2 sm:p-3 font-semibold"></th>
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
                        <td className="p-2 sm:p-3 font-mono text-[10px] sm:text-xs whitespace-nowrap">{plan.planNumber}</td>
                        <td className="p-2 sm:p-3 font-medium text-xs sm:text-sm">
                          <div className="max-w-[120px] sm:max-w-none truncate">{plan.name}</div>
                        </td>
                        <td className="p-2 sm:p-3 text-right font-semibold text-xs sm:text-sm whitespace-nowrap">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="p-2 sm:p-3 text-right text-green-600 font-semibold hidden sm:table-cell whitespace-nowrap">${paid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="p-2 sm:p-3 text-right text-yellow-600 font-semibold hidden sm:table-cell whitespace-nowrap">${unpaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                        <td className="p-2 sm:p-3 text-center hidden md:table-cell">{plan.lineItems.length}</td>
                        <td className="p-2 sm:p-3 text-center">
                          <div className="flex gap-1 sm:gap-2 justify-center">
                            <Button onClick={() => editPlan(plan)} variant="outline" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                              <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                            <Button onClick={() => deletePlan(plan.id)} variant="ghost" size="sm" className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                        <td className="p-2 sm:p-3 text-center">
                          <Button
                            onClick={() => toggleExpanded(plan.planNumber)}
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
                          <td colSpan={8} className="p-2 sm:p-4 bg-gray-50">
                            <div className="text-xs sm:text-sm">
                              <div className="font-semibold mb-2 sm:mb-3 text-xs sm:text-sm">Payment Line Items:</div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-[10px] sm:text-xs">
                                  <thead>
                                    <tr className="border-b">
                                      <th className="text-left p-1 sm:p-2">Description</th>
                                      <th className="text-right p-1 sm:p-2">Amount</th>
                                      <th className="text-left p-1 sm:p-2">Date</th>
                                      <th className="text-left p-1 sm:p-2 hidden sm:table-cell">Reference</th>
                                      <th className="text-center p-1 sm:p-2">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {plan.lineItems.map((item) => (
                                      <tr key={item.id} className="border-b">
                                        <td className="p-1 sm:p-2">
                                          <div className="max-w-[100px] sm:max-w-none truncate">{item.description || '—'}</div>
                                        </td>
                                        <td className="p-1 sm:p-2 text-right font-medium whitespace-nowrap">${parseFloat(item.amount.toString()).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                                        <td className="p-1 sm:p-2 whitespace-nowrap">{new Date(item.date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })}</td>
                                        <td className="p-1 sm:p-2 hidden sm:table-cell">{item.reference || '—'}</td>
                                        <td className="p-1 sm:p-2 text-center">
                                          {item.isPaid ? (
                                            <span className="bg-green-100 text-green-700 px-1 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-xs">Paid</span>
                                          ) : (
                                            <span className="bg-yellow-100 text-yellow-700 px-1 sm:px-2 py-0.5 sm:py-1 rounded text-[9px] sm:text-xs">Unpaid</span>
                                          )}
                                        </td>
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
                  <Button onClick={cancelEdit} variant="outline" disabled={isSaving}>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={savePlan} disabled={isSaving}>
                    {isSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </>
                    )}
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

              {/* Document Upload Section */}
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-base flex items-center">
                    <FileText className="h-5 w-5 mr-2" />
                    Supporting Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Dropzone for file upload */}
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    {isDragActive ? (
                      <p className="text-blue-600 font-medium">Drop files here...</p>
                    ) : (
                      <>
                        <p className="text-gray-600 font-medium mb-2">Drag & drop files here, or click to select</p>
                        <p className="text-sm text-gray-500">PDF, Word, Excel, Images - Max 10MB per file</p>
                      </>
                    )}
                  </div>

                  {/* Pending files to upload */}
                  {pendingFiles.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Files to Upload:</h4>
                      <div className="space-y-2">
                        {pendingFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <div className="flex items-center flex-1 min-w-0">
                              <FileText className="h-5 w-5 text-yellow-600 mr-3 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                              </div>
                            </div>
                            <Button
                              onClick={() => removePendingFile(index)}
                              variant="ghost"
                              size="sm"
                              className="ml-2 flex-shrink-0"
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        * Files will be uploaded when you save the payment plan
                      </p>
                    </div>
                  )}

                  {/* Uploaded files list */}
                  {uploadedFiles.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">Uploaded Documents:</h4>
                      <div className="space-y-2">
                        {uploadedFiles.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-center flex-1 min-w-0">
                              <FileText className="h-5 w-5 text-green-600 mr-3 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">{doc.fileName}</p>
                                <p className="text-xs text-gray-500">
                                  {(doc.fileSize / 1024).toFixed(1)} KB • 
                                  Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-1 ml-2 flex-shrink-0">
                              <Button
                                onClick={() => downloadDocument(doc)}
                                variant="ghost"
                                size="sm"
                                title="Download"
                              >
                                <Download className="h-4 w-4 text-blue-500" />
                              </Button>
                              <Button
                                onClick={() => deleteDocument(doc)}
                                variant="ghost"
                                size="sm"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {uploadedFiles.length === 0 && pendingFiles.length === 0 && (
                    <p className="text-center text-gray-500 text-sm mt-4">No documents attached yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

