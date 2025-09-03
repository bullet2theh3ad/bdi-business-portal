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
import { User, ProductSku, Warehouse } from '@/lib/db/schema';

interface UserWithOrganization extends User {
  organization?: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
}

interface SalesForecast {
  id: string;
  skuId: string;
  sku: ProductSku;
  deliveryWeek: string;
  quantity: number;
  status: 'draft' | 'submitted';
  salesSignal: 'unknown' | 'submitted' | 'rejected' | 'accepted';
  factorySignal: 'unknown' | 'submitted' | 'rejected' | 'accepted';
  shippingSignal: 'unknown' | 'submitted' | 'rejected' | 'accepted';
  shippingPreference: string;
  notes?: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ShipmentsPage() {
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  const { data: forecasts } = useSWR<SalesForecast[]>('/api/cpfr/forecasts', fetcher);
  const { data: warehouses } = useSWR<Warehouse[]>('/api/inventory/warehouses', fetcher);
  const { data: skus } = useSWR<ProductSku[]>('/api/admin/skus', fetcher);
  const { data: organizations } = useSWR('/api/admin/organizations?includeInternal=true', fetcher, {
    onError: (error) => {
      // Silently handle 403 errors for non-admin users
      if (error?.status !== 403) {
        console.error('Error fetching organizations:', error);
      }
    }
  });

  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [selectedShipment, setSelectedShipment] = useState<SalesForecast | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  
  // Shipment form state
  const [shipmentForm, setShipmentForm] = useState({
    shippingOrganization: '',
    shipperReference: '',
    unitsPerCarton: 5,
    requestedQuantity: 0,
    notes: '',
    priority: 'standard',
    incoterms: 'EXW',
    pickupLocation: '',
    deliveryLocation: '',
    estimatedShipDate: '',
    requestedDeliveryDate: '',
    overrideDefaults: false
  });
  const [uploadedCostDocs, setUploadedCostDocs] = useState<File[]>([]);
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);
  const [createdShipments, setCreatedShipments] = useState<Map<string, any>>(new Map());

  // Helper function to get default dates from forecast
  const getDefaultDatesFromForecast = (forecast: SalesForecast) => {
    // Always use safe fallback dates to avoid crashes
    const today = new Date();
    const futureDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    
    try {
      if (!forecast?.deliveryWeek || !forecast.deliveryWeek.includes('-W')) {
        throw new Error('Invalid delivery week format');
      }
      
      const deliveryWeek = forecast.deliveryWeek; // e.g., "2025-W47"
      const [yearStr, weekStr] = deliveryWeek.split('-W');
      const year = parseInt(yearStr);
      const week = parseInt(weekStr);
      
      // Validate inputs
      if (isNaN(year) || isNaN(week) || year < 2020 || year > 2030 || week < 1 || week > 53) {
        throw new Error('Invalid year or week values');
      }
      
      // Simple week calculation - use Monday of the specified week
      const jan1 = new Date(year, 0, 1);
      const jan1Day = jan1.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const mondayOfWeek1 = new Date(year, 0, 1 + (1 - jan1Day + 7) % 7);
      const deliveryDate = new Date(mondayOfWeek1.getTime() + (week - 1) * 7 * 24 * 60 * 60 * 1000);
      
      // Validate result
      if (isNaN(deliveryDate.getTime())) {
        throw new Error('Invalid delivery date result');
      }
      
      // Calculate estimated ship date
      const shippingDays = parseInt(forecast.shippingPreference?.split('_')?.pop() || '14');
      const estimatedShipDate = new Date(deliveryDate.getTime() - shippingDays * 24 * 60 * 60 * 1000);
      
      return {
        estimatedShipDate: estimatedShipDate.toISOString().split('T')[0],
        requestedDeliveryDate: deliveryDate.toISOString().split('T')[0]
      };
    } catch (error) {
      console.error('Error calculating default dates from forecast:', forecast?.deliveryWeek, error);
      // Always return safe fallback dates
      return {
        estimatedShipDate: today.toISOString().split('T')[0],
        requestedDeliveryDate: futureDate.toISOString().split('T')[0]
      };
    }
  };

  // Helper function to get default incoterms from forecast shipping preference
  const getDefaultIncoterms = (shippingPreference: string) => {
    if (shippingPreference.includes('SEA')) return 'FOB';
    if (shippingPreference.includes('AIR')) return 'EXW';
    return 'EXW';
  };

