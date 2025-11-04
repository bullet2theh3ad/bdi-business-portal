'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ShipmentStop {
  stopNumber: number;
  locationType: string;
  location: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  milestones: Array<{
    eventCode: string;
    eventName: string;
    estimatedDate?: string;
    actualDate?: string;
    plannedDate?: string;
  }>;
}

interface ShipmentData {
  shipmentStatus: string;
  reference: string;
  unitId: string;
  shipmentDetailsURL?: string;
  stops?: ShipmentStop[];
  originPort?: string;
  loadingPort?: string;
  dischargePort?: string;
  shipFrom?: string;
  shipTo?: string;
  containerSeals?: string;
  containerSizeClass?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OLShipmentTrackingModal({ open, onOpenChange }: Props) {
  const [reference, setReference] = useState('');
  const [containerNumber, setContainerNumber] = useState('');
  const [queryType, setQueryType] = useState<'shipmentDetailsV2' | 'fullTransportDetails'>('fullTransportDetails');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [isLoading, setIsLoading] = useState(false);
  const [shipmentData, setShipmentData] = useState<ShipmentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!reference && !containerNumber) {
      setError('Please enter either a reference number or container number');
      return;
    }

    // shipmentDetailsV2 requires containerNumber
    if (queryType === 'shipmentDetailsV2' && !containerNumber) {
      setError('Container Number is required when using "Shipment Details V2" query type. Use "Full Transport Details" if you only have a reference number.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setShipmentData(null);

    try {
      const response = await fetch('/api/warehouses/ol-usa/shipments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reference: reference || undefined,
          containerNumber: containerNumber || undefined,
          queryType,
          environment,
          verbose: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch shipment data');
      }

      const data = await response.json();
      
      // Handle different response structures
      if (queryType === 'shipmentDetailsV2' && data.shipmentDetailsV2) {
        setShipmentData(data.shipmentDetailsV2);
      } else if (queryType === 'fullTransportDetails' && data.fullTransportDetails) {
        // For fullTransportDetails, we need to extract the first container
        const transportData = data.fullTransportDetails;
        if (transportData.containers && transportData.containers.length > 0) {
          setShipmentData({
            ...transportData.containers[0],
            shipmentStatus: transportData.shipmentStatus,
            reference: transportData.reference,
            shipmentDetailsURL: transportData.shipmentDetailsURL,
          });
        } else {
          setShipmentData(transportData);
        }
      } else {
        throw new Error('No shipment data found');
      }
    } catch (err: any) {
      console.error('Shipment tracking error:', err);
      setError(err.message || 'Failed to fetch shipment tracking information');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setReference('');
    setContainerNumber('');
    setShipmentData(null);
    setError(null);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('delivered') || statusLower.includes('completed')) {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    if (statusLower.includes('transit') || statusLower.includes('in progress')) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (statusLower.includes('delayed') || statusLower.includes('exception')) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    if (statusLower.includes('cancelled') || statusLower.includes('failed')) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[98vw] h-[98vh] max-w-none overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <SemanticBDIIcon semantic="shipping" size={24} className="mr-2 text-indigo-600" />
            OL-USA Shipment Tracking
          </DialogTitle>
          <DialogDescription>
            Track your shipments through the OL-USA AccessHub portal
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 p-4">
          {/* Search Form */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="reference">Reference Number</Label>
                <Input
                  id="reference"
                  placeholder="Enter shipment reference"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="containerNumber">Container Number</Label>
                <Input
                  id="containerNumber"
                  placeholder="Enter container number"
                  value={containerNumber}
                  onChange={(e) => setContainerNumber(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="queryType">Query Type</Label>
                <select
                  id="queryType"
                  className="w-full mt-1 p-2 border rounded-md text-sm"
                  value={queryType}
                  onChange={(e) => setQueryType(e.target.value as any)}
                  disabled={isLoading}
                >
                  <option value="fullTransportDetails">Full Transport Details (Reference only - recommended)</option>
                  <option value="shipmentDetailsV2">Shipment Details V2 (Requires container number)</option>
                </select>
              </div>

              <div>
                <Label htmlFor="environment">Environment</Label>
                <select
                  id="environment"
                  className="w-full mt-1 p-2 border rounded-md"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as any)}
                  disabled={isLoading}
                >
                  <option value="sandbox">🧪 Sandbox (Testing)</option>
                  <option value="production">🚀 Production</option>
                </select>
              </div>
            </div>

            {/* Query Type Info */}
            {queryType === 'shipmentDetailsV2' && !containerNumber && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <div className="flex items-start">
                  <span className="text-blue-600 mr-2">ℹ️</span>
                  <p className="text-blue-800">
                    <strong>Shipment Details V2:</strong> Requires both Reference Number and Container Number. 
                    Switch to <strong>"Full Transport Details"</strong> if you only have a JJOLM/Reference number.
                  </p>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <Button
                onClick={handleSearch}
                disabled={isLoading || (!reference && !containerNumber) || (queryType === 'shipmentDetailsV2' && !containerNumber)}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
              >
                {isLoading ? (
                  <>
                    <SemanticBDIIcon semantic="loading" size={16} className="mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <SemanticBDIIcon semantic="search" size={16} className="mr-2" />
                    Track Shipment
                  </>
                )}
              </Button>
              <Button
                onClick={handleClear}
                variant="outline"
                disabled={isLoading}
              >
                Clear
              </Button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start">
                <span className="text-red-600 mr-2">⚠️</span>
                <div>
                  <p className="text-red-800 font-medium">Error</p>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Results Display */}
          {shipmentData && (
            <div className="space-y-4">
              {/* Environment Badge */}
              <div className="flex items-center justify-between bg-gray-50 border rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-700">Active Environment:</span>
                  <Badge className={environment === 'sandbox' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-green-100 text-green-800 border-green-200'}>
                    {environment === 'sandbox' ? '🧪 Sandbox (Testing)' : '🚀 Production'}
                  </Badge>
                </div>
              </div>

              {/* Shipment Summary */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <Badge className={`${getStatusColor(shipmentData.shipmentStatus)} mt-1`}>
                      {shipmentData.shipmentStatus}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Reference</p>
                    <p className="font-medium text-gray-900">{shipmentData.reference || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Unit ID</p>
                    <p className="font-medium text-gray-900">{shipmentData.unitId || 'N/A'}</p>
                  </div>
                  {shipmentData.originPort && (
                    <div>
                      <p className="text-sm text-gray-600">Origin Port</p>
                      <p className="font-medium text-gray-900">{shipmentData.originPort}</p>
                    </div>
                  )}
                  {shipmentData.loadingPort && (
                    <div>
                      <p className="text-sm text-gray-600">Loading Port</p>
                      <p className="font-medium text-gray-900">{shipmentData.loadingPort}</p>
                    </div>
                  )}
                  {shipmentData.dischargePort && (
                    <div>
                      <p className="text-sm text-gray-600">Discharge Port</p>
                      <p className="font-medium text-gray-900">{shipmentData.dischargePort}</p>
                    </div>
                  )}
                  {shipmentData.shipFrom && (
                    <div>
                      <p className="text-sm text-gray-600">Ship From</p>
                      <p className="font-medium text-gray-900">{shipmentData.shipFrom}</p>
                    </div>
                  )}
                  {shipmentData.shipTo && (
                    <div>
                      <p className="text-sm text-gray-600">Ship To</p>
                      <p className="font-medium text-gray-900">{shipmentData.shipTo}</p>
                    </div>
                  )}
                  {shipmentData.containerSizeClass && (
                    <div>
                      <p className="text-sm text-gray-600">Container Size</p>
                      <p className="font-medium text-gray-900">{shipmentData.containerSizeClass}</p>
                    </div>
                  )}
                  {shipmentData.containerSeals && (
                    <div>
                      <p className="text-sm text-gray-600">Container Seals</p>
                      <p className="font-medium text-gray-900">{shipmentData.containerSeals}</p>
                    </div>
                  )}
                </div>
                
                {shipmentData.shipmentDetailsURL && (
                  <div className="mt-4">
                    <a
                      href={shipmentData.shipmentDetailsURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 text-sm underline flex items-center"
                    >
                      View full details on OL-USA portal
                      <SemanticBDIIcon semantic="external_link" size={12} className="ml-1" />
                    </a>
                  </div>
                )}
              </div>

              {/* Stops and Milestones */}
              {shipmentData.stops && shipmentData.stops.length > 0 && (
                <div className="bg-white border rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <SemanticBDIIcon semantic="map" size={20} className="mr-2 text-indigo-600" />
                    Shipment Journey
                  </h3>
                  
                  <div className="space-y-6">
                    {shipmentData.stops.map((stop, index) => (
                      <div key={index} className="relative">
                        {index < shipmentData.stops!.length - 1 && (
                          <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-indigo-200" />
                        )}
                        
                        <div className="flex">
                          <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold z-10">
                            {stop.stopNumber}
                          </div>
                          
                          <div className="ml-4 flex-1">
                            <div className="bg-gray-50 border rounded-lg p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                                <div>
                                  <span className="text-xs text-gray-600">Location Type:</span>
                                  <p className="font-medium">{stop.locationType}</p>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-600">Location:</span>
                                  <p className="font-medium">{stop.location}</p>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-600">City:</span>
                                  <p className="font-medium">{stop.city}</p>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-600">Country:</span>
                                  <p className="font-medium">{stop.country}</p>
                                </div>
                              </div>

                              {stop.milestones && stop.milestones.length > 0 && (
                                <div className="mt-3 pt-3 border-t">
                                  <p className="text-sm font-medium text-gray-700 mb-2">Milestones:</p>
                                  <div className="space-y-2">
                                    {stop.milestones.map((milestone, mIndex) => (
                                      <div key={mIndex} className="bg-white rounded p-3 text-sm">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="font-medium text-indigo-700">{milestone.eventName}</span>
                                          <Badge variant="outline" className="text-xs">
                                            {milestone.eventCode}
                                          </Badge>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-600">
                                          {milestone.plannedDate && (
                                            <div>
                                              <span className="text-gray-500">Planned:</span> {formatDate(milestone.plannedDate)}
                                            </div>
                                          )}
                                          {milestone.estimatedDate && (
                                            <div>
                                              <span className="text-gray-500">Estimated:</span> {formatDate(milestone.estimatedDate)}
                                            </div>
                                          )}
                                          {milestone.actualDate && (
                                            <div>
                                              <span className="text-green-600">Actual:</span> {formatDate(milestone.actualDate)}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

