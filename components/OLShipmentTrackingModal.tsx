'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import useSWR from 'swr';
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
  preloadedJJOLM?: string; // Optional JJOLM number to auto-load
}

interface JJOLMRecord {
  id: string;
  jjolmNumber: string;
  customerReferenceNumber?: string;
  mode?: string;
  origin?: string;
  destination?: string;
  status?: string;
  lastUpdated?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function OLShipmentTrackingModal({ open, onOpenChange, preloadedJJOLM }: Props) {
  const [reference, setReference] = useState('');
  const [containerNumber, setContainerNumber] = useState('');
  const [queryType, setQueryType] = useState<'shipmentDetailsV2' | 'fullTransportDetails'>('fullTransportDetails');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('production'); // Default to production
  const [isLoading, setIsLoading] = useState(false);
  const [shipmentData, setShipmentData] = useState<ShipmentData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch JJOLM numbers from database
  const { data: jjolmData, isLoading: isLoadingJJOLM } = useSWR<{ success: boolean; data: JJOLMRecord[]; count: number }>(
    open ? '/api/cpfr/jjolm-reports' : null,
    fetcher
  );

  const jjolmRecords = jjolmData?.data || [];

  // Auto-populate when modal opens with a preloaded JJOLM
  // and trigger search after state is set
  useEffect(() => {
    if (open && preloadedJJOLM) {
      setReference(preloadedJJOLM);
      setError(null); // Clear any previous errors
      setShipmentData(null); // Clear previous data
    }
  }, [open, preloadedJJOLM]);

  // Auto-search when reference is populated from preloadedJJOLM
  useEffect(() => {
    if (open && preloadedJJOLM && reference === preloadedJJOLM) {
      // Reference has been set, now trigger search
      const timer = setTimeout(() => {
        handleSearch();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [reference, open, preloadedJJOLM]);

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
            shipmentStatus: transportData.shipmentStatus || 'Unknown',
            reference: transportData.reference || reference,
            shipmentDetailsURL: transportData.shipmentDetailsURL,
          });
        } else if (transportData.shipmentStatus || transportData.reference) {
          // Has some data but no containers
          setShipmentData(transportData);
        } else {
          throw new Error(`No shipment found for reference: ${reference || containerNumber}`);
        }
      } else {
        throw new Error(`No shipment found for reference: ${reference || containerNumber}. Please verify the JJOLM number is correct and exists in OL-USA's system.`);
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

  const getStatusColor = (status: string | null | undefined) => {
    if (!status) {
      return 'bg-gray-100 text-gray-800 border-gray-200';
    }
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
            {/* JJOLM Dropdown Selector */}
            <div className="mb-4">
              <Label htmlFor="jjolmSelect">Select from Your Shipments</Label>
              <select
                id="jjolmSelect"
                className="w-full mt-1 p-2 border rounded-md text-sm"
                value=""
                onChange={(e) => {
                  if (e.target.value) {
                    setReference(e.target.value);
                    setError(null);
                    setShipmentData(null);
                  }
                }}
                disabled={isLoading || isLoadingJJOLM}
              >
                <option value="">
                  {isLoadingJJOLM 
                    ? 'Loading JJOLM numbers...' 
                    : jjolmRecords.length > 0 
                      ? `Select JJOLM (${jjolmRecords.length} available)` 
                      : 'No JJOLM numbers found'}
                </option>
                {jjolmRecords.map((record) => (
                  <option key={record.id} value={record.jjolmNumber}>
                    {record.jjolmNumber}
                    {record.customerReferenceNumber ? ` - ${record.customerReferenceNumber}` : ''}
                    {record.status ? ` (${record.status})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Or enter manually</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="reference">Reference Number (JJOLM)</Label>
                <Input
                  id="reference"
                  placeholder="e.g., JJOLM255281"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              <div>
                <Label htmlFor="containerNumber">Container Number (Optional)</Label>
                <Input
                  id="containerNumber"
                  placeholder="Optional - leave blank if unknown"
                  value={containerNumber}
                  onChange={(e) => setContainerNumber(e.target.value)}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Environment and Query Type selectors hidden - defaults to production and fullTransportDetails */}
            {false && (
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
            )}

            {/* Simple info message */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm mb-4">
              <div className="flex items-start">
                <span className="text-blue-600 mr-2">ℹ️</span>
                <p className="text-blue-800">
                  Enter your <strong>JJOLM reference number</strong> to track your shipment. Container number is optional.
                </p>
              </div>
            </div>

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
              {/* Environment Badge - Hidden for production-only UI */}
              {false && (
                <div className="flex items-center justify-between bg-gray-50 border rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">Active Environment:</span>
                    <Badge className={environment === 'sandbox' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-green-100 text-green-800 border-green-200'}>
                      {environment === 'sandbox' ? '🧪 Sandbox (Testing)' : '🚀 Production'}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Shipment Summary */}
              <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <Badge className={`${getStatusColor(shipmentData.shipmentStatus)} mt-1`}>
                      {shipmentData.shipmentStatus || 'Unknown'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Reference</p>
                    <p className="font-medium text-gray-900">{shipmentData.reference || reference || 'N/A'}</p>
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

