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
import { useSimpleTranslations, getUserLocale } from '@/lib/i18n/simple-translator';
import { DynamicTranslation } from '@/components/DynamicTranslation';
import { User } from '@/lib/db/schema';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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
  
  // 🌍 Translation hooks
  const userLocale = getUserLocale(user);
  const { tc } = useSimpleTranslations(userLocale);
  
  const { data: warehouses, mutate: mutateWarehouses } = useSWR<Warehouse[]>('/api/inventory/warehouses', fetcher);
  const { data: emgInventoryData, mutate: mutateEmgInventory } = useSWR('/api/inventory/emg-reports', fetcher);
  const { data: catvInventoryData, mutate: mutateCatvInventory } = useSWR('/api/inventory/catv-reports', fetcher);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [warehouseFiles, setWarehouseFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);
  const [showExtraContact, setShowExtraContact] = useState(false);
  
  // EMG Inventory Modal State
  const [showEmgInventoryModal, setShowEmgInventoryModal] = useState(false);
  const [emgFile, setEmgFile] = useState<File | null>(null);
  const [uploadingEmg, setUploadingEmg] = useState(false);
  const [emgUploadResult, setEmgUploadResult] = useState<any>(null);
  const [inventoryChartView, setInventoryChartView] = useState<'current' | 'trends'>('current');

  // CATV Inventory Modal State
  const [showCatvInventoryModal, setShowCatvInventoryModal] = useState(false);
  const [catvFile, setCatvFile] = useState<File | null>(null);
  const [uploadingCatv, setUploadingCatv] = useState(false);
  const [catvUploadResult, setCatvUploadResult] = useState<any>(null);
  const [catvSearchTerm, setCatvSearchTerm] = useState('');

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
  // Ensure warehouses is an array before filtering
  // EMG Inventory Functions
  const handleEmgFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setEmgFile(file);
      setEmgUploadResult(null);
    }
  };

  const handleEmgUpload = async () => {
    if (!emgFile) return;

    setUploadingEmg(true);
    try {
      const formData = new FormData();
      formData.append('file', emgFile);

      const response = await fetch('/api/inventory/emg-reports', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (response.ok) {
        setEmgUploadResult(result);
        setEmgFile(null);
        
        // Refresh EMG inventory data
        mutateEmgInventory();
        
        // Reset file input
        const fileInput = document.getElementById('emg-file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        alert(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      console.error('EMG upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploadingEmg(false);
    }
  };

  const warehousesArray = Array.isArray(warehouses) ? warehouses : [];
  const filteredWarehouses = warehousesArray.filter(warehouse => {
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
    <div className="flex-1 p-3 sm:p-4 lg:p-8 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <SemanticBDIIcon semantic="sites" size={24} className="sm:w-8 sm:h-8" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{tc('warehousesTitle', 'Warehouses')}</h1>
              <p className="text-sm sm:text-base text-muted-foreground">{tc('warehousesDescription', 'Manage warehouse locations and inventory')}</p>
            </div>
          </div>
          <Button className="bg-indigo-600 hover:bg-indigo-700 w-full sm:w-auto" onClick={() => setShowCreateModal(true)}>
            <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
            {tc('addWarehouseButton', 'Add Warehouse')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder={tc('searchWarehousePlaceholder', 'Search by warehouse name, code, or city...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="type-filter">{tc('type', 'Type')}:</Label>
          <select
            id="type-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">{tc('allTypes', 'All Types')}</option>
            <option value="warehouse">{tc('warehouse', 'Warehouse')}</option>
            <option value="distribution_center">{tc('distributionCenter', 'Distribution Center')}</option>
            <option value="fulfillment_center">{tc('fulfillmentCenter', 'Fulfillment Center')}</option>
            <option value="cross_dock">{tc('crossDock', 'Cross Dock')}</option>
            <option value="manufacturing">{tc('manufacturing', 'Manufacturing')}</option>
          </select>
        </div>
      </div>

      {/* Warehouses List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SemanticBDIIcon semantic="sites" size={20} />
            <span>{tc('warehousesTitle', 'Warehouses')} ({filteredWarehouses.length})</span>
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
                <div key={warehouse.id} className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col space-y-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col space-y-2 mb-3">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-base sm:text-lg break-words">
                            <DynamicTranslation userLanguage={userLocale} context="business">
                              {warehouse.name}
                            </DynamicTranslation>
                          </h3>
                          <Badge className="bg-indigo-100 text-indigo-800 text-xs">
                            {warehouse.warehouseCode}
                          </Badge>
                          <Badge className={`${getTypeColor(warehouse.type)} text-xs`}>
                            {warehouse.type.replace('_', ' ')}
                          </Badge>
                        </div>
                        
                        {/* Display additional capabilities as badges - Mobile optimized */}
                        {warehouse.capabilities && typeof warehouse.capabilities === 'object' && (
                          <div className="flex flex-wrap gap-1">
                            {warehouse.capabilities.airFreight && (
                              <Badge className="bg-sky-100 text-sky-800 text-xs">✈️ <span className="hidden sm:inline">Air</span></Badge>
                            )}
                            {warehouse.capabilities.seaFreight && (
                              <Badge className="bg-blue-100 text-blue-800 text-xs">🚢 <span className="hidden sm:inline">Sea</span></Badge>
                            )}
                            {warehouse.capabilities.truckLoading && (
                              <Badge className="bg-gray-100 text-gray-800 text-xs">🚛 <span className="hidden sm:inline">Truck</span></Badge>
                            )}
                            {warehouse.capabilities.railAccess && (
                              <Badge className="bg-amber-100 text-amber-800 text-xs">🚂 <span className="hidden sm:inline">Rail</span></Badge>
                            )}
                            {warehouse.capabilities.coldStorage && (
                              <Badge className="bg-cyan-100 text-cyan-800 text-xs">❄️ <span className="hidden sm:inline">Cold</span></Badge>
                            )}
                            {warehouse.capabilities.hazmatHandling && (
                              <Badge className="bg-orange-100 text-orange-800 text-xs">⚠️ <span className="hidden sm:inline">Hazmat</span></Badge>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 text-sm mb-3">
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
                    <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedWarehouse(warehouse)} className="w-full sm:w-auto">
                        <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                        {tc('editButton', 'Edit')}
                      </Button>
                      {warehouse.warehouseCode === 'EMG' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setShowEmgInventoryModal(true)}
                          className="w-full sm:w-auto bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                        >
                          <SemanticBDIIcon semantic="analytics" size={14} className="mr-1" />
                          Inventory
                        </Button>
                      )}
                      {warehouse.warehouseCode === 'CAT' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setShowCatvInventoryModal(true)}
                          className="w-full sm:w-auto bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                        >
                          <SemanticBDIIcon semantic="analytics" size={14} className="mr-1" />
                          Inventory
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteWarehouse(warehouse.id)}
                        className="w-full sm:w-auto text-red-600 hover:text-red-700 hover:border-red-300"
                      >
                        <span className="mr-1 text-sm">🗑️</span>
                        {tc('deleteButton', 'Delete')}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
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
                <Label htmlFor="name">{tc('formLabels.name', 'Name')} *</Label>
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
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-6 xl:gap-10">
              <div className="md:col-span-2">
                <Label htmlFor="address">{tc('formLabels.shippingAddress', 'Address')} *</Label>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                    <div>
                      <Label htmlFor="contactName1">{tc('formLabels.contactPerson', 'Contact Person')} *</Label>
                      <Input
                        id="contactName1"
                        name="contactName1"
                        placeholder="John Smith"
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="contactEmail1">{tc('formLabels.email', 'Email')} *</Label>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
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
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 lg:gap-6 xl:gap-10">
                <div className="md:col-span-2">
                  <Label htmlFor="editAddress">{tc('formLabels.shippingAddress', 'Address')} *</Label>
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
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

      {/* EMG Inventory Modal */}
      <Dialog open={showEmgInventoryModal} onOpenChange={setShowEmgInventoryModal}>
        <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SemanticBDIIcon semantic="analytics" size={20} />
              EMG Warehouse Inventory
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 p-4 sm:p-6 lg:p-8">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <SemanticBDIIcon semantic="plus" size={16} />
                      Upload Inventory Report
                    </CardTitle>
                    <CardDescription>
                      Upload CSV files with format: BOUNDLESS DEVICES, INC-Inventory Report.csv
                    </CardDescription>
                  </div>
                  {emgInventoryData?.data?.currentInventory?.length > 0 && (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Last Updated</div>
                      <div className="text-sm font-medium">
                        {new Date(emgInventoryData.data.currentInventory[0]?.lastUpdated || emgInventoryData.data.currentInventory[0]?.uploadDate).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      id="emg-file-upload"
                      type="file"
                      accept=".csv"
                      onChange={handleEmgFileSelect}
                      disabled={uploadingEmg}
                    />
                  </div>
                  <Button
                    onClick={handleEmgUpload}
                    disabled={!emgFile || uploadingEmg}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {uploadingEmg ? (
                      <>
                        <SemanticBDIIcon semantic="sync" size={16} className="mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <SemanticBDIIcon semantic="plus" size={16} className="mr-2" />
                        Upload Report
                      </>
                    )}
                  </Button>
                </div>

                {emgFile && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <SemanticBDIIcon semantic="analytics" size={16} className="text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">
                        Selected: {emgFile.name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {(emgFile.size / 1024).toFixed(1)} KB
                      </Badge>
                    </div>
                  </div>
                )}

                {emgUploadResult && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-start gap-3">
                      <SemanticBDIIcon semantic="check" size={20} className="text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-green-800 mb-2">
                          Upload Successful!
                        </h4>
                        <div className="text-sm text-green-700 space-y-1">
                          <p><strong>File:</strong> {emgUploadResult.summary?.fileName}</p>
                          <p><strong>Uploaded:</strong> {new Date().toLocaleString()}</p>
                          <p><strong>Total Processed:</strong> {emgUploadResult.summary?.totalProcessed}</p>
                          <p><strong>New Records:</strong> {emgUploadResult.summary?.newRecords}</p>
                          <p><strong>Updated Records:</strong> {emgUploadResult.summary?.updatedRecords}</p>
                          {emgUploadResult.summary?.errors > 0 && (
                            <p><strong>Errors:</strong> {emgUploadResult.summary?.errors}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Inventory Summary */}
            {emgInventoryData?.data?.summary && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <SemanticBDIIcon semantic="inventory_analytics" size={20} />
                    Inventory Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <div className="text-center p-4 sm:p-6 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="text-xl sm:text-2xl font-bold text-blue-600 mb-1">
                        {emgInventoryData.data.summary.totalSkus.toLocaleString()}
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-blue-700">Total SKUs</div>
                    </div>
                    <div className="text-center p-4 sm:p-6 bg-green-50 rounded-lg border border-green-200">
                      <div className="text-xl sm:text-2xl font-bold text-green-600 mb-1">
                        {emgInventoryData.data.summary.totalOnHand.toLocaleString()}
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-green-700">On Hand</div>
                    </div>
                    <div className="text-center p-4 sm:p-6 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="text-xl sm:text-2xl font-bold text-orange-600 mb-1">
                        {emgInventoryData.data.summary.totalAllocated.toLocaleString()}
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-orange-700">Allocated</div>
                    </div>
                    <div className="text-center p-4 sm:p-6 bg-red-50 rounded-lg border border-red-200">
                      <div className="text-xl sm:text-2xl font-bold text-red-600 mb-1">
                        {emgInventoryData.data.summary.totalBackorder.toLocaleString()}
                      </div>
                      <div className="text-xs sm:text-sm font-medium text-red-700">Backorder</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Charts Section */}
            {emgInventoryData?.data?.currentInventory?.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <SemanticBDIIcon semantic="analytics" size={20} />
                      Inventory Analysis
                    </CardTitle>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        variant={inventoryChartView === 'current' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setInventoryChartView('current')}
                        className="flex-1 sm:flex-none"
                      >
                        Current Levels
                      </Button>
                      <Button
                        variant={inventoryChartView === 'trends' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setInventoryChartView('trends')}
                        className="flex-1 sm:flex-none"
                      >
                        Trends
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {inventoryChartView === 'current' ? (
                    <div className="h-64 sm:h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={emgInventoryData.data.currentInventory.slice(0, 15)} 
                          margin={{ top: 5, right: 5, left: 5, bottom: 60 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="model" 
                            angle={-45}
                            textAnchor="end"
                            height={60}
                            fontSize={9}
                            interval={0}
                          />
                          <YAxis fontSize={10} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#f8fafc', 
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              fontSize: '12px'
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Bar dataKey="qtyOnHand" fill="#10b981" name="On Hand" />
                          <Bar dataKey="qtyAllocated" fill="#f59e0b" name="Allocated" />
                          <Bar dataKey="qtyBackorder" fill="#ef4444" name="Backorder" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-64 sm:h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart 
                          data={emgInventoryData.data.history?.slice(0, 30) || []}
                          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="snapshotDate"
                            tickFormatter={(value) => new Date(value).toLocaleDateString()}
                            fontSize={9}
                          />
                          <YAxis fontSize={10} />
                          <Tooltip 
                            labelFormatter={(value) => new Date(value).toLocaleDateString()}
                            contentStyle={{ 
                              backgroundColor: '#f8fafc', 
                              border: '1px solid #e2e8f0',
                              borderRadius: '8px',
                              fontSize: '12px'
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: '12px' }} />
                          <Line type="monotone" dataKey="qtyOnHand" stroke="#10b981" name="On Hand" strokeWidth={2} />
                          <Line type="monotone" dataKey="qtyAllocated" stroke="#f59e0b" name="Allocated" strokeWidth={2} />
                          <Line type="monotone" dataKey="netStock" stroke="#3b82f6" name="Net Stock" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Current Inventory Table */}
            {emgInventoryData?.data?.currentInventory?.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <SemanticBDIIcon semantic="inventory_items" size={20} />
                    Current Inventory ({emgInventoryData.data.currentInventory.length.toLocaleString()} SKUs)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {emgInventoryData.data.currentInventory.slice(0, 50).map((item: any) => (
                      <div
                        key={item.id}
                        className="p-3 sm:p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {/* Mobile Layout */}
                        <div className="block sm:hidden space-y-2">
                          <div className="font-medium text-sm">
                            {item.model || item.upc}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.description}
                          </div>
                          {(item.location || item.upc) && (
                            <div className="text-xs text-muted-foreground">
                              {item.location && <span>Location: {item.location}</span>}
                              {item.location && item.upc && <span> • </span>}
                              {item.upc && <span>UPC: {item.upc}</span>}
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2 pt-2">
                            <div className="text-center p-2 bg-green-50 rounded">
                              <div className="font-medium text-green-600 text-sm">{item.qtyOnHand || 0}</div>
                              <div className="text-xs text-green-700">On Hand</div>
                            </div>
                            <div className="text-center p-2 bg-orange-50 rounded">
                              <div className="font-medium text-orange-600 text-sm">{item.qtyAllocated || 0}</div>
                              <div className="text-xs text-orange-700">Allocated</div>
                            </div>
                            <div className="text-center p-2 bg-blue-50 rounded">
                              <div className="font-medium text-blue-600 text-sm">{item.netStock || 0}</div>
                              <div className="text-xs text-blue-700">Net</div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Desktop Layout */}
                        <div className="hidden sm:flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {item.model || item.upc}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.description}
                              {item.location && <span> • Location: {item.location}</span>}
                              {item.upc && <span> • UPC: {item.upc}</span>}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-6 text-sm">
                            <div className="text-center">
                              <div className="font-medium text-green-600">{item.qtyOnHand || 0}</div>
                              <div className="text-xs text-muted-foreground">On Hand</div>
                            </div>
                            <div className="text-center">
                              <div className="font-medium text-orange-600">{item.qtyAllocated || 0}</div>
                              <div className="text-xs text-muted-foreground">Allocated</div>
                            </div>
                            <div className="text-center">
                              <div className="font-medium text-blue-600">{item.netStock || 0}</div>
                              <div className="text-xs text-muted-foreground">Net Stock</div>
                            </div>
                            <div className="text-xs text-muted-foreground min-w-[80px]">
                              {item.lastUpdated && new Date(item.lastUpdated).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {emgInventoryData.data.currentInventory.length > 50 && (
                      <div className="text-center pt-4">
                        <p className="text-sm text-muted-foreground">
                          Showing first 50 of {emgInventoryData.data.currentInventory.length.toLocaleString()} items
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {!emgInventoryData?.data?.currentInventory?.length && (
              <div className="text-center py-8">
                <SemanticBDIIcon semantic="inventory_items" size={48} className="mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No inventory data found. Upload a CSV report to get started.</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* CATV Inventory Modal */}
      <Dialog open={showCatvInventoryModal} onOpenChange={setShowCatvInventoryModal}>
        <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }} aria-describedby="catv-inventory-description">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SemanticBDIIcon semantic="analytics" size={20} />
              CATV Warehouse Inventory
            </DialogTitle>
            <div id="catv-inventory-description" className="sr-only">
              Upload and manage CATV warehouse inventory reports with weekly metrics and detailed unit tracking
            </div>
          </DialogHeader>

          <div className="space-y-6 p-4 sm:p-6 lg:p-8">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <SemanticBDIIcon semantic="plus" size={16} />
                      Upload CATV Inventory Report
                    </CardTitle>
                    <CardDescription>
                      Upload XLS files with 2 tabs: Summary chart (4 metrics by weeks) and Pivot data
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* File Upload Dropzone */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setCatvFile(file);
                    }}
                    className="hidden"
                    id="catv-file-upload"
                  />
                  <label htmlFor="catv-file-upload" className="cursor-pointer">
                    <SemanticBDIIcon semantic="upload" size={32} className="mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      XLS files only • Max 10MB
                    </p>
                  </label>
                </div>

                {catvFile && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <SemanticBDIIcon semantic="document" size={16} />
                        <span className="text-sm font-medium">{catvFile.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(catvFile.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCatvFile(null)}
                      >
                        <span className="text-red-500">✕</span>
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  onClick={async () => {
                    if (!catvFile) {
                      alert('Please select a file first');
                      return;
                    }
                    
                    console.log('🔄 Starting CATV file upload:', catvFile.name);
                    setUploadingCatv(true);
                    
                    try {
                      const formData = new FormData();
                      formData.append('file', catvFile);
                      
                      console.log('📤 Sending file to API...');
                      const response = await fetch('/api/inventory/catv-reports', {
                        method: 'POST',
                        body: formData,
                      });
                      
                      console.log('📥 API response status:', response.status);
                      const result = await response.json();
                      console.log('📊 API result:', result);
                      
                      setCatvUploadResult(result);
                      
                      if (result.success) {
                        setCatvFile(null);
                        setCatvUploadResult(null); // Clear old result
                        mutateCatvInventory(); // Refresh stored data
                        alert('CATV file uploaded successfully!');
                      } else {
                        alert(`Upload failed: ${result.error || 'Unknown error'}`);
                      }
                    } catch (error) {
                      console.error('CATV upload error:', error);
                      alert(`Upload error: ${error}`);
                    } finally {
                      setUploadingCatv(false);
                    }
                  }}
                  disabled={!catvFile || uploadingCatv}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {uploadingCatv ? 'Processing...' : 'Upload & Process CATV Report'}
                </Button>
              </CardContent>
            </Card>

            {/* CATV Inventory Display */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SemanticBDIIcon semantic="analytics" size={16} />
                  CATV Inventory Metrics
                </CardTitle>
                <CardDescription>
                  4 Key Metrics: Received (IN), RMA Units (OUT), Shipped to EMG (OUT), WIP (IN HOUSE)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(catvInventoryData?.data?.pivotData?.length > 0 || catvUploadResult?.success) ? (
                  <div className="space-y-6">
                    {/* File Upload Success Info */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-green-800">
                        <SemanticBDIIcon semantic="check" size={16} />
                        <span className="font-medium">File Processed Successfully</span>
                      </div>
                      <div className="mt-2 text-sm text-green-700">
                        <p><strong>File:</strong> {catvInventoryData?.data?.fileName || catvUploadResult?.data?.fileName}</p>
                        <p><strong>Last Updated:</strong> {catvInventoryData?.data?.lastUpdated ? new Date(catvInventoryData.data.lastUpdated).toLocaleString() : 'Just now'}</p>
                        <p><strong>Week Range:</strong> {catvInventoryData?.data?.weekNumber || 'Weeks 15-37'}</p>
                        <p><strong>Total Units:</strong> {(catvInventoryData?.data?.pivotData?.length || catvUploadResult?.data?.pivotData?.length || 0).toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Weekly Metrics Chart */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
                      <h3 className="text-lg font-semibold mb-4">CATV Weekly Inventory Metrics</h3>
                      
                      {/* Metrics Summary */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                        <div className="bg-white rounded-lg p-3 sm:p-4 text-center">
                          <div className="text-xl sm:text-2xl font-bold text-green-600">
                            {(catvInventoryData?.data?.metrics?.receivedIn || catvUploadResult?.data?.metrics?.receivedIn || 0).toLocaleString()}
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground">Received (IN)</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 sm:p-4 text-center">
                          <div className="text-xl sm:text-2xl font-bold text-blue-600">
                            {(catvInventoryData?.data?.metrics?.shippedJiraOut || catvUploadResult?.data?.metrics?.shippedJiraOut || 0).toLocaleString()}
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground">RMA Units (OUT)</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 sm:p-4 text-center">
                          <div className="text-xl sm:text-2xl font-bold text-purple-600">
                            {(catvInventoryData?.data?.metrics?.shippedEmgOut || catvUploadResult?.data?.metrics?.shippedEmgOut || 0).toLocaleString()}
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground">Shipped to EMG (OUT)</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 sm:p-4 text-center">
                          <div className="text-xl sm:text-2xl font-bold text-orange-600">
                            {(catvInventoryData?.data?.metrics?.wipInHouse || catvUploadResult?.data?.metrics?.wipInHouse || 0).toLocaleString()}
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground">WIP (In House)</div>
                        </div>
                      </div>

                      {/* Week Range Display */}
                      <div className="bg-white rounded-lg p-4">
                        <h4 className="font-semibold mb-2">Coverage Period</h4>
                        <p className="text-sm text-muted-foreground">
                          <strong>Weeks:</strong> 15-37 (ISO weeks)
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <strong>Total Weeks:</strong> 23 weeks of data
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <strong>Total SKUs:</strong> {catvUploadResult?.data?.totalSkus || catvInventoryData?.data?.totalSkus || 0} unique models
                        </p>
                      </div>
                    </div>

                    {/* SKU Impact Analysis */}
                    {(catvUploadResult?.data?.pivotData?.length > 0 || catvInventoryData?.data?.pivotData?.length > 0) && (
                      <div className="bg-white rounded-lg p-4 sm:p-6">
                        <h3 className="text-lg font-semibold mb-4">SKU Impact Analysis</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          Top performing SKUs by total units processed • Shows most active models for in-house work
                        </p>
                        
                        {/* Vertical Stacked Bar Chart */}
                        <div className="h-80 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={(() => {
                                // Get SKU analysis data from API or generate it from pivot data
                                const skuData = catvUploadResult?.data?.skuAnalysis || catvInventoryData?.data?.skuAnalysis;
                                
                                if (skuData && skuData.length > 0) {
                                  return skuData.slice(0, 8);
                                }
                                
                                // Fallback: Generate SKU analysis from pivot data
                                const pivotData = catvUploadResult?.data?.pivotData || catvInventoryData?.data?.pivotData || [];
                                console.log('📊 Generating SKU analysis from', pivotData.length, 'pivot records');
                                const skuAnalysis: any = {};
                                
                                pivotData.forEach((item: any) => {
                                  const sku = item.modelnumber;
                                  if (!sku) return;
                                  
                                  if (!skuAnalysis[sku]) {
                                    skuAnalysis[sku] = { 
                                      model: sku, 
                                      totalUnits: 0, 
                                      'Received (IN)': 0, 
                                      'RMA Units': 0, 
                                      'Shipped to EMG': 0, 
                                      'WIP (In House)': 0 
                                    };
                                  }
                                  
                                  skuAnalysis[sku].totalUnits++;
                                  
                                  // CORRECT LOGIC: Every unit counts as "Received (IN)" since it was received
                                  skuAnalysis[sku]['Received (IN)']++; // Every unit was received
                                  
                                  // Also track current status
                                  if (item.wip === 1) {
                                    skuAnalysis[sku]['WIP (In House)']++;
                                  }
                                  if (item.shipped_to_emg === 1) {
                                    skuAnalysis[sku]['Shipped to EMG']++;
                                  }
                                  if (item.shipped_to_jira === 1) {
                                    skuAnalysis[sku]['RMA Units']++;
                                  }
                                });
                                
                                return Object.values(skuAnalysis)
                                  .sort((a: any, b: any) => b.totalUnits - a.totalUnits)
                                  .slice(0, 8);
                              })()}
                              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis 
                                dataKey="model" 
                                angle={-45}
                                textAnchor="end"
                                height={80}
                                fontSize={12}
                              />
                              <YAxis fontSize={12} />
                              <Tooltip 
                                formatter={(value: any, name: string, props: any) => {
                                  const totalReceived = props.payload['Received (IN)'] || 0;
                                  const percentage = totalReceived > 0 ? ((value / totalReceived) * 100).toFixed(1) : '0.0';
                                  return [
                                    `${value.toLocaleString()} units (${percentage}%)`,
                                    name
                                  ];
                                }}
                                labelFormatter={(label) => `SKU: ${label}`}
                                contentStyle={{
                                  backgroundColor: 'white',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  padding: '12px'
                                }}
                                labelStyle={{ fontWeight: 'bold', marginBottom: '8px' }}
                              />
                              <Legend 
                                wrapperStyle={{ fontSize: '12px' }}
                              />
                              <Bar dataKey="Received (IN)" stackId="a" fill="#10b981" />
                              <Bar dataKey="RMA Units" stackId="a" fill="#3b82f6" />
                              <Bar dataKey="Shipped to EMG" stackId="a" fill="#8b5cf6" />
                              <Bar dataKey="WIP (In House)" stackId="a" fill="#f59e0b" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        
                        {/* SKU Performance Summary */}
                        <div className="mt-6 space-y-3">
                          <h4 className="font-semibold text-sm">SKU Performance Metrics</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {(() => {
                              // Get the same SKU data for percentage calculations
                              const skuData = catvUploadResult?.data?.skuAnalysis || catvInventoryData?.data?.skuAnalysis;
                              
                              if (skuData && skuData.length > 0) {
                                return skuData.slice(0, 6);
                              }
                              
                              // Fallback: Generate from pivot data
                              const pivotData = catvUploadResult?.data?.pivotData || catvInventoryData?.data?.pivotData || [];
                              const skuAnalysis: any = {};
                              
                              pivotData.forEach((item: any) => {
                                const sku = item.modelnumber;
                                if (!sku) return;
                                
                                if (!skuAnalysis[sku]) {
                                  skuAnalysis[sku] = { model: sku, totalUnits: 0, receivedIn: 0, rmaOut: 0, shippedEmgOut: 0, wipInHouse: 0 };
                                }
                                
                                skuAnalysis[sku].totalUnits++;
                                skuAnalysis[sku].receivedIn++;
                                
                                if (item.wip === 1) skuAnalysis[sku].wipInHouse++;
                                if (item.shipped_to_emg === 1) skuAnalysis[sku].shippedEmgOut++;
                                if (item.shipped_to_jira === 1) skuAnalysis[sku].rmaOut++;
                              });
                              
                              return Object.values(skuAnalysis).sort((a: any, b: any) => b.totalUnits - a.totalUnits).slice(0, 6);
                            })().map((sku: any, index: number) => (
                              <div key={index} className="bg-gray-50 rounded-lg p-3">
                                <div className="font-semibold text-sm mb-2">{sku.model}</div>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span>Total Received:</span>
                                    <span className="font-medium">{(sku.receivedIn || sku['Received (IN)'] || 0).toLocaleString()}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>RMA Rate:</span>
                                    <span className="font-medium text-blue-600">
                                      {((((sku.rmaOut || sku['RMA Units'] || 0) / (sku.receivedIn || sku['Received (IN)'] || 1)) * 100).toFixed(1))}%
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>EMG Shipped:</span>
                                    <span className="font-medium text-purple-600">
                                      {((((sku.shippedEmgOut || sku['Shipped to EMG'] || 0) / (sku.receivedIn || sku['Received (IN)'] || 1)) * 100).toFixed(1))}%
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>WIP Ratio:</span>
                                    <span className="font-medium text-orange-600">
                                      {((((sku.wipInHouse || sku['WIP (In House)'] || 0) / (sku.receivedIn || sku['Received (IN)'] || 1)) * 100).toFixed(1))}%
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ALL UNITS - Scrollable Container */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-md font-semibold">All CATV Units - Live Data</h4>
                        <div className="text-sm text-muted-foreground">
                          {(catvInventoryData?.data?.pivotData?.length || catvUploadResult?.data?.pivotData?.length || 0).toLocaleString()} total units
                        </div>
                      </div>
                      
                      {/* Search Input */}
                      <div className="flex items-center space-x-2">
                        <SemanticBDIIcon semantic="search" size={16} className="text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search by serial number, model, line item, or date..."
                          value={catvSearchTerm}
                          onChange={(e) => setCatvSearchTerm(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {catvSearchTerm && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCatvSearchTerm('')}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            ✕
                          </Button>
                        )}
                      </div>

                      {/* ALL UNITS - Mobile-First Design */}
                      <div className="bg-white border rounded-lg overflow-hidden">
                        <div className="max-h-96 overflow-y-auto">
                          {/* Mobile Card View */}
                          <div className="block sm:hidden">
                            <div className="space-y-2 p-3">
                              {(catvInventoryData?.data?.pivotData || catvUploadResult?.data?.pivotData || []).filter((item: any) => {
                                if (!catvSearchTerm) return true;
                                const searchLower = catvSearchTerm.toLowerCase();
                                return (
                                  item.serialnumber?.toLowerCase().includes(searchLower) ||
                                  item.modelnumber?.toLowerCase().includes(searchLower) ||
                                  item.lineitem?.toString().includes(searchLower) ||
                                  item.datestamp?.toLowerCase().includes(searchLower)
                                );
                              }).map((item: any, index: number) => (
                                <div key={index} className="bg-gray-50 rounded-lg p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="font-semibold text-sm">{item.modelnumber}</div>
                                    <div className="text-xs">
                                      {item.wip === 1 ? (
                                        <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                                          WIP
                                        </span>
                                      ) : item.shipped_to_emg === 1 ? (
                                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded-full text-xs font-medium">
                                          EMG
                                        </span>
                                      ) : item.shipped_to_jira === 1 ? (
                                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                                          RMA
                                        </span>
                                      ) : (
                                        <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium">
                                          PENDING
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    <div><strong>Serial:</strong> {item.serialnumber}</div>
                                    <div><strong>Line Item:</strong> {item.lineitem}</div>
                                    <div className="flex justify-between mt-1">
                                      <span><strong>Week:</strong> {item.iso_yearweek}</span>
                                      <span><strong>Date:</strong> {item.datestamp}</span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Desktop Table View */}
                          <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 sticky top-0 z-10">
                                <tr>
                                  <th className="px-4 py-3 text-left font-medium">Line Item</th>
                                  <th className="px-4 py-3 text-left font-medium">Serial Number</th>
                                  <th className="px-4 py-3 text-left font-medium">Model</th>
                                  <th className="px-4 py-3 text-left font-medium">Week</th>
                                  <th className="px-4 py-3 text-left font-medium">Date</th>
                                  <th className="px-4 py-3 text-left font-medium">EMG Ship</th>
                                  <th className="px-4 py-3 text-left font-medium">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(catvInventoryData?.data?.pivotData || catvUploadResult?.data?.pivotData || []).filter((item: any) => {
                                  if (!catvSearchTerm) return true;
                                  const searchLower = catvSearchTerm.toLowerCase();
                                  return (
                                    item.serialnumber?.toLowerCase().includes(searchLower) ||
                                    item.modelnumber?.toLowerCase().includes(searchLower) ||
                                    item.lineitem?.toString().includes(searchLower) ||
                                    item.datestamp?.toLowerCase().includes(searchLower)
                                  );
                                })?.map((item: any, index: number) => (
                                  <tr key={index} className="border-t hover:bg-gray-50">
                                    <td className="px-4 py-3 font-mono text-sm">{item.lineitem}</td>
                                    <td className="px-4 py-3 font-mono text-sm">{item.serialnumber}</td>
                                    <td className="px-4 py-3 font-semibold">{item.modelnumber}</td>
                                    <td className="px-4 py-3 text-center">{item.iso_yearweek}</td>
                                    <td className="px-4 py-3">{item.datestamp}</td>
                                    <td className="px-4 py-3 text-center">
                                      {item.emg_ship_date || '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                      {item.wip === 1 ? (
                                        <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-xs font-medium">
                                          WIP
                                        </span>
                                      ) : item.shipped_to_emg === 1 ? (
                                        <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-xs font-medium">
                                          EMG
                                        </span>
                                      ) : item.shipped_to_jira === 1 ? (
                                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                                          RMA
                                        </span>
                                      ) : (
                                        <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-medium">
                                          PENDING
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                )) || (
                                  <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                      No pivot data available
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        
                        {/* Scroll Indicator */}
                        <div className="bg-gray-50 px-2 sm:px-4 py-2 border-t text-center">
                          <p className="text-xs text-muted-foreground">
                            📊 Scroll to view all {(catvInventoryData?.data?.pivotData?.length || catvUploadResult?.data?.pivotData?.length || 0).toLocaleString()} units • 
                            Mobile optimized • Shows real work progress
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <SemanticBDIIcon semantic="inventory_items" size={48} className="mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No CATV inventory data found. Upload an XLS report to get started.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
