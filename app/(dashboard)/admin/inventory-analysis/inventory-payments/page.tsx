'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Plus, Calendar, Package, Trash2, Edit, Save, X, TruckIcon } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PurchaseOrder {
  poNumber: string;
  supplier: string;
  totalAmount: number;
  createdAt: string;
  status: string;
}

interface Shipment {
  id: string;
  shipmentNumber: string;
  estimatedDeparture: string;
  estimatedArrival: string;
  status: string;
  totalQuantity?: number;
}

interface PaymentLineItem {
  id: string;
  description: string;
  amount: number;
  date: string;
  reference: string; // PO or Shipment number
  referenceType: 'po' | 'shipment' | 'other';
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
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<PaymentPlan | null>(null);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load POs and Shipments for reference
  useEffect(() => {
    loadReferenceData();
  }, []);

  const loadReferenceData = async () => {
    setIsLoading(true);
    try {
      // Load POs
      const poResponse = await fetch('/api/cpfr/purchase-orders');
      if (poResponse.ok) {
        const poData = await poResponse.json();
        const pos = poData.purchaseOrders?.map((po: any) => ({
          poNumber: po.poNumber,
          supplier: po.supplierName || 'Unknown',
          totalAmount: parseFloat(po.totalAmount || '0'),
          createdAt: po.createdAt ? new Date(po.createdAt).toISOString().split('T')[0] : '',
          status: po.status || 'active',
        })) || [];
        setPurchaseOrders(pos);
      }

      // Load Shipments
      const shipmentResponse = await fetch('/api/cpfr/shipments');
      if (shipmentResponse.ok) {
        const shipmentData = await shipmentResponse.json();
        const ships = shipmentData.shipments?.map((ship: any) => ({
          id: ship.id,
          shipmentNumber: ship.shipmentNumber,
          estimatedDeparture: ship.estimatedDeparture ? new Date(ship.estimatedDeparture).toISOString().split('T')[0] : '',
          estimatedArrival: ship.estimatedArrival ? new Date(ship.estimatedArrival).toISOString().split('T')[0] : '',
          status: ship.status || 'planning',
          totalQuantity: ship.lineItems?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0,
        })) || [];
        setShipments(ships);
      }
    } catch (error) {
      console.error('Error loading reference data:', error);
    } finally {
      setIsLoading(false);
    }
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

  // Add new line item to current plan
  const addLineItem = () => {
    if (!currentPlan) return;
    
    const newLine: PaymentLineItem = {
      id: `line-${Date.now()}`,
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      reference: '',
      referenceType: 'other',
    };

    setCurrentPlan({
      ...currentPlan,
      lineItems: [...currentPlan.lineItems, newLine],
    });
    setEditingLineId(newLine.id);
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

  // Save current plan
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
    setEditingLineId(null);
  };

  // Calculate totals for floating summary
  const calculateTotals = () => {
    if (!currentPlan) return { total: 0, count: 0, minDate: '', maxDate: '' };

    const total = currentPlan.lineItems.reduce((sum, line) => sum + parseFloat(line.amount.toString() || '0'), 0);
    const count = currentPlan.lineItems.length;
    const dates = currentPlan.lineItems.map(line => line.date).filter(d => d).sort();
    const minDate = dates[0] || '';
    const maxDate = dates[dates.length - 1] || '';

    return { total, count, minDate, maxDate };
  };

  const totals = calculateTotals();

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Inventory Payments</h1>
        <p className="text-gray-600">Manage payment schedules for purchase orders and shipments</p>
      </div>

      {/* Floating Summary (when editing a plan) */}
      {currentPlan && (
        <>
          <div
            className="fixed top-16 right-[26px] sm:right-[34px] z-50 w-[420px] sm:w-[520px] bg-gradient-to-r from-blue-50 to-green-50 border-2 border-blue-300 rounded-lg shadow-lg backdrop-blur-sm bg-opacity-95 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">Payment Plan Summary</h3>
              <span className="text-sm font-mono bg-blue-100 px-3 py-1 rounded">{currentPlan.planNumber}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-600 mb-1">Total Amount</div>
                <div className={`text-2xl font-bold whitespace-nowrap ${totals.total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-1">Payment Count</div>
                <div className="text-2xl font-bold whitespace-nowrap text-blue-600">
                  {totals.count} {totals.count === 1 ? 'payment' : 'payments'}
                </div>
              </div>
            </div>
            {totals.minDate && totals.maxDate && (
              <div className="mt-3 pt-3 border-t border-blue-200">
                <div className="text-xs text-gray-600 mb-1">Date Range</div>
                <div className="text-sm font-medium">
                  {totals.minDate} → {totals.maxDate}
                </div>
              </div>
            )}
          </div>
          {/* Spacer */}
          <div className="h-32 sm:h-36 mb-6"></div>
        </>
      )}

      {/* Reference Windows: POs and Shipments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Purchase Orders Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Purchase Orders Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {isLoading ? (
                <div className="text-center text-gray-500 py-8">Loading POs...</div>
              ) : purchaseOrders.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No purchase orders found</div>
              ) : (
                <div className="space-y-2">
                  {purchaseOrders.map((po) => (
                    <div
                      key={po.poNumber}
                      className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-sm">{po.poNumber}</div>
                          <div className="text-xs text-gray-600">{po.supplier}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm">${po.totalAmount.toLocaleString()}</div>
                          <div className="text-xs text-gray-500">{po.createdAt}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Shipments Reference */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TruckIcon className="h-5 w-5" />
              Shipments Reference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              {isLoading ? (
                <div className="text-center text-gray-500 py-8">Loading shipments...</div>
              ) : shipments.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No shipments found</div>
              ) : (
                <div className="space-y-2">
                  {shipments.map((ship) => (
                    <div
                      key={ship.id}
                      className="p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-sm">{ship.shipmentNumber}</div>
                          <div className="text-xs text-gray-600">
                            Qty: {ship.totalQuantity || 'N/A'} • {ship.status}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-600">ETD: {ship.estimatedDeparture || 'N/A'}</div>
                          <div className="text-xs text-gray-600">ETA: {ship.estimatedArrival || 'N/A'}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Payment Plan Editor */}
      {currentPlan ? (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>
                  Editing: {currentPlan.planNumber}
                </CardTitle>
                <Input
                  value={currentPlan.name}
                  onChange={(e) => setCurrentPlan({ ...currentPlan, name: e.target.value })}
                  className="mt-2 max-w-md"
                  placeholder="Plan name..."
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={addLineItem} variant="outline" size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line Item
                </Button>
                <Button onClick={savePlan} size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  Save Plan
                </Button>
                <Button onClick={() => { setCurrentPlan(null); setEditingLineId(null); }} variant="ghost" size="sm">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {currentPlan.lineItems.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                No line items yet. Click "Add Line Item" to start.
              </div>
            ) : (
              <div className="space-y-2">
                {/* Header */}
                <div className="grid grid-cols-12 gap-2 pb-2 border-b font-semibold text-sm text-gray-600">
                  <div className="col-span-3">Description</div>
                  <div className="col-span-2">Amount ($)</div>
                  <div className="col-span-2">Date</div>
                  <div className="col-span-2">Reference Type</div>
                  <div className="col-span-2">Reference #</div>
                  <div className="col-span-1">Actions</div>
                </div>

                {/* Line Items */}
                {currentPlan.lineItems.map((line) => (
                  <div key={line.id} className="grid grid-cols-12 gap-2 items-center py-2 border-b">
                    <div className="col-span-3">
                      <Input
                        value={line.description}
                        onChange={(e) => updateLineItem(line.id, 'description', e.target.value)}
                        placeholder="e.g., Deposit, On Shipment"
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
                        placeholder="PO-123 or SHP-456"
                        className="h-9"
                      />
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

            {/* Bottom Summary */}
            <div className="mt-6 pt-4 border-t flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Total: <span className="font-bold text-lg text-gray-900">${totals.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="text-sm text-gray-600">
                {totals.count} line {totals.count === 1 ? 'item' : 'items'}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Payment Plans List */
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Payment Plans</CardTitle>
              <Button onClick={createNewPlan}>
                <Plus className="h-4 w-4 mr-2" />
                New Payment Plan
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {paymentPlans.length === 0 ? (
              <div className="text-center text-gray-500 py-12">
                <DollarSign className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium mb-2">No payment plans yet</p>
                <p className="text-sm mb-4">Create your first payment plan to get started</p>
                <Button onClick={createNewPlan} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Payment Plan
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {paymentPlans.map((plan) => {
                  const planTotal = plan.lineItems.reduce((sum, line) => sum + parseFloat(line.amount.toString() || '0'), 0);
                  return (
                    <div
                      key={plan.id}
                      className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="font-semibold text-lg">{plan.name}</div>
                          <div className="text-sm text-gray-600 font-mono">{plan.planNumber}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-xl">${planTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                          <div className="text-xs text-gray-500">{plan.lineItems.length} payments</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => setCurrentPlan(plan)}
                          variant="outline"
                          size="sm"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          onClick={() => setPaymentPlans(paymentPlans.filter(p => p.id !== plan.id))}
                          variant="ghost"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
