'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Calendar, Package, TrendingUp, Plus, Search, SortAsc, Factory, Truck, FileText, Edit, Trash2, X, Grid3x3, List, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type SortOption = 'date' | 'sku' | 'manufacturer';

interface ProductionSchedule {
  id: string;
  skuId: string;
  shipmentId?: string;
  purchaseOrderId?: string;
  quantity: number;
  materialArrivalDate?: string;
  smtDate?: string;
  dipDate?: string;
  atpBeginDate?: string;
  atpEndDate?: string;
  obaDate?: string;
  exwDate?: string;
  notes?: string;
  status: string;
  createdAt: string;
  sku?: {
    id: string;
    sku: string;
    name: string;
    mfg?: string;
  };
}

export default function ProductionSchedulesPage() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ProductionSchedule | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Form state
  const [formData, setFormData] = useState({
    skuId: '',
    purchaseOrderId: '',
    quantity: 0,
    materialArrivalDate: '',
    smtDate: '',
    dipDate: '',
    atpBeginDate: '',
    atpEndDate: '',
    obaDate: '',
    exwDate: '',
    notes: '',
    status: 'draft',
  });

  // Multi-shipment state
  const [selectedShipments, setSelectedShipments] = useState<string[]>([]);
  const [filteredShipments, setFilteredShipments] = useState<any[]>([]);

  // Fetch data
  const { data: schedules, mutate } = useSWR<ProductionSchedule[]>('/api/production-schedules', fetcher);
  const { data: skus } = useSWR('/api/admin/skus', fetcher);
  const { data: shipments } = useSWR('/api/production-schedules/shipments', fetcher);
  const { data: purchaseOrders } = useSWR('/api/cpfr/purchase-orders', fetcher);

  // Fetch filtered shipments when SKU is selected
  const { data: skuShipments } = useSWR(
    formData.skuId ? `/api/production-schedules/shipments?skuId=${formData.skuId}` : null,
    fetcher
  );

  // Update filtered shipments when SKU changes
  React.useEffect(() => {
    if (skuShipments) {
      setFilteredShipments(skuShipments);
    } else {
      setFilteredShipments([]);
    }
    // Only clear selected shipments when SKU changes if NOT editing
    // (editing mode pre-loads selected shipments in handleEdit)
    if (!editingSchedule) {
      setSelectedShipments([]);
    }
  }, [skuShipments, editingSchedule]);

  // Handle shipment selection
  const toggleShipmentSelection = (shipmentId: string) => {
    setSelectedShipments(prev => 
      prev.includes(shipmentId) 
        ? prev.filter(id => id !== shipmentId)
        : [...prev, shipmentId]
    );
  };

  // Remove shipment from selection
  const removeShipment = (shipmentId: string) => {
    setSelectedShipments(prev => prev.filter(id => id !== shipmentId));
  };

  // Calculate total selected shipment quantity
  const totalSelectedQuantity = selectedShipments.reduce((total, shipmentId) => {
    const shipment = filteredShipments.find(s => s.id === shipmentId);
    return total + (shipment?.forecast?.quantity || 0);
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingSchedule
        ? `/api/production-schedules/${editingSchedule.id}`
        : '/api/production-schedules';
      
      const method = editingSchedule ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          shipmentIds: selectedShipments,
        }),
      });

      if (!response.ok) throw new Error('Failed to save production schedule');

      await mutate();
      setShowCreateDialog(false);
      setEditingSchedule(null);
      resetForm();
    } catch (error) {
      console.error('Error saving production schedule:', error);
      alert('Failed to save production schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this production schedule?')) return;

    try {
      const response = await fetch(`/api/production-schedules/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete production schedule');

      await mutate();
    } catch (error) {
      console.error('Error deleting production schedule:', error);
      alert('Failed to delete production schedule');
    }
  };

  const handleEdit = (schedule: any) => {
    setEditingSchedule(schedule);
    setFormData({
      skuId: schedule.skuId,
      purchaseOrderId: schedule.purchaseOrderId || '',
      quantity: schedule.quantity,
      materialArrivalDate: schedule.materialArrivalDate || '',
      smtDate: schedule.smtDate || '',
      dipDate: schedule.dipDate || '',
      atpBeginDate: schedule.atpBeginDate || '',
      atpEndDate: schedule.atpEndDate || '',
      obaDate: schedule.obaDate || '',
      exwDate: schedule.exwDate || '',
      notes: schedule.notes || '',
      status: schedule.status,
    });
    
    // Load existing shipments for this production schedule
    if (schedule.shipments && schedule.shipments.length > 0) {
      const existingShipmentIds = schedule.shipments.map((s: any) => s.shipmentId);
      setSelectedShipments(existingShipmentIds);
    } else {
      setSelectedShipments([]);
    }
    
    setShowCreateDialog(true);
  };

  const resetForm = () => {
    setFormData({
      skuId: '',
      purchaseOrderId: '',
      quantity: 0,
      materialArrivalDate: '',
      smtDate: '',
      dipDate: '',
      atpBeginDate: '',
      atpEndDate: '',
      obaDate: '',
      exwDate: '',
      notes: '',
      status: 'draft',
    });
    setSelectedShipments([]);
    setFilteredShipments([]);
  };

  // Export to CSV
  const exportToCSV = () => {
    if (!filteredAndSortedSchedules || filteredAndSortedSchedules.length === 0) {
      alert('No data to export');
      return;
    }

    // Create CSV headers
    const headers = [
      'Reference Number',
      'SKU',
      'Product Name',
      'Manufacturer',
      'Quantity',
      'Shipment Quantity',
      'Status',
      'Material Arrival',
      'SMT Date',
      'DIP Date',
      'ATP Begin',
      'ATP End',
      'OBA Date',
      'EXW Date',
      'Notes'
    ];

    // Create CSV rows
    const rows = filteredAndSortedSchedules.map((schedule: any) => [
      schedule.referenceNumber || '',
      schedule.sku?.sku || '',
      schedule.sku?.name || '',
      schedule.sku?.mfg || '',
      schedule.quantity || 0,
      schedule.shipmentQuantity || 0,
      schedule.status || '',
      schedule.materialArrivalDate || '',
      schedule.smtDate || '',
      schedule.dipDate || '',
      schedule.atpBeginDate || '',
      schedule.atpEndDate || '',
      schedule.obaDate || '',
      schedule.exwDate || '',
      (schedule.notes || '').replace(/,/g, ';').replace(/\n/g, ' ')
    ]);

    // Combine headers and rows
    const csvContent = [
      headers.join(','),
      ...rows.map((row: any[]) => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `production-schedules-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter and sort schedules
  const filteredAndSortedSchedules = (Array.isArray(schedules) ? schedules : [])
    .filter((schedule) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        (schedule as any).referenceNumber?.toLowerCase().includes(searchLower) ||
        schedule.sku?.sku?.toLowerCase().includes(searchLower) ||
        schedule.sku?.name?.toLowerCase().includes(searchLower) ||
        schedule.sku?.mfg?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'sku':
          return (a.sku?.sku || '').localeCompare(b.sku?.sku || '');
        case 'manufacturer':
          return (a.sku?.mfg || '').localeCompare(b.sku?.mfg || '');
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'confirmed':
        return 'bg-purple-100 text-purple-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg">
            <Factory className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Production Schedules</h1>
            <p className="text-sm sm:text-base text-gray-600">Manage manufacturing timelines and milestones</p>
          </div>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={(open) => {
          setShowCreateDialog(open);
          if (!open) {
            setEditingSchedule(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">New Schedule</span>
              <span className="sm:hidden">New</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="w-screen h-screen max-w-none max-h-none m-0 p-0 rounded-none flex flex-col">
            <DialogHeader className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 border-b bg-gradient-to-r from-purple-50 to-pink-50 flex-shrink-0">
              <DialogTitle className="text-xl sm:text-2xl lg:text-3xl font-bold">
                {editingSchedule ? 'Edit Production Schedule' : 'Create Production Schedule'}
              </DialogTitle>
              <DialogDescription className="text-sm sm:text-base">
                Enter the production timeline and milestones for this SKU
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="space-y-6 sm:space-y-8 p-4 sm:p-8 pb-32">
              {/* SKU Selection & Basic Info */}
              <div className="bg-gray-50 p-4 sm:p-6 rounded-lg">
                <h3 className="font-semibold text-base sm:text-lg mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="skuId" className="text-base font-semibold">SKU *</Label>
                    <Select
                      value={formData.skuId}
                      onValueChange={(value) => setFormData({ ...formData, skuId: value })}
                      required
                    >
                      <SelectTrigger className="text-base h-12">
                        <SelectValue placeholder="Select SKU" />
                      </SelectTrigger>
                      <SelectContent>
                        {skus?.map((sku: any) => (
                          <SelectItem key={sku.id} value={sku.id}>
                            {sku.sku} - {sku.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity" className="text-base font-semibold">Quantity *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      value={formData.quantity || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        const numValue = value === '' ? 0 : parseInt(value) || 0;
                        setFormData({ ...formData, quantity: numValue });
                      }}
                      required
                      min="0"
                      className="text-base h-12"
                    />
                  </div>
                </div>
              </div>

              {/* Shipment Selection - Only show if SKU is selected */}
              {formData.skuId && (
                <div className="bg-blue-50 p-4 sm:p-6 rounded-lg">
                  <h3 className="font-semibold text-base sm:text-lg mb-4">Available Shipments for Selected SKU</h3>
                  
                  {filteredShipments.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {filteredShipments.map((shipment: any) => (
                        <Card 
                          key={shipment.id}
                          className={`cursor-pointer transition-all hover:shadow-md ${
                            selectedShipments.includes(shipment.id) 
                              ? 'border-purple-500 bg-purple-50' 
                              : 'border-gray-200 hover:border-purple-300'
                          }`}
                          onClick={() => toggleShipmentSelection(shipment.id)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="font-medium text-sm mb-2">
                                  {shipment.sku?.name || 'Unknown Product'}
                                </div>
                                <div className="flex gap-2 flex-wrap">
                                  <Badge variant="secondary" className="text-xs">
                                    {shipment.forecast?.quantity || 0} units
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {shipment.forecast?.delivery_week || 'No date'}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {shipment.shippingMethod || 'Standard'}
                                  </Badge>
                                </div>
                              </div>
                              <div className="ml-2">
                                <input
                                  type="checkbox"
                                  checked={selectedShipments.includes(shipment.id)}
                                  onChange={() => {}} // Handled by card onClick
                                  className="h-4 w-4 text-purple-600"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                      <p>No shipments found for this SKU</p>
                    </div>
                  )}

                  {/* Selected Shipments Summary */}
                  {selectedShipments.length > 0 && (
                    <div className="bg-white p-4 rounded-lg border">
                      <h4 className="font-semibold mb-3">Selected Shipments ({selectedShipments.length})</h4>
                      <div className="space-y-2">
                        {selectedShipments.map((shipmentId: string) => {
                          const shipment = filteredShipments.find(s => s.id === shipmentId);
                          return (
                            <div key={shipmentId} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                              <span className="text-sm">
                                {shipment?.displayName || shipment?.sku?.name || 'Unknown Shipment'}
                              </span>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeShipment(shipmentId);
                                }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex justify-between text-sm">
                          <span>Total Selected Quantity:</span>
                          <span className="font-semibold">{totalSelectedQuantity.toLocaleString()} units</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Production Quantity:</span>
                          <span className="font-semibold">{formData.quantity.toLocaleString()} units</span>
                        </div>
                        {totalSelectedQuantity !== formData.quantity && (
                          <div className="text-xs text-amber-600 mt-1">
                            ⚠️ Selected shipment quantity ({totalSelectedQuantity}) differs from production quantity ({formData.quantity})
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Purchase Order Connection */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-4">Purchase Order Connection</h3>
                <div className="space-y-2">
                  <Label htmlFor="purchaseOrderId" className="text-base font-semibold">Purchase Order (Optional)</Label>
                  <Select
                    value={formData.purchaseOrderId || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, purchaseOrderId: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger className="text-base h-12">
                      <SelectValue placeholder="Select Purchase Order" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {purchaseOrders?.map((po: any) => (
                        <SelectItem key={po.id} value={po.id}>
                          {po.purchaseOrderNumber} - {po.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Manufacturing Milestone Dates - Timeline Flow */}
              <div className="border-t pt-4 sm:pt-6">
                <h3 className="font-semibold text-lg sm:text-xl mb-4 sm:mb-6 flex items-center gap-2">
                  <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                  Manufacturing Timeline
                </h3>
                
                {/* Timeline Flow - Left to Right */}
                <div className="space-y-6">
                  {/* Row 1: Material → SMT → DIP */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="materialArrivalDate" className="text-base font-semibold">
                        1. Material Arrival
                      </Label>
                      <Input
                        id="materialArrivalDate"
                        type="date"
                        value={formData.materialArrivalDate}
                        onChange={(e) => setFormData({ ...formData, materialArrivalDate: e.target.value })}
                        className="text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtDate" className="text-base font-semibold">
                        2. SMT
                      </Label>
                      <Input
                        id="smtDate"
                        type="date"
                        value={formData.smtDate}
                        onChange={(e) => setFormData({ ...formData, smtDate: e.target.value })}
                        className="text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dipDate" className="text-base font-semibold">
                        3. DIP
                      </Label>
                      <Input
                        id="dipDate"
                        type="date"
                        value={formData.dipDate}
                        onChange={(e) => setFormData({ ...formData, dipDate: e.target.value })}
                        className="text-base"
                      />
                    </div>
                  </div>

                  {/* Row 2: ATP Begin → ATP End → OBA */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="atpBeginDate" className="text-base font-semibold">
                        4. ATP Begin
                        <span className="block text-xs font-normal text-gray-500">Assembly, Test, Packaging</span>
                      </Label>
                      <Input
                        id="atpBeginDate"
                        type="date"
                        value={formData.atpBeginDate}
                        onChange={(e) => setFormData({ ...formData, atpBeginDate: e.target.value })}
                        className="text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="atpEndDate" className="text-base font-semibold">
                        5. ATP End
                        <span className="block text-xs font-normal text-gray-500">Assembly, Test, Packaging</span>
                      </Label>
                      <Input
                        id="atpEndDate"
                        type="date"
                        value={formData.atpEndDate}
                        onChange={(e) => setFormData({ ...formData, atpEndDate: e.target.value })}
                        className="text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="obaDate" className="text-base font-semibold">
                        6. OBA
                        <span className="block text-xs font-normal text-gray-500">Outbound Quality</span>
                      </Label>
                      <Input
                        id="obaDate"
                        type="date"
                        value={formData.obaDate}
                        onChange={(e) => setFormData({ ...formData, obaDate: e.target.value })}
                        className="text-base"
                      />
                    </div>
                  </div>

                  {/* Row 3: EXW → Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="exwDate" className="text-base font-semibold">
                        7. EXW
                        <span className="block text-xs font-normal text-gray-500">Ex Works</span>
                      </Label>
                      <Input
                        id="exwDate"
                        type="date"
                        value={formData.exwDate}
                        onChange={(e) => setFormData({ ...formData, exwDate: e.target.value })}
                        className="text-base"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status" className="text-base font-semibold">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger className="text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2 bg-gray-50 p-4 sm:p-6 rounded-lg">
                <Label htmlFor="notes" className="text-base font-semibold">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={4}
                  placeholder="Add any additional notes or comments..."
                  className="text-sm sm:text-base"
                />
              </div>

              </div>
              {/* Actions - Fixed Footer */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 border-t bg-white px-4 sm:px-8 py-4 sm:py-6 sticky bottom-0 shadow-lg">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false);
                    setEditingSchedule(null);
                    resetForm();
                  }}
                  className="h-10 sm:h-12 px-6 sm:px-8 text-sm sm:text-base w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 h-10 sm:h-12 px-6 sm:px-8 text-sm sm:text-base w-full sm:w-auto"
                >
                  {isSubmitting ? 'Saving...' : editingSchedule ? 'Update Schedule' : 'Create Schedule'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters and Sort */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by reference number, SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
          <SelectTrigger className="w-full sm:w-48">
            <SortAsc className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="date">Sort by Date</SelectItem>
            <SelectItem value="sku">Sort by SKU</SelectItem>
            <SelectItem value="manufacturer">Sort by Manufacturer</SelectItem>
          </SelectContent>
        </Select>
        
        {/* View Toggle */}
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="gap-2"
          >
            <Grid3x3 className="h-4 w-4" />
            <span className="hidden sm:inline">Grid</span>
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="gap-2"
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">List</span>
          </Button>
        </div>

        {/* Export Button */}
        <Button
          onClick={exportToCSV}
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={filteredAndSortedSchedules.length === 0}
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export CSV</span>
          <span className="sm:hidden">Export</span>
        </Button>
      </div>

      {/* Production Schedule Cards/List */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
        {filteredAndSortedSchedules.map((schedule) => (
          <Card key={schedule.id} className={`hover:shadow-lg transition-shadow ${viewMode === 'list' ? 'flex flex-col sm:flex-row' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5 text-purple-600" />
                    {schedule.sku?.sku || 'Unknown SKU'}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {schedule.sku?.name || 'Unknown Product'}
                  </CardDescription>
                  {/* Badges in a horizontal row */}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {(schedule as any).referenceNumber || 'PS-XXXX-0000'}
                    </span>
                    {schedule.sku?.mfg && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {schedule.sku.mfg}
                      </span>
                    )}
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(schedule.status)}`}>
                      {schedule.status}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(schedule)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(schedule.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Production Quantity */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Production Quantity:</span>
                <span className="font-semibold">{schedule.quantity.toLocaleString()} units</span>
              </div>

              {/* Shipment Quantity */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Shipment Quantity:</span>
                <span className="font-semibold text-blue-600">
                  {(schedule as any).totalShipmentQuantity?.toLocaleString() || '0'} units
                </span>
              </div>

              {/* Shipment Count */}
              {(schedule as any).shipments?.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Associated Shipments:</span>
                  <span className="font-semibold text-purple-600">
                    {(schedule as any).shipments.length} shipment{(schedule as any).shipments.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}

              {/* Associated Shipments Display */}
              {(schedule as any).shipments?.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="h-4 w-4 text-blue-600" />
                    <span className="text-gray-600">Shipments:</span>
                  </div>
                  <div className="ml-6 space-y-1">
                    {(schedule as any).shipments.slice(0, 3).map((shipment: any, index: number) => (
                      <div key={index} className="text-xs flex justify-between">
                        <span className="text-gray-600">
                          {shipment.shipment?.bdiReference || shipment.shipment?.shipperReference || shipment.shipmentId?.slice(0, 8) || 'Unknown'}
                        </span>
                        <span className="font-medium text-blue-600">
                          {shipment.forecast?.quantity || shipment.shipment?.requestedQuantity || 0} units
                        </span>
                      </div>
                    ))}
                    {(schedule as any).shipments.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{(schedule as any).shipments.length - 3} more shipment{(schedule as any).shipments.length - 3 !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {schedule.purchaseOrderId && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-green-600" />
                  <span className="text-gray-600">PO ID:</span>
                  <span className="font-medium text-xs">{schedule.purchaseOrderId.slice(0, 8)}...</span>
                </div>
              )}

              {/* Milestone Dates */}
              <div className="border-t pt-3 space-y-2">
                <p className="text-xs font-semibold text-gray-700 mb-2">Manufacturing Milestones:</p>
                {schedule.materialArrivalDate && (
                  <div className="text-xs flex justify-between">
                    <span className="text-gray-600">Material Arrival:</span>
                    <span className="font-medium">{new Date(schedule.materialArrivalDate + 'T00:00:00').toLocaleDateString()}</span>
                  </div>
                )}
                {schedule.smtDate && (
                  <div className="text-xs flex justify-between">
                    <span className="text-gray-600">SMT:</span>
                    <span className="font-medium">{new Date(schedule.smtDate + 'T00:00:00').toLocaleDateString()}</span>
                  </div>
                )}
                {schedule.dipDate && (
                  <div className="text-xs flex justify-between">
                    <span className="text-gray-600">DIP:</span>
                    <span className="font-medium">{new Date(schedule.dipDate + 'T00:00:00').toLocaleDateString()}</span>
                  </div>
                )}
                {schedule.atpBeginDate && (
                  <div className="text-xs flex justify-between">
                    <span className="text-gray-600">ATP Begin:</span>
                    <span className="font-medium">{new Date(schedule.atpBeginDate + 'T00:00:00').toLocaleDateString()}</span>
                  </div>
                )}
                {schedule.atpEndDate && (
                  <div className="text-xs flex justify-between">
                    <span className="text-gray-600">ATP End:</span>
                    <span className="font-medium">{new Date(schedule.atpEndDate + 'T00:00:00').toLocaleDateString()}</span>
                  </div>
                )}
                {schedule.obaDate && (
                  <div className="text-xs flex justify-between">
                    <span className="text-gray-600">OBA:</span>
                    <span className="font-medium">{new Date(schedule.obaDate + 'T00:00:00').toLocaleDateString()}</span>
                  </div>
                )}
                {schedule.exwDate && (
                  <div className="text-xs flex justify-between">
                    <span className="text-gray-600">EXW:</span>
                    <span className="font-medium">{new Date(schedule.exwDate + 'T00:00:00').toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {schedule.notes && (
                <div className="border-t pt-3">
                  <p className="text-xs text-gray-600 line-clamp-2">{schedule.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredAndSortedSchedules.length === 0 && (
        <Card className="p-12 text-center">
          <Factory className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Production Schedules Found
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm
              ? 'No schedules match your search criteria'
              : 'Get started by creating your first production schedule'}
          </p>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Production Schedule
          </Button>
        </Card>
      )}
    </div>
  );
}

