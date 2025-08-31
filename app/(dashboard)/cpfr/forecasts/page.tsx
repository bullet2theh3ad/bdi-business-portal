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

interface SalesForecast {
  id: string;
  skuId: string;
  sku: ProductSku;
  deliveryWeek: string; // ISO week format: 2025-W12
  quantity: number;
  confidence: 'low' | 'medium' | 'high';
  notes?: string;
  createdBy: string;
  createdAt: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SalesForecastsPage() {
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  const { data: skus } = useSWR<ProductSku[]>('/api/admin/skus', fetcher);
  const { data: forecasts, mutate: mutateForecasts } = useSWR<SalesForecast[]>('/api/cpfr/forecasts', fetcher);
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSku, setSelectedSku] = useState<ProductSku | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [isLoading, setIsLoading] = useState(false);

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
          deliveryWeek: formData.get('deliveryWeek'),
          quantity: parseInt(formData.get('quantity') as string),
          confidence: formData.get('confidence'),
          notes: formData.get('notes'),
        }),
      });

      if (response.ok) {
        mutateForecasts();
        setShowCreateModal(false);
        setSelectedSku(null);
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

  // Get next 12 weeks for calendar view with ISO week numbers
  const getNext12Weeks = () => {
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
    
    for (let i = 0; i < 12; i++) {
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

  const weeks = getNext12Weeks();
  const skusArray = Array.isArray(skus) ? skus : [];
  const forecastsArray = Array.isArray(forecasts) ? forecasts : [];

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
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <SemanticBDIIcon semantic="forecasts" size={20} className="mr-2" />
                Create Sales Forecast
              </DialogTitle>
            </DialogHeader>
            <form className="space-y-6" onSubmit={(e) => {
              e.preventDefault();
              handleCreateForecast(new FormData(e.currentTarget));
            }}>
              {/* SKU Selection */}
              <div>
                <Label className="text-base font-semibold mb-3 block">Select Product SKU</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-64 overflow-y-auto border rounded-lg p-4">
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
                        onClick={() => setSelectedSku(sku)}
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
                  <div className="mt-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline" className="font-mono">{selectedSku.sku}</Badge>
                        <span className="font-medium">{selectedSku.name}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="bg-white p-3 rounded border">
                        <span className="text-gray-600">Units per Carton:</span>
                        <p className="font-bold text-lg text-blue-600">
                          {(selectedSku as any).boxesPerCarton || 'Not Set'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(selectedSku as any).boxesPerCarton ? 'Forecast in multiples of this' : 'Configure in SKU settings'}
                        </p>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <span className="text-gray-600">Carton Dimensions:</span>
                        <p className="font-medium">
                          {(selectedSku as any).cartonLengthCm && (selectedSku as any).cartonWidthCm && (selectedSku as any).cartonHeightCm
                            ? `${(selectedSku as any).cartonLengthCm} × ${(selectedSku as any).cartonWidthCm} × ${(selectedSku as any).cartonHeightCm} cm`
                            : 'Not Set'
                          }
                        </p>
                        <p className="text-xs text-gray-500">Length × Width × Height</p>
                      </div>
                      <div className="bg-white p-3 rounded border">
                        <span className="text-gray-600">Carton Weight:</span>
                        <p className="font-medium">
                          {(selectedSku as any).cartonWeightKg ? `${(selectedSku as any).cartonWeightKg} kg` : 'Not Set'}
                        </p>
                        <p className="text-xs text-gray-500">Per carton shipping weight</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Forecast Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="deliveryWeek">Delivery Week *</Label>
                  <select
                    id="deliveryWeek"
                    name="deliveryWeek"
                    required
                    defaultValue={selectedDate}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  >
                    <option value="">Select Delivery Week</option>
                    {weeks.map(week => (
                      <option key={week.isoWeek} value={week.isoWeek}>
                        {week.isoWeek} ({week.dateRange})
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-gray-600">
                    ISO week format with Monday-Sunday date range
                  </div>
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
                    className="mt-1"
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      const unitsPerCarton = (selectedSku as any)?.boxesPerCarton;
                      if (unitsPerCarton && value % unitsPerCarton !== 0) {
                        e.target.setCustomValidity(`Must be multiple of ${unitsPerCarton} (units per carton)`);
                      } else {
                        e.target.setCustomValidity('');
                      }
                    }}
                  />
                  {(selectedSku as any)?.boxesPerCarton && (
                    <div className="mt-1 text-xs text-blue-600">
                      💡 Must be multiple of {(selectedSku as any).boxesPerCarton} units (full cartons only)
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="confidence">Confidence Level *</Label>
                  <select
                    id="confidence"
                    name="confidence"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
                  >
                    <option value="">Select Confidence</option>
                    <option value="high">🟢 High - Very likely to meet</option>
                    <option value="medium">🟡 Medium - Probable</option>
                    <option value="low">🔴 Low - Uncertain</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Input
                    id="notes"
                    name="notes"
                    placeholder="Market conditions, customer feedback, etc."
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setSelectedSku(null);
                  }}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isLoading || !selectedSku}
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
