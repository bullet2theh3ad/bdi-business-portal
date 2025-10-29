'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Plus, Calendar, Package, Trash2, Edit, Save } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface InventoryPayment {
  id: string;
  poNumber: string;
  supplier: string;
  totalAmount: number;
  paymentDate: string;
  paymentWeek: string;
  description: string;
  status: 'scheduled' | 'paid';
  createdAt: string;
}

interface PaymentTemplate {
  id: string;
  name: string;
  description: string;
  milestones: {
    label: string;
    percentage: number;
    offsetWeeks: number;
  }[];
}

const PAYMENT_TEMPLATES: PaymentTemplate[] = [
  {
    id: 'deposit-shipment-net30',
    name: '30/40/30 (Standard)',
    description: 'Deposit, On Shipment, Net-30',
    milestones: [
      { label: 'Deposit', percentage: 30, offsetWeeks: 0 },
      { label: 'On Shipment', percentage: 40, offsetWeeks: 4 },
      { label: 'Net-30', percentage: 30, offsetWeeks: 8 },
    ],
  },
  {
    id: 'fifty-fifty',
    name: '50/50',
    description: 'Half upfront, half on delivery',
    milestones: [
      { label: 'Upfront', percentage: 50, offsetWeeks: 0 },
      { label: 'On Delivery', percentage: 50, offsetWeeks: 4 },
    ],
  },
  {
    id: 'net-30',
    name: 'Net-30',
    description: 'Full payment 30 days after invoice',
    milestones: [
      { label: 'Net-30', percentage: 100, offsetWeeks: 4 },
    ],
  },
  {
    id: 'net-60',
    name: 'Net-60',
    description: 'Full payment 60 days after invoice',
    milestones: [
      { label: 'Net-60', percentage: 100, offsetWeeks: 8 },
    ],
  },
];