  // Helper function to calculate shipping data from SKU
  const calculateShippingData = (sku: ProductSku, requestedQuantity: number, unitsPerCarton: number) => {
    const cartonCount = Math.ceil(requestedQuantity / unitsPerCarton);
    const palletCount = Math.ceil(cartonCount / (sku.boxesPerCarton || 1));
    
    // Dimensions - use actual SKU data (no placeholders)
    const ctnL = Number(sku.cartonLengthCm) || 0;
    const ctnW = Number(sku.cartonWidthCm) || 0;
    const ctnH = Number(sku.cartonHeightCm) || 0;
    
    // Weights - use actual SKU data (no placeholders)
    const unitNW = Number(sku.boxWeightKg) || 0; // Net Product Weight
    const ctnGW = Number(sku.cartonWeightKg) || 0; // CTN GW
    const unitCtnWeight = unitNW; // Unit/CTN weight
    const palletGW = Number(sku.palletWeightKg) || 0; // Gross Pallet Weight
    
    // Calculate totals (matching your format exactly)
    const totalUnitsWeight = requestedQuantity * unitNW; // Total Weight (kg) - Units
    const totalCartonsWeight = cartonCount * ctnGW; // Total Weight (kg) - Cartons  
    const totalPalletsWeight = palletCount * palletGW; // Total Weight (kg) - Pallet(s)
    const totalShippingWeight = totalUnitsWeight + totalCartonsWeight + totalPalletsWeight;
    
    // Volume calculations (matching your precision)
    const cbmPerCarton = (ctnL * ctnW * ctnH) / 1000000; // CBM per Carton
    const totalCartonVolume = cartonCount * cbmPerCarton; // Total Volume (cbm) - Cartons
    const palletVolumeCbm = ((Number(sku.palletLengthCm) || 0) * (Number(sku.palletWidthCm) || 0) * (Number(sku.palletHeightCm) || 0)) / 1000000;
    const totalPalletVolume = palletCount * palletVolumeCbm; // Total Volume (cbm) - Pallet(s)
    
    return {
      // Basic info
      requestedQuantity,
      unitsPerCarton,
      cartonCount,
      palletCount,
      
      // Dimensions
      ctnL: ctnL.toString(),
      ctnW: ctnW.toString(), 
      ctnH: ctnH.toString(),
      cbmPerCarton: cbmPerCarton.toFixed(8), // Matching your precision: 0.034374375
      
      // Weights (matching your labels exactly)
      unitNW: unitNW.toFixed(3), // Unit NW
      ctnGW: ctnGW.toFixed(3), // CTN GW  
      unitCTN: unitCtnWeight.toFixed(3), // Unit/CTN
      palletGW: palletGW.toFixed(2), // Pallet GW
      
      // Total weights (matching your format)
      totalWeightUnits: totalUnitsWeight.toFixed(0), // 658 kg
      totalWeightCartons: totalCartonsWeight.toFixed(2), // 713.6 kg
      totalWeightPallets: totalPalletsWeight.toFixed(2), // 856.32 kg
      totalShippingWeight: totalShippingWeight.toFixed(2),
      
      // Total volumes (matching your format)
      totalVolumeCartons: totalCartonVolume.toFixed(7), // 3.4374375 cbm
      totalVolumePallets: totalPalletVolume.toFixed(2), // 5.13 cbm
      
      // Additional fields
      totalUnitsInCarton: requestedQuantity,
      totalNumberOfCartons: cartonCount,
      totalNumberOfPallets: palletCount,
      costPerUnitSEA: '$ - USD',
      htsCode: sku.htsCode || 'Not specified'
    };
  };

  // Get shipping/logistics organizations
  const shippingOrganizations = Array.isArray(organizations) 
    ? organizations.filter((org: any) => org.type === 'shipping_logistics')
    : (user?.organization?.type === 'shipping_logistics' ? [user.organization] : []);

