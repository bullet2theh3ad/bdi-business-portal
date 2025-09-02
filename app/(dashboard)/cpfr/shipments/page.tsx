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
  salesSignal: 'submitted' | 'accepted';
  factorySignal: 'awaiting' | 'accepted';
  shippingSignal: 'unknown' | 'awaiting' | 'accepted' | 'rejected';
  shippingPreference: string;
  notes?: string;
}

interface Shipment {
  id: string;
  shipmentNumber: string;
  forecastId?: string; // Link to originating forecast
  
  // Shipping Details
  origin: {
    warehouseId: string;
    warehouse?: Warehouse;
    customLocation?: string;
  };
  destination: {
    warehouseId?: string;
    warehouse?: Warehouse;
    customLocation: string;
    country: string;
    port?: string;
  };
  
  // Logistics
  shippingMethod: 'AIR_EXPRESS' | 'AIR_STANDARD' | 'SEA_FCL' | 'SEA_LCL' | 'TRUCK' | 'RAIL' | 'INTERMODAL';
  containerType: '20ft' | '40ft' | '40ft_HC' | '45ft' | 'AIR_ULD' | 'TRUCK_TRAILER';
  incoterms: string;
  incotermsLocation: string;
  
  // Container Details
  containerDetails: {
    containerNumber?: string;
    sealNumber?: string;
    weight: number; // kg
    volume: number; // m³
    palletCount: number;
    utilization: number; // percentage
  };
  
  // Customs & Compliance
  customsInfo: {
    htsCode: string;
    commercialValue: number;
    customsBroker?: string;
    importLicense?: string;
    specialPermits?: string[];
    cbpFiling?: string; // For USA imports
    euEori?: string; // For EU imports
  };
  
  // Timeline
  estimatedDeparture: string;
  estimatedArrival: string;
  actualDeparture?: string;
  actualArrival?: string;
  
  // Status
  status: 'planning' | 'booked' | 'in_transit' | 'customs_clearance' | 'delivered' | 'delayed' | 'cancelled';
  trackingNumber?: string;
  
  // Line Items (from forecasts)
  lineItems: Array<{
    skuId: string;
    sku: ProductSku;
    quantity: number;
    palletCount: number;
    weight: number; // kg
    volume: number; // m³
    htsCode: string;
    unitValue: number;
    totalValue: number;
  }>;
  
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ShipmentsPage() {
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  const { data: shipments, mutate: mutateShipments } = useSWR<Shipment[]>('/api/cpfr/shipments', fetcher);
  const { data: forecasts } = useSWR<SalesForecast[]>('/api/cpfr/forecasts', fetcher);
  const { data: warehouses } = useSWR<Warehouse[]>('/api/inventory/warehouses', fetcher);
  const { data: skus } = useSWR<ProductSku[]>('/api/admin/skus', fetcher);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showForecastConversion, setShowForecastConversion] = useState(false);
  const [selectedForecast, setSelectedForecast] = useState<SalesForecast | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');

  // Access control - Operations and admin can manage Shipments
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

  // Get ready-to-ship forecasts (factory accepted, shipping awaiting)
  const readyToShipForecasts = forecasts?.filter(f => 
    f.salesSignal === 'accepted' && 
    f.factorySignal === 'accepted' && 
    f.shippingSignal === 'awaiting'
  ) || [];

