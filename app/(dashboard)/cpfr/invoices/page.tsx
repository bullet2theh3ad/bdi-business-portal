'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  requestedDeliveryWeek: string;
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

export default function InvoicesPage() {
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  const { data: invoices, mutate: mutateInvoices } = useSWR<Invoice[]>('/api/cpfr/invoices', fetcher);
  const { data: skus } = useSWR<ProductSku[]>('/api/admin/skus', fetcher);
  const { data: organizations } = useSWR('/api/admin/organizations?includeInternal=true', fetcher);

  // Fetch line items for all invoices when invoices are loaded
  useEffect(() => {
    if (invoices && invoices.length > 0) {
      const fetchAllLineItems = async () => {
        const lineItemsData: Record<string, Array<{
          skuCode: string;
          skuName: string;
          quantity: number;
        }>> = {};

        for (const invoice of invoices) {
          try {
            const response = await fetch(`/api/cpfr/invoices/${invoice.id}/line-items`);
            if (response.ok) {
              const lineItems = await response.json();
              lineItemsData[invoice.id] = lineItems.map((item: any) => ({
                skuCode: item.skuCode,
                skuName: item.skuName,
                quantity: item.quantity
              }));
            }
          } catch (error) {
            console.error(`Error fetching line items for invoice ${invoice.id}:`, error);
            lineItemsData[invoice.id] = [];
          }
        }

        setInvoiceLineItems(lineItemsData);
      };

      fetchAllLineItems();
    }
  }, [invoices]);

  // Helper function to aggregate SKU quantities for display
  const getSkuSummary = (invoiceId: string) => {
    const lineItems = invoiceLineItems[invoiceId] || [];
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
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
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
  const [invoiceLineItems, setInvoiceLineItems] = useState<Record<string, Array<{
    skuCode: string;
    skuName: string;
    quantity: number;
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

        // Access control - Sales team and admins can manage Invoices
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

  const handleCreateInvoice = async (formData: FormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/cpfr/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poNumber: formData.get('poNumber'),
          supplierName: formData.get('supplierName'),
          orderDate: formData.get('orderDate'),
          requestedDeliveryWeek: formData.get('requestedDeliveryWeek'),
          terms: formData.get('terms'),
          incoterms: formData.get('incoterms'),
          incotermsLocation: formData.get('incotermsLocation'),
          totalValue: calculateTotal(),
          notes: formData.get('notes'),
          lineItems: lineItems, // ✅ ADD LINE ITEMS TO CREATE REQUEST
        }),
      });

      if (response.ok) {
        mutateInvoices();
        setShowCreateModal(false);
        // Clear form state after successful creation
        setLineItems([]);
        setUploadedDocs([]);
        setCustomTerms(false);
      } else {
        const errorData = await response.json();
        alert(`Failed to create PO: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating PO:', error);
      alert('Failed to create PO');
    }
    setIsLoading(false);
  };

  const invoicesArray = Array.isArray(invoices) ? invoices : [];
  const filteredInvoices = invoicesArray.filter(invoice => {
    const matchesSearch = !searchTerm || 
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
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
              <h1 className="text-2xl sm:text-3xl font-bold">Invoices</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Manage supplier orders and delivery terms</p>
            </div>
          </div>
          <Button className="bg-green-600 hover:bg-green-700" onClick={() => {
            // Clear all form state for a fresh invoice
            setLineItems([]);
            setUploadedDocs([]);
            setCustomTerms(false);
            setShowCreateModal(true);
          }}>
            <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
            Enter Invoice
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by Invoice number or customer name..."
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
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
      </div>

      {/* Invoices List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="orders" size={20} className="mr-2" />
            Invoices ({filteredInvoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12">
              <SemanticBDIIcon semantic="orders" size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Invoices</h3>
              <p className="text-muted-foreground mb-4">Enter your first Invoice to start managing customer orders</p>
              <Button onClick={() => {
                // Clear all form state for a fresh invoice
                setLineItems([]);
                setUploadedDocs([]);
                setCustomTerms(false);
                setShowCreateModal(true);
              }}>
                <SemanticBDIIcon semantic="plus" size={16} className="mr-2" />
                Enter First Invoice
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-3">
                        <h3 className="font-semibold text-lg">Invoice #{invoice.invoiceNumber}</h3>
                        <Badge className={getStatusColor(invoice.status)}>
                          {invoice.status}
                        </Badge>
                      </div>
                      
                      {/* Action Buttons - Right under invoice number */}
                      <div className="flex flex-col sm:flex-row gap-2 mb-4">
                        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={async () => {
                          setSelectedInvoice(invoice);
                          setEditUploadedDocs([]);
                          
                          // Fetch existing documents for this invoice
                          try {
                            const docsResponse = await fetch(`/api/cpfr/invoices/${invoice.id}/documents`);
                            if (docsResponse.ok) {
                              const docs = await docsResponse.json();
                              setExistingDocs(docs);
                              // Documents loaded successfully
                            }
                          } catch (error) {
                            console.error('Error loading documents:', error);
                            setExistingDocs([]);
                          }

                          // Fetch existing line items for this invoice
                          try {
                            // Fetching line items for invoice
                            const lineItemsResponse = await fetch(`/api/cpfr/invoices/${invoice.id}/line-items`);
                            // Line items response received
                            
                            if (lineItemsResponse.ok) {
                              const lineItems = await lineItemsResponse.json();
                              // Raw line items received from API
                              
                              const mappedItems = lineItems.map((item: any) => ({
                                id: item.id,
                                skuId: item.skuId,
                                sku: item.sku,
                                skuName: item.skuName,
                                quantity: parseInt(item.quantity),
                                unitCost: parseFloat(item.unitCost),
                                lineTotal: parseFloat(item.lineTotal)
                              }));
                              
                              // Line items mapped for UI
                              setEditLineItems(mappedItems);
                            } else {
                              const errorText = await lineItemsResponse.text();
                              console.error('Failed to fetch line items:', lineItemsResponse.status, errorText);
                              setEditLineItems([]);
                            }
                          } catch (error) {
                            console.error('Error loading line items:', error);
                            setEditLineItems([]);
                          }
                        }}>
                          <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                          Edit
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full sm:w-auto text-red-600 border-red-300 hover:bg-red-50"
                          onClick={async () => {
                            if (confirm(`Are you sure you want to delete invoice ${invoice.invoiceNumber}?\n\nThis action cannot be undone and will delete:\n• The invoice\n• All line items\n• All documents\n• All related data`)) {
                              try {
                                const response = await fetch(`/api/cpfr/invoices/${invoice.id}`, {
                                  method: 'DELETE'
                                });

                                if (response.ok) {
                                  const result = await response.json();
                                  alert(`✅ ${result.message}`);
                                  mutateInvoices(); // Refresh the invoice list
                                } else {
                                  const errorData = await response.json();
                                  alert(`❌ Failed to delete invoice: ${errorData.error || 'Unknown error'}`);
                                }
                              } catch (error) {
                                console.error('Error deleting invoice:', error);
                                alert('❌ Failed to delete invoice');
                              }
                            }
                          }}
                        >
                          <span className="mr-1 text-sm">🗑️</span>
                          Delete
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-500">Supplier:</span>
                          <p className="font-medium">{invoice.customerName}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Invoice Date:</span>
                          <p className="font-medium">{new Date(invoice.invoiceDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Delivery Week:</span>
                          <p className="font-medium">{invoice.requestedDeliveryWeek}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Terms:</span>
                          <p className="font-medium">{invoice.terms}</p>
                        </div>
                      </div>
                      
                      {/* SKU Summary */}
                      <div className="bg-blue-50 p-3 rounded-md border border-blue-200 mb-3">
                        <div className="flex items-center space-x-2 mb-1">
                          <SemanticBDIIcon semantic="inventory" size={14} className="text-blue-600" />
                          <span className="text-blue-800 font-medium text-sm">Line Items Summary:</span>
                        </div>
                        <p className="text-sm text-blue-700 font-mono">
                          {getSkuSummary(invoice.id)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <div>
                          <span className="text-gray-500">Total Value:</span>
                          <span className="font-bold text-green-600">${Number(invoice.totalValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                      {invoice.notes && (
                        <p className="text-sm text-gray-600 mt-2">{invoice.notes}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enter Invoice Modal */}
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <SemanticBDIIcon semantic="orders" size={20} className="mr-2" />
                Create Invoice
              </DialogTitle>
            </DialogHeader>
            <form className="space-y-6 lg:space-y-12 p-4 sm:p-6 lg:p-8" onSubmit={(e) => {
              e.preventDefault();
              handleCreateInvoice(new FormData(e.currentTarget));
            }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 lg:gap-6 xl:gap-10">
                <div>
                  <Label htmlFor="poNumber">Invoice Number *</Label>
                  <Input
                    id="poNumber"
                    name="poNumber"
                    placeholder="e.g., INV-2025-001"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="supplierName">MFG/Customer Organization *</Label>
                  <select
                    id="supplierName"
                    name="supplierName"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                  >
                    <option value="">Select MFG Organization</option>
                    {organizations?.map((org: any) => (
                      <option key={org.id} value={org.code}>
                        {org.code} - {org.name}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-gray-600 mt-1">
                    Select the Manufacturing/ODM organization (Factory) for CPFR signaling
                  </div>
                </div>
                <div>
                  <Label htmlFor="customCustomerName">Custom Customer Name</Label>
                  <Input
                    id="customCustomerName"
                    name="customCustomerName"
                    placeholder="Optional: Additional customer details"
                    className="mt-1"
                  />
                  <div className="text-xs text-gray-600 mt-1">
                    Optional: Additional customer information beyond MFG code
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-10">
                <div>
                  <Label htmlFor="orderDate">Invoice Date *</Label>
                  <Input
                    id="orderDate"
                    name="orderDate"
                    type="date"
                    required
                    className="mt-1"
                  />
                </div>
                                  <div>
                    <Label htmlFor="requestedDeliveryWeek">Requested Delivery Week *</Label>
                    <Input
                      id="requestedDeliveryWeek"
                      name="requestedDeliveryWeek"
                      type="date"
                      required
                      className="mt-1"
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      📅 Target delivery date
                    </div>
                  </div>
              </div>

                              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-10">
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
                          Presets
                        </Button>
                      </div>
                      <div className="mt-1 text-xs text-blue-600">
                        💡 Enter custom payment terms (e.g., "2/10 Net 30" for 2% discount if paid in 10 days)
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
                      <option value="FAS">FAS - Free Alongside Ship (seller delivers to port)</option>
                      <option value="FOB">FOB - Free on Board (seller loads vessel)</option>
                      <option value="CFR">CFR - Cost and Freight (seller pays shipping)</option>
                      <option value="CIF">CIF - Cost, Insurance & Freight (seller pays shipping + insurance)</option>
                    </optgroup>
                  </select>
                  <div className="mt-1 text-xs text-blue-600">
                    💡 IncoTerms 2020 - International trade delivery terms
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <div className="text-center py-8 text-gray-500">
                    <SemanticBDIIcon semantic="inventory" size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No line items added yet</p>
                    <p className="text-xs">Click "Add Item" to start building your PO</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {lineItems.map((item, index) => (
                      <div key={item.id} className="bg-white p-4 rounded border border-blue-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-4 items-end">
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
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Total Value Display */}
                    <div className="bg-blue-100 p-4 rounded border border-blue-300">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-blue-800">Total Invoice Value:</span>
                        <span className="font-bold text-2xl text-blue-900">${calculateTotal().toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Document Upload Section */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-4 flex items-center">
                  <SemanticBDIIcon semantic="upload" size={16} className="mr-2" />
                  Supporting Documents
                </h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
                  <div>
                    <Label htmlFor="documents">Upload Documents</Label>
                    <input
                      type="file"
                      id="documents"
                      name="documents"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        setUploadedDocs(prev => [...prev, ...files]);
                        
                        // TODO: Implement real-time upload to Supabase
                        // For now, just add to local state for preview
                        // Files selected for upload
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      PDF, Word, Excel, Images - Max 10MB per file
                    </div>
                  </div>
                  <div>
                    <Label className="block mb-3">Selected Documents ({uploadedDocs.length})</Label>
                    <div className="min-h-[150px] max-h-[200px] overflow-y-auto border border-gray-300 rounded-md p-3 bg-white">
                      {uploadedDocs.length === 0 ? (
                        <div className="text-center text-gray-500 text-sm py-8">
                          <SemanticBDIIcon semantic="upload" size={24} className="mx-auto mb-2 opacity-50" />
                          No documents selected yet
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {uploadedDocs.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 flex items-center justify-center">
                                  {file.type.includes('pdf') ? (
                                    <span className="text-red-600 text-sm font-bold">📄</span>
                                  ) : file.type.includes('word') || file.type.includes('document') ? (
                                    <span className="text-blue-600 text-sm font-bold">📝</span>
                                  ) : file.type.includes('sheet') || file.type.includes('excel') ? (
                                    <span className="text-green-600 text-sm font-bold">📊</span>
                                  ) : file.type.includes('image') ? (
                                    <span className="text-purple-600 text-sm font-bold">🖼️</span>
                                  ) : (
                                    <span className="text-gray-600 text-sm font-bold">📎</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium truncate block" title={file.name}>
                                    {file.name}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {(file.size / 1024).toFixed(1)}KB
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setUploadedDocs(prev => prev.filter((_, i) => i !== index))}
                                className="text-red-600 hover:text-red-800 text-sm"
                                title="Remove file"
                              >
                                🗑️
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <textarea
                  id="notes"
                  name="notes"
                  placeholder="Special instructions, delivery requirements, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-4 pt-8">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isLoading ? (
                    <>
                      <SemanticBDIIcon semantic="sync" size={16} className="mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <SemanticBDIIcon semantic="orders" size={16} className="mr-2 brightness-0 invert" />
                      Enter Invoice
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Invoice Modal */}
      {selectedInvoice && !showCreateModal && (
        <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <SemanticBDIIcon semantic="settings" size={20} className="mr-2" />
                Edit Invoice: {selectedInvoice.invoiceNumber}
              </DialogTitle>
              <DialogDescription>
                Modify invoice details, line items, and upload supporting documents. Changes will be saved when you submit the form.
              </DialogDescription>
            </DialogHeader>
            <form className="space-y-8 p-8" onSubmit={async (e) => {
              e.preventDefault();
              setIsLoading(true);
              
              const formData = new FormData(e.currentTarget);
              
              try {
                // Calculate new total from line items
                const newTotal = editLineItems.reduce((sum, item) => sum + item.lineTotal, 0);

                const response = await fetch(`/api/cpfr/invoices/${selectedInvoice.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    editCustomerName: formData.get('editCustomerName'),
                    editStatus: formData.get('editStatus'),
                    editTerms: formData.get('editTerms'),
                    editIncoterms: formData.get('editIncoterms'),
                    editIncotermsLocation: formData.get('editIncotermsLocation'),
                    editNotes: formData.get('editNotes'),
                    editTotalValue: newTotal.toString(),
                  }),
                });

                if (response.ok) {
                  const result = await response.json();
                  // Invoice updated successfully

                  // Update line items
                  if (editLineItems.length > 0) {
                    // Updating line items
                    try {
                      const lineItemsResponse = await fetch(`/api/cpfr/invoices/${selectedInvoice.id}/line-items`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lineItems: editLineItems })
                      });

                      if (lineItemsResponse.ok) {
                        const lineItemsResult = await lineItemsResponse.json();
                        // Line items updated successfully
                      } else {
                        console.error('Failed to update line items');
                      }
                    } catch (lineItemsError) {
                      console.error('Line items update error:', lineItemsError);
                    }
                  }
                  
                  // Upload new documents if any
                  if (editUploadedDocs.length > 0) {
                    // Uploading new documents
                    try {
                      const uploadFormData = new FormData();
                      editUploadedDocs.forEach(file => uploadFormData.append('files', file));
                      
                      const uploadResponse = await fetch(`/api/cpfr/invoices/${selectedInvoice.id}/documents`, {
                        method: 'POST',
                        body: uploadFormData
                      });
                      
                      if (uploadResponse.ok) {
                        const uploadResult = await uploadResponse.json();
                        // New files uploaded successfully
                        alert(`Invoice updated with ${uploadResult.uploaded} new documents uploaded!`);
                      } else {
                        alert('Invoice updated but new file upload failed');
                      }
                    } catch (uploadError) {
                      console.error('Upload error:', uploadError);
                      alert('Invoice updated but new file upload failed');
                    }
                  } else {
                    alert('Invoice updated successfully!');
                  }
                  
                  mutateInvoices(); // Refresh invoice list
                  setSelectedInvoice(null); // Close modal
                  setEditUploadedDocs([]); // Clear new files
                } else {
                  const errorData = await response.json();
                  alert(`Failed to update invoice: ${errorData.error || 'Unknown error'}`);
                }
              } catch (error) {
                console.error('Error updating invoice:', error);
                alert('Failed to update invoice');
              }
              
              setIsLoading(false);
            }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-6">
                <div>
                  <Label htmlFor="editInvoiceNumber">Invoice Number</Label>
                  <Input
                    id="editInvoiceNumber"
                    defaultValue={selectedInvoice.invoiceNumber}
                    className="font-mono bg-gray-50"
                    readOnly
                  />
                </div>
                <div>
                  <Label htmlFor="editCustomerName">MFG/Customer Organization *</Label>
                  <select
                    id="editCustomerName"
                    name="editCustomerName"
                    defaultValue={selectedInvoice.customerName}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select MFG Organization</option>
                    {organizations?.map((org: any) => (
                      <option key={org.id} value={org.code}>
                        {org.code} - {org.name}
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-gray-600 mt-1">
                    Manufacturing/ODM organization for CPFR signaling
                  </div>
                </div>
                <div>
                  <Label htmlFor="editStatus">Status</Label>
                  <select
                    id="editStatus"
                    name="editStatus"
                    defaultValue={selectedInvoice.status}
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
                    defaultValue={selectedInvoice.terms || ''}
                    placeholder="NET30"
                  />
                </div>
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
                    onClick={() => {
                      const newItem = {
                        id: Date.now().toString(),
                        skuId: '',
                        sku: '',
                        skuName: '',
                        quantity: 0,
                        unitCost: 0,
                        lineTotal: 0
                      };
                      setEditLineItems([...editLineItems, newItem]);
                    }}
                    variant="outline"
                    size="sm"
                    className="bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200"
                  >
                    <SemanticBDIIcon semantic="plus" size={14} className="mr-1" />
                    Add Item
                  </Button>
                </div>
                
                {editLineItems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <SemanticBDIIcon semantic="inventory" size={32} className="mx-auto mb-2 opacity-50" />
                    <p>No line items found</p>
                    <p className="text-xs">Click "Add Item" to add line items</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {editLineItems.map((item, index) => (
                      <div key={item.id} className="bg-white p-4 rounded border border-blue-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-4 items-end">
                          <div>
                            <Label className="text-xs">SKU *</Label>
                            <select
                              value={item.skuId}
                              onChange={(e) => {
                                const selectedSku = skus?.find(sku => sku.id === e.target.value);
                                if (selectedSku) {
                                  const updatedItems = [...editLineItems];
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
                                const quantity = parseInt(e.target.value) || 0;
                                const updatedItems = [...editLineItems];
                                updatedItems[index] = {
                                  ...item,
                                  quantity,
                                  lineTotal: quantity * item.unitCost
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
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unitCost === 0 ? '' : item.unitCost}
                              onChange={(e) => {
                                const unitCost = parseFloat(e.target.value) || 0;
                                const updatedItems = [...editLineItems];
                                updatedItems[index] = {
                                  ...item,
                                  unitCost,
                                  lineTotal: item.quantity * unitCost
                                };
                                setEditLineItems(updatedItems);
                              }}
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
                              onClick={() => {
                                setEditLineItems(editLineItems.filter((_, i) => i !== index));
                              }}
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Updated Total Value Display */}
                    <div className="bg-blue-100 p-4 rounded border border-blue-300">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-blue-800">Updated Invoice Total:</span>
                        <span className="font-bold text-2xl text-blue-900">
                          ${editLineItems.reduce((sum, item) => sum + item.lineTotal, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* File Management Section */}
              <div className="bg-gray-50 p-6 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-4 flex items-center">
                  <SemanticBDIIcon semantic="upload" size={16} className="mr-2" />
                  Document Management
                </h4>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
                  {/* Existing Documents */}
                  <div>
                    <Label className="block mb-3">Existing Documents ({existingDocs.length})</Label>
                    <div className="min-h-[150px] max-h-[200px] overflow-y-auto border border-gray-300 rounded-md p-3 bg-white">
                      {existingDocs.length === 0 ? (
                        <div className="text-center text-gray-500 text-sm py-8">
                          <SemanticBDIIcon semantic="upload" size={24} className="mx-auto mb-2 opacity-50" />
                          No documents uploaded yet
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {existingDocs.map((doc) => (
                            <div key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 flex items-center justify-center">
                                  {doc.fileType.includes('pdf') ? (
                                    <span className="text-red-600 text-sm font-bold">📄</span>
                                  ) : doc.fileType.includes('word') || doc.fileType.includes('document') ? (
                                    <span className="text-blue-600 text-sm font-bold">📝</span>
                                  ) : doc.fileType.includes('sheet') || doc.fileType.includes('excel') ? (
                                    <span className="text-green-600 text-sm font-bold">📊</span>
                                  ) : doc.fileType.includes('image') ? (
                                    <span className="text-purple-600 text-sm font-bold">🖼️</span>
                                  ) : (
                                    <span className="text-gray-600 text-sm font-bold">📎</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm font-medium truncate block" title={doc.fileName}>
                                    {doc.fileName}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {(doc.fileSize / 1024).toFixed(1)}KB • {new Date(doc.uploadedAt).toLocaleDateString()}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    // TODO: Implement file download
                                    alert(`Download ${doc.fileName} - Coming soon!`);
                                  }}
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                  title="Download file"
                                >
                                  ⬇️
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm(`Delete ${doc.fileName}?`)) {
                                      try {
                                        const deleteResponse = await fetch(`/api/cpfr/invoices/${selectedInvoice.id}/documents/${doc.id}`, {
                                          method: 'DELETE'
                                        });
                                        if (deleteResponse.ok) {
                                          setExistingDocs(existingDocs.filter(d => d.id !== doc.id));
                                          alert('File deleted successfully!');
                                        } else {
                                          alert('Failed to delete file');
                                        }
                                      } catch (error) {
                                        alert('Failed to delete file');
                                      }
                                    }
                                  }}
                                  className="text-red-600 hover:text-red-800 text-sm"
                                  title="Delete file"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Upload New Documents */}
                  <div>
                    <Label htmlFor="editDocuments">Upload New Documents</Label>
                    <input
                      type="file"
                      id="editDocuments"
                      name="editDocuments"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setEditUploadedDocs(prev => [...prev, ...files]);
                        // New files selected for upload
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      PDF, Word, Excel, Images - Max 10MB per file
                    </div>
                    
                    {/* Preview New Files */}
                    {editUploadedDocs.length > 0 && (
                      <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
                        <div className="text-sm font-medium text-green-800 mb-2">
                          New Files to Upload ({editUploadedDocs.length})
                        </div>
                        <div className="space-y-2">
                          {editUploadedDocs.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 flex items-center justify-center">
                                  {file.type.includes('pdf') ? (
                                    <span className="text-red-600 text-xs font-bold">📄</span>
                                  ) : file.type.includes('word') || file.type.includes('document') ? (
                                    <span className="text-blue-600 text-xs font-bold">📝</span>
                                  ) : file.type.includes('sheet') || file.type.includes('excel') ? (
                                    <span className="text-green-600 text-xs font-bold">📊</span>
                                  ) : file.type.includes('image') ? (
                                    <span className="text-purple-600 text-xs font-bold">🖼️</span>
                                  ) : (
                                    <span className="text-gray-600 text-xs font-bold">📎</span>
                                  )}
                                </div>
                                <span className="text-sm truncate max-w-[200px]" title={file.name}>
                                  {file.name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  ({(file.size / 1024).toFixed(1)}KB)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setEditUploadedDocs(prev => prev.filter((_, i) => i !== index))}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="editNotes">Notes</Label>
                <textarea
                  id="editNotes"
                  name="editNotes"
                  defaultValue={selectedInvoice.notes || ''}
                  placeholder="Special instructions, delivery requirements, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
                  rows={3}
                />
              </div>

              <div className="bg-blue-100 p-4 rounded">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-blue-800">Total Value:</span>
                  <span className="font-bold text-2xl text-blue-900">${Number(selectedInvoice.totalValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setSelectedInvoice(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-green-600 hover:bg-green-700">
                  Update Invoice
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