export default function InventoryPaymentsPage() {
  const [payments, setPayments] = useState<InventoryPayment[]>([]);
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [showBuilderDialog, setShowBuilderDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [availablePOs, setAvailablePOs] = useState<{poNumber: string; supplier: string; totalAmount: number; createdAt: string}[]>([]);

  // Manual payment form state
  const [manualForm, setManualForm] = useState({
    poNumber: '',
    supplier: '',
    amount: '',
    date: '',
    description: '',
  });

  // Payment builder state
  const [builderForm, setBuilderForm] = useState({
    poNumber: '',
    supplier: '',
    totalAmount: '',
    startDate: '',
    selectedTemplate: '',
  });
  const [customMilestones, setCustomMilestones] = useState<{
    label: string;
    percentage: number;
    offsetWeeks: number;
    amount: number;
    date: string;
  }[]>([]);

  // Load available POs from CPFR system
  useEffect(() => {
    async function loadPOs() {
      try {
        const response = await fetch('/api/cpfr/purchase-orders');
        if (response.ok) {
          const data = await response.json();
          // Map PO data to our format
          const pos = data.purchaseOrders?.map((po: any) => ({
            poNumber: po.poNumber,
            supplier: po.supplierName || 'Unknown Supplier',
            totalAmount: parseFloat(po.totalAmount || '0'),
            createdAt: po.createdAt ? new Date(po.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          })) || [];
          setAvailablePOs(pos);
        }
      } catch (error) {
        console.error('Error loading POs:', error);
      }
    }
    loadPOs();
  }, []);

  // Calculate week start date (Monday) from a given date
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
  };

  // Handle manual payment submission
  const handleManualSubmit = () => {
    if (!manualForm.poNumber || !manualForm.supplier || !manualForm.amount || !manualForm.date) {
      alert('Please fill in all required fields');
      return;
    }

    const paymentDate = new Date(manualForm.date);
    const weekStart = getWeekStart(paymentDate);

    const newPayment: InventoryPayment = {
      id: `payment-${Date.now()}`,
      poNumber: manualForm.poNumber,
      supplier: manualForm.supplier,
      totalAmount: parseFloat(manualForm.amount),
      paymentDate: manualForm.date,
      paymentWeek: weekStart,
      description: manualForm.description,
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };

    setPayments([...payments, newPayment]);
    setShowManualDialog(false);
    setManualForm({ poNumber: '', supplier: '', amount: '', date: '', description: '' });
  };

  // Handle template selection in builder
  const handleTemplateSelect = (templateId: string) => {
    setBuilderForm({ ...builderForm, selectedTemplate: templateId });
    
    // If custom is selected, clear milestones and let user build their own
    if (templateId === 'custom') {
      setCustomMilestones([]);
      return;
    }
    
    const template = PAYMENT_TEMPLATES.find(t => t.id === templateId);
    if (!template || !builderForm.totalAmount || !builderForm.startDate) return;

    const totalAmount = parseFloat(builderForm.totalAmount);
    const startDate = new Date(builderForm.startDate);

    const milestones = template.milestones.map(m => {
      const amount = (totalAmount * m.percentage) / 100;
      const milestoneDate = new Date(startDate);
      milestoneDate.setDate(milestoneDate.getDate() + (m.offsetWeeks * 7));

      return {
        label: m.label,
        percentage: m.percentage,
        offsetWeeks: m.offsetWeeks,
        amount,
        date: milestoneDate.toISOString().split('T')[0],
      };
    });

    setCustomMilestones(milestones);
  };

  // Apply payment schedule from builder
  const handleBuilderSubmit = () => {
    if (!builderForm.poNumber || !builderForm.supplier || customMilestones.length === 0) {
      alert('Please complete the payment schedule');
      return;
    }

    const newPayments: InventoryPayment[] = customMilestones.map((m, index) => {
      const paymentDate = new Date(m.date);
      const weekStart = getWeekStart(paymentDate);

      return {
        id: `payment-${Date.now()}-${index}`,
        poNumber: builderForm.poNumber,
        supplier: builderForm.supplier,
        totalAmount: m.amount,
        paymentDate: m.date,
        paymentWeek: weekStart,
        description: `${m.label} (${m.percentage}% of PO)`,
        status: 'scheduled',
        createdAt: new Date().toISOString(),
      };
    });

    setPayments([...payments, ...newPayments]);
    setShowBuilderDialog(false);
    setBuilderForm({ poNumber: '', supplier: '', totalAmount: '', startDate: '', selectedTemplate: '' });
    setCustomMilestones([]);
  };

  // Delete payment
  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this payment?')) {
      setPayments(payments.filter(p => p.id !== id));
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Package className="h-8 w-8 text-blue-600" />
          Inventory Payments
        </h1>
        <p className="text-gray-600 mt-2">
          Manage PO payment schedules and inventory cash outflows
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mb-6 flex gap-3">
        <Button onClick={() => setShowManualDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Manual Payment
        </Button>
        <Button onClick={() => setShowBuilderDialog(true)} variant="outline" className="gap-2">
          <Calendar className="h-4 w-4" />
          Build Payment Schedule
        </Button>
      </div>

      {/* Payments List */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No payments scheduled yet</p>
              <p className="text-sm mt-2">Add a manual payment or build a payment schedule to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.sort((a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()).map(payment => (
                <div key={payment.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-lg">PO #{payment.poNumber}</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {payment.status === 'scheduled' ? 'Scheduled' : 'Paid'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-gray-600">Supplier:</span>
                          <p className="font-medium">{payment.supplier}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Amount:</span>
                          <p className="font-medium text-green-600">${payment.totalAmount.toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Payment Date:</span>
                          <p className="font-medium">{new Date(payment.paymentDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-600">Week of:</span>
                          <p className="font-medium">{new Date(payment.paymentWeek).toLocaleDateString()}</p>
                        </div>
                      </div>
                      {payment.description && (
                        <p className="text-sm text-gray-600 mt-2">{payment.description}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(payment.id)}
                      className="ml-4"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Payment Dialog */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
          <DialogHeader>
            <DialogTitle>Add Manual Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="poNumber">PO Number *</Label>
                <Select
                  value={manualForm.poNumber}
                  onValueChange={(value) => {
                    const selectedPO = availablePOs.find(po => po.poNumber === value);
                    setManualForm({
                      ...manualForm,
                      poNumber: value,
                      supplier: selectedPO?.supplier || '',
                      amount: selectedPO?.totalAmount.toString() || '',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a PO..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePOs.map((po) => (
                      <SelectItem key={po.poNumber} value={po.poNumber}>
                        {po.poNumber} - {po.supplier} (${po.totalAmount.toLocaleString()})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="supplier">Supplier (Auto-filled)</Label>
                <Input
                  id="supplier"
                  value={manualForm.supplier}
                  onChange={(e) => setManualForm({ ...manualForm, supplier: e.target.value })}
                  placeholder="Supplier Name"
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={manualForm.amount}
                  onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label htmlFor="date">Payment Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={manualForm.date}
                  onChange={(e) => setManualForm({ ...manualForm, date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={manualForm.description}
                onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
                placeholder="Payment description"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowManualDialog(false)}>Cancel</Button>
            <Button onClick={handleManualSubmit}>
              <Save className="h-4 w-4 mr-2" />
              Save Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Schedule Builder Dialog */}
      <Dialog open={showBuilderDialog} onOpenChange={setShowBuilderDialog}>
        <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
          <DialogHeader>
            <DialogTitle>Build Payment Schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Step 1: PO Details */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-gray-700">Step 1: PO Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="builderPoNumber" className="mb-2 block">PO Number *</Label>
                  <Select
                    value={builderForm.poNumber}
                    onValueChange={(value) => {
                      const selectedPO = availablePOs.find(po => po.poNumber === value);
                      setBuilderForm({
                        ...builderForm,
                        poNumber: value,
                        supplier: selectedPO?.supplier || '',
                        totalAmount: selectedPO?.totalAmount.toString() || '',
                        startDate: selectedPO?.createdAt || '',
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a PO..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePOs.map((po) => (
                        <SelectItem key={po.poNumber} value={po.poNumber}>
                          {po.poNumber} - {po.supplier} (${po.totalAmount.toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="builderSupplier" className="mb-2 block">Supplier (Auto-filled)</Label>
                  <Input
                    id="builderSupplier"
                    value={builderForm.supplier}
                    onChange={(e) => setBuilderForm({ ...builderForm, supplier: e.target.value })}
                    placeholder="Supplier Name"
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="builderAmount" className="mb-2 block">Total PO Amount (Auto-filled)</Label>
                  <Input
                    id="builderAmount"
                    type="number"
                    step="0.01"
                    value={builderForm.totalAmount}
                    onChange={(e) => setBuilderForm({ ...builderForm, totalAmount: e.target.value })}
                    placeholder="50000.00"
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                <div>
                  <Label htmlFor="builderStartDate" className="mb-2 block">PO Creation Date (Auto-filled)</Label>
                  <Input
                    id="builderStartDate"
                    type="date"
                    value={builderForm.startDate}
                    onChange={(e) => setBuilderForm({ ...builderForm, startDate: e.target.value })}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Select Template */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-gray-700">Step 2: Select Payment Template</h3>
              <div>
                <Label htmlFor="paymentTemplate" className="mb-2 block">Payment Template *</Label>
                <Select
                  value={builderForm.selectedTemplate}
                  onValueChange={(value) => handleTemplateSelect(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a payment template...">
                      {builderForm.selectedTemplate && (
                        <span className="font-medium">
                          {builderForm.selectedTemplate === 'custom' 
                            ? '✏️ Custom Payment Schedule' 
                            : PAYMENT_TEMPLATES.find(t => t.id === builderForm.selectedTemplate)?.name}
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="w-[600px]">
                    {PAYMENT_TEMPLATES.map(template => (
                      <SelectItem key={template.id} value={template.id} className="py-3">
                        <div className="flex flex-col gap-2 py-1">
                          <div className="font-semibold text-base">{template.name}</div>
                          <div className="text-sm text-gray-600">{template.description}</div>
                          <div className="flex gap-2 flex-wrap mt-1">
                            {template.milestones.map((m, i) => (
                              <span key={i} className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-md font-medium">
                                {m.percentage}% @ {m.offsetWeeks}w
                              </span>
                            ))}
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="custom" className="py-3 border-t-2 border-gray-200">
                      <div className="flex flex-col gap-2 py-1">
                        <div className="font-semibold text-base">✏️ Custom</div>
                        <div className="text-sm text-gray-600">Create your own payment schedule</div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Milestones Editor (for any selected template) */}
              {builderForm.selectedTemplate && (
                <div className="border rounded-lg p-4 bg-gray-50 space-y-3 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">
                      {builderForm.selectedTemplate === 'custom' ? 'Custom Payment Milestones' : 'Payment Schedule (Editable)'}
                    </h4>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCustomMilestones([
                          ...customMilestones,
                          {
                            label: '',
                            percentage: 0,
                            offsetWeeks: 0,
                            amount: 0,
                            date: builderForm.startDate,
                          },
                        ]);
                      }}
                    >
                      + Add Milestone
                    </Button>
                  </div>
                  {customMilestones.map((milestone, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-3">
                        <Label className="text-xs">Label</Label>
                        <Input
                          value={milestone.label}
                          onChange={(e) => {
                            const updated = [...customMilestones];
                            updated[index].label = e.target.value;
                            setCustomMilestones(updated);
                          }}
                          placeholder="e.g. Deposit"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Percent %</Label>
                        <Input
                          type="number"
                          value={milestone.percentage || ''}
                          onChange={(e) => {
                            const updated = [...customMilestones];
                            const percent = parseFloat(e.target.value) || 0;
                            updated[index].percentage = percent;
                            const total = parseFloat(builderForm.totalAmount) || 0;
                            updated[index].amount = (total * percent) / 100;
                            setCustomMilestones(updated);
                          }}
                          placeholder="30"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Amount $</Label>
                        <Input
                          type="number"
                          value={milestone.amount || ''}
                          onChange={(e) => {
                            const updated = [...customMilestones];
                            updated[index].amount = parseFloat(e.target.value) || 0;
                            setCustomMilestones(updated);
                          }}
                          placeholder="15000"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Weeks</Label>
                        <Input
                          type="number"
                          value={milestone.offsetWeeks || ''}
                          onChange={(e) => {
                            const updated = [...customMilestones];
                            updated[index].offsetWeeks = parseInt(e.target.value) || 0;
                            if (builderForm.startDate) {
                              const startDate = new Date(builderForm.startDate);
                              startDate.setDate(startDate.getDate() + (updated[index].offsetWeeks * 7));
                              updated[index].date = startDate.toISOString().split('T')[0];
                            }
                            setCustomMilestones(updated);
                          }}
                          placeholder="0"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Date</Label>
                        <Input
                          type="date"
                          value={milestone.date}
                          onChange={(e) => {
                            const updated = [...customMilestones];
                            updated[index].date = e.target.value;
                            setCustomMilestones(updated);
                          }}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setCustomMilestones(customMilestones.filter((_, i) => i !== index));
                          }}
                          className="h-8 w-8 p-0"
                        >
                          ✕
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step 3: Preview Payment Schedule */}
            {customMilestones.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-gray-700">Step 3: Preview Payment Schedule</h3>
                <div className="border rounded-lg p-4 bg-gray-50">
                  <div className="space-y-3">
                    {customMilestones.map((milestone, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex-1">
                          <span className="font-medium">{milestone.label}</span>
                          <span className="text-sm text-gray-600 ml-2">({milestone.percentage}%)</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-green-600">${milestone.amount.toFixed(2)}</div>
                          <div className="text-xs text-gray-600">{new Date(milestone.date).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between py-2 pt-4 border-t-2 font-bold">
                      <span>Total</span>
                      <span className="text-green-600">
                        ${customMilestones.reduce((sum, m) => sum + m.amount, 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowBuilderDialog(false)}>Cancel</Button>
            <Button onClick={handleBuilderSubmit} disabled={customMilestones.length === 0}>
              <Save className="h-4 w-4 mr-2" />
              Create Payment Schedule
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

