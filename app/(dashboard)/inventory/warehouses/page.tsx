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

  const handleCreateWarehouse = async (formData: FormData) => {
    setIsLoading(true);
    try {
      // Collect selected capabilities from checkboxes
      const selectedCapabilities = formData.getAll('capabilities') as string[];
      
      // Collect other capabilities (existing checkboxes)
      const additionalCapabilities = {
        airFreight: formData.get('airFreight') === 'on',
        seaFreight: formData.get('seaFreight') === 'on',
        truckLoading: formData.get('truckLoading') === 'on',
        railAccess: formData.get('railAccess') === 'on',
        coldStorage: formData.get('coldStorage') === 'on',
        hazmatHandling: formData.get('hazmatHandling') === 'on',
      };

      const response = await fetch('/api/inventory/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseCode: formData.get('warehouseCode'),
          name: formData.get('name'),
          capabilities: selectedCapabilities, // Send array of selected capabilities
          address: formData.get('address'),
          city: formData.get('city'),
          state: formData.get('state'),
          country: formData.get('country'),
          postalCode: formData.get('postalCode'),
          timezone: formData.get('timezone'),
          additionalCapabilities,
          operatingHours: formData.get('operatingHours'),
          contactName: formData.get('contactName'),
          contactEmail: formData.get('contactEmail'),
          contactPhone: formData.get('contactPhone'),
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
                        {/* Display multiple capabilities as badges */}
                        {Array.isArray(warehouse.capabilities) ? (
                          warehouse.capabilities.map((capability: string, index: number) => (
                            <Badge key={index} className={getTypeColor(capability)}>
                              {capability.replace('_', ' ')}
                            </Badge>
                          ))
                        ) : (
                          <Badge className={getTypeColor(warehouse.capabilities || 'warehouse')}>
                            {(warehouse.capabilities || 'warehouse').replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-500">Location:</span>
                          <p className="font-medium">{warehouse.city}, {warehouse.state}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Contact:</span>
                          <p className="font-medium">{warehouse.contactName}</p>
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
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-6 gap-10">
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
              <div>
                <Label htmlFor="name">Warehouse Name *</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g., Shanghai Distribution Center"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="capabilities">Warehouse Capabilities *</Label>
                <div className="mt-1 space-y-2 p-3 border border-gray-300 rounded-md">
                  <p className="text-sm text-gray-600 mb-3">Select all capabilities this warehouse provides:</p>
                  
                  {[
                    { value: 'warehouse', label: 'Warehouse' },
                    { value: 'distribution_center', label: 'Distribution Center' },
                    { value: 'fulfillment_center', label: 'Fulfillment Center' },
                    { value: 'cross_dock', label: 'Cross Dock' },
                    { value: 'manufacturing', label: 'Manufacturing' },
                    { value: 'cold_storage', label: 'Cold Storage' },
                    { value: 'hazmat_storage', label: 'Hazmat Storage' }
                  ].map((capability) => (
                    <div key={capability.value} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={`capability-${capability.value}`}
                        name="capabilities"
                        value={capability.value}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                      <label 
                        htmlFor={`capability-${capability.value}`}
                        className="text-sm font-medium text-gray-700 cursor-pointer"
                      >
                        {capability.label}
                      </label>
                    </div>
                  ))}
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

            {/* Shipping Capabilities */}
            <div className="bg-indigo-50 p-6 rounded-lg border border-indigo-200">
              <h4 className="font-semibold text-indigo-800 mb-4 flex items-center">
                <SemanticBDIIcon semantic="shipping" size={16} className="mr-2" />
                Shipping Capabilities
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <label className="flex items-center space-x-2">
                  <input type="checkbox" name="airFreight" className="rounded border-gray-300" />
                  <span className="text-sm">✈️ Air Freight</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" name="seaFreight" className="rounded border-gray-300" />
                  <span className="text-sm">🚢 Sea Freight</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" name="truckLoading" className="rounded border-gray-300" />
                  <span className="text-sm">🚛 Truck Loading</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" name="railAccess" className="rounded border-gray-300" />
                  <span className="text-sm">🚂 Rail Access</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" name="coldStorage" className="rounded border-gray-300" />
                  <span className="text-sm">❄️ Cold Storage</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input type="checkbox" name="hazmatHandling" className="rounded border-gray-300" />
                  <span className="text-sm">⚠️ Hazmat Handling</span>
                </label>
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

            {/* Contact Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="contactName">Contact Name</Label>
                <Input
                  id="contactName"
                  name="contactName"
                  placeholder="Warehouse manager name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  placeholder="manager@warehouse.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  name="contactPhone"
                  placeholder="+1 555 123 4567"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="operatingHours">Operating Hours</Label>
                <Input
                  id="operatingHours"
                  name="operatingHours"
                  placeholder="8:00 AM - 6:00 PM UTC+8"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  name="timezone"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-1"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time (EST/EDT)</option>
                  <option value="America/Chicago">Central Time (CST/CDT)</option>
                  <option value="America/Denver">Mountain Time (MST/MDT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PST/PDT)</option>
                  <option value="Asia/Shanghai">China Standard Time</option>
                  <option value="Asia/Tokyo">Japan Standard Time</option>
                  <option value="Europe/London">Greenwich Mean Time</option>
                  <option value="Europe/Berlin">Central European Time</option>
                </select>
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

      {/* Edit Warehouse Modal - Placeholder for now */}
      <Dialog open={!!selectedWarehouse} onOpenChange={() => setSelectedWarehouse(null)}>
        <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
          <DialogHeader>
            <DialogTitle>Edit Warehouse: {selectedWarehouse?.name}</DialogTitle>
          </DialogHeader>
          {selectedWarehouse && (
            <div className="p-8">
              <p className="text-center text-lg font-semibold text-indigo-600 mb-4">
                Edit functionality will be implemented in the next update.
              </p>
              <div className="flex justify-center">
                <Button onClick={() => setSelectedWarehouse(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
