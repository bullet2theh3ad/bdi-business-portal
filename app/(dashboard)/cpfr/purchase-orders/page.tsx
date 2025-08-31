'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import useSWR from 'swr';
import { User } from '@/lib/db/schema';

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
  poNumber: string;
  supplierName: string;
  orderDate: string;
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

export default function PurchaseOrdersPage() {
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  const { data: purchaseOrders, mutate: mutatePOs } = useSWR<PurchaseOrder[]>('/api/cpfr/purchase-orders', fetcher);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [customTerms, setCustomTerms] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<File[]>([]);

  // Access control - Sales team and admins can manage POs
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

  const handleCreatePO = async (formData: FormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/cpfr/purchase-orders', {
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
          totalValue: parseFloat(formData.get('totalValue') as string),
          notes: formData.get('notes'),
        }),
      });

      if (response.ok) {
        mutatePOs();
        setShowCreateModal(false);
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

  const posArray = Array.isArray(purchaseOrders) ? purchaseOrders : [];
  const filteredPOs = posArray.filter(po => {
    const matchesSearch = !searchTerm || 
      po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
    <div className="flex-1 p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <SemanticBDIIcon semantic="orders" size={32} />
            <div>
              <h1 className="text-3xl font-bold">Purchase Orders</h1>
              <p className="text-muted-foreground">Manage supplier orders and delivery terms</p>
            </div>
          </div>
          <Button className="bg-green-600 hover:bg-green-700" onClick={() => setShowCreateModal(true)}>
            <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
            Create PO
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by PO number or supplier name..."
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

      {/* Purchase Orders List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="orders" size={20} className="mr-2" />
            Purchase Orders ({filteredPOs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPOs.length === 0 ? (
            <div className="text-center py-12">
              <SemanticBDIIcon semantic="orders" size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Purchase Orders</h3>
              <p className="text-muted-foreground mb-4">Create your first PO to start managing supplier orders</p>
              <Button onClick={() => setShowCreateModal(true)}>
                <SemanticBDIIcon semantic="plus" size={16} className="mr-2" />
                Create First PO
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPOs.map((po) => (
                <div key={po.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-lg">PO #{po.poNumber}</h3>
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
                          <span className="text-gray-500">Order Date:</span>
                          <p className="font-medium">{new Date(po.orderDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Delivery Week:</span>
                          <p className="font-medium">{po.requestedDeliveryWeek}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Terms:</span>
                          <p className="font-medium">{po.terms}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 text-sm">
                        <div>
                          <span className="text-gray-500">Total Value:</span>
                          <span className="font-bold text-green-600">${po.totalValue.toLocaleString()}</span>
                        </div>
                      </div>
                      {po.notes && (
                        <p className="text-sm text-gray-600 mt-2">{po.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedPO(po)}>
                        <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create PO Modal */}
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <SemanticBDIIcon semantic="orders" size={20} className="mr-2" />
                Create Purchase Order
              </DialogTitle>
            </DialogHeader>
            <form className="space-y-12 p-8" onSubmit={(e) => {
              e.preventDefault();
              handleCreatePO(new FormData(e.currentTarget));
            }}>
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-10">
                <div>
                  <Label htmlFor="poNumber">PO Number *</Label>
                  <Input
                    id="poNumber"
                    name="poNumber"
                    placeholder="e.g., PO-2025-001"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="supplierName">Supplier Name *</Label>
                  <Input
                    id="supplierName"
                    name="supplierName"
                    placeholder="e.g., Motorola Solutions"
                    required
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-10">
                <div>
                  <Label htmlFor="orderDate">Order Date *</Label>
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
                    placeholder="e.g., 2025-W12"
                    required
                    className="mt-1"
                  />
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

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <Label htmlFor="totalValue">Total Value ($) *</Label>
                  <Input
                    id="totalValue"
                    name="totalValue"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g., 125000.00"
                    required
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Document Upload Section */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                  <SemanticBDIIcon semantic="upload" size={16} className="mr-2" />
                  Supporting Documents
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-10">
                  <div>
                    <Label htmlFor="documents">Upload Documents</Label>
                    <input
                      type="file"
                      id="documents"
                      name="documents"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        setUploadedDocs(prev => [...prev, ...files]);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 mt-1 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      PDF, Word, Excel, Images - Max 10MB per file
                    </div>
                  </div>
                  <div>
                    <Label className="block mb-2">Uploaded Documents ({uploadedDocs.length})</Label>
                    <div className="min-h-[100px] max-h-[120px] overflow-y-auto border border-gray-300 rounded-md p-3 bg-white">
                      {uploadedDocs.length === 0 ? (
                        <div className="text-center text-gray-500 text-sm py-4">
                          <SemanticBDIIcon semantic="upload" size={24} className="mx-auto mb-2 opacity-50" />
                          No documents uploaded
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {uploadedDocs.map((file, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 flex items-center justify-center">
                                  {file.type.includes('pdf') ? (
                                    <span className="text-red-600 text-xs font-bold">PDF</span>
                                  ) : file.type.includes('word') || file.type.includes('document') ? (
                                    <span className="text-blue-600 text-xs font-bold">DOC</span>
                                  ) : file.type.includes('sheet') || file.type.includes('excel') ? (
                                    <span className="text-green-600 text-xs font-bold">XLS</span>
                                  ) : file.type.includes('image') ? (
                                    <span className="text-purple-600 text-xs font-bold">IMG</span>
                                  ) : (
                                    <span className="text-gray-600 text-xs font-bold">FILE</span>
                                  )}
                                </div>
                                <span className="text-sm truncate max-w-[150px]" title={file.name}>
                                  {file.name}
                                </span>
                                <span className="text-xs text-gray-500">
                                  ({(file.size / 1024).toFixed(1)}KB)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setUploadedDocs(prev => prev.filter((_, i) => i !== index))}
                                className="text-red-500 hover:text-red-700 text-xs"
                              >
                                ✕
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
                      Create PO
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
