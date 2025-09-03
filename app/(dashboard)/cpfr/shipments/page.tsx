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

  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [selectedShipment, setSelectedShipment] = useState<SalesForecast | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');

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
    if (forecast.shippingSignal === 'accepted') completedMilestones = 4;
    
    return { completed: completedMilestones, total: 4 };
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
                              {progress.completed}/{progress.total} milestones completed
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${(progress.completed / progress.total) * 100}%` }}
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
                          style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                        ></div>

                        {/* Milestone 1: Sales */}
                        <div className="flex flex-col items-center space-y-2 relative z-10">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                            forecast.salesSignal === 'accepted' ? 'bg-green-500 border-green-500' :
                            forecast.salesSignal === 'submitted' ? 'bg-blue-500 border-blue-500' :
                            'bg-gray-300 border-gray-300'
                          }`}>
                            <SemanticBDIIcon 
                              semantic="profile" 
                              size={20} 
                              className={
                                forecast.salesSignal === 'accepted' || forecast.salesSignal === 'submitted' 
                                  ? 'text-white' 
                                  : 'text-gray-600'
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
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                            forecast.factorySignal === 'accepted' ? 'bg-green-500 border-green-500' :
                            forecast.factorySignal === 'submitted' ? 'bg-orange-500 border-orange-500' :
                            'bg-gray-300 border-gray-300'
                          }`}>
                            <SemanticBDIIcon 
                              semantic="collaboration" 
                              size={20} 
                              className={
                                forecast.factorySignal === 'accepted' || forecast.factorySignal === 'submitted' 
                                  ? 'text-white' 
                                  : 'text-gray-600'
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
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                            progress.completed >= 3 ? 'bg-blue-500 border-blue-500 text-white' :
                            'bg-gray-300 border-gray-300 text-gray-600'
                          }`}>
                            <span className="text-xl">{shippingIcon}</span>
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-medium text-gray-800">In Transit</p>
                            <p className="text-xs text-gray-600">
                              {milestones.departureDate.toLocaleDateString()}
                            </p>
                            <Badge className={
                              progress.completed >= 3 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                            }>
                              {progress.completed >= 3 ? 'shipping' : 'unknown'}
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
            <DialogTitle>
              Shipment Details: {selectedShipment?.sku.sku}
            </DialogTitle>
          </DialogHeader>
          {selectedShipment && (
            <div className="p-8">
              <p className="text-center text-lg font-semibold text-blue-600 mb-4">
                Detailed shipment management coming next!
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