  const getStatusColor = (status: string) => {
    const colors = {
      'planning': 'bg-gray-100 text-gray-800',
      'booked': 'bg-blue-100 text-blue-800',
      'in_transit': 'bg-purple-100 text-purple-800',
      'customs_clearance': 'bg-yellow-100 text-yellow-800',
      'delivered': 'bg-green-100 text-green-800',
      'delayed': 'bg-orange-100 text-orange-800',
      'cancelled': 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getMethodIcon = (method: string) => {
    const icons = {
      'AIR_EXPRESS': '✈️',
      'AIR_STANDARD': '🛩️',
      'SEA_FCL': '🚢',
      'SEA_LCL': '⛵',
      'TRUCK': '🚛',
      'RAIL': '🚂',
      'INTERMODAL': '🔄'
    };
    return icons[method as keyof typeof icons] || '📦';
  };

  const getDestinationFlag = (country: string) => {
    const flags = {
      'USA': '🇺🇸',
      'Austria': '🇦🇹',
      'Germany': '🇩🇪',
      'China': '🇨🇳',
      'Japan': '🇯🇵',
      'UK': '🇬🇧',
      'France': '🇫🇷',
      'Canada': '🇨🇦'
    };
    return flags[country as keyof typeof flags] || '🌍';
  };

  // Calculate container utilization from SKU pallet data
  const calculateContainerOptimization = (lineItems: any[], containerType: string) => {
    if (!lineItems.length) return { palletCount: 0, utilization: 0, weight: 0, volume: 0 };

    let totalPallets = 0;
    let totalWeight = 0;
    let totalVolume = 0;

    lineItems.forEach(item => {
      const sku = skus?.find(s => s.id === item.skuId);
      if (sku) {
        // Calculate pallets needed based on boxes per carton and cartons per pallet
        const cartonsNeeded = Math.ceil(item.quantity / (sku.boxesPerCarton || 1));
        const palletsNeeded = Math.ceil(cartonsNeeded / 40); // Assume 40 cartons per pallet
        
        totalPallets += palletsNeeded;
        totalWeight += palletsNeeded * (Number(sku.palletWeightKg) || 500);
        totalVolume += palletsNeeded * 1.44; // Standard pallet volume m³
      }
    });

    // Container capacity limits
    const containerLimits = {
      '20ft': { maxPallets: 10, maxWeight: 28000, maxVolume: 33 },
      '40ft': { maxPallets: 20, maxWeight: 28000, maxVolume: 67 },
      '40ft_HC': { maxPallets: 24, maxWeight: 28000, maxVolume: 76 },
      '45ft': { maxPallets: 26, maxWeight: 28000, maxVolume: 86 }
    };

    const limits = containerLimits[containerType as keyof typeof containerLimits] || containerLimits['40ft'];
    const utilization = Math.max(
      (totalPallets / limits.maxPallets) * 100,
      (totalWeight / limits.maxWeight) * 100,
      (totalVolume / limits.maxVolume) * 100
    );

    return {
      palletCount: totalPallets,
      utilization: Math.min(utilization, 100),
      weight: totalWeight,
      volume: totalVolume
    };
  };

  // Filter shipments
  const filteredShipments = shipments?.filter(shipment => {
    const matchesSearch = shipment.shipmentNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         shipment.destination.country.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || shipment.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || shipment.shippingMethod === methodFilter;
    return matchesSearch && matchesStatus && matchesMethod;
  }) || [];

  return (
    <div className="flex-1 p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <SemanticBDIIcon semantic="shipping" size={32} />
            <div>
              <h1 className="text-3xl font-bold">Shipments</h1>
              <p className="text-muted-foreground">Global logistics and container management</p>
            </div>
          </div>
          <div className="flex space-x-3">
            <Button 
              variant="outline" 
              className="bg-green-100 hover:bg-green-200 text-green-700 border-green-300"
              onClick={() => setShowForecastConversion(true)}
              disabled={readyToShipForecasts.length === 0}
            >
              <SemanticBDIIcon semantic="forecasts" size={16} className="mr-2" />
              Convert Forecasts ({readyToShipForecasts.length})
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowCreateModal(true)}>
              <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
              Create Shipment
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <SemanticBDIIcon semantic="forecasts" size={20} className="text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Ready to Ship</p>
                <p className="text-2xl font-bold text-green-600">{readyToShipForecasts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <SemanticBDIIcon semantic="shipping" size={20} className="text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Active Shipments</p>
                <p className="text-2xl font-bold text-blue-600">{shipments?.filter(s => ['booked', 'in_transit', 'customs_clearance'].includes(s.status)).length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <SemanticBDIIcon semantic="analytics" size={20} className="text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">In Customs</p>
                <p className="text-2xl font-bold text-yellow-600">{shipments?.filter(s => s.status === 'customs_clearance').length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <SemanticBDIIcon semantic="collaboration" size={20} className="text-emerald-600" />
              <div>
                <p className="text-sm text-gray-600">Delivered</p>
                <p className="text-2xl font-bold text-emerald-600">{shipments?.filter(s => s.status === 'delivered').length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by shipment number, destination country, or tracking..."
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
              <option value="booked">Booked</option>
              <option value="in_transit">In Transit</option>
              <option value="customs_clearance">Customs</option>
              <option value="delivered">Delivered</option>
              <option value="delayed">Delayed</option>
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
              <option value="AIR_EXPRESS">✈️ Air Express</option>
              <option value="AIR_STANDARD">🛩️ Air Standard</option>
              <option value="SEA_FCL">🚢 Sea FCL</option>
              <option value="SEA_LCL">⛵ Sea LCL</option>
              <option value="TRUCK">🚛 Truck</option>
              <option value="INTERMODAL">🔄 Intermodal</option>
            </select>
          </div>
        </div>
      </div>

      {/* Shipments List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SemanticBDIIcon semantic="shipping" size={20} />
            <span>Shipments ({filteredShipments.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredShipments.length === 0 ? (
            <div className="text-center py-12">
              <SemanticBDIIcon semantic="shipping" size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Shipments</h3>
              <p className="text-muted-foreground mb-4">
                {readyToShipForecasts.length > 0 
                  ? `Convert ${readyToShipForecasts.length} ready forecasts into shipments`
                  : 'Create your first shipment or convert forecasts into shipments'
                }
              </p>
              <div className="flex justify-center space-x-3">
                {readyToShipForecasts.length > 0 && (
                  <Button 
                    onClick={() => setShowForecastConversion(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <SemanticBDIIcon semantic="forecasts" size={16} className="mr-2" />
                    Convert {readyToShipForecasts.length} Forecasts
                  </Button>
                )}
                <Button onClick={() => setShowCreateModal(true)}>
                  <SemanticBDIIcon semantic="plus" size={16} className="mr-2" />
                  Create Manual Shipment
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredShipments.map((shipment) => (
                <div key={shipment.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-lg">Shipment #{shipment.shipmentNumber}</h3>
                        <Badge className={getStatusColor(shipment.status)}>
                          {shipment.status.replace('_', ' ')}
                        </Badge>
                        <Badge className="bg-blue-100 text-blue-800">
                          {getMethodIcon(shipment.shippingMethod)} {shipment.shippingMethod.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-gray-500">Route:</span>
                          <p className="font-medium">
                            {shipment.origin.warehouse?.city || 'Origin'} → {getDestinationFlag(shipment.destination.country)} {shipment.destination.customLocation}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-500">Container:</span>
                          <p className="font-medium">{shipment.containerType} ({shipment.containerDetails.palletCount} pallets)</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Departure:</span>
                          <p className="font-medium">{new Date(shipment.estimatedDeparture).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Arrival:</span>
                          <p className="font-medium">{new Date(shipment.estimatedArrival).toLocaleDateString()}</p>
                        </div>
                      </div>
                      
                      {/* Container Details */}
                      <div className="bg-blue-50 p-3 rounded-md border border-blue-200 mb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <SemanticBDIIcon semantic="inventory" size={14} className="text-blue-600" />
                              <span className="text-blue-800 font-medium text-sm">Container:</span>
                              <span className="text-blue-700 text-sm">{shipment.containerDetails.weight.toLocaleString()} kg</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="text-blue-800 font-medium text-sm">Utilization:</span>
                              <span className="text-blue-700 text-sm">{shipment.containerDetails.utilization.toFixed(1)}%</span>
                            </div>
                          </div>
                          <div className="text-xs text-blue-600">
                            {shipment.incoterms} {shipment.incotermsLocation}
                          </div>
                        </div>
                      </div>

                      {/* Customs Info */}
                      {shipment.customsInfo.htsCode && (
                        <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200 mb-3">
                          <div className="flex items-center space-x-4 text-sm">
                            <div>
                              <span className="text-yellow-800 font-medium">HTS:</span>
                              <span className="text-yellow-700 ml-1">{shipment.customsInfo.htsCode}</span>
                            </div>
                            <div>
                              <span className="text-yellow-800 font-medium">Value:</span>
                              <span className="text-yellow-700 ml-1">${shipment.customsInfo.commercialValue.toLocaleString()}</span>
                            </div>
                            {shipment.customsInfo.cbpFiling && (
                              <div>
                                <span className="text-yellow-800 font-medium">CBP:</span>
                                <span className="text-yellow-700 ml-1">{shipment.customsInfo.cbpFiling}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {shipment.trackingNumber && (
                        <div className="text-sm">
                          <span className="text-gray-500">Tracking:</span>
                          <span className="font-mono text-blue-600 ml-1">{shipment.trackingNumber}</span>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedShipment(shipment)}>
                        <SemanticBDIIcon semantic="analytics" size={14} className="mr-1" />
                        Track
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setSelectedShipment(shipment)}>
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

      {/* Forecast Conversion Modal */}
      <Dialog open={showForecastConversion} onOpenChange={setShowForecastConversion}>
        <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <SemanticBDIIcon semantic="forecasts" size={20} className="mr-2" />
              Convert Forecasts to Shipments
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-8 space-y-6">
            <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border">
              <h3 className="text-xl font-bold text-gray-800 mb-4">🚢 Forecast-to-Shipment Conversion</h3>
              <p className="text-gray-700 mb-4">
                Convert approved forecasts into optimized shipping containers with flexible line item splitting.
              </p>
              
              {readyToShipForecasts.length === 0 ? (
                <div className="text-center py-8">
                  <SemanticBDIIcon semantic="forecasts" size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-600">No forecasts ready for shipping conversion.</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Forecasts need: Sales ✅ → Factory ✅ → Shipping ⏳ status
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {readyToShipForecasts.map((forecast) => (
                    <div key={forecast.id} className="bg-white p-4 rounded border border-green-200">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h4 className="font-semibold">{forecast.sku.sku} - {forecast.sku.name}</h4>
                            <Badge className="bg-green-100 text-green-800">
                              {forecast.quantity.toLocaleString()} units
                            </Badge>
                            <Badge className="bg-blue-100 text-blue-800">
                              {forecast.deliveryWeek}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Shipping:</span>
                              <span className="font-medium ml-1">{forecast.shippingPreference}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Pallets Needed:</span>
                              <span className="font-medium ml-1">
                                {Math.ceil(forecast.quantity / ((forecast.sku.boxesPerCarton || 1) * 40))} pallets
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Est. Weight:</span>
                              <span className="font-medium ml-1">
                                {(Math.ceil(forecast.quantity / ((forecast.sku.boxesPerCarton || 1) * 40)) * (Number(forecast.sku.palletWeightKg) || 500)).toLocaleString()} kg
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedForecast(forecast);
                            // This would open the shipment creation modal with pre-filled data
                          }}
                          className="bg-blue-100 hover:bg-blue-200 text-blue-700 border-blue-300"
                        >
                          <SemanticBDIIcon semantic="shipping" size={14} className="mr-1" />
                          Create Shipment
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 p-8 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowForecastConversion(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Shipment Modal - Placeholder */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
          <DialogHeader>
            <DialogTitle>Create Manual Shipment</DialogTitle>
          </DialogHeader>
          <div className="p-8">
            <p className="text-center text-lg font-semibold text-blue-600 mb-4">
              Manual shipment creation will be implemented next.
            </p>
            <div className="flex justify-center">
              <Button onClick={() => setShowCreateModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Shipment Details Modal - Placeholder */}
      <Dialog open={!!selectedShipment} onOpenChange={() => setSelectedShipment(null)}>
        <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
          <DialogHeader>
            <DialogTitle>Shipment Details: {selectedShipment?.shipmentNumber}</DialogTitle>
          </DialogHeader>
          {selectedShipment && (
            <div className="p-8">
              <p className="text-center text-lg font-semibold text-blue-600 mb-4">
                Detailed shipment tracking and editing will be implemented next.
              </p>
              <div className="flex justify-center">
                <Button onClick={() => setSelectedShipment(null)}>
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
