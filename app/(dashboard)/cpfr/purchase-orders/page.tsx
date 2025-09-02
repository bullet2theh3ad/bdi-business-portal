'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import useSWR from 'swr';
import { User, ProductSku, InvoiceDocument } from '@/lib/db/schema';

interface UserWithOrganization extends User {
  organization?: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
}

interface PurchaseOrder {
  id: string;
  purchaseOrderNumber: string;
  supplierName: string;
  purchaseOrderDate: string;
  requestedDeliveryDate: string;
  status: 'draft' | 'sent' | 'confirmed' | 'shipped' | 'delivered';
  terms: string; // NET30, NET60, etc.
  incoterms: string; // FOB, CIF, DDP, etc.
  incotermsLocation: string; // Shanghai Port, Los Angeles, etc.
  totalValue: number;
  documents?: string[]; // Array of document URLs/paths
  notes?: string;
  createdBy: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function PurchaseOrdersPage() {
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  const { data: purchaseOrders, mutate: mutatePurchaseOrders } = useSWR<PurchaseOrder[]>('/api/cpfr/purchase-orders', fetcher);
  const { data: skus } = useSWR<ProductSku[]>('/api/admin/skus', fetcher);
  const { data: organizations } = useSWR('/api/admin/organizations?includeInternal=true', fetcher);

  // State for modals and forms
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Line items state (matching Invoice structure exactly)
  const [lineItems, setLineItems] = useState<Array<{
    id: string;
    skuId: string;
    sku: string;
    skuName: string;
    quantity: number;
    unitCost: number;
    lineTotal: number;
  }>>([]);

  const [purchaseOrderLineItems, setPurchaseOrderLineItems] = useState<Record<string, Array<{
    skuCode: string;
    skuName: string;
    quantity: number;
  }>>>({});

  // File upload state
  const [uploadedDocs, setUploadedDocs] = useState<File[]>([]);
  const [customTerms, setCustomTerms] = useState('');

  // Fetch line items for all purchase orders when purchase orders are loaded
  useEffect(() => {
    if (purchaseOrders && purchaseOrders.length > 0) {
      const fetchAllLineItems = async () => {
        const lineItemsData: Record<string, Array<{
          skuCode: string;
          skuName: string;
          quantity: number;
        }>> = {};

        for (const po of purchaseOrders) {
          try {
            const response = await fetch(`/api/cpfr/purchase-orders/${po.id}/line-items`);
            if (response.ok) {
              const lineItems = await response.json();
              lineItemsData[po.id] = lineItems.map((item: any) => ({
                skuCode: item.skuCode,
                skuName: item.skuName,
                quantity: item.quantity
              }));
            }
          } catch (error) {
            console.error(`Error fetching line items for purchase order ${po.id}:`, error);
            lineItemsData[po.id] = [];
          }
        }

        setPurchaseOrderLineItems(lineItemsData);
      };

      fetchAllLineItems();
    }
  }, [purchaseOrders]);

  // Helper function to aggregate SKU quantities for display
  const getSkuSummary = (purchaseOrderId: string) => {
    const lineItems = purchaseOrderLineItems[purchaseOrderId] || [];
    if (lineItems.length === 0) return 'No items';

    // Aggregate quantities by SKU
    const skuTotals: Record<string, { name: string; quantity: number }> = {};
    
    lineItems.forEach(item => {
      if (skuTotals[item.skuCode]) {
        skuTotals[item.skuCode].quantity += item.quantity;
      } else {
        skuTotals[item.skuCode] = {
          name: item.skuName,
          quantity: item.quantity
        };
      }
    });

    // Create summary string
    return Object.entries(skuTotals)
      .map(([sku, data]) => `${sku}: ${data.quantity.toLocaleString()}`)
      .join(' • ');
  };

  // Helper functions for line items (matching Invoice exactly)
  const addLineItem = () => {
    const newItem = {
      id: Date.now().toString(),
      skuId: '',
      sku: '',
      skuName: '',
      quantity: 1,
      unitCost: 0,
      lineTotal: 0
    };
    setLineItems([...lineItems, newItem]);
  };

  const updateLineItem = (id: string, field: string, value: any) => {
    setLineItems(lineItems.map(item => {
      if (item.id === id) {
        const updatedItem = { ...item, [field]: value };
        
        // If SKU is selected, populate SKU code and name
        if (field === 'skuId' && value) {
          const selectedSku = skus?.find(sku => sku.id === value);
          if (selectedSku) {
            updatedItem.sku = selectedSku.sku;
            updatedItem.skuName = selectedSku.name;
          }
        }
        
        // Calculate line total
        updatedItem.lineTotal = updatedItem.quantity * updatedItem.unitCost;
        return updatedItem;
      }
      return item;
    }));
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setUploadedDocs([...uploadedDocs, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedDocs(uploadedDocs.filter((_, i) => i !== index));
  };

  const handleCreatePurchaseOrder = async (formData: FormData) => {
    setIsLoading(true);
    try {
      // Create FormData for file uploads
      const createFormData = new FormData();
      
      // Add purchase order data
      createFormData.append('purchaseOrderNumber', formData.get('purchaseOrderNumber') as string);
      createFormData.append('supplierName', formData.get('supplierName') as string);
      createFormData.append('purchaseOrderDate', formData.get('purchaseOrderDate') as string);
      createFormData.append('requestedDeliveryDate', formData.get('requestedDeliveryDate') as string);
      createFormData.append('status', formData.get('status') as string);
      createFormData.append('terms', formData.get('terms') as string);
      createFormData.append('incoterms', formData.get('incoterms') as string);
      createFormData.append('incotermsLocation', formData.get('incotermsLocation') as string);
      createFormData.append('totalValue', calculateTotal().toString());
      createFormData.append('notes', formData.get('notes') as string);
      createFormData.append('lineItems', JSON.stringify(lineItems));

      // Add uploaded files
      uploadedDocs.forEach((file, index) => {
        createFormData.append(`file-${index}`, file);
      });

      const response = await fetch('/api/cpfr/purchase-orders', {
        method: 'POST',
        body: createFormData,
      });

      if (response.ok) {
        mutatePurchaseOrders();
        setShowCreateModal(false);
        setLineItems([]);
        setUploadedDocs([]);
        setCustomTerms('');
      } else {
        const errorData = await response.json();
        alert(`Failed to create purchase order: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating purchase order:', error);
      alert('Failed to create purchase order');
    }
    setIsLoading(false);
  };

  const handleEditPurchaseOrder = (purchaseOrder: PurchaseOrder) => {
    setSelectedPurchaseOrder(purchaseOrder);
    setShowEditModal(true);
    // Load existing line items for editing
    // This would be implemented similarly to the invoice edit functionality
  };

  const handleDeletePurchaseOrder = async (purchaseOrderId: string) => {
    if (confirm('Are you sure you want to delete this purchase order? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/cpfr/purchase-orders/${purchaseOrderId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          mutatePurchaseOrders();
        } else {
          const errorData = await response.json();
          alert(`Failed to delete purchase order: ${errorData.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error deleting purchase order:', error);
        alert('Failed to delete purchase order');
      }
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'draft': 'bg-gray-100 text-gray-800',
      'sent': 'bg-blue-100 text-blue-800',
      'confirmed': 'bg-green-100 text-green-800',
      'shipped': 'bg-purple-100 text-purple-800',
      'delivered': 'bg-emerald-100 text-emerald-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  };

  return (
    <div className="flex-1 p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <SemanticBDIIcon semantic="orders" size={32} />
            <div>
              <h1 className="text-3xl font-bold">Purchase Orders</h1>
              <p className="text-muted-foreground">Manage procurement and supplier purchase orders</p>
            </div>
          </div>
          <Button className="bg-green-600 hover:bg-green-700" onClick={() => {
            // Clear all form state for a fresh purchase order
            setLineItems([]);
            setUploadedDocs([]);
            setCustomTerms('');
            setShowCreateModal(true);
          }}>
            <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
            Enter Purchase Order
          </Button>
        </div>
      </div>

      {/* Purchase Orders List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SemanticBDIIcon semantic="orders" size={20} />
            <span>Purchase Orders ({purchaseOrders?.length || 0})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!purchaseOrders || purchaseOrders.length === 0 ? (
            <div className="text-center py-12">
              <SemanticBDIIcon semantic="orders" size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Purchase Orders</h3>
              <p className="text-muted-foreground mb-4">Enter your first Purchase Order to start managing supplier procurement</p>
              <Button onClick={() => {
                // Clear all form state for a fresh purchase order
                setLineItems([]);
                setUploadedDocs([]);
                setCustomTerms('');
                setShowCreateModal(true);
              }}>
                <SemanticBDIIcon semantic="plus" size={16} className="mr-2" />
                Enter First Purchase Order
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {purchaseOrders.map((po) => (
                <div key={po.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-lg">Purchase Order #{po.purchaseOrderNumber}</h3>
                        <Badge className={getStatusColor(po.status)}>
                          {po.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-500">Supplier:</span>
                          <p className="font-medium">{po.supplierName}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">PO Date:</span>
                          <p className="font-medium">{new Date(po.purchaseOrderDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Delivery Date:</span>
                          <p className="font-medium">{new Date(po.requestedDeliveryDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Terms:</span>
                          <p className="font-medium">{po.terms}</p>
                        </div>
                      </div>
                      
                      {/* SKU Summary */}
                      <div className="bg-blue-50 p-3 rounded-md border border-blue-200 mb-3">
                        <div className="flex items-center space-x-2 mb-1">
                          <SemanticBDIIcon semantic="inventory" size={14} className="text-blue-600" />
                          <span className="text-blue-800 font-medium text-sm">Line Items Summary:</span>
                        </div>
                        <p className="text-sm text-blue-700 font-mono">
                          {getSkuSummary(po.id)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <div>
                          <span className="text-gray-500">Total Value:</span>
                          <span className="font-bold text-green-600">${Number(po.totalValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      {po.notes && (
                        <p className="text-sm text-gray-600 mt-2">{po.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditPurchaseOrder(po)}>
                        <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeletePurchaseOrder(po.id)}
                        className="text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <SemanticBDIIcon semantic="delete" size={14} className="mr-1" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Purchase Order Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
          <DialogHeader>
            <DialogTitle>Create New Purchase Order</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleCreatePurchaseOrder(formData);
          }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="purchaseOrderNumber">Purchase Order Number *</Label>
                  <Input id="purchaseOrderNumber" name="purchaseOrderNumber" required />
                </div>
                
                <div>
                  <Label htmlFor="supplierName">Supplier Name *</Label>
                  {organizations ? (
                    <select
                      id="supplierName"
                      name="supplierName"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Supplier Organization</option>
                      {organizations.map((org: any) => (
                        <option key={org.id} value={org.code}>
                          {org.name} ({org.code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input id="supplierName" name="supplierName" required />
                  )}
                </div>

                <div>
                  <Label htmlFor="customSupplierName">Custom Supplier Name (Optional)</Label>
                  <Input 
                    id="customSupplierName" 
                    name="customSupplierName" 
                    placeholder="Additional supplier details"
                  />
                </div>
                
                <div>
                  <Label htmlFor="purchaseOrderDate">Purchase Order Date *</Label>
                  <Input 
                    id="purchaseOrderDate" 
                    name="purchaseOrderDate" 
                    type="date" 
                    required 
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="requestedDeliveryDate">Expected Delivery Date *</Label>
                  <Input 
                    id="requestedDeliveryDate" 
                    name="requestedDeliveryDate" 
                    type="date"
                    required 
                    className="w-full"
                  />
                </div>
                
                <div>
                  <Label htmlFor="status">Status *</Label>
                  <select
                    id="status"
                    name="status"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>
                
                <div>
                  <Label htmlFor="terms">Payment Terms *</Label>
                  {!customTerms ? (
                    <div>
                      <select
                        id="terms"
                        name="terms"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                        onChange={(e) => {
                          if (e.target.value === 'CUSTOM') {
                            setCustomTerms('custom');
                          }
                        }}
                      >
                        <option value="">Select Terms</option>
                        <option value="NET15">NET 15 - Payment due in 15 days</option>
                        <option value="NET30">NET 30 - Payment due in 30 days</option>
                        <option value="NET60">NET 60 - Payment due in 60 days</option>
                        <option value="NET90">NET 90 - Payment due in 90 days</option>
                        <option value="COD">COD - Cash on Delivery</option>
                        <option value="PREPAID">Prepaid - Payment in advance</option>
                        <option value="CUSTOM">📝 Enter Custom Terms</option>
                      </select>
                      <div className="mt-1 text-xs text-gray-600">
                        Standard payment terms or select custom
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex space-x-2">
                        <Input
                          id="terms"
                          name="terms"
                          placeholder="e.g., NET45, 2/10 Net 30, Letter of Credit"
                          required
                          className="flex-1 mt-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setCustomTerms('')}
                          className="mt-1"
                        >
                          Cancel
                        </Button>
                      </div>
                      <div className="mt-1 text-xs text-gray-600">
                        Enter your custom payment terms
                      </div>
                    </div>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="incoterms">IncoTerms 2020 *</Label>
                  <select
                    id="incoterms"
                    name="incoterms"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  >
                    <option value="">Select IncoTerms</option>
                    <optgroup label="🌍 Any Mode of Transport">
                      <option value="EXW">EXW - Ex Works (buyer arranges all transport)</option>
                      <option value="FCA">FCA - Free Carrier (seller to carrier)</option>
                      <option value="CPT">CPT - Carriage Paid To (seller pays freight)</option>
                      <option value="CIP">CIP - Carriage & Insurance Paid To (seller pays freight + insurance)</option>
                      <option value="DAP">DAP - Delivered at Place (seller delivers, buyer handles duties)</option>
                      <option value="DPU">DPU - Delivered at Place Unloaded (seller delivers & unloads)</option>
                      <option value="DDP">DDP - Delivered Duty Paid (seller handles everything)</option>
                    </optgroup>
                    <optgroup label="🚢 Sea & Inland Waterway Only">
                      <option value="FAS">FAS - Free Alongside Ship (seller to ship's side)</option>
                      <option value="FOB">FOB - Free on Board (seller loads ship)</option>
                      <option value="CFR">CFR - Cost and Freight (seller pays freight)</option>
                      <option value="CIF">CIF - Cost, Insurance & Freight (seller pays freight + insurance)</option>
                    </optgroup>
                  </select>
                  <div className="mt-1 text-xs text-gray-600">
                    International Commercial Terms - defines responsibilities
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <Label htmlFor="incotermsLocation">Incoterms Location</Label>
              <Input 
                id="incotermsLocation" 
                name="incotermsLocation" 
                placeholder="Shanghai Port, Los Angeles, etc." 
              />
            </div>

            {/* Line Items Section */}
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold text-blue-800 flex items-center">
                  <SemanticBDIIcon semantic="inventory" size={16} className="mr-2" />
                  Line Items
                </h4>
                <Button
                  type="button"
                  onClick={addLineItem}
                  variant="outline"
                  size="sm"
                  className="bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200"
                >
                  <SemanticBDIIcon semantic="plus" size={14} className="mr-1" />
                  Add Item
                </Button>
              </div>
              
              {lineItems.length === 0 ? (
                <div className="text-center py-8">
                  <SemanticBDIIcon semantic="inventory" size={32} className="mx-auto mb-2 text-blue-400" />
                  <p className="text-blue-600 text-sm">No line items added yet. Click "Add Item" to start.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lineItems.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded border border-blue-200">
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                        <div>
                          <Label className="text-xs">SKU *</Label>
                          <select
                            value={item.skuId}
                            onChange={(e) => updateLineItem(item.id, 'skuId', e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            required
                          >
                            <option value="">Select SKU</option>
                            {skus?.map((sku) => (
                              <option key={sku.id} value={sku.id}>
                                {sku.sku} - {sku.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs">Quantity *</Label>
                          <Input
                            type="number"
                            value={item.quantity === 0 ? '' : item.quantity}
                            onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                            min="1"
                            placeholder="0"
                            className="text-sm"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Unit Cost *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unitCost === 0 ? '' : item.unitCost}
                            onChange={(e) => updateLineItem(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                            min="0"
                            className="text-sm"
                            placeholder="0.00"
                            required
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Line Total</Label>
                          <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm font-mono">
                            ${item.lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <div>
                          <Button
                            type="button"
                            onClick={() => removeLineItem(item.id)}
                            variant="outline"
                            size="sm"
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <SemanticBDIIcon semantic="delete" size={12} className="mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Total Value Display */}
                  <div className="bg-blue-100 p-4 rounded border border-blue-300">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-blue-800">Total Purchase Order Value:</span>
                      <span className="font-bold text-2xl text-blue-900">${calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* File Upload Section */}
            <div className="mb-6">
              <Label className="text-lg font-semibold mb-4 block">Documents</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <input
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="text-center">
                    <SemanticBDIIcon semantic="upload" size={32} className="mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-600">Click to upload documents</p>
                    <p className="text-sm text-gray-500">PDF, DOC, XLS, Images supported</p>
                  </div>
                </label>
                
                {uploadedDocs.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {uploadedDocs.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span className="text-sm">{file.name}</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-red-600"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>



            <div className="mb-6">
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes or special instructions"
              />
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Creating...' : 'Create Purchase Order'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Purchase Order Modal would go here - similar to create but with pre-filled data */}
    </div>
  );
}