  // Handle shipment form submission
  const handleCreateShipment = async () => {
    if (!selectedShipment || !shipmentForm.shippingOrganization) {
      alert('Please select a shipping organization');
      return;
    }

    setIsCreatingShipment(true);
    try {
      const response = await fetch('/api/cpfr/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          forecastId: selectedShipment.id,
          shippingOrganizationCode: shipmentForm.shippingOrganization,
          ...shipmentForm,
          calculatedData: calculateShippingData(
            selectedShipment.sku, 
            shipmentForm.requestedQuantity || selectedShipment.quantity, 
            shipmentForm.unitsPerCarton
          )
        }),
      });

      const result = await response.json();
      if (result.success) {
        // Store the created shipment data
        setCreatedShipments(prev => new Map(prev.set(selectedShipment.id, result.shipment)));
        alert('Shipment created successfully and logged for shipper processing!');
        // Don't reset form or close modal - keep it open to show the saved data
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error creating shipment:', error);
      alert('Failed to create shipment');
    } finally {
      setIsCreatingShipment(false);
    }
  };

  // Export shipment data as CSV (matching your exact format)
  const exportShipmentData = () => {
    if (!selectedShipment) return;
    
    const quantity = shipmentForm.requestedQuantity || selectedShipment.quantity;
    const shippingData = calculateShippingData(selectedShipment.sku, quantity, shipmentForm.unitsPerCarton);
    
    const csvData = [
      ['Field', 'Value', '', 'CTN_L', 'CTN_W', 'CTN_H', 'CBM per Carton'],
      ['Select SKU', selectedShipment.sku.sku, '', shippingData.ctnL, shippingData.ctnW, shippingData.ctnH, shippingData.cbmPerCarton],
      ['Enter Units', `${quantity} units`, '', '', '', '', ''],
      ['Enter Cartons', `${shippingData.cartonCount} cartons`, '', '', '', '', ''],
      ['Units per Carton', shippingData.unitsPerCarton, '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['Unit NW', `${shippingData.unitNW} kg`, 'Net Product Weight', '', '', '', ''],
      ['CTN GW', `${shippingData.ctnGW} kg`, '', '', '', '', ''],
      ['Unit/CTN', `${shippingData.unitCTN} kg`, '', '', '', '', ''],
      ['Pallet GW', `${shippingData.palletGW} kg`, 'Gross Pallet Weight', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      ['Total Weight (kg) - Units', `${shippingData.totalWeightUnits} kg`, '', '', '', '', ''],
      ['Total Weight (kg) - Cartons', `${shippingData.totalWeightCartons} kg`, 'Total Shipping Weight', '', '', '', ''],
      ['Total Weight (kg) - Pallet(s)', `${shippingData.totalWeightPallets} kg`, 'Total Shipping Weight', '', '', '', ''],
      ['Total Volume (cbm) - Cartons', `${shippingData.totalVolumeCartons} cbm`, 'Total Shipping Volume (Cartons Only)', '', '', '', ''],
      ['Total Volume (cbm) - Pallet(s)', `${shippingData.totalVolumePallets} cbm`, 'Total Shipping Volume (Pallet(s))', '', '', '', ''],
      ['Total Units in Carton', `${quantity} units`, '', '', '', '', ''],
      ['Total Number of Cartons', `${shippingData.cartonCount} cartons`, '', '', '', '', ''],
      ['Total Number of Pallets', `${shippingData.palletCount} pallet(s)`, '', '', '', '', ''],
      ['Cost per Unit (SEA)', shippingData.costPerUnitSEA, '', '', '', '', '']
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shipment_${selectedShipment.sku.sku}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Access control
  if (!user || !['super_admin', 'admin', 'operations', 'sales', 'member'].includes(user.role)) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="shipping" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Operations access required for shipment management.</p>
          </div>
        </div>
      </div>
    );
  }

  // Get shipment data from forecasts (Forecasts ARE Shipments!)
  // Show ALL forecasts - drafts will show 0/4 milestones, submitted will show progress
  const shipmentForecasts = forecasts || [];

  // Helper functions for timeline calculations
  const getShippingIcon = (shippingMethod: string) => {
    if (shippingMethod.includes('SEA')) return '🚢';
    if (shippingMethod.includes('AIR')) return '✈️';
    if (shippingMethod.includes('TRUCK')) return '🚛';
    return '📦';
  };

  const calculateMilestoneDates = (forecast: SalesForecast) => {
    // Parse delivery week (e.g., "2025-W47" to actual date)
    const [year, week] = forecast.deliveryWeek.split('-W').map(Number);
    const deliveryDate = new Date(year, 0, 1 + (week - 1) * 7);
    
    // Extract shipping days from shipping preference (e.g., "SEA_ASIA_US_WEST" or "AIR_14_DAYS")
    let shippingDays = 7; // Default
    
    if (forecast.shippingPreference.includes('SEA')) {
      shippingDays = 21; // Sea freight default
    } else if (forecast.shippingPreference.includes('AIR')) {
      // Extract days from AIR_X_DAYS format
      const airMatch = forecast.shippingPreference.match(/AIR_(\d+)_DAYS/);
      shippingDays = airMatch ? parseInt(airMatch[1]) : 3;
    } else if (forecast.shippingPreference.includes('TRUCK')) {
      shippingDays = 7; // Truck default
    }
    
    const exwDate = new Date(deliveryDate.getTime() - (shippingDays * 24 * 60 * 60 * 1000));
    const departureDate = new Date(exwDate.getTime() + (2 * 24 * 60 * 60 * 1000)); // 2 days after EXW
    
    return {
      salesDate: new Date(forecast.createdAt),
      exwDate,
      departureDate,
      arrivalDate: deliveryDate,
      transitDays: shippingDays
    };
  };

  const getTimelineProgress = (forecast: SalesForecast) => {
    const milestones = calculateMilestoneDates(forecast);
    const now = new Date();
    
    let completedMilestones = 0;
    
    // Only count as completed if forecast status is 'submitted' (not draft)
    if (forecast.status === 'submitted' && forecast.salesSignal === 'submitted') completedMilestones = 1;
    if (forecast.factorySignal === 'accepted') completedMilestones = 2;
    if (forecast.factorySignal === 'accepted' && now >= milestones.departureDate) completedMilestones = 3;
    
    // Check if shipment has been created for this forecast
    if (createdShipments.has(forecast.id)) {
      // Shipment created - show awaiting status for shipping milestone
      if (completedMilestones >= 2) completedMilestones = 3; // Transport shows "awaiting"
    }
    
    if (forecast.shippingSignal === 'accepted') completedMilestones = 4;
    
    return completedMilestones;
  };

  // Filter shipments
  const filteredShipments = shipmentForecasts.filter(forecast => {
    const sku = skus?.find(s => s.id === forecast.skuId);
    const matchesSearch = forecast.sku?.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         forecast.sku?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'planning' && forecast.shippingSignal === 'unknown') ||
      (statusFilter === 'in_transit' && forecast.shippingSignal === 'submitted') ||
      (statusFilter === 'delivered' && forecast.shippingSignal === 'accepted');
    
    const matchesMethod = methodFilter === 'all' || 
      forecast.shippingPreference.includes(methodFilter);
    
    return matchesSearch && matchesStatus && matchesMethod;
  });

  return (
    <div className="flex-1 p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <SemanticBDIIcon semantic="shipping" size={32} />
            <div>
              <h1 className="text-3xl font-bold">Shipments</h1>
              <p className="text-muted-foreground">Global logistics tracking from forecasts to delivery</p>
            </div>
          </div>
          <div className="flex space-x-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="px-3"
              >
                <SemanticBDIIcon semantic="analytics" size={14} className="mr-2" />
                Timeline
              </Button>
              <Button
                variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('calendar')}
                className="px-3"
              >
                <SemanticBDIIcon semantic="calendar" size={14} className="mr-2" />
                Calendar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <SemanticBDIIcon semantic="forecasts" size={20} className="text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Total Shipments</p>
                <p className="text-2xl font-bold text-blue-600">{shipmentForecasts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <SemanticBDIIcon semantic="shipping" size={20} className="text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">In Transit</p>
                <p className="text-2xl font-bold text-orange-600">
                  {shipmentForecasts.filter(f => f.shippingSignal === 'submitted').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <SemanticBDIIcon semantic="sites" size={20} className="text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Delivered</p>
                <p className="text-2xl font-bold text-green-600">
                  {shipmentForecasts.filter(f => f.shippingSignal === 'accepted').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <SemanticBDIIcon semantic="analytics" size={20} className="text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Total Units</p>
                <p className="text-2xl font-bold text-purple-600">
                  {shipmentForecasts.reduce((sum, f) => sum + f.quantity, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by SKU, product name, or delivery week..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Label htmlFor="status-filter">Status:</Label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="planning">Planning</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="method-filter">Method:</Label>
            <select
              id="method-filter"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Methods</option>
              <option value="SEA">🚢 Sea Freight</option>
              <option value="AIR">✈️ Air Freight</option>
              <option value="TRUCK">🚛 Ground</option>
            </select>
          </div>
        </div>
      </div>

      {/* Shipments List/Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SemanticBDIIcon semantic="shipping" size={20} />
            <span>Shipments Timeline ({filteredShipments.length})</span>
          </CardTitle>
          <CardDescription>
            Shipment tracking from sales forecast through delivery milestones
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredShipments.length === 0 ? (
            <div className="text-center py-12">
              <SemanticBDIIcon semantic="shipping" size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Shipments</h3>
              <p className="text-muted-foreground mb-4">
                Shipments are created from submitted forecasts. Create forecasts to see shipments here.
              </p>
              <Button onClick={() => window.location.href = '/cpfr/forecasts'}>
                <SemanticBDIIcon semantic="forecasts" size={16} className="mr-2" />
                Go to Forecasts
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredShipments.map((forecast) => {
                const milestones = calculateMilestoneDates(forecast);
                const progress = getTimelineProgress(forecast);
                const shippingIcon = getShippingIcon(forecast.shippingPreference);
                
                return (
                  <div key={forecast.id} className="border rounded-lg p-6 hover:bg-gray-50 transition-colors">
                    {/* Shipment Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold text-lg">
                            {forecast.sku.sku} - {forecast.sku.name}
                          </h3>
                          <Badge className="bg-blue-100 text-blue-800">
                            {forecast.quantity.toLocaleString()} units
                          </Badge>
                          <Badge className="bg-purple-100 text-purple-800">
                            {forecast.deliveryWeek}
                          </Badge>
                          <Badge className="bg-cyan-100 text-cyan-800">
                            {shippingIcon} {forecast.shippingPreference}
                          </Badge>
                        </div>
                        
                        {/* Timeline Progress Bar */}
                        <div className="mb-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-sm text-gray-600">Shipment Progress:</span>
                            <span className="text-sm font-medium">
                              {progress}/4 milestones completed
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${(progress / 4) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSelectedShipment(forecast)}
                        >
                          <SemanticBDIIcon semantic="analytics" size={14} className="mr-1" />
                          Details
                        </Button>
                      </div>
                    </div>

                    {/* AWESOME MILESTONE TIMELINE */}
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg border">
                      <div className="flex items-center justify-between relative">
                        {/* Progress Line */}
                        <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-300"></div>
                        <div 
                          className="absolute top-6 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-1000"
                          style={{ width: `${(progress / 4) * 100}%` }}
                        ></div>

                        {/* Milestone 1: Sales */}
                        <div className="flex flex-col items-center space-y-2 relative z-10">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 bg-white ${
                            forecast.salesSignal === 'accepted' ? 'border-green-500' :
                            forecast.salesSignal === 'submitted' ? 'border-blue-500' :
                            'border-gray-300'
                          }`}>
                            <SemanticBDIIcon 
                              semantic="profile" 
                              size={20} 
                              className={
                                forecast.salesSignal === 'accepted' ? 'text-green-600' :
                                forecast.salesSignal === 'submitted' ? 'text-blue-600' :
                                'text-gray-600'
                              } 
                            />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-medium text-gray-800">Sales</p>
                            <p className="text-xs text-gray-600">
                              {milestones.salesDate.toLocaleDateString()}
                            </p>
                            <Badge className={
                              forecast.salesSignal === 'accepted' ? 'bg-green-100 text-green-800' :
                              forecast.salesSignal === 'submitted' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-600'
                            }>
                              {forecast.salesSignal}
                            </Badge>
                          </div>
                        </div>

                        {/* Milestone 2: Factory EXW */}
                        <div className="flex flex-col items-center space-y-2 relative z-10">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 bg-white ${
                            forecast.factorySignal === 'accepted' ? 'border-green-500' :
                            forecast.factorySignal === 'submitted' ? 'border-orange-500' :
                            'border-gray-300'
                          }`}>
                            <SemanticBDIIcon 
                              semantic="collaboration" 
                              size={20} 
                              className={
                                forecast.factorySignal === 'accepted' ? 'text-green-600' :
                                forecast.factorySignal === 'submitted' ? 'text-orange-600' :
                                'text-gray-600'
                              } 
                            />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-medium text-gray-800">Factory EXW</p>
                            <p className="text-xs text-gray-600">
                              {milestones.exwDate.toLocaleDateString()}
                            </p>
                            <Badge className={
                              forecast.factorySignal === 'accepted' ? 'bg-green-100 text-green-800' :
                              forecast.factorySignal === 'submitted' ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-600'
                            }>
                              {forecast.factorySignal}
                            </Badge>
                          </div>
                        </div>

                        {/* Milestone 3: In Transit */}
                        <div className="flex flex-col items-center space-y-2 relative z-10">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 bg-white ${
                            progress >= 3 ? 'border-blue-500' : 'border-gray-300'
                          }`}>
                            <span className={`text-xl ${
                              progress >= 3 ? 'text-blue-600' : 'text-gray-600'
                            }`}>{shippingIcon}</span>
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-medium text-gray-800">In Transit</p>
                            <p className="text-xs text-gray-600">
                              {milestones.departureDate.toLocaleDateString()}
                            </p>
                            <Badge className={
                              progress >= 3 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                            }>
                              {createdShipments.has(forecast.id) && progress >= 3 ? 'quote requested' : (progress >= 3 ? 'shipping' : 'unknown')}
                            </Badge>
                          </div>
                        </div>

                        {/* Milestone 4: Warehouse Arrival */}
                        <div className="flex flex-col items-center space-y-2 relative z-10">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                            forecast.shippingSignal === 'accepted' ? 'bg-green-500 border-green-500' :
                            forecast.shippingSignal === 'submitted' ? 'bg-orange-500 border-orange-500' :
                            'bg-gray-300 border-gray-300'
                          }`}>
                            <SemanticBDIIcon 
                              semantic="sites" 
                              size={20} 
                              className={
                                forecast.shippingSignal === 'accepted' || forecast.shippingSignal === 'submitted' 
                                  ? 'text-white' 
                                  : 'text-gray-600'
                              } 
                            />
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-medium text-gray-800">Warehouse</p>
                            <p className="text-xs text-gray-600">
                              {milestones.arrivalDate.toLocaleDateString()}
                            </p>
                            <Badge className={
                              forecast.shippingSignal === 'accepted' ? 'bg-green-100 text-green-800' :
                              forecast.shippingSignal === 'submitted' ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-600'
                            }>
                              {forecast.shippingSignal}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Shipment Details */}
                      <div className="mt-4 pt-4 border-t border-blue-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Estimated Transit:</span>
                            <p className="font-medium">
                              {milestones.transitDays} days
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Estimated Pallets:</span>
                            <p className="font-medium">
                              {Math.ceil(forecast.quantity / ((forecast.sku.boxesPerCarton || 1) * 40))} pallets
                            </p>
                          </div>
                          <div>
                            <span className="text-gray-600">Estimated Weight:</span>
                            <p className="font-medium">
                              {(Math.ceil(forecast.quantity / ((forecast.sku.boxesPerCarton || 1) * 40)) * (Number(forecast.sku.palletWeightKg) || 500)).toLocaleString()} kg
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shipment Details Modal */}
      <Dialog open={!!selectedShipment} onOpenChange={() => setSelectedShipment(null)}>
        <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-3">
              <SemanticBDIIcon semantic="shipping" size={24} className="text-blue-600" />
              <span>Create Shipment: {selectedShipment?.sku.sku}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedShipment && (
            <div className="p-6 space-y-8">
              {/* Header Info */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-semibold text-blue-800">Forecast Details</Label>
                    <div className="mt-2 space-y-1">
                      <div className="text-sm"><span className="font-medium">SKU:</span> {selectedShipment.sku.sku}</div>
                      <div className="text-sm"><span className="font-medium">Product:</span> {selectedShipment.sku.name}</div>
                      <div className="text-sm"><span className="font-medium">Delivery Week:</span> {selectedShipment.deliveryWeek}</div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-blue-800">Original Forecast</Label>
                    <div className="mt-2 space-y-1">
                      <div className="text-sm"><span className="font-medium">Quantity:</span> {selectedShipment.quantity.toLocaleString()} units</div>
                      <div className="text-sm"><span className="font-medium">Shipping:</span> {selectedShipment.shippingPreference}</div>
                      <div className="text-sm"><span className="font-medium">Status:</span> 
                        <Badge variant={selectedShipment.status === 'submitted' ? 'default' : 'secondary'} className="ml-1">
                          {selectedShipment.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-blue-800">SKU Specifications</Label>
                    <div className="mt-2 space-y-1">
                      <div className="text-sm"><span className="font-medium">HTS Code:</span> {selectedShipment.sku.htsCode || '8517.62.00.10'}</div>
                      <div className="text-sm"><span className="font-medium">Unit Weight:</span> {selectedShipment.sku.boxWeightKg || 0}kg</div>
                      <div className="text-sm"><span className="font-medium">Carton Weight:</span> {selectedShipment.sku.cartonWeightKg || 0}kg</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Shipment Configuration */}
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <SemanticBDIIcon semantic="settings" size={20} className="mr-2 text-blue-600" />
                      Shipment Configuration
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="shippingOrg">Shipping Organization *</Label>
                        <select
                          id="shippingOrg"
                          value={shipmentForm.shippingOrganization}
                          onChange={(e) => setShipmentForm(prev => ({ ...prev, shippingOrganization: e.target.value }))}
                          className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        >
                          <option value="">Select Shipping Partner</option>
                          {Array.isArray(shippingOrganizations) && shippingOrganizations.map((org: any) => (
                            <option key={org.id} value={org.code}>
                              {org.code} - {org.name}
                            </option>
                          ))}
                          {(!Array.isArray(shippingOrganizations) || shippingOrganizations.length === 0) && user?.organization?.type === 'shipping_logistics' && (
                            <option value={user.organization.code}>
                              {user.organization.code} - {user.organization.name}
                            </option>
                          )}
                        </select>
                        <div className="text-xs text-gray-600 mt-1">
                          Select OLM or other approved shipping partner
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="shipperReference">Shipper Reference Number</Label>
                        <Input
                          id="shipperReference"
                          type="text"
                          value={shipmentForm.shipperReference}
                          onChange={(e) => setShipmentForm(prev => ({ ...prev, shipperReference: e.target.value }))}
                          placeholder="Enter shipper's reference number"
                          className="mt-1"
                        />
                        <div className="text-xs text-gray-600 mt-1">
                          Optional reference number from shipping partner
                        </div>
                      </div>

                      {/* Show shipment status if created */}
                      {createdShipments.has(selectedShipment.id) ? (
                        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                          <div className="flex items-center space-x-2 mb-2">
                            <SemanticBDIIcon semantic="check" size={16} className="text-green-600" />
                            <span className="font-semibold text-green-800">Shipment Created Successfully</span>
                          </div>
                          <div className="text-sm text-green-700 space-y-1">
                            <div><strong>Shipment ID:</strong> {createdShipments.get(selectedShipment.id)?.id}</div>
                            <div><strong>Status:</strong> Pending Shipper Confirmation</div>
                            <div><strong>Organization:</strong> {shipmentForm.shippingOrganization}</div>
                            {shipmentForm.shipperReference && (
                              <div><strong>Reference:</strong> {shipmentForm.shipperReference}</div>
                            )}
                            <div className="mt-2 text-xs text-green-600">
                              ✅ Timeline will show "Awaiting" status for shipping milestone
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Basic Configuration */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="requestedQuantity">Requested Quantity</Label>
                              <Input
                                id="requestedQuantity"
                                type="number"
                                value={shipmentForm.requestedQuantity || selectedShipment.quantity}
                                onChange={(e) => setShipmentForm(prev => ({ ...prev, requestedQuantity: parseInt(e.target.value) || 0 }))}
                                placeholder={selectedShipment.quantity.toString()}
                                className="mt-1"
                              />
                              <div className="text-xs text-blue-600 mt-1">Default: {selectedShipment.quantity.toLocaleString()} units (from forecast)</div>
                            </div>
                            <div>
                              <Label htmlFor="unitsPerCarton">Units per Carton</Label>
                              <Input
                                id="unitsPerCarton"
                                type="number"
                                value={shipmentForm.unitsPerCarton}
                                onChange={(e) => setShipmentForm(prev => ({ ...prev, unitsPerCarton: parseInt(e.target.value) || 5 }))}
                                className="mt-1"
                              />
                            </div>
                          </div>

                          <div>
                            <Label htmlFor="priority">Shipment Priority</Label>
                            <select
                              id="priority"
                              value={shipmentForm.priority}
                              onChange={(e) => setShipmentForm(prev => ({ ...prev, priority: e.target.value }))}
                              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="standard">Standard</option>
                              <option value="expedited">Expedited</option>
                              <option value="urgent">Urgent</option>
                            </select>
                          </div>

                          {/* Override Section */}
                          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                            <div className="flex items-center space-x-2 mb-3">
                              <input
                                type="checkbox"
                                id="overrideDefaults"
                                checked={shipmentForm.overrideDefaults}
                                onChange={(e) => setShipmentForm(prev => ({ ...prev, overrideDefaults: e.target.checked }))}
                                className="rounded border-orange-300"
                              />
                              <Label htmlFor="overrideDefaults" className="text-orange-800 font-medium">
                                Override Forecast Defaults
                              </Label>
                            </div>
                            
                            {(() => {
                              const defaults = getDefaultDatesFromForecast(selectedShipment);
                              const defaultIncoterms = getDefaultIncoterms(selectedShipment.shippingPreference);
                              
                              return (
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="incoterms">Incoterms</Label>
                                    <select
                                      id="incoterms"
                                      value={shipmentForm.overrideDefaults ? shipmentForm.incoterms : defaultIncoterms}
                                      onChange={(e) => setShipmentForm(prev => ({ ...prev, incoterms: e.target.value }))}
                                      disabled={!shipmentForm.overrideDefaults}
                                      className={`w-full mt-1 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                        !shipmentForm.overrideDefaults ? 'bg-gray-100 text-gray-600' : 'border-gray-300'
                                      }`}
                                    >
                                      <option value="EXW">EXW - Ex Works</option>
                                      <option value="FOB">FOB - Free on Board</option>
                                      <option value="CIF">CIF - Cost, Insurance & Freight</option>
                                      <option value="DDP">DDP - Delivered Duty Paid</option>
                                    </select>
                                    <div className="text-xs text-orange-600 mt-1">
                                      Default: {defaultIncoterms} (based on {selectedShipment.shippingPreference})
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label htmlFor="estimatedShipDate">Estimated Ship Date</Label>
                                      <Input
                                        id="estimatedShipDate"
                                        type="date"
                                        value={shipmentForm.overrideDefaults ? shipmentForm.estimatedShipDate : defaults.estimatedShipDate}
                                        onChange={(e) => setShipmentForm(prev => ({ ...prev, estimatedShipDate: e.target.value }))}
                                        disabled={!shipmentForm.overrideDefaults}
                                        className={`mt-1 ${!shipmentForm.overrideDefaults ? 'bg-gray-100' : ''}`}
                                      />
                                      <div className="text-xs text-orange-600 mt-1">Default from forecast shipping timeline</div>
                                    </div>
                                    <div>
                                      <Label htmlFor="requestedDeliveryDate">Requested Delivery Date</Label>
                                      <Input
                                        id="requestedDeliveryDate"
                                        type="date"
                                        value={shipmentForm.overrideDefaults ? shipmentForm.requestedDeliveryDate : defaults.requestedDeliveryDate}
                                        onChange={(e) => setShipmentForm(prev => ({ ...prev, requestedDeliveryDate: e.target.value }))}
                                        disabled={!shipmentForm.overrideDefaults}
                                        className={`mt-1 ${!shipmentForm.overrideDefaults ? 'bg-gray-100' : ''}`}
                                      />
                                      <div className="text-xs text-orange-600 mt-1">Default: {selectedShipment.deliveryWeek}</div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          <div>
                            <Label htmlFor="notes">Special Instructions</Label>
                            <textarea
                              id="notes"
                              value={shipmentForm.notes}
                              onChange={(e) => setShipmentForm(prev => ({ ...prev, notes: e.target.value }))}
                              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={3}
                              placeholder="Any special handling instructions or notes for the shipper..."
                            />
                          </div>

                          {/* Cost Estimate Documents */}
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h4 className="font-medium text-gray-800 mb-3 flex items-center">
                              <SemanticBDIIcon semantic="document" size={16} className="mr-2 text-gray-600" />
                              Cost Estimate Documents
                            </h4>
                            
                            <div className="space-y-3">
                              <div>
                                <input
                                  type="file"
                                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                                  multiple
                                  onChange={(e) => {
                                    const files = Array.from(e.target.files || []);
                                    setUploadedCostDocs(prev => [...prev, ...files]);
                                  }}
                                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                />
                                <div className="text-xs text-gray-600 mt-1">
                                  Upload cost estimates, quotes, or shipping documentation
                                </div>
                              </div>
                              
                              {uploadedCostDocs.length > 0 && (
                                <div className="space-y-2">
                                  <h5 className="text-sm font-medium text-gray-700">Files to Upload:</h5>
                                  {uploadedCostDocs.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between bg-white p-2 rounded border">
                                      <div className="flex items-center space-x-2">
                                        <SemanticBDIIcon semantic="document" size={14} className="text-blue-600" />
                                        <span className="text-sm">{file.name}</span>
                                        <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                                      </div>
                                      <button
                                        onClick={() => setUploadedCostDocs(prev => prev.filter((_, i) => i !== index))}
                                        className="text-red-500 hover:text-red-700"
                                      >
                                        <SemanticBDIIcon semantic="close" size={14} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column - Live Calculations */}
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                      <SemanticBDIIcon semantic="calculator" size={20} className="mr-2 text-green-600" />
                      Live Calculated Data
                    </h3>
                    
                    {(() => {
                      const quantity = shipmentForm.requestedQuantity || selectedShipment.quantity;
                      const shippingData = calculateShippingData(selectedShipment.sku, quantity, shipmentForm.unitsPerCarton);
                      
                      return (
                        <div className="space-y-4">
                                                      <div className="bg-blue-50 p-4 rounded-lg">
                            <h4 className="font-semibold text-blue-800 mb-3">📦 Package Summary</h4>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div><span className="font-medium">Total Units:</span> {quantity.toLocaleString()}</div>
                              <div><span className="font-medium">Total Cartons:</span> {shippingData.cartonCount}</div>
                              <div><span className="font-medium">Total Pallets:</span> {shippingData.palletCount}</div>
                              <div><span className="font-medium">Units/Carton:</span> {shippingData.unitsPerCarton}</div>
                            </div>
                            {/* Debug info to see SKU data */}
                            <div className="mt-2 text-xs text-gray-600 bg-white p-2 rounded">
                              <div><strong>Debug - SKU Raw Data:</strong></div>
                              <div>Box: {selectedShipment.sku.boxLengthCm || 'null'}×{selectedShipment.sku.boxWidthCm || 'null'}×{selectedShipment.sku.boxHeightCm || 'null'} cm, {selectedShipment.sku.boxWeightKg || 'null'}kg</div>
                              <div>Carton: {selectedShipment.sku.cartonLengthCm || 'null'}×{selectedShipment.sku.cartonWidthCm || 'null'}×{selectedShipment.sku.cartonHeightCm || 'null'} cm, {selectedShipment.sku.cartonWeightKg || 'null'}kg</div>
                              <div>Pallet: {selectedShipment.sku.palletLengthCm || 'null'}×{selectedShipment.sku.palletWidthCm || 'null'}×{selectedShipment.sku.palletHeightCm || 'null'} cm, {selectedShipment.sku.palletWeightKg || 'null'}kg</div>
                            </div>
                          </div>

                          <div className="bg-green-50 p-4 rounded-lg">
                            <h4 className="font-semibold text-green-800 mb-3">⚖️ Weight Breakdown (kg)</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Unit NW:</span>
                                <span className="font-medium">{shippingData.unitNW} kg</span>
                              </div>
                              <div className="flex justify-between">
                                <span>CTN GW:</span>
                                <span className="font-medium">{shippingData.ctnGW} kg</span>
                              </div>
                              <div className="flex justify-between font-bold text-green-800 text-base border-t pt-2">
                                <span>Total Shipping Weight:</span>
                                <span>{shippingData.totalShippingWeight} kg</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-purple-50 p-4 rounded-lg">
                            <h4 className="font-semibold text-purple-800 mb-3">📐 Volume Breakdown (CBM)</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Dimensions (L×W×H):</span>
                                <span className="font-medium">{shippingData.ctnL}×{shippingData.ctnW}×{shippingData.ctnH} cm</span>
                              </div>
                              <div className="flex justify-between">
                                <span>CBM per Carton:</span>
                                <span className="font-medium">{shippingData.cbmPerCarton}</span>
                              </div>
                              <div className="flex justify-between font-bold text-purple-800 text-base border-t pt-2">
                                <span>Total Volume:</span>
                                <span>{shippingData.totalVolumeCartons} cbm</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-orange-50 p-4 rounded-lg">
                            <h4 className="font-semibold text-orange-800 mb-3">📄 Export Preview</h4>
                            <div className="text-xs font-mono bg-white p-3 rounded border">
                              <div className="text-gray-600">SKU: {selectedShipment.sku.sku}</div>
                              <div>Units: {quantity.toLocaleString()}, Cartons: {shippingData.cartonCount}</div>
                              <div>CBM: {shippingData.cbmPerCarton}, Weight: {shippingData.totalShippingWeight}kg</div>
                              <div className="text-blue-600 mt-2">✅ Ready for CSV export to shipper</div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={exportShipmentData}
                    className="flex items-center space-x-2"
                  >
                    <SemanticBDIIcon semantic="download" size={16} />
                    <span>Export CSV</span>
                  </Button>
                </div>
                
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedShipment(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateShipment}
                    disabled={isCreatingShipment || !shipmentForm.shippingOrganization}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isCreatingShipment ? (
                      <>
                        <SemanticBDIIcon semantic="loading" size={16} className="mr-2 animate-spin" />
                        Creating Shipment...
                      </>
                    ) : (
                      <>
                        <SemanticBDIIcon semantic="shipping" size={16} className="mr-2" />
                        Create Shipment
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}