'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
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

interface Warehouse {
  id: string;
  warehouseCode: string;
  name: string;
  type: 'warehouse' | 'distribution_center' | 'fulfillment_center' | 'cross_dock' | 'manufacturing';
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  timezone: string;
  
  // Capabilities
  capabilities: {
    airFreight: boolean;
    seaFreight: boolean;
    truckLoading: boolean;
    railAccess: boolean;
    coldStorage: boolean;
    hazmatHandling: boolean;
  };
  
  // Operational Details
  operatingHours: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  
  // New multiple contacts structure
  contacts?: Array<{
    name: string;
    email: string;
    phone?: string;
    extension?: string;
    isPrimary: boolean;
  }>;
  
  // Main capabilities (warehouse operations)
  mainCapabilities?: string[];
  
  // Physical Specifications
  maxPalletHeight: number; // cm
  maxPalletWeight: number; // kg
  loadingDockCount: number;
  storageCapacity: number; // square meters
  
  isActive: boolean;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function WarehousesPage() {
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  const { data: warehouses, mutate: mutateWarehouses } = useSWR<Warehouse[]>('/api/inventory/warehouses', fetcher);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [warehouseFiles, setWarehouseFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [showExtraContact, setShowExtraContact] = useState(false);

  // Load existing files when opening edit modal
  useEffect(() => {
    if (selectedWarehouse) {
      // Don't auto-show extra contact form - only show when user clicks "Add Contact"
      setShowExtraContact(false);

      // Fetch existing documents for this warehouse
      fetch(`/api/inventory/warehouses/${selectedWarehouse.id}/documents`)
        .then(res => res.json())
        .then(docs => {
          console.log('📁 Loaded warehouse documents:', docs);
          setUploadedFiles(docs || []);
        })
        .catch(err => console.error('Error loading warehouse documents:', err));
    } else {
      // Clear files when modal closes
      setUploadedFiles([]);
      setWarehouseFiles([]);
      setShowExtraContact(false);
    }
  }, [selectedWarehouse]);

  // Dropzone for warehouse documents
  const onDrop = useCallback((acceptedFiles: File[]) => {
    setWarehouseFiles(prev => [...prev, ...acceptedFiles]);
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
    maxSize: 5 * 1024 * 1024 // 5MB limit
  });

  // Remove file from list
  const removeFile = (index: number) => {
    setWarehouseFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Access control - Admin and operations can manage Warehouses
  if (!user || !['super_admin', 'admin', 'operations', 'member'].includes(user.role)) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="sites" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Admin access required for warehouse management.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleEditWarehouse = async (formData: FormData) => {
    if (!selectedWarehouse) return;
    
    setIsLoading(true);
    try {
      // Collect main capabilities
      const mainCapabilities = formData.getAll('mainCapabilities') as string[];
      
      // Collect shipping capabilities
      const shippingCapabilities = {
        airFreight: formData.get('airFreight') === 'on',
        seaFreight: formData.get('seaFreight') === 'on',
        truckLoading: formData.get('truckLoading') === 'on',
        railAccess: formData.get('railAccess') === 'on',
        hazmatHandling: formData.get('hazmatHandling') === 'on',
        coldStorage: formData.get('coldStorage') === 'on',
      };

      // Determine primary type
      const primaryType = mainCapabilities.length > 0 ? mainCapabilities[0] : selectedWarehouse.type;

      const response = await fetch(`/api/inventory/warehouses/${selectedWarehouse.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseCode: formData.get('warehouseCode'),
          name: formData.get('name'),
          type: primaryType,
          address: formData.get('address'),
          city: formData.get('city'),
          state: formData.get('state'),
          country: formData.get('country'),
          postalCode: formData.get('postalCode'),
          timezone: formData.get('timezone'),
          capabilities: shippingCapabilities,
          mainCapabilities: mainCapabilities,
                      contacts: (() => {
              const contacts = [];
              
              // Read updated contact values from form (for existing contacts)
              for (let i = 1; i <= 10; i++) {
                const name = formData.get(`contactName${i}`);
                const email = formData.get(`contactEmail${i}`);
                if (name && email) {
                  contacts.push({
                    name: name,
                    email: email,
                    phone: formData.get(`contactPhone${i}`) || '',
                    extension: formData.get(`contactExt${i}`) || '',
                    isPrimary: i === 1
                  });
                }
              }
              
              return contacts;
            })(),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Upload documents if any were attached
        if (warehouseFiles.length > 0) {
          try {
            const formData = new FormData();
            warehouseFiles.forEach((file, index) => {
              formData.append(`file${index}`, file);
            });
            
            const docsResponse = await fetch(`/api/inventory/warehouses/${result.warehouse.id}/documents`, {
              method: 'POST',
              body: formData,
            });
            
            if (docsResponse.ok) {
              const uploadResult = await docsResponse.json();
              alert(`Warehouse updated successfully with ${uploadResult.documents.length} documents uploaded!`);
              setWarehouseFiles([]); // Clear uploaded files
            } else {
              alert('Warehouse updated but document upload failed');
            }
          } catch (docError) {
            console.error('Error uploading documents:', docError);
            alert('Warehouse updated but document upload failed');
          }
        } else {
          alert('Warehouse updated successfully!');
        }
        
        setSelectedWarehouse(null);
        mutateWarehouses(); // Refresh the list
      } else {
        const errorData = await response.json();
        alert(`Failed to update warehouse: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating warehouse:', error);
      alert('Failed to update warehouse');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWarehouse = async (formData: FormData) => {
    setIsLoading(true);
    try {
      // Collect main capabilities
      const mainCapabilities = formData.getAll('mainCapabilities') as string[];
      
      // Collect shipping capabilities (matches existing database structure)
      const shippingCapabilities = {
        airFreight: formData.get('airFreight') === 'on',
        seaFreight: formData.get('seaFreight') === 'on',
        truckLoading: formData.get('truckLoading') === 'on',
        railAccess: formData.get('railAccess') === 'on',
        hazmatHandling: formData.get('hazmatHandling') === 'on',
        coldStorage: formData.get('coldStorage') === 'on', // Can be both main and shipping capability
      };

      // Determine primary type (use first selected main capability or default to 'warehouse')
      const primaryType = mainCapabilities.length > 0 ? mainCapabilities[0] : 'warehouse';

      const response = await fetch('/api/inventory/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseCode: formData.get('warehouseCode'),
          name: formData.get('name'),
          type: primaryType, // Primary warehouse type from main capabilities
          address: formData.get('address'),
          city: formData.get('city'),
          state: formData.get('state'),
          country: formData.get('country'),
          postalCode: formData.get('postalCode'),
          timezone: formData.get('timezone'),
          capabilities: shippingCapabilities,
          mainCapabilities: mainCapabilities, // Send main capabilities array for future use
          operatingHours: `${formData.get('openTime')} - ${formData.get('closeTime')}`,
          contacts: [
            {
              name: formData.get('contactName1'),
              email: formData.get('contactEmail1'),
              phone: formData.get('contactPhone1'),
              extension: formData.get('contactExt1'),
              isPrimary: true
            },
            ...(formData.get('contactName2') ? [{
              name: formData.get('contactName2'),
              email: formData.get('contactEmail2'),
              phone: formData.get('contactPhone2'),
              extension: formData.get('contactExt2'),
              isPrimary: false
            }] : []),
            ...(formData.get('contactName3') ? [{
              name: formData.get('contactName3'),
              email: formData.get('contactEmail3'),
              phone: formData.get('contactPhone3'),
              extension: formData.get('contactExt3'),
              isPrimary: false
            }] : [])
          ].filter(contact => contact.name && contact.email), // Only include contacts with name and email
          maxPalletHeight: parseInt(formData.get('maxPalletHeight') as string) || 0,
          maxPalletWeight: parseInt(formData.get('maxPalletWeight') as string) || 0,
          loadingDockCount: parseInt(formData.get('loadingDockCount') as string) || 0,
          storageCapacity: parseInt(formData.get('storageCapacity') as string) || 0,
          notes: formData.get('notes'),
        }),
      });

      if (response.ok) {
        mutateWarehouses();
        setShowCreateModal(false);
      } else {
        const errorData = await response.json();
        alert(`Failed to create warehouse: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating warehouse:', error);
      alert('Failed to create warehouse');
    }
    setIsLoading(false);
  };

  const handleDeleteWarehouse = async (warehouseId: string) => {
    if (confirm('Are you sure you want to delete this warehouse? This action cannot be undone.')) {
      try {
        const response = await fetch(`/api/inventory/warehouses/${warehouseId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          mutateWarehouses();
        } else {
          const errorData = await response.json();
          alert(`Failed to delete warehouse: ${errorData.error || 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error deleting warehouse:', error);
        alert('Failed to delete warehouse');
      }
    }
  };

  // Filter warehouses based on search and type
  const filteredWarehouses = warehouses?.filter(warehouse => {
    const matchesSearch = warehouse.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         warehouse.warehouseCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         warehouse.city.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || warehouse.type === typeFilter;
    return matchesSearch && matchesType;
  }) || [];

  const getTypeColor = (type: string) => {
    const colors = {
      'warehouse': 'bg-blue-100 text-blue-800',
      'distribution_center': 'bg-green-100 text-green-800',
      'fulfillment_center': 'bg-purple-100 text-purple-800',
      'cross_dock': 'bg-yellow-100 text-yellow-800',
      'manufacturing': 'bg-red-100 text-red-800',
      'cold_storage': 'bg-cyan-100 text-cyan-800',
      'hazmat_storage': 'bg-orange-100 text-orange-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getCapabilityBadges = (capabilities: any) => {
    const badges = [];
    if (capabilities.airFreight) badges.push({ label: '✈️ Air', color: 'bg-sky-100 text-sky-800' });
    if (capabilities.seaFreight) badges.push({ label: '🚢 Sea', color: 'bg-blue-100 text-blue-800' });
    if (capabilities.truckLoading) badges.push({ label: '🚛 Truck', color: 'bg-green-100 text-green-800' });
    if (capabilities.railAccess) badges.push({ label: '🚂 Rail', color: 'bg-purple-100 text-purple-800' });
    if (capabilities.coldStorage) badges.push({ label: '❄️ Cold', color: 'bg-cyan-100 text-cyan-800' });
    if (capabilities.hazmatHandling) badges.push({ label: '⚠️ Hazmat', color: 'bg-orange-100 text-orange-800' });
    return badges;
  };

  return (
    <div className="flex-1 p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <SemanticBDIIcon semantic="sites" size={32} />
            <div>
              <h1 className="text-3xl font-bold">Warehouses</h1>
              <p className="text-muted-foreground">Manage warehouse locations and shipping capabilities</p>
            </div>
          </div>
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setShowCreateModal(true)}>
            <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
            Add Warehouse
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by warehouse name, code, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="type-filter">Type:</Label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Types</option>
            <option value="warehouse">Warehouse</option>
            <option value="distribution_center">Distribution Center</option>
            <option value="fulfillment_center">Fulfillment Center</option>
            <option value="cross_dock">Cross Dock</option>
            <option value="manufacturing">Manufacturing</option>
          </select>
        </div>
      </div>

      {/* Warehouses List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SemanticBDIIcon semantic="sites" size={20} />
            <span>Warehouses ({filteredWarehouses.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredWarehouses.length === 0 ? (
            <div className="text-center py-12">
              <SemanticBDIIcon semantic="sites" size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Warehouses</h3>
              <p className="text-muted-foreground mb-4">Add your first warehouse to start managing shipping locations</p>
              <Button onClick={() => setShowCreateModal(true)}>
                <SemanticBDIIcon semantic="plus" size={16} className="mr-2" />
                Add First Warehouse
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredWarehouses.map((warehouse) => (
                <div key={warehouse.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-lg">{warehouse.name}</h3>
                        <Badge className="bg-indigo-100 text-indigo-800">
                          {warehouse.warehouseCode}
                        </Badge>
                        {/* Display primary type badge */}
                        <Badge className={getTypeColor(warehouse.type)}>
                          {warehouse.type.replace('_', ' ')}
                        </Badge>
                        
                        {/* Display additional capabilities as badges */}
                        {warehouse.capabilities && typeof warehouse.capabilities === 'object' && (
                          <>
                            {warehouse.capabilities.airFreight && (
                              <Badge className="bg-sky-100 text-sky-800">✈️ Air</Badge>
                            )}
                            {warehouse.capabilities.seaFreight && (
                              <Badge className="bg-blue-100 text-blue-800">🚢 Sea</Badge>
                            )}
                            {warehouse.capabilities.truckLoading && (
                              <Badge className="bg-gray-100 text-gray-800">🚛 Truck</Badge>
                            )}
                            {warehouse.capabilities.railAccess && (
                              <Badge className="bg-amber-100 text-amber-800">🚂 Rail</Badge>
                            )}
                            {warehouse.capabilities.coldStorage && (
                              <Badge className="bg-cyan-100 text-cyan-800">❄️ Cold</Badge>
                            )}
                            {warehouse.capabilities.hazmatHandling && (
                              <Badge className="bg-orange-100 text-orange-800">⚠️ Hazmat</Badge>
                            )}
                          </>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-500">Location:</span>
                          <p className="font-medium">{warehouse.city}, {warehouse.state}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Contact:</span>
                          <p className="font-medium">
                            {warehouse.contacts && Array.isArray(warehouse.contacts) && warehouse.contacts.length > 0 
                              ? warehouse.contacts.find(c => c.isPrimary)?.name || warehouse.contacts[0]?.name || warehouse.contactName
                              : warehouse.contactName || 'No contact info'
                            }
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Max Pallet:</span>
                          <p className="font-medium">{warehouse.maxPalletHeight}cm / {warehouse.maxPalletWeight}kg</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Docks:</span>
                          <p className="font-medium">{warehouse.loadingDockCount} loading docks</p>
                        </div>
                      </div>
                      
                      {/* Shipping Capabilities */}
                      <div className="bg-indigo-50 p-3 rounded-md border border-indigo-200 mb-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <SemanticBDIIcon semantic="shipping" size={14} className="text-indigo-600" />
                          <span className="text-indigo-800 font-medium text-sm">Shipping Capabilities:</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {getCapabilityBadges(warehouse.capabilities).map((badge, index) => (
                            <Badge key={index} className={`${badge.color} text-xs`}>
                              {badge.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm">
                        <div>
                          <span className="text-gray-500">Storage:</span>
                          <span className="font-medium text-indigo-600">{warehouse.storageCapacity.toLocaleString()} m²</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Hours:</span>
                          <span className="font-medium">{warehouse.operatingHours}</span>
                        </div>
                      </div>
                      {warehouse.notes && (
                        <p className="text-sm text-gray-600 mt-2">{warehouse.notes}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedWarehouse(warehouse)}>
                        <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteWarehouse(warehouse.id)}
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

      {/* Create Warehouse Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <SemanticBDIIcon semantic="sites" size={20} className="mr-2" />
              Create Warehouse
            </DialogTitle>
          </DialogHeader>
          <form className="space-y-12 p-8" onSubmit={(e) => {
            e.preventDefault();
            handleCreateWarehouse(new FormData(e.currentTarget));
          }}>
            
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="warehouseCode">Warehouse Code *</Label>
                <Input
                  id="warehouseCode"
                  name="warehouseCode"
                  placeholder="e.g., WHB-SH-01"
                  required
                  className="mt-1"
                />
                <div className="mt-1 text-xs text-gray-600">
                  Unique identifier for this warehouse
                </div>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="name">Warehouse Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Shanghai Distribution Center"
                  required
                  className="mt-1"
                />
              </div>
            </div>

            {/* Warehouse Capabilities - Full Width Professional Layout */}
            <div className="space-y-6">
              <div>
                <Label className="text-lg font-medium text-gray-900">Warehouse Capabilities *</Label>
                <p className="text-sm text-gray-600 mt-1">Select all capabilities this warehouse provides</p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Main Warehouse Capabilities */}
                <div className="p-6 bg-indigo-50 border border-indigo-200 rounded-lg">
                  <h4 className="text-base font-medium text-indigo-800 mb-4 flex items-center">
                    🏢 Warehouse Operations
                  </h4>
                  <div className="space-y-3">
                    {[
                      { value: 'warehouse', label: 'General Warehouse' },
                      { value: 'distribution_center', label: 'Distribution Center' },
                      { value: 'fulfillment_center', label: 'Fulfillment Center' },
                      { value: 'cross_dock', label: 'Cross Dock' },
                      { value: 'manufacturing', label: 'Manufacturing' },
                      { value: 'cold_storage', label: 'Cold Storage' }
                    ].map((capability) => (
                      <div key={capability.value} className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id={capability.value}
                          name="mainCapabilities"
                          value={capability.value}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <label 
                          htmlFor={capability.value}
                          className="text-sm font-medium text-gray-700 cursor-pointer"
                        >
                          {capability.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Shipping Capabilities */}
                <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-base font-medium text-blue-800 mb-4 flex items-center">
                    🚚 Shipping Capabilities
                  </h4>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="airFreight"
                        name="airFreight"
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="airFreight" className="text-sm font-medium text-gray-700 cursor-pointer">
                        ✈️ Air Freight
                      </label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="seaFreight"
                        name="seaFreight"
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="seaFreight" className="text-sm font-medium text-gray-700 cursor-pointer">
                        🚢 Sea Freight
                      </label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="truckLoading"
                        name="truckLoading"
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="truckLoading" className="text-sm font-medium text-gray-700 cursor-pointer">
                        🚛 Truck Loading
                      </label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="railAccess"
                        name="railAccess"
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="railAccess" className="text-sm font-medium text-gray-700 cursor-pointer">
                        🚂 Rail Access
                      </label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="hazmatHandling"
                        name="hazmatHandling"
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="hazmatHandling" className="text-sm font-medium text-gray-700 cursor-pointer">
                        ⚠️ Hazmat Handling
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Location Information */}
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-10">
              <div className="md:col-span-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  name="address"
                  placeholder="Street address"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  name="city"
                  placeholder="City"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="state">State/Province</Label>
                <Input
                  id="state"
                  name="state"
                  placeholder="State/Province"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="country">Country *</Label>
                <Input
                  id="country"
                  name="country"
                  placeholder="Country"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="postalCode">Postal Code</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  placeholder="Postal code"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Contact Information - Multiple Contacts */}
            <div className="space-y-6">
              <div>
                <Label className="text-lg font-medium text-gray-900">Contact Information</Label>
                <p className="text-sm text-gray-600 mt-1">Primary contact is required. Add additional contacts as needed.</p>
              </div>
              
              <div className="space-y-4">
                {/* Primary Contact (Required) */}
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="text-base font-medium text-green-800 mb-4">📞 Primary Contact (Required)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="contactName1">Contact Name *</Label>
                      <Input
                        id="contactName1"
                        name="contactName1"
                        placeholder="John Smith"
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contactEmail1">Contact Email *</Label>
                      <Input
                        id="contactEmail1"
                        name="contactEmail1"
                        type="email"
                        placeholder="john@company.com"
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contactPhone1">Phone Number</Label>
                      <Input
                        id="contactPhone1"
                        name="contactPhone1"
                        placeholder="+1 (555) 123-4567"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contactExt1">Extension</Label>
                      <Input
                        id="contactExt1"
                        name="contactExt1"
                        placeholder="1234"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Contact 2 (Optional) */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="text-base font-medium text-gray-700 mb-4">📞 Additional Contact 2 (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="contactName2">Contact Name</Label>
                      <Input
                        id="contactName2"
                        name="contactName2"
                        placeholder="Jane Doe"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contactEmail2">Contact Email</Label>
                      <Input
                        id="contactEmail2"
                        name="contactEmail2"
                        type="email"
                        placeholder="jane@company.com"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contactPhone2">Phone Number</Label>
                      <Input
                        id="contactPhone2"
                        name="contactPhone2"
                        placeholder="+1 (555) 123-4567"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contactExt2">Extension</Label>
                      <Input
                        id="contactExt2"
                        name="contactExt2"
                        placeholder="5678"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                {/* Additional Contact 3 (Optional) */}
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="text-base font-medium text-gray-700 mb-4">📞 Additional Contact 3 (Optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="contactName3">Contact Name</Label>
                      <Input
                        id="contactName3"
                        name="contactName3"
                        placeholder="Bob Wilson"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contactEmail3">Contact Email</Label>
                      <Input
                        id="contactEmail3"
                        name="contactEmail3"
                        type="email"
                        placeholder="bob@company.com"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contactPhone3">Phone Number</Label>
                      <Input
                        id="contactPhone3"
                        name="contactPhone3"
                        placeholder="+1 (555) 123-4567"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contactExt3">Extension</Label>
                      <Input
                        id="contactExt3"
                        name="contactExt3"
                        placeholder="9012"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Operating Hours with Time Picker */}
            <div className="space-y-4">
              <Label className="text-lg font-medium text-gray-900">Operating Hours</Label>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="openTime">Opening Time</Label>
                  <select
                    id="openTime"
                    name="openTime"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
                  >
                    <option value="">Select Opening Time</option>
                    {Array.from({ length: 96 }, (_, i) => {
                      const hours = Math.floor(i / 4);
                      const minutes = (i % 4) * 15;
                      const time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                      const displayTime = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      });
                      return (
                        <option key={time} value={time}>{displayTime}</option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <Label htmlFor="closeTime">Closing Time</Label>
                  <select
                    id="closeTime"
                    name="closeTime"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
                  >
                    <option value="">Select Closing Time</option>
                    {Array.from({ length: 96 }, (_, i) => {
                      const hours = Math.floor(i / 4);
                      const minutes = (i % 4) * 15;
                      const time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                      const displayTime = new Date(`2000-01-01T${time}`).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      });
                      return (
                        <option key={time} value={time}>{displayTime}</option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  name="timezone"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                  <option value="Europe/London">London Time</option>
                  <option value="Asia/Shanghai">Shanghai Time</option>
                  <option value="Asia/Tokyo">Tokyo Time</option>
                </select>
              </div>
            </div>

            {/* Document Upload */}
            <div className="space-y-4">
              <div>
                <Label className="text-lg font-medium text-gray-900">Warehouse Documents</Label>
                <p className="text-sm text-gray-600 mt-1">Upload contracts, certifications, and other warehouse-specific documents</p>
              </div>
              
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
                <SemanticBDIIcon semantic="upload" size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-lg font-medium text-gray-700 mb-2">Drop warehouse documents here</p>
                <p className="text-sm text-gray-500 mb-4">or click to browse files</p>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  className="hidden"
                  id="warehouseDocuments"
                  name="warehouseDocuments"
                />
                <label
                  htmlFor="warehouseDocuments"
                  className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer"
                >
                  <SemanticBDIIcon semantic="upload" size={16} className="mr-2" />
                  Choose Files
                </label>
                <p className="text-xs text-gray-400 mt-2">PDF, DOC, XLS, PNG, JPG files up to 5MB each</p>
              </div>
            </div>

            {/* Physical Specifications */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <Label htmlFor="maxPalletHeight">Max Pallet Height (cm)</Label>
                <Input
                  id="maxPalletHeight"
                  name="maxPalletHeight"
                  type="number"
                  placeholder="180"
                  className="mt-1"
                />
                <div className="mt-1 text-xs text-gray-600">
                  Maximum pallet height for shipping
                </div>
              </div>
              <div>
                <Label htmlFor="maxPalletWeight">Max Pallet Weight (kg)</Label>
                <Input
                  id="maxPalletWeight"
                  name="maxPalletWeight"
                  type="number"
                  placeholder="1000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="loadingDockCount">Loading Docks</Label>
                <Input
                  id="loadingDockCount"
                  name="loadingDockCount"
                  type="number"
                  placeholder="4"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="storageCapacity">Storage Capacity (m²)</Label>
                <Input
                  id="storageCapacity"
                  name="storageCapacity"
                  type="number"
                  placeholder="5000"
                  className="mt-1"
                />
              </div>
            </div>


            <div className="mb-6">
              <Label htmlFor="notes">Notes & Special Information</Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
                placeholder="Special handling capabilities, restrictions, or additional information"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700">
                {isLoading ? 'Creating...' : 'Create Warehouse'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Warehouse Modal */}
      <Dialog open={!!selectedWarehouse} onOpenChange={() => setSelectedWarehouse(null)}>
        <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
          <DialogHeader>
            <DialogTitle>Edit Warehouse: {selectedWarehouse?.name}</DialogTitle>
          </DialogHeader>
          {selectedWarehouse && (
            <form className="space-y-12 p-8" onSubmit={(e) => {
              e.preventDefault();
              handleEditWarehouse(new FormData(e.currentTarget));
            }}>
              
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label htmlFor="editWarehouseCode">Warehouse Code *</Label>
                  <Input
                    id="editWarehouseCode"
                    name="warehouseCode"
                    defaultValue={selectedWarehouse.warehouseCode}
                    required
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="editName">Warehouse Name *</Label>
                  <Input
                    id="editName"
                    name="name"
                    defaultValue={selectedWarehouse.name}
                    required
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Warehouse Capabilities */}
              <div className="space-y-6">
                <div>
                  <Label className="text-lg font-medium text-gray-900">Warehouse Capabilities *</Label>
                  <p className="text-sm text-gray-600 mt-1">Select all capabilities this warehouse provides</p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Main Warehouse Capabilities */}
                  <div className="p-6 bg-indigo-50 border border-indigo-200 rounded-lg">
                    <h4 className="text-base font-medium text-indigo-800 mb-4">🏢 Warehouse Operations</h4>
                    <div className="space-y-3">
                      {[
                        { value: 'warehouse', label: 'General Warehouse' },
                        { value: 'distribution_center', label: 'Distribution Center' },
                        { value: 'fulfillment_center', label: 'Fulfillment Center' },
                        { value: 'cross_dock', label: 'Cross Dock' },
                        { value: 'manufacturing', label: 'Manufacturing' },
                        { value: 'cold_storage', label: 'Cold Storage' }
                      ].map((capability) => (
                        <div key={capability.value} className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id={`edit-${capability.value}`}
                            name="mainCapabilities"
                            value={capability.value}
                            defaultChecked={selectedWarehouse.mainCapabilities?.includes(capability.value) || selectedWarehouse.type === capability.value}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                          />
                          <label 
                            htmlFor={`edit-${capability.value}`}
                            className="text-sm font-medium text-gray-700 cursor-pointer"
                          >
                            {capability.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Shipping Capabilities */}
                  <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="text-base font-medium text-blue-800 mb-4">🚚 Shipping Capabilities</h4>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="edit-airFreight"
                          name="airFreight"
                          defaultChecked={selectedWarehouse.capabilities?.airFreight}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="edit-airFreight" className="text-sm font-medium text-gray-700 cursor-pointer">
                          ✈️ Air Freight
                        </label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="edit-seaFreight"
                          name="seaFreight"
                          defaultChecked={selectedWarehouse.capabilities?.seaFreight}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="edit-seaFreight" className="text-sm font-medium text-gray-700 cursor-pointer">
                          🚢 Sea Freight
                        </label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="edit-truckLoading"
                          name="truckLoading"
                          defaultChecked={selectedWarehouse.capabilities?.truckLoading}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="edit-truckLoading" className="text-sm font-medium text-gray-700 cursor-pointer">
                          🚛 Truck Loading
                        </label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="edit-railAccess"
                          name="railAccess"
                          defaultChecked={selectedWarehouse.capabilities?.railAccess}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="edit-railAccess" className="text-sm font-medium text-gray-700 cursor-pointer">
                          🚂 Rail Access
                        </label>
                      </div>
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id="edit-hazmatHandling"
                          name="hazmatHandling"
                          defaultChecked={selectedWarehouse.capabilities?.hazmatHandling}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <label htmlFor="edit-hazmatHandling" className="text-sm font-medium text-gray-700 cursor-pointer">
                          ⚠️ Hazmat Handling
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Location Information */}
              <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-10">
                <div className="md:col-span-2">
                  <Label htmlFor="editAddress">Address *</Label>
                  <Input
                    id="editAddress"
                    name="address"
                    defaultValue={selectedWarehouse.address}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="editCity">City *</Label>
                  <Input
                    id="editCity"
                    name="city"
                    defaultValue={selectedWarehouse.city}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="editState">State/Province</Label>
                  <Input
                    id="editState"
                    name="state"
                    defaultValue={selectedWarehouse.state || ''}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="editCountry">Country *</Label>
                  <Input
                    id="editCountry"
                    name="country"
                    defaultValue={selectedWarehouse.country}
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="editPostalCode">Postal Code</Label>
                  <Input
                    id="editPostalCode"
                    name="postalCode"
                    defaultValue={selectedWarehouse.postalCode || ''}
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Contact Information - Dynamic Contacts */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-lg font-medium text-gray-900">Contact Information</Label>
                    <p className="text-sm text-gray-600 mt-1">Manage all contacts for this warehouse</p>
                  </div>
                  {(!selectedWarehouse?.contacts || selectedWarehouse.contacts.length < 2) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowExtraContact(true)}
                      className="text-green-600 border-green-300 hover:bg-green-50"
                    >
                      <SemanticBDIIcon semantic="plus" size={14} className="mr-1" />
                      Add Contact
                    </Button>
                  )}
                </div>
                
                {/* Display all existing contacts */}
                {selectedWarehouse.contacts && selectedWarehouse.contacts.length > 0 ? (
                  selectedWarehouse.contacts.map((contact, index) => (
                    <div key={index} className={`p-4 border rounded-lg ${contact.isPrimary ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className={`text-base font-medium ${contact.isPrimary ? 'text-green-800' : 'text-gray-700'}`}>
                          📞 {contact.isPrimary ? 'Primary Contact (Required)' : `Additional Contact ${index}`}
                        </h4>
                        {!contact.isPrimary && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Remove this contact from the selectedWarehouse
                              if (selectedWarehouse) {
                                const updatedContacts = selectedWarehouse.contacts?.filter((_, i) => i !== index) || [];
                                setSelectedWarehouse(prev => prev ? ({
                                  ...prev,
                                  contacts: updatedContacts
                                }) : null);
                              }
                            }}
                            className="text-red-600 border-red-300 hover:bg-red-50"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <Label htmlFor={`editContactName${index + 1}`}>Contact Name {contact.isPrimary ? '*' : ''}</Label>
                          <Input
                            id={`editContactName${index + 1}`}
                            name={`contactName${index + 1}`}
                            defaultValue={contact.name}
                            required={contact.isPrimary}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`editContactEmail${index + 1}`}>Contact Email {contact.isPrimary ? '*' : ''}</Label>
                          <Input
                            id={`editContactEmail${index + 1}`}
                            name={`contactEmail${index + 1}`}
                            type="email"
                            defaultValue={contact.email}
                            required={contact.isPrimary}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`editContactPhone${index + 1}`}>Phone Number</Label>
                          <Input
                            id={`editContactPhone${index + 1}`}
                            name={`contactPhone${index + 1}`}
                            defaultValue={contact.phone || ''}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor={`editContactExt${index + 1}`}>Extension</Label>
                          <Input
                            id={`editContactExt${index + 1}`}
                            name={`contactExt${index + 1}`}
                            defaultValue={contact.extension || ''}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  // Fallback for legacy data
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <h4 className="text-base font-medium text-green-800 mb-4">📞 Primary Contact (Required)</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <Label htmlFor="editContactName1">Contact Name *</Label>
                        <Input
                          id="editContactName1"
                          name="contactName1"
                          defaultValue={selectedWarehouse.contactName || ''}
                          required
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="editContactEmail1">Contact Email *</Label>
                        <Input
                          id="editContactEmail1"
                          name="contactEmail1"
                          type="email"
                          defaultValue={selectedWarehouse.contactEmail || ''}
                          required
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="editContactPhone1">Phone Number</Label>
                        <Input
                          id="editContactPhone1"
                          name="contactPhone1"
                          defaultValue={selectedWarehouse.contactPhone || ''}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="editContactExt1">Extension</Label>
                        <Input
                          id="editContactExt1"
                          name="contactExt1"
                          defaultValue=""
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional Contact Form (Simple) */}
                {showExtraContact && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-base font-medium text-blue-800">📞 New Additional Contact</h4>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowExtraContact(false)}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        Remove
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <Label htmlFor="extraContactName">Contact Name</Label>
                        <Input
                          id="extraContactName"
                          name="contactName3"
                          placeholder="Additional contact name"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="extraContactEmail">Contact Email</Label>
                        <Input
                          id="extraContactEmail"
                          name="contactEmail3"
                          type="email"
                          placeholder="additional@company.com"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="extraContactPhone">Phone Number</Label>
                        <Input
                          id="extraContactPhone"
                          name="contactPhone3"
                          placeholder="+1 (555) 123-4567"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="extraContactExt">Extension</Label>
                        <Input
                          id="extraContactExt"
                          name="contactExt3"
                          placeholder="5678"
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Document Upload */}
              <div className="space-y-4">
                <div>
                  <Label className="text-lg font-medium text-gray-900">Warehouse Documents</Label>
                  <p className="text-sm text-gray-600 mt-1">Upload contracts, certifications, and other warehouse-specific documents</p>
                </div>
                
                {/* Dropzone */}
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    isDragActive 
                      ? 'border-indigo-500 bg-indigo-50' 
                      : 'border-gray-300 hover:border-indigo-400'
                  }`}
                >
                  <input {...getInputProps()} />
                  <SemanticBDIIcon semantic="upload" size={48} className="mx-auto text-gray-400 mb-4" />
                  {isDragActive ? (
                    <p className="text-lg font-medium text-indigo-600">Drop files here...</p>
                  ) : (
                    <>
                      <p className="text-lg font-medium text-gray-700 mb-2">Drop warehouse documents here</p>
                      <p className="text-sm text-gray-500 mb-4">or click to browse files</p>
                      <div className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                        <SemanticBDIIcon semantic="upload" size={16} className="mr-2" />
                        Choose Files
                      </div>
                    </>
                  )}
                  <p className="text-xs text-gray-400 mt-2">PDF, DOC, XLS, PNG, JPG files up to 5MB each</p>
                </div>

                {/* Existing Uploaded Files */}
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-green-700">📁 Existing Files ({uploadedFiles.length})</h5>
                    {uploadedFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-green-50 p-3 rounded-lg border border-green-200">
                        <div className="flex items-center space-x-3">
                          <SemanticBDIIcon semantic="document" size={16} className="text-green-600" />
                          <div>
                            <p className="text-sm font-medium text-green-900">{file.fileName}</p>
                            <p className="text-xs text-green-600">{(file.fileSize / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            try {
                              const fileName = encodeURIComponent(file.fileName);
                              const response = await fetch(`/api/inventory/warehouses/${selectedWarehouse.id}/documents/${fileName}`);
                              if (response.ok) {
                                const result = await response.json();
                                // Create a temporary link and trigger download
                                const link = document.createElement('a');
                                link.href = result.downloadUrl;
                                link.download = file.fileName;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                              } else {
                                alert('Failed to generate download link');
                              }
                            } catch (error) {
                              console.error('Download error:', error);
                              alert('Download failed');
                            }
                          }}
                          className="text-green-600 hover:text-green-700 border-green-300"
                        >
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* File Preview */}
                {warehouseFiles.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-sm font-medium text-gray-900">📤 Files to Upload ({warehouseFiles.length})</h5>
                    {warehouseFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <SemanticBDIIcon semantic="document" size={16} className="text-gray-600" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{file.name}</p>
                            <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-4 pt-6 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedWarehouse(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {isLoading ? 'Updating...' : 'Update Warehouse'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
