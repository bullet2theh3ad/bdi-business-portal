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
import { User, ProductSku } from '@/lib/db/schema';

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
  terms: string;
  totalValue: number;
  createdBy: string;
  createdAt: string;
}

interface SalesForecast {
  id: string;
  skuId: string;
  sku: ProductSku;
  purchaseOrderId?: string; // Link to PO
  purchaseOrder?: PurchaseOrder;
  deliveryWeek: string; // ISO week format: 2025-W12
  quantity: number;
  confidence: 'low' | 'medium' | 'high';
  shippingPreference: string; // AIR_EXPRESS, SEA_STANDARD, etc.
  notes?: string;
  createdBy: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SalesForecastsPage() {
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  const { data: skus } = useSWR<ProductSku[]>('/api/admin/skus', fetcher);
  const { data: forecasts, mutate: mutateForecasts } = useSWR<SalesForecast[]>('/api/cpfr/forecasts', fetcher);
  const { data: purchaseOrders } = useSWR<PurchaseOrder[]>('/api/cpfr/purchase-orders', fetcher);
  const { data: inventoryData } = useSWR('/api/cpfr/inventory/availability', fetcher);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSku, setSelectedSku] = useState<ProductSku | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState<string>('');
  const [quantityError, setQuantityError] = useState<string>('');
  const [moqOverride, setMoqOverride] = useState<boolean>(false);
  const [leadTimeOption, setLeadTimeOption] = useState<'mp_ready' | 'normal' | 'custom'>('normal');
  const [customLeadTime, setCustomLeadTime] = useState<number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customDate, setCustomDate] = useState<string>('');
  const [confidenceLevel, setConfidenceLevel] = useState<'part_of_po' | 'pre_po' | 'planning'>('planning');
  const [forecastQuantity, setForecastQuantity] = useState<number>(0);

  // Helper function to get available quantity for a SKU
  const getAvailableQuantity = (skuId: string) => {
    if (!inventoryData?.availability) return 0;
    return inventoryData.availability[skuId]?.availableQuantity || 0;
  };

  // Helper function to generate CPFR signal based on demand vs availability
  const getCpfrSignal = (skuId: string, demandQuantity: number) => {
    const available = getAvailableQuantity(skuId);
    const ratio = available > 0 ? demandQuantity / available : demandQuantity > 0 ? Infinity : 0;
    
    if (available === 0 && demandQuantity > 0) {
      return { 
        type: 'critical', 
        message: 'No inventory available - Critical shortage!',
        color: 'bg-red-100 border-red-300 text-red-800',
        icon: '🚨'
      };
    } else if (ratio > 1) {
      const shortage = demandQuantity - available;
      return { 
        type: 'shortage', 
        message: `Shortage: Need ${shortage.toLocaleString()} more units`,
        color: 'bg-orange-100 border-orange-300 text-orange-800',
        icon: '⚠️'
      };
    } else if (ratio > 0.8) {
      return { 
        type: 'low', 
        message: 'Low inventory - Monitor closely',
        color: 'bg-yellow-100 border-yellow-300 text-yellow-800',
        icon: '🔶'
      };
    } else if (ratio > 0) {
      return { 
        type: 'adequate', 
        message: 'Adequate inventory available',
        color: 'bg-green-100 border-green-300 text-green-800',
        icon: '✅'
      };
    } else {
      return { 
        type: 'surplus', 
        message: 'Surplus inventory available',
        color: 'bg-blue-100 border-blue-300 text-blue-800',
        icon: '📦'
      };
    }
  };

  // Helper function to get effective lead time based on selected option
  const getEffectiveLeadTime = (): number => {
    if (!selectedSku) return 30;
    
    switch (leadTimeOption) {
      case 'mp_ready':
        if ((selectedSku as any)?.mpStartDate) {
          const mpReady = new Date((selectedSku as any).mpStartDate);
          const today = new Date();
          const diffTime = mpReady.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return Math.max(1, diffDays); // Ensure at least 1 day
        }
        return (selectedSku as any)?.leadTimeDays || 30; // Fallback to normal
      case 'custom':
        if (customDate) {
          const customDeliveryDate = new Date(customDate);
          const today = new Date();
          const diffTime = customDeliveryDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          return Math.max(1, diffDays);
        }
        return customLeadTime || (selectedSku as any)?.leadTimeDays || 30;
      case 'normal':
      default:
        return (selectedSku as any)?.leadTimeDays || 30;
    }
  };

  // Access control - Sales team and admins can create forecasts
  if (!user || !['super_admin', 'admin', 'sales', 'member'].includes(user.role)) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="forecasts" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Sales team access required for demand forecasting.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleCreateForecast = async (formData: FormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/cpfr/forecasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          skuId: selectedSku?.id,
          purchaseOrderId: formData.get('purchaseOrderId') || null,
          deliveryWeek: formData.get('deliveryWeek'),
          quantity: parseInt(formData.get('quantity') as string),
          confidence: formData.get('confidence'),
          shippingPreference: formData.get('shippingPreference'),
          moqOverride: moqOverride,
          notes: formData.get('notes'),
        }),
      });

      if (response.ok) {
        mutateForecasts();
        setShowCreateModal(false);
        setSelectedSku(null);
        setMoqOverride(false);
        setQuantityError('');
        setForecastQuantity(0);
      } else {
        const errorData = await response.json();
        alert(`Failed to create forecast: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating forecast:', error);
      alert('Failed to create forecast');
    }
    setIsLoading(false);
  };

  // Get planning weeks - extends 6 weeks beyond earliest possible delivery
  const getPlanningWeeks = () => {
    const weeks = [];
    const now = new Date();
    
    // Helper to get ISO week number
    const getISOWeek = (date: Date) => {
      const target = new Date(date.valueOf());
      const dayNr = (date.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
      }
      return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    };
    
    // Helper to get Monday of the week
    const getMondayOfWeek = (date: Date) => {
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      return new Date(date.setDate(diff));
    };
    
    // Calculate how many weeks we need based on selected SKU and shipping
    let totalWeeks = 12; // Default minimum
    
    if (selectedSku && selectedShipping) {
      const leadTime = getEffectiveLeadTime();
      const shippingDays: { [key: string]: number } = {
        'AIR_7_DAYS': 7,
        'AIR_14_DAYS': 14,
        'AIR_NLD': 14,
        'AIR_AUT': 14,
        'SEA_ASIA_US_WEST': 45,
        'SEA_ASIA_US_EAST': 52,
        'SEA_WEST_EXPEDITED': 35,
        'SEA_ASIA_NLD': 45,
        'SEA_ASIA_AUT': 45,
        'TRUCK_EXPRESS': 10.5,
        'TRUCK_STANDARD': 21,
        'RAIL': 28,
      };
      const shippingTime = shippingDays[selectedShipping] || 0;
      const totalDays = leadTime + shippingTime;
      const weeksUntilEarliest = Math.ceil(totalDays / 7);
      totalWeeks = Math.max(12, weeksUntilEarliest + 6); // 6 weeks beyond earliest
    }
    
    for (let i = 0; i < totalWeeks; i++) {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + (i * 7));
      const monday = getMondayOfWeek(new Date(weekStart));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      
      const isoWeek = getISOWeek(monday);
      const year = monday.getFullYear();
      
      weeks.push({
        isoWeek: `${year}-W${String(isoWeek).padStart(2, '0')}`,
        weekNumber: isoWeek,
        year,
        startDate: monday,
        endDate: sunday,
        dateRange: `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        fullRange: `${monday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${sunday.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      });
    }
    return weeks;
  };

  const weeks = getPlanningWeeks();
  const skusArray = Array.isArray(skus) ? skus : [];
  const forecastsArray = Array.isArray(forecasts) ? forecasts : [];
  const posArray = Array.isArray(purchaseOrders) ? purchaseOrders : [];

  return (
    <div className="flex-1 p-4 lg:p-8 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <SemanticBDIIcon semantic="forecasts" size={32} />
            <div>
              <h1 className="text-3xl font-bold">Sales Forecasts</h1>
              <p className="text-muted-foreground">Create demand forecasts for CPFR planning</p>
            </div>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setShowCreateModal(true)}>
            <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
            New Forecast
          </Button>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex border rounded-md">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 py-2 text-sm transition-colors ${viewMode === 'calendar' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            📅 Calendar
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 text-sm transition-colors ${viewMode === 'list' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            📋 List
          </button>
        </div>
        <div className="text-sm text-gray-600">
          {forecastsArray.length} forecasts • {skusArray.length} SKUs available
        </div>
      </div>

      {/* Calendar View - Weekly */}
      {viewMode === 'calendar' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {weeks.map((week) => (
            <Card key={week.isoWeek} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">
                  Week {week.weekNumber} - {week.year}
                </CardTitle>
                <CardDescription className="text-xs">
                  <div className="font-medium">{week.dateRange}</div>
                  <div className="text-gray-500 mt-1">
                    {forecastsArray.filter(f => f.deliveryWeek === week.isoWeek).length} forecasts
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full text-xs"
                  onClick={() => {
                    setSelectedDate(week.isoWeek);
                    setShowCreateModal(true);
                  }}
                >
                  <SemanticBDIIcon semantic="plus" size={12} className="mr-1" />
                  Add Forecast
                </Button>
                
                {/* Show existing forecasts for this week */}
                <div className="mt-3 space-y-1">
                  {forecastsArray
                    .filter(f => f.deliveryWeek === week.isoWeek)
                    .slice(0, 2)
                    .map(forecast => (
                      <div key={forecast.id} className="text-xs p-2 bg-gray-50 rounded">
                        <div className="font-mono text-xs">{forecast.sku.sku}</div>
                        <div className="text-gray-600">{forecast.quantity.toLocaleString()} units</div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        /* List View */
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <SemanticBDIIcon semantic="forecasts" size={20} className="mr-2" />
              All Forecasts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {forecastsArray.length === 0 ? (
              <div className="text-center py-12">
                <SemanticBDIIcon semantic="forecasts" size={48} className="mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Forecasts Yet</h3>
                <p className="text-muted-foreground mb-4">Create your first demand forecast to start CPFR planning</p>
                <Button onClick={() => setShowCreateModal(true)}>
                  <SemanticBDIIcon semantic="plus" size={16} className="mr-2" />
                  Create First Forecast
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {forecastsArray.map((forecast) => (
                  <div key={forecast.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-semibold">{forecast.sku.name}</h3>
                          <Badge variant="outline" className="font-mono text-xs">
                            {forecast.sku.sku}
                          </Badge>
                          <Badge variant={
                            forecast.confidence === 'high' ? 'default' : 
                            forecast.confidence === 'medium' ? 'secondary' : 
                            'outline'
                          }>
                            {forecast.confidence} confidence
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Delivery Week:</span>
                            <p className="font-medium">{forecast.deliveryWeek}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Quantity:</span>
                            <p className="font-medium">{forecast.quantity.toLocaleString()} units</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Created:</span>
                            <p className="font-medium">{new Date(forecast.createdAt).toLocaleDateString()}</p>
                          </div>
                        </div>
                        {forecast.notes && (
                          <p className="text-sm text-gray-600 mt-2">{forecast.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
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
      )}

      {/* Create Forecast Modal */}
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <SemanticBDIIcon semantic="forecasts" size={20} className="mr-2" />
                Create Sales Forecast
              </DialogTitle>
            </DialogHeader>
            <form className="space-y-12 p-8" onSubmit={(e) => {
              e.preventDefault();
              handleCreateForecast(new FormData(e.currentTarget));
            }}>
              {/* SKU Selection */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Select Product SKU</Label>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-15 gap-4 max-h-80 overflow-y-auto border rounded-lg p-6">
                  {skusArray.map((sku) => {
                    const productType = sku.sku.length >= 3 ? sku.sku.charAt(2) : 'C';
                    const getProductTypeColor = (type: string) => {
                      const colors: { [key: string]: string } = {
                        'B': 'bg-blue-100 border-blue-300 text-blue-800',
                        'G': 'bg-green-100 border-green-300 text-green-800',
                        'Q': 'bg-purple-100 border-purple-300 text-purple-800',
                        'F': 'bg-orange-100 border-orange-300 text-orange-800',
                        'P': 'bg-pink-100 border-pink-300 text-pink-800',
                        'X': 'bg-indigo-100 border-indigo-300 text-indigo-800',
                        'A': 'bg-yellow-100 border-yellow-300 text-yellow-800',
                        'R': 'bg-red-100 border-red-300 text-red-800',
                      };
                      return colors[type] || 'bg-gray-100 border-gray-300 text-gray-800';
                    };
                    
                    return (
                      <div 
                        key={sku.id} 
                        className={`relative border-2 rounded-lg p-2 cursor-pointer transition-all ${
                          selectedSku?.id === sku.id 
                            ? 'ring-2 ring-blue-500 border-blue-500' 
                            : getProductTypeColor(productType)
                        } hover:shadow-md`}
                        onClick={() => {
                          setSelectedSku(sku);
                          setForecastQuantity(0); // Reset forecast quantity when SKU changes
                        }}
                      >
                        <div className="text-center">
                          <div className="text-xs font-mono font-bold mb-1 truncate">
                            {sku.sku}
                          </div>
                          <div className="text-xs font-medium leading-tight line-clamp-2">
                            {sku.name}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selectedSku && (
                  <div className="mt-4 p-6 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline" className="font-mono text-sm px-3 py-1">{selectedSku.sku}</Badge>
                        <span className="font-semibold text-lg">{selectedSku.name}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-5 gap-10 text-sm">
                      <div className="bg-white p-6 rounded-lg border shadow-sm h-[160px] flex flex-col justify-center">
                        <span className="text-gray-600 text-sm font-medium mb-2">Units per Carton</span>
                        <p className="font-bold text-3xl text-blue-600 mb-2">
                          {(selectedSku as any).boxesPerCarton || 'Not Set'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(selectedSku as any).boxesPerCarton ? 'Forecast in multiples of this' : 'Configure in SKU settings'}
                        </p>
                      </div>
                      <div className="bg-white p-4 rounded-lg border shadow-sm h-[160px] flex flex-col justify-center">
                        <span className="text-gray-600 text-sm font-medium mb-2">Lead Time Options</span>
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="mp_ready"
                              name="leadTimeOption"
                              value="mp_ready"
                              checked={leadTimeOption === 'mp_ready'}
                              onChange={(e) => setLeadTimeOption(e.target.value as 'mp_ready')}
                              className="text-orange-600 flex-shrink-0"
                            />
                            <div className="flex flex-col min-w-0">
                              <label htmlFor="mp_ready" className="text-xs font-medium truncate">
                                MP Ready (EXW)
                              </label>
                              <span className="text-xs text-gray-500 truncate">
                                {(selectedSku as any)?.mpStartDate 
                                  ? new Date((selectedSku as any).mpStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                                  : 'Not set'
                                }
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="normal"
                              name="leadTimeOption"
                              value="normal"
                              checked={leadTimeOption === 'normal'}
                              onChange={(e) => setLeadTimeOption(e.target.value as 'normal')}
                              className="text-orange-600 flex-shrink-0"
                            />
                            <div className="flex flex-col min-w-0">
                              <label htmlFor="normal" className="text-xs font-medium truncate">
                                Normal
                              </label>
                              <span className="text-xs text-gray-500 truncate">
                                {(selectedSku as any)?.leadTimeDays || 30} days
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <input
                              type="radio"
                              id="custom"
                              name="leadTimeOption"
                              value="custom"
                              checked={leadTimeOption === 'custom'}
                              onChange={(e) => setLeadTimeOption(e.target.value as 'custom')}
                              className="text-orange-600 flex-shrink-0"
                            />
                            <div className="flex flex-col min-w-0">
                              <label htmlFor="custom" className="text-xs font-medium truncate">
                                Custom
                              </label>
                              {leadTimeOption === 'custom' ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    placeholder="Days"
                                    value={customLeadTime || ''}
                                    onChange={(e) => setCustomLeadTime(e.target.value ? parseInt(e.target.value) : null)}
                                    className="w-12 px-1 py-0.5 border rounded text-xs"
                                    min="1"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowDatePicker(!showDatePicker)}
                                    className="px-1 py-0.5 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200"
                                  >
                                    📅
                                  </button>
                                  {showDatePicker && (
                                    <input
                                      type="date"
                                      value={customDate}
                                      onChange={(e) => setCustomDate(e.target.value)}
                                      className="px-1 py-0.5 border rounded text-xs w-20"
                                    />
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500 truncate">
                                  Days or date
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-white p-6 rounded-lg border shadow-sm h-[160px] flex flex-col justify-center">
                        <span className="text-gray-600 text-sm font-medium mb-2">MOQ</span>
                        <p className="font-bold text-3xl text-green-600 mb-2">
                          {((selectedSku as any).moq || 1).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          Minimum order quantity
                        </p>
                      </div>
                      <div className="bg-white p-6 rounded-lg border shadow-sm h-[160px] flex flex-col justify-center">
                        <span className="text-gray-600 text-sm font-medium mb-2">Shipping Time</span>
                        <p className="font-bold text-3xl text-purple-600 mb-2">
                          {(() => {
                            const shippingTimes: { [key: string]: string } = {
                              'AIR_7_DAYS': '7 days',
                              'AIR_14_DAYS': '14 days',
                              'AIR_NLD': '14 days',
                              'AIR_AUT': '14 days',
                              'SEA_ASIA_US_WEST': '45 days',
                              'SEA_ASIA_US_EAST': '52 days',
                              'SEA_WEST_EXPEDITED': '35 days',
                              'SEA_ASIA_NLD': '45 days',
                              'SEA_ASIA_AUT': '45 days',
                              'TRUCK_EXPRESS': '7-14 days',
                              'TRUCK_STANDARD': '14-28 days',
                              'RAIL': '21-35 days',
                            };
                            return selectedShipping ? shippingTimes[selectedShipping] || 'TBD' : 'Select shipping';
                          })()}
                        </p>
                        <p className="text-xs text-gray-500">
                          Transit time for selected method
                        </p>
                      </div>
                      <div className="bg-white p-6 rounded-lg border shadow-sm h-[160px] flex flex-col justify-center">
                        <span className="text-gray-600 text-sm font-medium mb-2">Total Delivery Time</span>
                        <p className="font-bold text-3xl text-indigo-600 mb-2">
                          {(() => {
                            if (!selectedShipping) return 'Select shipping';
                            const leadTime = getEffectiveLeadTime();
                            const shippingDays: { [key: string]: number } = {
                              'AIR_7_DAYS': 7,
                              'AIR_14_DAYS': 14,
                              'AIR_NLD': 14,
                              'AIR_AUT': 14,
                              'SEA_ASIA_US_WEST': 45,
                              'SEA_ASIA_US_EAST': 52,
                              'SEA_WEST_EXPEDITED': 35,
                              'SEA_ASIA_EU_NLD': 45,
                              'SEA_ASIA_EU_AUT': 45,
                              'GROUND': 14
                            };
                            
                            if (leadTimeOption === 'mp_ready' && (selectedSku as any)?.mpStartDate) {
                              const mpReady = new Date((selectedSku as any).mpStartDate);
                              const today = new Date();
                              const daysToMpReady = Math.ceil((mpReady.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                              const shippingTime = shippingDays[selectedShipping] || 0;
                              const totalDays = daysToMpReady + shippingTime;

                              return totalDays;
                            } else {
                              const leadTime = getEffectiveLeadTime();
                              const shippingTime = shippingDays[selectedShipping] || 0;
                              const totalDays = leadTime + shippingTime;

                              return totalDays;
                            }
                          })()} days
                        </p>
                        <p className="text-xs text-gray-500">
                          Lead time + shipping time
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Forecast Details */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-20 mt-12">
                <div>
                  <Label htmlFor="deliveryWeek">Final Delivery Week *</Label>
                  <select
                    id="deliveryWeek"
                    name="deliveryWeek"
                    required
                    defaultValue={selectedDate}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                    onChange={(e) => {
                      const selectedWeek = weeks.find(w => w.isoWeek === e.target.value);
                      if (selectedWeek && selectedSku && selectedShipping) {
                        const orderDate = new Date();
                        const leadTime = getEffectiveLeadTime();
                        const shippingDays: { [key: string]: number } = {
                          'AIR_7_DAYS': 7,
                          'AIR_14_DAYS': 14,
                          'AIR_NLD': 14,
                          'AIR_AUT': 14,
                          'SEA_ASIA_US_WEST': 45,
                          'SEA_ASIA_US_EAST': 52,
                          'SEA_WEST_EXPEDITED': 35,
                          'SEA_ASIA_NLD': 45,
                          'SEA_ASIA_AUT': 45,
                          'TRUCK_EXPRESS': 10.5,
                          'TRUCK_STANDARD': 21,
                          'RAIL': 28,
                        };
                        const shippingTime = shippingDays[selectedShipping] || 0;
                        const totalDays = leadTime + shippingTime;
                        const earliestDelivery = new Date(orderDate);
                        earliestDelivery.setDate(orderDate.getDate() + totalDays);
                        
                        if (selectedWeek.startDate < earliestDelivery) {
                          const earliestWeek = weeks.find(w => w.startDate >= earliestDelivery);
                          if (earliestWeek) {
                            alert(`⚠️ Total time is ${Math.round(totalDays)} days (${leadTime} lead + ${Math.round(shippingTime)} shipping). Earliest possible final delivery: ${earliestWeek.isoWeek} (${earliestWeek.dateRange})`);
                          }
                        }
                      }
                    }}
                  >
                    <option value="">Select Final Delivery Week</option>
                    {weeks.map(week => {
                      if (!selectedSku || !selectedShipping) {
                        return (
                          <option key={week.isoWeek} value={week.isoWeek}>
                            {week.isoWeek} ({week.dateRange})
                          </option>
                        );
                      }

                      const leadTime = getEffectiveLeadTime();
                      const shippingDays: { [key: string]: number } = {
                        'AIR_7_DAYS': 7,
                        'AIR_14_DAYS': 14,
                        'AIR_NLD': 14,
                        'AIR_AUT': 14,
                        'SEA_ASIA_US_WEST': 45,
                        'SEA_ASIA_US_EAST': 52,
                        'SEA_WEST_EXPEDITED': 35,
                        'SEA_ASIA_NLD': 45,
                        'SEA_ASIA_AUT': 45,
                        'TRUCK_EXPRESS': 10.5,
                        'TRUCK_STANDARD': 21,
                        'RAIL': 28,
                      };
                      const shippingTime = shippingDays[selectedShipping] || 0;
                      const totalDays = leadTime + shippingTime;
                      const orderDate = new Date();
                      const earliestDelivery = new Date(orderDate);
                      earliestDelivery.setDate(orderDate.getDate() + totalDays);
                      
                      const isTooEarly = week.startDate < earliestDelivery;
                      
                      return (
                        <option 
                          key={week.isoWeek} 
                          value={week.isoWeek}
                          style={isTooEarly ? { color: '#dc2626', fontStyle: 'italic' } : {}}
                        >
                          {week.isoWeek} ({week.dateRange})
                          {isTooEarly ? ` ⚠️ Too Early (Need ${Math.round(totalDays)} days)` : ''}
                        </option>
                      );
                    })}
                  </select>
                  <div className="mt-1 text-xs text-gray-600">
                    Final customer delivery week (includes lead time + shipping)
                  </div>
                  {selectedSku && selectedShipping && (
                    <div className="mt-2 p-4 bg-gradient-to-r from-green-50 via-blue-50 to-emerald-50 border border-green-200 rounded-lg text-sm shadow-sm">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="text-center">
                          <span className="font-medium text-orange-800 block">
                            ⏱️ Lead Time
                          </span>
                          <p className="font-bold text-xl text-orange-600 my-1">
                            {(() => {
                              if (leadTimeOption === 'mp_ready' && (selectedSku as any)?.mpStartDate) {
                                const mpReady = new Date((selectedSku as any).mpStartDate);
                                const today = new Date();
                                const daysAway = Math.ceil((mpReady.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                return `${daysAway} days`;
                              }
                              return `${getEffectiveLeadTime()} days`;
                            })()}
                          </p>
                          <span className="text-orange-600 text-xs">
                            {leadTimeOption === 'mp_ready' ? 'To MP Ready (Sep 29)' : 'Production + prep'}
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="font-medium text-purple-800 block">
                            🚚 Shipping Time
                          </span>
                          <p className="font-bold text-xl text-purple-600 my-1">
                            {(() => {
                              const shippingDays: { [key: string]: number } = {
                                'AIR_7_DAYS': 7,
                                'AIR_14_DAYS': 14,
                                'AIR_NLD': 14,
                                'AIR_AUT': 14,
                                'SEA_ASIA_US_WEST': 45,
                                'SEA_ASIA_US_EAST': 52,
                                'SEA_WEST_EXPEDITED': 35,
                                'SEA_ASIA_EU_NLD': 45,
                                'SEA_ASIA_EU_AUT': 45,
                                'GROUND': 14
                              };
                              return `${shippingDays[selectedShipping] || 0} days`;
                            })()} 
                          </p>
                          <span className="text-purple-600 text-xs">
                            Transit time
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="font-medium text-blue-800 block">
                            📅 Total Timeline
                          </span>
                          <p className="font-bold text-xl text-blue-600 my-1">
                            {(() => {
                              const leadTime = getEffectiveLeadTime();
                              const shippingDays: { [key: string]: number } = {
                                'AIR_7_DAYS': 7,
                                'AIR_14_DAYS': 14,
                                'AIR_NLD': 14,
                                'AIR_AUT': 14,
                                'SEA_ASIA_US_WEST': 45,
                                'SEA_ASIA_US_EAST': 52,
                                'SEA_WEST_EXPEDITED': 35,
                                'SEA_ASIA_NLD': 45,
                                'SEA_ASIA_AUT': 45,
                                'TRUCK_EXPRESS': 10.5,
                                'TRUCK_STANDARD': 21,
                                'RAIL': 28,
                              };
                              const shippingTime = shippingDays[selectedShipping] || 0;
                              return `${Math.round(leadTime + shippingTime)} days`;
                            })()}
                          </p>
                          <span className="text-blue-600 text-xs">
                            Order to delivery
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="font-medium text-emerald-800 block">
                            🎯 Best Case
                          </span>
                          <p className="font-bold text-xl text-emerald-600 my-1">
                            {(() => {
                              const orderDate = new Date();
                              const leadTime = getEffectiveLeadTime();
                              const shippingDays: { [key: string]: number } = {
                                'AIR_7_DAYS': 7, // Fixed timing
                                'AIR_14_DAYS': 14,
                                'AIR_NLD': 14,
                                'AIR_AUT': 14,
                                'SEA_ASIA_US_WEST': 45,
                                'SEA_ASIA_US_EAST': 52,
                                'SEA_WEST_EXPEDITED': 35,
                                'SEA_ASIA_NLD': 45,
                                'SEA_ASIA_AUT': 45,
                                'TRUCK_EXPRESS': 7,
                                'TRUCK_STANDARD': 14,
                                'RAIL': 21,
                              };
                              const bestCaseShipping = shippingDays[selectedShipping] || 0;
                              const bestCaseDays = leadTime + bestCaseShipping;
                              const bestCaseDate = new Date(orderDate);
                              bestCaseDate.setDate(orderDate.getDate() + bestCaseDays);
                              return bestCaseDate.toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              });
                            })()}
                          </p>
                          <span className="text-emerald-600 text-xs">
                            Earliest delivery
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity (units) *</Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min="1"
                    step={(selectedSku as any)?.boxesPerCarton || 1}
                    placeholder={
                      (selectedSku as any)?.boxesPerCarton 
                        ? `Multiples of ${(selectedSku as any).boxesPerCarton} (e.g., ${(selectedSku as any).boxesPerCarton * 100})`
                        : "e.g., 5000"
                    }
                    required
                    className={`mt-1 ${quantityError ? 'border-red-500 bg-red-50 text-red-900' : ''}`}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      const unitsPerCarton = (selectedSku as any)?.boxesPerCarton;
                      const moq = (selectedSku as any)?.moq || 1;
                      
                      // Update forecast quantity for CPFR calculations
                      setForecastQuantity(value || 0);
                      
                      let error = '';
                      
                      // Check carton multiple
                      if (unitsPerCarton && value && value % unitsPerCarton !== 0) {
                        error = `Must be multiple of ${unitsPerCarton} (units per carton)`;
                      }
                      // Check MOQ (unless override is enabled)
                      else if (!moqOverride && value && value < moq) {
                        error = `Below MOQ of ${moq.toLocaleString()} units`;
                      }
                      
                      setQuantityError(error);
                      e.target.setCustomValidity(error);
                    }}
                  />
                  
                  {/* Real-time Inventory Availability & CPFR Signaling */}
                  {selectedSku && (
                    <div className="mt-3 space-y-3">
                      {/* Available Quantity Display */}
                      <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <SemanticBDIIcon semantic="inventory" size={14} className="text-blue-600" />
                            <span className="text-blue-800 font-medium text-sm">Available Quantity ({selectedSku.sku}):</span>
                          </div>
                          <div className="text-right">
                            <span className="text-blue-900 font-bold text-lg">
                              {getAvailableQuantity(selectedSku.id).toLocaleString()}
                            </span>
                            <span className="text-blue-700 text-sm ml-1">units</span>
                          </div>
                        </div>
                        <div className="text-xs text-blue-600 mt-1 space-y-1">
                          <div>Total from {inventoryData?.availability?.[selectedSku.id]?.sourceInvoices || 0} invoice(s): {inventoryData?.availability?.[selectedSku.id]?.totalFromInvoices?.toLocaleString() || '0'}</div>
                          {inventoryData?.availability?.[selectedSku.id]?.alreadyAllocated > 0 && (
                            <div>Already allocated: -{inventoryData.availability[selectedSku.id].alreadyAllocated.toLocaleString()}</div>
                          )}
                        </div>
                      </div>

                      {/* CPFR Signal Display */}
                      {forecastQuantity > 0 && (
                        <div className={`p-3 rounded-md border ${getCpfrSignal(selectedSku.id, forecastQuantity).color}`}>
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{getCpfrSignal(selectedSku.id, forecastQuantity).icon}</span>
                            <span className="font-medium text-sm">CPFR Signal:</span>
                            <span className="text-sm">{getCpfrSignal(selectedSku.id, forecastQuantity).message}</span>
                          </div>
                          {getCpfrSignal(selectedSku.id, forecastQuantity).type === 'shortage' && (
                            <div className="mt-2 text-xs">
                              💡 Consider increasing purchase orders or adjusting delivery timeline
                            </div>
                          )}
                          {getCpfrSignal(selectedSku.id, forecastQuantity).type === 'critical' && (
                            <div className="mt-2 text-xs">
                              🚨 Urgent: Create purchase orders immediately to meet demand
                            </div>
                          )}
                        </div>
                      )}

                      {/* Remaining Inventory After Forecast */}
                      {forecastQuantity > 0 && getAvailableQuantity(selectedSku.id) > 0 && (
                        <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">Remaining after forecast:</span>
                            <span className={`font-medium ${
                              getAvailableQuantity(selectedSku.id) - forecastQuantity >= 0 
                                ? 'text-green-600' 
                                : 'text-red-600'
                            }`}>
                              {(getAvailableQuantity(selectedSku.id) - forecastQuantity).toLocaleString()} units
                            </span>
                          </div>
                        </div>
                      )}

                      {/* SKU Requirements Info - Moved Below for Better Alignment */}
                      <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
                        <div className="space-y-1">
                          {(selectedSku as any)?.boxesPerCarton && (
                            <div className="text-xs text-blue-600">
                              💡 Must be multiple of {(selectedSku as any).boxesPerCarton} units (full cartons only)
                            </div>
                          )}
                          {(selectedSku as any)?.moq && (
                            <div className="text-xs text-green-600">
                              📊 MOQ: {((selectedSku as any).moq || 1).toLocaleString()} units minimum
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {quantityError ? (
                    <div className="mt-1 text-xs text-red-600 font-medium">
                      ❌ {quantityError}
                      {quantityError.includes('Below MOQ') && (
                        <div className="mt-2">
                          <label className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={moqOverride}
                              onChange={(e) => {
                                setMoqOverride(e.target.checked);
                                if (e.target.checked) {
                                  setQuantityError('');
                                  const quantityInput = document.getElementById('quantity') as HTMLInputElement;
                                  if (quantityInput) quantityInput.setCustomValidity('');
                                }
                              }}
                              className="w-4 h-4 text-red-600"
                            />
                            <span className="text-red-700 font-medium">Override MOQ (special order)</span>
                          </label>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mt-10">
                <div>
                  <Label htmlFor="purchaseOrderId">Link to Purchase Order</Label>
                  <select
                    id="purchaseOrderId"
                    name="purchaseOrderId"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  >
                    <option value="">No PO (Independent Forecast)</option>
                    {posArray.map(po => (
                      <option key={po.id} value={po.id}>
                        PO #{po.poNumber} - {po.supplierName} ({po.requestedDeliveryWeek})
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-gray-600">
                    Optional: Link forecast to existing Purchase Order
                  </div>
                </div>
                <div>
                  <Label htmlFor="confidence">Confidence Level *</Label>
                  <select
                    id="confidence"
                    name="confidence"
                    value={confidenceLevel}
                    onChange={(e) => setConfidenceLevel(e.target.value as 'part_of_po' | 'pre_po' | 'planning')}
                    required
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 mt-1 font-medium ${
                      confidenceLevel === 'part_of_po' 
                        ? 'bg-green-50 border-green-300 text-green-800 focus:ring-green-500' 
                        : confidenceLevel === 'pre_po'
                        ? 'bg-yellow-50 border-yellow-300 text-yellow-800 focus:ring-yellow-500'
                        : 'bg-red-50 border-red-300 text-red-800 focus:ring-red-500'
                    }`}
                  >
                    <option value="part_of_po" className="bg-green-50 text-green-800">🟢 Part of PO</option>
                    <option value="pre_po" className="bg-yellow-50 text-yellow-800">🟡 Pre-PO</option>
                    <option value="planning" className="bg-red-50 text-red-800">🔴 Planning</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="shippingPreference">Shipping Mode *</Label>
                  <select
                    id="shippingPreference"
                    name="shippingPreference"
                    required
                    value={selectedShipping}
                    onChange={(e) => setSelectedShipping(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  >
                    <option value="">Select Shipping Mode</option>
                    <optgroup label="✈️ Air Freight (Fast, Higher Cost)">
                      <option value="AIR_7_DAYS">Air Express - 7 days door-to-door (urgent orders)</option>
                      <option value="AIR_14_DAYS">Air Standard - 14 days door-to-door (standard air)</option>
                      <option value="AIR_NLD">Air to Netherlands (NLD) - 14 days door-to-door</option>
                      <option value="AIR_AUT">Air to Austria (AUT) - 14 days door-to-door</option>
                    </optgroup>
                    <optgroup label="🚢 Ocean Freight (Bulk, Cost Efficient)">
                      <option value="SEA_ASIA_US_WEST">Sea Asia→US West - 45 days door-to-door (bulk)</option>
                      <option value="SEA_ASIA_US_EAST">Sea Asia→US East - 52 days door-to-door (bulk)</option>
                      <option value="SEA_WEST_EXPEDITED">Sea West Expedited - 35 days door-to-door (faster bulk)</option>
                      <option value="SEA_ASIA_NLD">Sea Asia→Netherlands (NLD) - 45 days door-to-door</option>
                      <option value="SEA_ASIA_AUT">Sea Asia→Austria (AUT) - 45 days door-to-door</option>
                    </optgroup>
                    <optgroup label="🚛 Ground Transport">
                      <option value="TRUCK_EXPRESS">Truck Express - 1-2 weeks (regional)</option>
                      <option value="TRUCK_STANDARD">Truck Standard - 2-4 weeks (domestic)</option>
                      <option value="RAIL">Rail Freight - 3-5 weeks (cost efficient)</option>
                    </optgroup>
                  </select>
                  <div className="mt-1 text-xs text-blue-600">
                    💡 Air ≈ 5-10× sea cost but faster. Sea = bulk/planned orders.
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <textarea
                  id="notes"
                  name="notes"
                  placeholder="Market conditions, customer feedback, special requirements, etc."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                            setSelectedSku(null);
        setMoqOverride(false);
        setQuantityError('');
        setSelectedShipping('');
        setForecastQuantity(0);
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading || !selectedSku || !!quantityError}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isLoading ? (
                    <>
                      <SemanticBDIIcon semantic="sync" size={16} className="mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <SemanticBDIIcon semantic="forecasts" size={16} className="mr-2 brightness-0 invert" />
                      Create Forecast
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


