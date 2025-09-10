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
import { useSimpleTranslations, getUserLocale } from '@/lib/i18n/simple-translator';
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
  
  // 🌍 Translation hooks
  const userLocale = getUserLocale(user);
  const { tc } = useSimpleTranslations(userLocale);
  
  const { data: purchaseOrders, mutate: mutatePurchaseOrders } = useSWR<PurchaseOrder[]>('/api/cpfr/purchase-orders', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds for real-time updates
    revalidateOnFocus: true, // Refresh when user returns to tab
  });
  const { data: skus } = useSWR<ProductSku[]>('/api/admin/skus', fetcher);
  const { data: organizations } = useSWR('/api/admin/organizations?includeInternal=false', fetcher, {
    onError: (error) => {
      // Silently handle 403 errors for non-admin users
      if (error?.status !== 403) {
        console.error('Error fetching organizations:', error);
      }
    }
  });

  // Fetch line items for all purchase orders when purchase orders are loaded
  useEffect(() => {
    if (Array.isArray(purchaseOrders) && purchaseOrders.length > 0) {
      const fetchAllLineItems = async () => {
        const lineItemsData: Record<string, Array<{
          skuCode: string;
          skuName: string;
          quantity: number;
          unitCost: number;
          totalCost: number;
        }>> = {};

        for (const po of purchaseOrders) {
          try {
            const response = await fetch(`/api/cpfr/purchase-orders/${po.id}/line-items`);
            if (response.ok) {
              const lineItems = await response.json();
              lineItemsData[po.id] = lineItems.map((item: any) => ({
                skuCode: item.skuCode,
                skuName: item.skuName,
                quantity: item.quantity,
                unitCost: parseFloat(item.unitCost) || 0,
                totalCost: parseFloat(item.totalCost) || 0
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

    // Format for display with commas
    const skuEntries = Object.entries(skuTotals);
    if (skuEntries.length === 0) return 'No items';

    return skuEntries.map(([sku, data]) => 
      `${sku}: ${data.quantity.toLocaleString()}`
    ).join(' • ');
  };

  // Helper function to get detailed line items for display
  const getDetailedLineItems = (purchaseOrderId: string) => {
    const lineItems = purchaseOrderLineItems[purchaseOrderId] || [];
    if (lineItems.length === 0) return null;

    const grandTotal = lineItems.reduce((sum, item) => sum + item.totalCost, 0);

    return {
      items: lineItems,
      grandTotal: grandTotal
    };
  };
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPurchaseOrder, setSelectedPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customTerms, setCustomTerms] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<File[]>([]);
  const [lineItems, setLineItems] = useState<Array<{
    id: string;
    skuId: string;
    sku: string;
    skuName: string;
    quantity: number;
    unitCost: number;
    lineTotal: number;
  }>>([]);
  const [editUploadedDocs, setEditUploadedDocs] = useState<File[]>([]);
  const [existingDocs, setExistingDocs] = useState<InvoiceDocument[]>([]);
  const [editLineItems, setEditLineItems] = useState<Array<{
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
    unitCost: number;
    totalCost: number;
  }>>>({});

  // Helper functions for line items
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

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + item.lineTotal, 0);
  };

  // Access control - Sales team and admins can manage Purchase Orders
  if (!user || !['super_admin', 'admin', 'sales', 'member'].includes(user.role)) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="orders" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Sales team access required for purchase order management.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleCreatePurchaseOrder = async (formData: FormData) => {
    setIsLoading(true);
    try {
      // Create FormData for file uploads
      const createFormData = new FormData();
      
      // Add purchase order data
      createFormData.append('purchaseOrderNumber', formData.get('poNumber') as string);
      createFormData.append('supplierName', formData.get('supplierName') as string);
      createFormData.append('customSupplierName', formData.get('customSupplierName') as string);
      createFormData.append('purchaseOrderDate', formData.get('orderDate') as string);
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
        // Clear form state after successful creation
        setLineItems([]);
        setUploadedDocs([]);
        setCustomTerms(false);
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setUploadedDocs([...uploadedDocs, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setUploadedDocs(uploadedDocs.filter((_, i) => i !== index));
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

  // Filter purchase orders based on search and status
  // Ensure purchaseOrders is an array before filtering
  const purchaseOrdersArray = Array.isArray(purchaseOrders) ? purchaseOrders : [];
  const filteredPurchaseOrders = purchaseOrdersArray.filter(po => {
    const matchesSearch = po.purchaseOrderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         po.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

  return (
    <div className="flex-1 p-3 sm:p-4 lg:p-8 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <SemanticBDIIcon semantic="orders" size={24} className="sm:w-8 sm:h-8" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{tc('purchaseOrdersTitle', 'Purchase Orders')}</h1>
              <p className="text-sm sm:text-base text-muted-foreground">{tc('purchaseOrdersDescription', 'Manage supplier purchase orders')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => mutatePurchaseOrders()}
              className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
            >
              <SemanticBDIIcon semantic="sync" size={16} className="mr-2" />
              {tc('refreshButton', 'Refresh')}
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 w-full sm:w-auto" onClick={() => {
              // Clear all form state for a fresh purchase order
              setLineItems([]);
              setUploadedDocs([]);
              setCustomTerms(false);
              setShowCreateModal(true);
            }}>
              <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
              {tc('enterPurchaseOrderButton', 'Enter Purchase Order')}
            </Button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by Purchase Order number or supplier name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="status-filter">Status:</Label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
      </div>

      {/* Purchase Orders List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SemanticBDIIcon semantic="orders" size={20} />
            <span>Purchase Orders ({filteredPurchaseOrders.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPurchaseOrders.length === 0 ? (
            <div className="text-center py-12">
              <SemanticBDIIcon semantic="orders" size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Purchase Orders</h3>
              <p className="text-muted-foreground mb-4">Enter your first Purchase Order to start managing supplier orders</p>
              <div className="flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => mutatePurchaseOrders()}
                  className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                >
                  <SemanticBDIIcon semantic="sync" size={16} className="mr-2" />
                  {tc('refreshButton', 'Refresh')}
                </Button>
                <Button onClick={() => {
                  // Clear all form state for a fresh purchase order
                  setLineItems([]);
                  setUploadedDocs([]);
                  setCustomTerms(false);
                  setShowCreateModal(true);
                }}>
                  <SemanticBDIIcon semantic="plus" size={16} className="mr-2" />
                  Enter First Purchase Order
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPurchaseOrders.map((po) => (
                <div key={po.id} className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col space-y-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
                    <div className="flex-1">
                      {/* Header with PO number and status */}
                      <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3 mb-3">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-base sm:text-lg">PO #{po.purchaseOrderNumber}</h3>
                          <Badge className={getStatusColor(po.status)}>
                            {po.status}
                          </Badge>
                        </div>
                      </div>
                      
                      {/* PO Details */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4 text-sm mb-3">
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
                      
                      {/* Total Value */}
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
                    
                    {/* Edit Button - Mobile: Below content, Desktop: Right side */}
                    <div className="flex items-center justify-center sm:justify-end">
                      <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={async () => {
                        setSelectedPurchaseOrder(po);
                        setEditUploadedDocs([]);
                        
                        // Fetch existing documents for this purchase order
                        try {
                          const docsResponse = await fetch(`/api/cpfr/purchase-orders/${po.id}/documents`);
                          if (docsResponse.ok) {
                            const docs = await docsResponse.json();
                            setExistingDocs(docs);
                          } else {
                            console.error('Failed to fetch documents');
                            setExistingDocs([]);
                          }
                        } catch (error) {
                          console.error('Error fetching documents:', error);
                          setExistingDocs([]);
                        }

                        // Fetch existing line items for this purchase order
                        try {
                          const lineItemsResponse = await fetch(`/api/cpfr/purchase-orders/${po.id}/line-items`);
                          if (lineItemsResponse.ok) {
                            const lineItems = await lineItemsResponse.json();
                            const mappedItems = lineItems.map((item: any) => {
                              const quantity = item.quantity || 0;
                              const unitCost = parseFloat(item.unitCost) || 0;
                              const lineTotal = parseFloat(item.totalCost) || (quantity * unitCost);
                              
                              return {
                                id: item.id,
                                skuId: item.skuId,
                                sku: item.skuCode,
                                skuName: item.skuName,
                                quantity: quantity,
                                unitCost: unitCost,
                                lineTotal: lineTotal
                              };
                            });
                            
                            console.log('Mapped line items for UI:', mappedItems);
                            setEditLineItems(mappedItems);
                          } else {
                            const errorText = await lineItemsResponse.text();
                            console.error('Failed to fetch line items:', lineItemsResponse.status, errorText);
                            setEditLineItems([]);
                          }
                        } catch (error) {
                          console.error('Error fetching line items:', error);
                          setEditLineItems([]);
                        }
                      }}>
                        <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                        {tc('editButton', 'Edit')}
                      </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeletePurchaseOrder(po.id)}
                          className="w-full sm:w-auto text-red-600 hover:text-red-700 hover:border-red-300"
                        >
                        <SemanticBDIIcon semantic="delete" size={14} className="mr-1" />
                        {tc('deleteButton', 'Delete')}
                      </Button>
                      </div>
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
        <DialogContent className="w-[95vw] sm:w-[90vw] lg:w-[98vw] h-[95vh] sm:h-[90vh] lg:h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
          <DialogHeader className="px-3 sm:px-6">
            <DialogTitle className="text-lg sm:text-xl">Create Purchase Order</DialogTitle>
          </DialogHeader>
          <form className="space-y-6 sm:space-y-8 lg:space-y-12 p-3 sm:p-6 lg:p-8" onSubmit={(e) => {
            e.preventDefault();
            handleCreatePurchaseOrder(new FormData(e.currentTarget));
          }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-6 xl:gap-10">
              <div>
                <Label htmlFor="poNumber">{tc('formLabels.purchaseOrderNumber', 'Purchase Order Number')} *</Label>
                <Input
                  id="poNumber"
                  name="poNumber"
                  placeholder="e.g., PO-2025-001"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="supplierName">Supplier Organization *</Label>
                <select
                  id="supplierName"
                  name="supplierName"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                >
                  <option value="">Select Supplier Organization</option>
                  {Array.isArray(organizations) && organizations.map((org: any) => (
                    <option key={org.id} value={org.code}>
                      {org.code} - {org.name}
                    </option>
                  ))}
                  {(!Array.isArray(organizations) || organizations.length === 0) && user?.organization && (
                    <option key={user.organization.id} value={user.organization.code}>
                      {user.organization.code} - {user.organization.name}
                    </option>
                  )}
                </select>
                <div className="text-xs text-gray-600 mt-1">
                  Select the Supplier/Vendor organization (Factory) for CPFR signaling
                </div>
              </div>
              <div>
                <Label htmlFor="customSupplierName">Custom Supplier Name</Label>
                <Input
                  id="customSupplierName"
                  name="customSupplierName"
                  placeholder="Optional: Additional supplier details"
                  className="mt-1"
                />
                <div className="text-xs text-gray-600 mt-1">
                  Optional: Additional supplier information beyond organization code
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-6 xl:gap-10">
              <div>
                <Label htmlFor="orderDate">{tc('formLabels.dateCreated', 'Date Created')} *</Label>
                <Input
                  id="orderDate"
                  name="orderDate"
                  type="date"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="requestedDeliveryDate">Requested Delivery Date *</Label>
                <Input
                  id="requestedDeliveryDate"
                  name="requestedDeliveryDate"
                  type="date"
                  required
                  className="mt-1"
                />
                <div className="mt-1 text-xs text-gray-600">
                  📅 Target delivery date
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-6 xl:gap-10">
              <div>
                <Label htmlFor="status">Status *</Label>
                <select
                  id="status"
                  name="status"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                      onChange={(e) => {
                        if (e.target.value === 'CUSTOM') {
                          setCustomTerms(true);
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
                        onClick={() => setCustomTerms(false)}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
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
                  <a href="https://iccwbo.org/business-solutions/incoterms-rules/" target="_blank" className="text-blue-600 hover:underline">
                    IncoTerms 2020 - International trade delivery terms
                  </a>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
              <div>
                <Label htmlFor="incotermsLocation">IncoTerms Location *</Label>
                <Input
                  id="incotermsLocation"
                  name="incotermsLocation"
                  placeholder="e.g., Shanghai Port, Los Angeles, Factory Gate"
                  required
                  className="mt-1"
                />
                <div className="mt-1 text-xs text-gray-600">
                  Named place where IncoTerms apply (e.g., "FOB Shanghai")
                </div>
              </div>
            </div>

            {/* Line Items Section */}
            <div className="bg-blue-50 p-3 sm:p-4 lg:p-6 rounded-lg border border-blue-200">
              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 mb-4">
                <h4 className="font-semibold text-blue-800 flex items-center text-sm sm:text-base">
                  <SemanticBDIIcon semantic="inventory" size={16} className="mr-2" />
                  Line Items
                </h4>
                <Button
                  type="button"
                  onClick={addLineItem}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200"
                >
                  <SemanticBDIIcon semantic="plus" size={14} className="mr-1" />
                  Add Item
                </Button>
              </div>
              
              {lineItems.length === 0 ? (
                <div className="text-center py-8">
                  <SemanticBDIIcon semantic="inventory" size={32} className="mx-auto mb-2 text-blue-400" />
                  <p className="text-blue-600 text-sm">No line items added yet. Click "Add Item" to start building your PO</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {lineItems.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded border border-blue-200">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 lg:gap-4 items-end">
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
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.unitCost === 0 ? '' : item.unitCost}
                                onChange={(e) => {
                                  const newUnitCost = parseFloat(e.target.value) || 0;
                                  updateLineItem(item.id, 'unitCost', newUnitCost);
                                }}
                                min="0"
                                className="text-sm pl-6 font-mono"
                                placeholder="0.00"
                                required
                              />
                            </div>
                          </div>
                        <div>
                          <Label className="text-xs">{tc('tableHeaders.lineTotal', 'Line Total')}</Label>
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
            <div className="bg-green-50 p-3 sm:p-4 lg:p-6 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-3 sm:mb-4 flex items-center text-sm sm:text-base">
                <SemanticBDIIcon semantic="upload" size={16} className="mr-2" />
                Documents & Attachments
              </h4>
              
              <div className="border-2 border-dashed border-green-300 rounded-lg p-4 sm:p-6 bg-white">
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
                    <SemanticBDIIcon semantic="upload" size={32} className="mx-auto mb-2 text-green-400" />
                    <p className="text-green-700 font-medium">Click to upload documents</p>
                    <p className="text-sm text-green-600">PDF, DOC, XLS, Images supported • Multiple files allowed</p>
                  </div>
                </label>
                
                {uploadedDocs.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h5 className="font-medium text-green-800">Files to Upload:</h5>
                    {uploadedDocs.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-green-100 p-3 rounded border border-green-200">
                        <div className="flex items-center space-x-2">
                          <SemanticBDIIcon semantic="upload" size={14} className="text-green-600" />
                          <span className="text-sm font-medium text-green-800">{file.name}</span>
                          <span className="text-xs text-green-600">({(file.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          <SemanticBDIIcon semantic="delete" size={12} className="mr-1" />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-6">
              <Label htmlFor="notes">Notes & Special Instructions</Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                placeholder="Any special instructions, delivery notes, or additional information"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-green-600 hover:bg-green-700">
                {isLoading ? 'Creating...' : 'Create Purchase Order'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Purchase Order Modal */}
      <Dialog open={!!selectedPurchaseOrder} onOpenChange={() => setSelectedPurchaseOrder(null)}>
        <DialogContent className="w-[95vw] sm:w-[90vw] lg:w-[98vw] h-[95vh] sm:h-[90vh] lg:h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
          <DialogHeader className="px-3 sm:px-6">
            <DialogTitle className="text-lg sm:text-xl">Edit Purchase Order #{selectedPurchaseOrder?.purchaseOrderNumber}</DialogTitle>
          </DialogHeader>
          {selectedPurchaseOrder && (
            <form className="space-y-6 sm:space-y-8 lg:space-y-12 p-3 sm:p-6 lg:p-8" onSubmit={async (e) => {
              e.preventDefault();
              
              const formData = new FormData(e.currentTarget);
              
              try {
                // Calculate new total from line items
                const newTotal = editLineItems.reduce((sum, item) => sum + item.lineTotal, 0);

                const response = await fetch(`/api/cpfr/purchase-orders/${selectedPurchaseOrder.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    editSupplierName: formData.get('editSupplierName'),
                    editStatus: formData.get('editStatus'),
                    editTerms: formData.get('editTerms'),
                    editIncoterms: formData.get('editIncoterms') || 'FOB',
                    editIncotermsLocation: formData.get('editIncotermsLocation') || '',
                    editTotalValue: newTotal,
                    editNotes: formData.get('editNotes'),
                  }),
                });

                if (response.ok) {
                  // Update line items
                  const lineItemsResponse = await fetch(`/api/cpfr/purchase-orders/${selectedPurchaseOrder.id}/line-items`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      lineItems: editLineItems
                    }),
                  });

                  if (lineItemsResponse.ok) {
                    console.log('✅ Line items updated successfully');
                  } else {
                    console.error('Failed to update line items');
                  }

                  // Upload new documents if any
                  if (editUploadedDocs.length > 0) {
                    const docFormData = new FormData();
                    editUploadedDocs.forEach((file, index) => {
                      docFormData.append(`file-${index}`, file);
                    });

                    const docResponse = await fetch(`/api/cpfr/purchase-orders/${selectedPurchaseOrder.id}/documents`, {
                      method: 'POST',
                      body: docFormData,
                    });

                    if (docResponse.ok) {
                      console.log('✅ Documents uploaded successfully');
                    } else {
                      console.error('Failed to upload documents');
                    }
                  }

                  mutatePurchaseOrders();
                  setSelectedPurchaseOrder(null);
                  setEditLineItems([]);
                  setEditUploadedDocs([]);
                } else {
                  const errorData = await response.json();
                  alert(`Failed to update purchase order: ${errorData.error || 'Unknown error'}`);
                }
              } catch (error) {
                console.error('Error updating purchase order:', error);
                alert('Failed to update purchase order');
              }
            }}>
              
              {/* Basic Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
                <div>
                  <Label htmlFor="editSupplierName">Supplier Organization</Label>
                  <select
                    id="editSupplierName"
                    name="editSupplierName"
                    defaultValue={selectedPurchaseOrder.supplierName || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select Supplier Organization</option>
                    {Array.isArray(organizations) && organizations.map((org: any) => (
                      <option key={org.id} value={org.code}>
                        {org.code} - {org.name}
                      </option>
                    ))}
                    {(!Array.isArray(organizations) || organizations.length === 0) && user?.organization && (
                      <option key={user.organization.id} value={user.organization.code}>
                        {user.organization.code} - {user.organization.name}
                      </option>
                    )}
                  </select>
                  <div className="text-xs text-gray-600 mt-1">
                    Select the Supplier/Vendor organization (Factory) for CPFR signaling
                  </div>
                </div>
                <div>
                  <Label htmlFor="editStatus">Status</Label>
                  <select
                    id="editStatus"
                    name="editStatus"
                    defaultValue={selectedPurchaseOrder.status || 'draft'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="editTerms">Payment Terms</Label>
                  <Input
                    id="editTerms"
                    name="editTerms"
                    defaultValue={selectedPurchaseOrder.terms || ''}
                    placeholder="NET30"
                  />
                </div>
              </div>

              {/* IncoTerms Information */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div>
                  <Label htmlFor="editIncoterms">IncoTerms</Label>
                  <select
                    id="editIncoterms"
                    name="editIncoterms"
                    defaultValue={selectedPurchaseOrder.incoterms || 'FOB'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="EXW">EXW - Ex Works</option>
                    <option value="FCA">FCA - Free Carrier</option>
                    <option value="CPT">CPT - Carriage Paid To</option>
                    <option value="CIP">CIP - Carriage & Insurance Paid To</option>
                    <option value="DAP">DAP - Delivered at Place</option>
                    <option value="DPU">DPU - Delivered at Place Unloaded</option>
                    <option value="DDP">DDP - Delivered Duty Paid</option>
                    <option value="FAS">FAS - Free Alongside Ship</option>
                    <option value="FOB">FOB - Free on Board</option>
                    <option value="CFR">CFR - Cost and Freight</option>
                    <option value="CIF">CIF - Cost, Insurance & Freight</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="editIncotermsLocation">IncoTerms Location</Label>
                  <Input
                    id="editIncotermsLocation"
                    name="editIncotermsLocation"
                    defaultValue={selectedPurchaseOrder.incotermsLocation || ''}
                    placeholder="e.g., Shanghai Port, Los Angeles"
                  />
                </div>
              </div>

              {/* Line Items Section */}
              <div className="bg-blue-50 p-3 sm:p-4 lg:p-6 rounded-lg border border-blue-200">
                <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 mb-4">
                  <h4 className="font-semibold text-blue-800 flex items-center text-sm sm:text-base">
                    <SemanticBDIIcon semantic="inventory" size={16} className="mr-2" />
                    Line Items
                  </h4>
                  <Button
                    type="button"
                    onClick={() => {
                      const newItem = {
                        id: Date.now().toString(),
                        skuId: '',
                        sku: '',
                        skuName: '',
                        quantity: 1,
                        unitCost: 0,
                        lineTotal: 0
                      };
                      setEditLineItems([...editLineItems, newItem]);
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200"
                  >
                    <SemanticBDIIcon semantic="plus" size={14} className="mr-1" />
                    Add Item
                  </Button>
                </div>
                
                {editLineItems.length === 0 ? (
                  <div className="text-center py-8">
                    <SemanticBDIIcon semantic="inventory" size={32} className="mx-auto mb-2 text-blue-400" />
                    <p className="text-blue-600 text-sm">No line items. Click "Add Item" to start.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {editLineItems.map((item, index) => (
                      <div key={item.id} className="bg-white p-4 rounded border border-blue-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 lg:gap-4 items-end">
                          <div>
                            <Label className="text-xs">SKU *</Label>
                            <select
                              value={item.skuId}
                              onChange={(e) => {
                                const updatedItems = [...editLineItems];
                                const selectedSku = skus?.find(sku => sku.id === e.target.value);
                                if (selectedSku) {
                                  updatedItems[index] = {
                                    ...item,
                                    skuId: selectedSku.id,
                                    sku: selectedSku.sku,
                                    skuName: selectedSku.name,
                                    lineTotal: item.quantity * item.unitCost
                                  };
                                  setEditLineItems(updatedItems);
                                }
                              }}
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
                              onChange={(e) => {
                                const updatedItems = [...editLineItems];
                                const newQuantity = parseInt(e.target.value) || 0;
                                updatedItems[index] = {
                                  ...item,
                                  quantity: newQuantity,
                                  lineTotal: newQuantity * item.unitCost
                                };
                                setEditLineItems(updatedItems);
                              }}
                              min="1"
                              placeholder="0"
                              className="text-sm"
                              required
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Unit Cost *</Label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
                              <Input
                                type="number"
                                step="0.01"
                                value={item.unitCost === 0 ? '' : item.unitCost}
                                onChange={(e) => {
                                  const updatedItems = [...editLineItems];
                                  const newUnitCost = parseFloat(e.target.value) || 0;
                                  updatedItems[index] = {
                                    ...item,
                                    unitCost: newUnitCost,
                                    lineTotal: item.quantity * newUnitCost
                                  };
                                  setEditLineItems(updatedItems);
                                }}
                                min="0"
                                className="text-sm pl-6 font-mono"
                                placeholder="0.00"
                                required
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">{tc('tableHeaders.lineTotal', 'Line Total')}</Label>
                            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded text-sm font-mono">
                              ${item.lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div>
                            <Button
                              type="button"
                              onClick={() => {
                                setEditLineItems(editLineItems.filter((_, i) => i !== index));
                              }}
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
                    
                    {/* Updated Total Value Display */}
                    <div className="bg-blue-100 p-4 rounded border border-blue-300">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-blue-800">Updated Purchase Order Total:</span>
                        <span className="font-bold text-2xl text-blue-900">
                          ${editLineItems.reduce((sum, item) => sum + item.lineTotal, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Document Management Section */}
              <div className="bg-green-50 p-3 sm:p-4 lg:p-6 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-800 mb-3 sm:mb-4 flex items-center text-sm sm:text-base">
                  <SemanticBDIIcon semantic="upload" size={16} className="mr-2" />
                  Documents & Attachments
                </h4>
                
                {/* Existing Documents */}
                {existingDocs.length > 0 && (
                  <div className="mb-3 sm:mb-4">
                    <h5 className="font-medium text-green-800 mb-2 text-sm sm:text-base">Existing Documents:</h5>
                    <div className="space-y-3">
                      {existingDocs.map((doc) => (
                        <div key={doc.id} className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0 bg-white p-3 rounded border border-green-200">
                          <div className="flex flex-col space-y-1 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
                            <div className="flex items-center space-x-2">
                              <SemanticBDIIcon semantic="upload" size={14} className="text-green-600" />
                              <span className="text-sm font-medium text-green-800 break-all">{doc.fileName}</span>
                            </div>
                            <span className="text-xs text-green-600">
                              ({new Date(doc.uploadedAt).toLocaleDateString()})
                            </span>
                          </div>
                          <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  // Get download URL from API
                                  const response = await fetch(`/api/cpfr/purchase-orders/${selectedPurchaseOrder.id}/documents/${doc.id}`);
                                  
                                  if (response.ok) {
                                    const { downloadUrl, fileName } = await response.json();
                                    
                                    // Create temporary download link
                                    const link = document.createElement('a');
                                    link.href = downloadUrl;
                                    link.download = fileName;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  } else {
                                    const errorData = await response.json();
                                    alert(`Failed to download file: ${errorData.error || 'Unknown error'}`);
                                  }
                                } catch (error) {
                                  console.error('Error downloading file:', error);
                                  alert('Failed to download file');
                                }
                              }}
                              className="w-full sm:w-auto text-blue-600 border-blue-300 hover:bg-blue-50"
                            >
                              <SemanticBDIIcon semantic="download" size={12} className="mr-1" />
                              Download
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                if (confirm(`Are you sure you want to delete "${doc.fileName}"? This action cannot be undone.`)) {
                                  try {
                                    const response = await fetch(`/api/cpfr/purchase-orders/${selectedPurchaseOrder.id}/documents?docId=${doc.id}`, {
                                      method: 'DELETE',
                                    });
                                    if (response.ok) {
                                      // Remove from local state immediately
                                      setExistingDocs(existingDocs.filter(d => d.id !== doc.id));
                                      console.log('✅ Document deleted successfully');
                                    } else {
                                      const errorData = await response.json();
                                      alert(`Failed to delete document: ${errorData.error || 'Unknown error'}`);
                                    }
                                  } catch (error) {
                                    console.error('Error deleting document:', error);
                                    alert('Failed to delete document');
                                  }
                                }
                              }}
                              className="w-full sm:w-auto text-red-600 border-red-300 hover:bg-red-50"
                            >
                              <SemanticBDIIcon semantic="delete" size={12} className="mr-1" />
                              {tc('deleteButton', 'Delete')}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload New Documents */}
                <div className="border-2 border-dashed border-green-300 rounded-lg p-6 bg-white">
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) {
                        const newFiles = Array.from(e.target.files);
                        setEditUploadedDocs([...editUploadedDocs, ...newFiles]);
                      }
                    }}
                    className="hidden"
                    id="edit-file-upload"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  />
                  <label htmlFor="edit-file-upload" className="cursor-pointer">
                    <div className="text-center">
                      <SemanticBDIIcon semantic="upload" size={32} className="mx-auto mb-2 text-green-400" />
                      <p className="text-green-700 font-medium">Click to upload additional documents</p>
                      <p className="text-sm text-green-600">PDF, DOC, XLS, Images supported</p>
                    </div>
                  </label>
                  
                  {editUploadedDocs.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h5 className="font-medium text-green-800">New Files to Upload:</h5>
                      {editUploadedDocs.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-green-100 p-3 rounded border border-green-200">
                          <div className="flex items-center space-x-2">
                            <SemanticBDIIcon semantic="upload" size={14} className="text-green-600" />
                            <span className="text-sm font-medium text-green-800">{file.name}</span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditUploadedDocs(editUploadedDocs.filter((_, i) => i !== index));
                            }}
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            <SemanticBDIIcon semantic="delete" size={12} className="mr-1" />
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="editNotes">Notes & Special Instructions</Label>
                <textarea
                  id="editNotes"
                  name="editNotes"
                  rows={3}
                  defaultValue={selectedPurchaseOrder.notes || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                  placeholder="Any special instructions, delivery notes, or additional information"
                />
              </div>

              <div className="bg-blue-100 p-4 rounded">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-blue-800">Total Value:</span>
                  <span className="font-bold text-2xl text-blue-900">${Number(selectedPurchaseOrder.totalValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setSelectedPurchaseOrder(null)}>
                  {tc('cancelButton', 'Cancel')}
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  {tc('updatePurchaseOrderButton', 'Update Purchase Order')}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}