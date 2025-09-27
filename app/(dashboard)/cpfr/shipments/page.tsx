'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { useDropzone } from 'react-dropzone';
import useSWR from 'swr';
import { User, ProductSku, Warehouse } from '@/lib/db/schema';
import { useSimpleTranslations, getUserLocale } from '@/lib/i18n/simple-translator';
import { DynamicTranslation } from '@/components/DynamicTranslation';

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
  salesSignal: 'unknown' | 'draft' | 'submitted' | 'confirmed' | 'rejected';
  factorySignal: 'unknown' | 'reviewing' | 'confirmed' | 'rejected';
  shippingSignal: 'unknown' | 'submitted' | 'rejected' | 'confirmed'; // Legacy - keeping for compatibility
  transitSignal: 'unknown' | 'pending' | 'submitted' | 'rejected' | 'confirmed';
  warehouseSignal: 'unknown' | 'pending' | 'submitted' | 'rejected' | 'confirmed';
  shippingPreference: string;
  notes?: string;
  createdAt: string;
  customExwDate?: string; // Custom EXW date from Lead Time Options
  
  // New comprehensive date fields
  estimatedTransitStart?: string;
  estimatedWarehouseArrival?: string;
  confirmedDeliveryDate?: string;
  originalDeliveryDate?: string;
  originalExwDate?: string;
  originalTransitStart?: string;
  originalWarehouseArrival?: string;
  
  // Manual override fields
  manualFactoryLeadTime?: number;
  manualTransitTime?: number;
  manualWarehouseProcessing?: number;
  manualBufferDays?: number;
  
  // Change tracking
  dateChangeHistory?: any[];
  lastDateChangeBy?: string;
  lastDateChangeAt?: string;
  dateChangeReason?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ShipmentsPage() {
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  
  // 🌍 Translation hooks
  const userLocale = getUserLocale(user);
  const { tc, tcpfr } = useSimpleTranslations(userLocale);
  
  const { data: forecasts, mutate: mutateForecasts } = useSWR<SalesForecast[]>('/api/cpfr/forecasts', fetcher);
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
  const { data: actualShipments, mutate: mutateShipments } = useSWR('/api/cpfr/shipments', fetcher);
  
  // Ensure actualShipments is an array before using
  const actualShipmentsArray = Array.isArray(actualShipments) ? actualShipments : [];
  const { data: jjolmData, mutate: mutateJjolm } = useSWR('/api/cpfr/jjolm-reports', fetcher);

  // JJOLM Upload Functions
  const handleJjolmFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setJjolmFile(file);
      setJjolmUploadResult(null);
    }
  };

  const handleJjolmUpload = async () => {
    if (!jjolmFile) return;

    setUploadingJjolm(true);
    try {
      const formData = new FormData();
      formData.append('file', jjolmFile);

      const response = await fetch('/api/cpfr/jjolm-reports', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      
      if (response.ok) {
        setJjolmUploadResult(result);
        setJjolmFile(null);
        
        // Refresh JJOLM data for dropdown
        mutateJjolm();
        
        // Reset file input
        const fileInput = document.getElementById('jjolm-file-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        alert(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      console.error('JJOLM upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploadingJjolm(false);
    }
  };

  const handleViewJjolmTimeline = (jjolmNumber: string) => {
    setSelectedJjolmForTimeline(jjolmNumber);
    setShowJjolmTimeline(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return (
      <DynamicTranslation userLanguage={userLocale} context="general">
        Not set
      </DynamicTranslation>
    );
    return new Date(dateString).toLocaleDateString();
  };

  const getEventIcon = (icon: string) => {
    const iconMap: { [key: string]: string } = {
      plus: 'plus',
      sync: 'sync',
      shipping: 'shipping',
      calendar: 'calendar',
      check: 'check',
    };
    return iconMap[icon] || 'sync';
  };

  const getEventColor = (color: string) => {
    const colorMap: { [key: string]: string } = {
      green: 'text-green-600 bg-green-100',
      blue: 'text-blue-600 bg-blue-100',
      purple: 'text-purple-600 bg-purple-100',
      orange: 'text-orange-600 bg-orange-100',
      yellow: 'text-yellow-600 bg-yellow-100',
      indigo: 'text-indigo-600 bg-indigo-100',
    };
    return colorMap[color] || 'text-gray-600 bg-gray-100';
  };

  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [selectedShipment, setSelectedShipment] = useState<SalesForecast | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  
  // Status change modal state
  const [statusChangeModal, setStatusChangeModal] = useState<{
    isOpen: boolean;
    milestone: 'sales' | 'factory' | 'transit' | 'warehouse' | null;
    forecast: SalesForecast | null;
  }>({
    isOpen: false,
    milestone: null,
    forecast: null
  });
  
  // Shipment form state - Updated for 3-step flow
  const [shipmentForm, setShipmentForm] = useState({
    // Step 1: Origin Factory
    originFactoryId: '',
    customOriginFactory: '', // Custom origin entry
    
    // Step 2: Shipping Partner  
    shippingOrganizationId: '',
    customShippingPartner: '', // Custom shipping partner entry
    
    // Step 3: Final Destination
    destinationWarehouseId: '',
    customDestinationWarehouse: '', // Custom destination entry
    
    // Additional fields
    shipperReference: '',
    factoryWarehouseId: '', // Keep for backward compatibility
    unitsPerCarton: selectedShipment?.sku?.boxesPerCarton || 5,
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
  const [shipmentDocuments, setShipmentDocuments] = useState<Map<string, File[]>>(new Map());
  const [isCreatingShipment, setIsCreatingShipment] = useState(false);
  const [createdShipments, setCreatedShipments] = useState<Map<string, any>>(new Map());
  
  // JJOLM Upload Modal State
  const [showJjolmModal, setShowJjolmModal] = useState(false);
  const [jjolmFile, setJjolmFile] = useState<File | null>(null);
  const [uploadingJjolm, setUploadingJjolm] = useState(false);
  const [jjolmUploadResult, setJjolmUploadResult] = useState<any>(null);
  const [selectedJjolmForTimeline, setSelectedJjolmForTimeline] = useState<string | null>(null);
  const [showJjolmTimeline, setShowJjolmTimeline] = useState(false);
  
  // Timeline data for selected JJOLM
  const { data: timelineData, isLoading: timelineLoading } = useSWR(
    selectedJjolmForTimeline ? `/api/cpfr/jjolm-reports/${selectedJjolmForTimeline}/timeline` : null,
    fetcher
  );
  const [uploadedDocumentsFromDB, setUploadedDocumentsFromDB] = useState<Map<string, any[]>>(new Map());
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [documentsForCurrentShipment, setDocumentsForCurrentShipment] = useState<any[]>([]);

  // Load existing shipment data when opening Details modal
  useEffect(() => {
    if (selectedShipment) {
      console.log('🔍 Loading shipment data for forecast:', selectedShipment.id);
      console.log('🔍 Available shipments from DB:', actualShipments);
      console.log('🔍 Local shipments:', Array.from(createdShipments.entries()));
      
      // Check if this forecast already has a shipment created
      const existingShipment = actualShipmentsArray.find((shipment: any) => shipment.forecast_id === selectedShipment.id);
      const localShipment = createdShipments.get(selectedShipment.id);
      
      console.log('🔍 Found existing shipment:', existingShipment);
      console.log('🔍 Found local shipment:', localShipment);
      
      if (existingShipment || localShipment) {
        // Populate form with existing shipment data
        const shipmentData = existingShipment || localShipment;
        console.log('🔍 Using shipment data:', shipmentData);
        console.log('🔍 3-Step Flow Debug:');
        console.log('   - organization_id:', shipmentData.organization_id);
        console.log('   - shipper_organization_id:', shipmentData.shipper_organization_id);
        console.log('   - destination_warehouse_id:', shipmentData.destination_warehouse_id);
        
        const formData = {
          // Step 1: Origin Factory (check warehouse origin first, then organization)
          originFactoryId: shipmentData.origin_warehouse_id || shipmentData.organization_id || shipmentData.organizationId || '',
          
          // Step 2: Shipping Partner (handle custom entries)
          shippingOrganizationId: shipmentData.shipper_organization_id || shipmentData.shipperOrganizationId || 
            (shipmentData.shipper_reference?.includes('LCL') ? 'lcl' : 
             shipmentData.shipper_reference && !shipmentData.shipper_organization_id ? 'custom' : ''),
          
          // Step 3: Final Destination (handle custom entries)
          destinationWarehouseId: shipmentData.destination_warehouse_id || shipmentData.destinationWarehouseId || 
            (shipmentData.destination_custom_location && shipmentData.destination_custom_location !== 'Customer Warehouse' ? 'custom' : ''),
          
          // Legacy/Additional fields
          shipperReference: shipmentData.shipper_reference || shipmentData.shipperReference || '',
          factoryWarehouseId: shipmentData.factory_warehouse_id || shipmentData.factoryWarehouseId || '',
          unitsPerCarton: shipmentData.units_per_carton || shipmentData.unitsPerCarton || selectedShipment?.sku?.boxesPerCarton || 5,
          requestedQuantity: shipmentData.requested_quantity || shipmentData.requestedQuantity || selectedShipment.quantity,
          notes: shipmentData.notes || '',
          priority: shipmentData.priority || 'standard',
          incoterms: shipmentData.incoterms || 'EXW',
          pickupLocation: shipmentData.pickup_location || shipmentData.pickupLocation || '',
          deliveryLocation: shipmentData.delivery_location || shipmentData.deliveryLocation || '',
          estimatedShipDate: shipmentData.estimated_departure ? new Date(shipmentData.estimated_departure).toISOString().split('T')[0] : '',
          requestedDeliveryDate: shipmentData.estimated_arrival ? new Date(shipmentData.estimated_arrival).toISOString().split('T')[0] : '',
          overrideDefaults: false, // Default to unchecked, user can check if they want to override
          
          // Custom entry fields (populate from existing data)
          customOriginFactory: shipmentData.origin_custom_location || '',
          customShippingPartner: (shipmentData.shipper_reference && !shipmentData.shipper_organization_id && !shipmentData.shipper_reference.includes('LCL')) ? shipmentData.shipper_reference : '',
          customDestinationWarehouse: (shipmentData.destination_custom_location && shipmentData.destination_custom_location !== 'Customer Warehouse') ? shipmentData.destination_custom_location : ''
        };
        
        console.log('🔍 Setting form data:', formData);
        setShipmentForm(formData);

        // Load existing documents if available
        const shipmentId = existingShipment?.id || localShipment?.id;
        if (shipmentId) {
          console.log('🔍 Loading documents for shipment:', shipmentId);
          setLoadingDocuments(true);
          fetch(`/api/cpfr/shipments/${shipmentId}/documents`)
            .then(res => res.json())
            .then(docs => {
              console.log('🔍 Loaded documents from API:', docs);
              console.log('🔍 Setting documents for forecast ID:', selectedShipment.id);
              console.log('🔍 Documents array length:', docs?.length || 0);
              
              // Use same method as successful update callback
              console.log('🔍 INITIAL LOAD PATH - Setting documents state:');
              console.log('🔍 INITIAL LOAD PATH - Docs to set:', docs);
              console.log('🔍 INITIAL LOAD PATH - Forecast ID:', selectedShipment.id);
              setUploadedDocumentsFromDB(prev => new Map(prev.set(selectedShipment.id, docs || [])));
              setDocumentsForCurrentShipment(docs || []);
              console.log('🔍 INITIAL LOAD PATH - State updated');
              console.log('🔍 INITIAL LOAD PATH - documentsForCurrentShipment set to:', docs || []);
              setLoadingDocuments(false);
            })
            .catch(err => {
              console.error('Error loading existing documents:', err);
              setLoadingDocuments(false);
            });
        } else {
          console.log('🔍 No shipment ID found - no documents to load');
          setLoadingDocuments(false);
        }
      } else {
        console.log('🔍 No existing shipment found - creating new');
        // Reset form for new shipment
        setShipmentForm({
          // Step 1: Origin Factory
          originFactoryId: '',
          
          // Step 2: Shipping Partner  
          shippingOrganizationId: '',
          
          // Step 3: Final Destination
          destinationWarehouseId: '',
          
          // Additional fields
          shipperReference: '',
          factoryWarehouseId: '',
          unitsPerCarton: selectedShipment?.sku?.boxesPerCarton || 5,
          requestedQuantity: 0,
          notes: '',
          priority: 'standard',
          incoterms: 'EXW',
          pickupLocation: '',
          deliveryLocation: '',
          estimatedShipDate: '',
          requestedDeliveryDate: '',
          overrideDefaults: false,
          
          // Custom entry fields
          customOriginFactory: '',
          customShippingPartner: '',
          customDestinationWarehouse: ''
        });
      }
    } else {
      // Clear documents when modal closes
      console.log('🔍 Modal closed - clearing documents state');
      setUploadedDocumentsFromDB(new Map());
      setShipmentDocuments(new Map());
      setDocumentsForCurrentShipment([]);
    }
  }, [selectedShipment, actualShipments, createdShipments]);

  // Watch for changes in uploadedDocumentsFromDB and update display state
  useEffect(() => {
    if (selectedShipment) {
      const docs = uploadedDocumentsFromDB.get(selectedShipment.id);
      if (docs && docs.length > 0) {
        console.log('👀 WATCHER - Documents found for shipment, updating display state:', docs);
        setDocumentsForCurrentShipment(docs);
      }
    }
  }, [uploadedDocumentsFromDB, selectedShipment]);

  // Drag and drop for cost documents (shipment-specific)
  const onDrop = useCallback((confirmedFiles: File[]) => {
    if (selectedShipment) {
      setShipmentDocuments(prev => {
        const newMap = new Map(prev);
        const existingDocs = newMap.get(selectedShipment.id) || [];
        newMap.set(selectedShipment.id, [...existingDocs, ...confirmedFiles]);
        return newMap;
      });
    }
  }, [selectedShipment]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    multiple: true
  });

  // Get documents for current shipment
  const currentShipmentDocs = selectedShipment ? (shipmentDocuments.get(selectedShipment.id) || []) : [];

  // Helper function to get default dates from forecast (simplified to avoid crashes)
  const getDefaultDatesFromForecast = (forecast: SalesForecast) => {
    // Always start with safe fallback dates
    const today = new Date();
    const defaultShipDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    const defaultDeliveryDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
    
    // For now, just use simple defaults based on shipping preference
    // We'll enhance this later once the core functionality is working
    const shippingDays = forecast?.shippingPreference?.includes('AIR') ? 7 : 21;
    const calculatedShipDate = new Date(defaultDeliveryDate.getTime() - shippingDays * 24 * 60 * 60 * 1000);
    
    return {
      estimatedShipDate: calculatedShipDate.toISOString().split('T')[0],
      requestedDeliveryDate: defaultDeliveryDate.toISOString().split('T')[0]
    };
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

  // Get organizations by type for 3-step flow
  const manufacturingOrganizations = Array.isArray(organizations) 
    ? organizations.filter((org: any) => ['contractor', 'oem_partner', 'manufacturing', 'internal'].includes(org.type))
    : [];
    
  const shippingOrganizations = Array.isArray(organizations) 
    ? organizations.filter((org: any) => org.type === 'shipping_logistics')
    : (user?.organization?.type === 'shipping_logistics' ? [user.organization] : []);
    
  const allWarehouses = Array.isArray(warehouses) ? warehouses : [];

  // Handle shipment form submission (Create OR Update)
  const handleCreateShipment = async () => {
    if (!selectedShipment) {
      alert('No shipment selected');
      return;
    }
    
    // Validate 3-step flow
    if (!shipmentForm.originFactoryId) {
      alert('Please select an origin factory (Step 1)');
      return;
    }
    
    if (!shipmentForm.shippingOrganizationId) {
      alert('Please select a shipping partner (Step 2)');
      return;
    }
    
    if (!shipmentForm.destinationWarehouseId) {
      alert('Please select a destination warehouse (Step 3)');
      return;
    }
    
    // Validate organizations are different
    if (shipmentForm.originFactoryId === shipmentForm.shippingOrganizationId) {
      alert('Origin factory and shipping partner must be different organizations');
      return;
    }

    setIsCreatingShipment(true);
    try {
      // Check if shipment already exists for this forecast
      const existingShipment = actualShipmentsArray.find((shipment: any) => shipment.forecast_id === selectedShipment.id);
      const localShipment = createdShipments.get(selectedShipment.id);
      const isUpdate = existingShipment || localShipment;
      const shipmentId = existingShipment?.id || localShipment?.id;
      
      console.log('🔧 Shipment operation:', isUpdate ? 'UPDATE' : 'CREATE');
      console.log('🔧 Existing shipment ID:', shipmentId);
      
      const response = await fetch(
        isUpdate ? `/api/cpfr/shipments/${shipmentId}` : '/api/cpfr/shipments',
        {
          method: isUpdate ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            forecastId: selectedShipment.id,
            // New 3-step flow data
            organizationId: shipmentForm.originFactoryId, // Step 1: Origin Factory
            shipperOrganizationId: shipmentForm.shippingOrganizationId, // Step 2: Shipping Partner
            destinationWarehouseId: shipmentForm.destinationWarehouseId, // Step 3: Final Destination
            // Custom entry fields - CRITICAL FOR UPDATES
            customOriginFactory: shipmentForm.customOriginFactory,
            customShippingPartner: shipmentForm.customShippingPartner,
            customDestinationWarehouse: shipmentForm.customDestinationWarehouse,
            // Legacy fields for backward compatibility
            shippingOrganizationCode: shipmentForm.shippingOrganizationId, // Map to legacy field
            // Include other form fields (excluding the ones we already set above)
            shipperReference: shipmentForm.shipperReference,
            factoryWarehouseId: shipmentForm.factoryWarehouseId,
            unitsPerCarton: shipmentForm.unitsPerCarton,
            requestedQuantity: shipmentForm.requestedQuantity,
            notes: shipmentForm.notes,
            priority: shipmentForm.priority,
            incoterms: shipmentForm.incoterms,
            pickupLocation: shipmentForm.pickupLocation,
            deliveryLocation: shipmentForm.deliveryLocation,
            estimatedShipDate: shipmentForm.estimatedShipDate,
            requestedDeliveryDate: shipmentForm.requestedDeliveryDate,
            overrideDefaults: shipmentForm.overrideDefaults,
            calculatedData: calculateShippingData(
              selectedShipment.sku, 
              shipmentForm.requestedQuantity || selectedShipment.quantity, 
              shipmentForm.unitsPerCarton
            )
          }),
        }
      );

      const result = await response.json();
      if (result.success) {
        // Store the created shipment data
        setCreatedShipments(prev => new Map(prev.set(selectedShipment.id, result.shipment)));
        
        // CRITICAL: Refresh shipments data to show updated notes and custom fields
        mutateShipments();
        
        // Upload documents if any were attached
        const currentDocs = currentShipmentDocs;
        if (currentDocs.length > 0) {
          try {
            const formData = new FormData();
            currentDocs.forEach((file, index) => {
              formData.append(`file${index}`, file);
            });
            
            const docsResponse = await fetch(`/api/cpfr/shipments/${result.shipment.id}/documents`, {
              method: 'POST',
              body: formData,
            });
            
            if (docsResponse.ok) {
              // Fetch the uploaded documents from database
              const fetchDocsResponse = await fetch(`/api/cpfr/shipments/${result.shipment.id}/documents`);
              if (fetchDocsResponse.ok) {
                const uploadedDocs = await fetchDocsResponse.json();
                console.log('📎 UPDATE PATH - Fetched documents after upload:', uploadedDocs);
                console.log('📎 UPDATE PATH - Forecast ID:', selectedShipment.id);
                console.log('📎 UPDATE PATH - Setting documents state:');
                // Use selectedShipment.id (forecast ID) as key since that's what we check in display
                setUploadedDocumentsFromDB(prev => new Map(prev.set(selectedShipment.id, uploadedDocs)));
                setDocumentsForCurrentShipment(uploadedDocs || []);
                console.log('📎 UPDATE PATH - State updated');
                console.log('📎 UPDATE PATH - documentsForCurrentShipment set to:', uploadedDocs || []);
              } else {
                console.error('📎 Failed to fetch documents after upload:', fetchDocsResponse.status);
              }
              alert(`Shipment ${isUpdate ? 'updated' : 'created'} successfully with ${currentDocs.length} documents uploaded!`);
            } else {
              alert(`Shipment ${isUpdate ? 'updated' : 'created'} but document upload failed`);
            }
          } catch (docError) {
            console.error('Error uploading documents:', docError);
            alert(`Shipment ${isUpdate ? 'updated' : 'created'} but document upload failed`);
          }
        } else {
          alert(isUpdate ? 'Shipment updated successfully!' : 'Shipment created successfully and logged for shipper processing!');
        }
        
        // Refresh the forecasts data to update timeline status
        mutateForecasts();
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
    
    // Get the current shipment data for configuration fields
    const currentShipment = actualShipmentsArray.find((s: any) => s.forecast_id === selectedShipment.id);
    
    // Get full warehouse details for all three steps (Origin Factory, Shipping Partner, Final Destination)
    // DYNAMIC LOOKUP: Use actual selected data instead of hardcoded defaults
    
    // Step 1: Origin Factory - Check if it's a warehouse origin (like EMG) or organization
    const originFactoryWarehouse = currentShipment?.origin_warehouse_id 
      ? allWarehouses.find((w: any) => w.id === currentShipment.origin_warehouse_id)
      : allWarehouses.find((w: any) => w.id === shipmentForm.originFactoryId) ||
        allWarehouses.find((w: any) => w.warehouseCode === 'MTN-FACTORY'); // Fallback to MTN
    
    // Step 2: Shipping Partner - Use custom text or find warehouse
    const shippingPartnerWarehouse = currentShipment?.shipper_organization_id
      ? allWarehouses.find((w: any) => w.id === currentShipment.shipper_organization_id)
      : allWarehouses.find((w: any) => w.id === shipmentForm.shippingOrganizationId) ||
        allWarehouses.find((w: any) => w.warehouseCode === 'OLM'); // Fallback to OLM
    
    // Step 3: Final Destination - Use actual selection
    const destinationWarehouse = allWarehouses.find((w: any) => w.id === shipmentForm.destinationWarehouseId) ||
                                 allWarehouses.find((w: any) => w.id === currentShipment?.destination_warehouse_id) ||
                                 allWarehouses.find((w: any) => w.warehouseCode === 'EMG'); // Fallback to EMG
    
    // Helper function to get primary contact from CPFR contacts
    const getPrimaryContact = (cpfrContacts: any) => {
      if (cpfrContacts?.primary_contacts && cpfrContacts.primary_contacts.length > 0) {
        return cpfrContacts.primary_contacts[0];
      }
      return null;
    };
    
    // Helper function to get warehouse contacts
    const getWarehouseContacts = (warehouse: any) => {
      if (warehouse?.contacts && Array.isArray(warehouse.contacts)) {
        return warehouse.contacts;
      }
      return [];
    };
    
    // Helper function to format capabilities
    const formatCapabilities = (capabilities: any) => {
      if (!capabilities) return 'Not Available';
      const caps = [];
      if (capabilities.airFreight) caps.push('Air');
      if (capabilities.seaFreight) caps.push('Sea');
      if (capabilities.truckLoading) caps.push('Truck');
      if (capabilities.railAccess) caps.push('Rail');
      if (capabilities.coldStorage) caps.push('Cold Storage');
      if (capabilities.hazmatHandling) caps.push('Hazmat');
      return caps.length > 0 ? caps.join(', ') : 'Standard';
    };
    
    // Get primary warehouse contact
    const getPrimaryWarehouseContact = (contacts: any) => {
      if (Array.isArray(contacts) && contacts.length > 0) {
        const primary = contacts.find((c: any) => c.isPrimary) || contacts[0];
        return primary;
      }
      return null;
    };
    
    // Legacy warehouse for backward compatibility
    const linkedWarehouse = warehouses?.find((w: any) => w.id === shipmentForm.factoryWarehouseId);
    
    const csvData = [
      ['Field', 'Value', '', 'CTN_L', 'CTN_W', 'CTN_H', 'CBM per Carton'],
      ['Select SKU', selectedShipment.sku.sku.replace(/\([^)]*\)/g, '').replace(/-+$/, '').trim(), '', shippingData.ctnL, shippingData.ctnW, shippingData.ctnH, shippingData.cbmPerCarton],
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
      ['Cost per Unit (SEA)', shippingData.costPerUnitSEA, '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      
      // 3-Step Shipment Route Summary - DYNAMIC based on actual selections
      ['=== SHIPMENT ROUTE SUMMARY ===', '', '', '', '', '', ''],
      ['Origin Factory', (() => {
        if (currentShipment?.origin_custom_location || shipmentForm.customOriginFactory) {
          return currentShipment?.origin_custom_location || shipmentForm.customOriginFactory || 'Custom Origin';
        }
        return originFactoryWarehouse?.name || 'Not Set';
      })(), '', '', '', '', ''],
      ['Shipping Partner', (() => {
        if (currentShipment?.shipper_reference && !currentShipment?.shipper_organization_id) {
          return currentShipment.shipper_reference;
        }
        if (shipmentForm.customShippingPartner) {
          return shipmentForm.customShippingPartner;
        }
        if (shipmentForm.shippingOrganizationId === 'lcl') {
          return 'LCL (Less than Container Load)';
        }
        return shippingPartnerWarehouse?.name || 'Not Set';
      })(), '', '', '', '', ''],
      ['Final Destination', (() => {
        if (currentShipment?.destination_custom_location || shipmentForm.customDestinationWarehouse) {
          return currentShipment?.destination_custom_location || shipmentForm.customDestinationWarehouse || 'Custom Destination';
        }
        return destinationWarehouse?.name || 'Not Set';
      })(), '', '', '', '', ''],
      ['Route Flow', (() => {
        const origin = (currentShipment?.origin_custom_location || shipmentForm.customOriginFactory) ? 'CUSTOM' : (originFactoryWarehouse?.warehouseCode || 'Factory');
        const shipper = (currentShipment?.shipper_reference && !currentShipment?.shipper_organization_id) ? 'CUSTOM' : 
                       shipmentForm.shippingOrganizationId === 'lcl' ? 'LCL' : (shippingPartnerWarehouse?.warehouseCode || 'Shipper');
        const destination = (currentShipment?.destination_custom_location || shipmentForm.customDestinationWarehouse) ? 'CUSTOM' : (destinationWarehouse?.warehouseCode || 'Warehouse');
        return `${origin} → ${shipper} → ${destination}`;
      })(), '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      
      // Shipment Configuration Section
      ['=== SHIPMENT CONFIGURATION ===', '', '', '', '', '', ''],
      ['Shipper Reference Number', shipmentForm.shipperReference || 'Not Set', '', '', '', '', ''],
      ['Shipment Priority', shipmentForm.priority || 'Standard', '', '', '', '', ''],
      ['Incoterms', currentShipment?.incoterms || shipmentForm.incoterms || 'Not Set', '', '', '', ''],
      ['Estimated Ship Date', currentShipment?.estimated_departure ? new Date(currentShipment.estimated_departure).toLocaleDateString() : 'Not Set', '', '', '', '', ''],
      ['Requested Delivery Date', currentShipment?.estimated_arrival ? new Date(currentShipment.estimated_arrival).toLocaleDateString() : 'Not Set', '', '', '', '', ''],
      ['Shipping Method', selectedShipment.shippingPreference || 'Not Set', '', '', '', '', ''],
      ['Special Instructions', currentShipment?.notes || selectedShipment.notes || 'None', '', '', '', '', ''],
      ['', '', '', '', '', '', ''],
      
      // Origin Factory Details - Dynamic based on actual selection
      ['=== ORIGIN FACTORY DETAILS ===', '', '', '', '', '', ''],
      ['Factory Name', (() => {
        // Handle custom origin
        if (currentShipment?.origin_custom_location || shipmentForm.customOriginFactory) {
          return currentShipment?.origin_custom_location || shipmentForm.customOriginFactory || 'Custom Origin';
        }
        // Handle warehouse origin (like EMG)
        return originFactoryWarehouse?.name || 'Not Available';
      })(), '', '', '', '', ''],
      ['Warehouse Code', originFactoryWarehouse?.warehouseCode || 'Not Available', '', '', '', '', ''],
      ['Factory Type', originFactoryWarehouse?.type || 'Not Available', '', '', '', '', ''],
      ['Full Address', originFactoryWarehouse?.address || 'Not Available', '', '', '', '', ''],
      ['City', originFactoryWarehouse?.city || 'Not Available', '', '', '', '', ''],
      ['State/Province', originFactoryWarehouse?.state || 'Not Available', '', '', '', '', ''],
      ['Country', originFactoryWarehouse?.country || 'Not Available', '', '', '', '', ''],
      ['Postal Code', originFactoryWarehouse?.postalCode || 'Not Available', '', '', '', '', ''],
      ['Timezone', originFactoryWarehouse?.timezone || 'Not Available', '', '', '', '', ''],
      ['Operating Hours', originFactoryWarehouse?.operatingHours || 'Not Available', '', '', '', '', ''],
      ['Primary Contact Name', originFactoryWarehouse?.contactName || 'Not Available', '', '', '', '', ''],
      ['Primary Contact Email', originFactoryWarehouse?.contactEmail || 'Not Available', '', '', '', '', ''],
      ['Primary Contact Phone', originFactoryWarehouse?.contactPhone || 'Not Available', '', '', '', '', ''],
      ['Shipping Capabilities', formatCapabilities(originFactoryWarehouse?.capabilities), '', '', '', '', ''],
      ['Main Capabilities', Array.isArray((originFactoryWarehouse as any)?.mainCapabilities) ? (originFactoryWarehouse as any).mainCapabilities.join(', ') : 'Not Available', '', '', '', '', ''],
      ['Max Pallet Height', `${originFactoryWarehouse?.maxPalletHeightCm || 'N/A'} cm`, '', '', '', '', ''],
      ['Max Pallet Weight', `${originFactoryWarehouse?.maxPalletWeightKg || 'N/A'} kg`, '', '', '', '', ''],
      ['Loading Dock Count', originFactoryWarehouse?.loadingDockCount || 'N/A', '', '', '', '', ''],
      ['Storage Capacity', `${originFactoryWarehouse?.storageCapacitySqm || 'N/A'} sqm`, '', '', '', '', ''],
      ['Warehouse Notes', originFactoryWarehouse?.notes || 'None', '', '', '', '', ''],
      // Additional Factory Contacts
      ...((() => {
        const factoryContacts = getWarehouseContacts(originFactoryWarehouse);
        const contactRows: string[][] = [];
        factoryContacts.forEach((contact: any, index: number) => {
          contactRows.push(['Additional Contact ' + (index + 1), `${contact.name} - ${contact.email}${contact.phone ? ` - ${contact.phone}` : ''}${contact.isPrimary ? ' (PRIMARY)' : ''}`, '', '', '', '', '']);
        });
        return contactRows.length > 0 ? contactRows : [['Additional Contacts', 'None Available', '', '', '', '', '']];
      })()),
      ['', '', '', '', '', '', ''],
      
      // Shipping Partner Details - Dynamic based on actual selection
      ['=== SHIPPING PARTNER DETAILS ===', '', '', '', '', '', ''],
      ['Shipper Name', (() => {
        // Handle custom shipping partner
        if (currentShipment?.shipper_reference && !currentShipment?.shipper_organization_id) {
          return currentShipment.shipper_reference;
        }
        if (shipmentForm.customShippingPartner) {
          return shipmentForm.customShippingPartner;
        }
        if (shipmentForm.shippingOrganizationId === 'lcl') {
          return 'LCL (Less than Container Load)';
        }
        // Handle warehouse/organization shipping partner
        return shippingPartnerWarehouse?.name || 'Not Available';
      })(), '', '', '', '', ''],
      ['Warehouse Code', shippingPartnerWarehouse?.warehouseCode || 'Not Available', '', '', '', '', ''],
      ['Shipper Type', shippingPartnerWarehouse?.type || 'Not Available', '', '', '', '', ''],
      ['Full Address', shippingPartnerWarehouse?.address || 'Not Available', '', '', '', '', ''],
      ['City', shippingPartnerWarehouse?.city || 'Not Available', '', '', '', '', ''],
      ['State/Province', shippingPartnerWarehouse?.state || 'Not Available', '', '', '', '', ''],
      ['Country', shippingPartnerWarehouse?.country || 'Not Available', '', '', '', '', ''],
      ['Postal Code', shippingPartnerWarehouse?.postalCode || 'Not Available', '', '', '', '', ''],
      ['Timezone', shippingPartnerWarehouse?.timezone || 'Not Available', '', '', '', '', ''],
      ['Operating Hours', shippingPartnerWarehouse?.operatingHours || 'Not Available', '', '', '', '', ''],
      ['Primary Contact Name', shippingPartnerWarehouse?.contactName || 'Not Available', '', '', '', '', ''],
      ['Primary Contact Email', shippingPartnerWarehouse?.contactEmail || 'Not Available', '', '', '', '', ''],
      ['Primary Contact Phone', shippingPartnerWarehouse?.contactPhone || 'Not Available', '', '', '', '', ''],
      ['Shipping Capabilities', formatCapabilities(shippingPartnerWarehouse?.capabilities), '', '', '', '', ''],
      ['Main Capabilities', Array.isArray((shippingPartnerWarehouse as any)?.mainCapabilities) ? (shippingPartnerWarehouse as any).mainCapabilities.join(', ') : 'Not Available', '', '', '', '', ''],
      ['Max Pallet Height', `${shippingPartnerWarehouse?.maxPalletHeightCm || 'N/A'} cm`, '', '', '', '', ''],
      ['Max Pallet Weight', `${shippingPartnerWarehouse?.maxPalletWeightKg || 'N/A'} kg`, '', '', '', '', ''],
      ['Loading Dock Count', shippingPartnerWarehouse?.loadingDockCount || 'N/A', '', '', '', '', ''],
      ['Storage Capacity', `${shippingPartnerWarehouse?.storageCapacitySqm || 'N/A'} sqm`, '', '', '', '', ''],
      ['Warehouse Notes', shippingPartnerWarehouse?.notes || 'None', '', '', '', '', ''],
      // Additional Shipping Partner Contacts
      ...((() => {
        const shipperContacts = getWarehouseContacts(shippingPartnerWarehouse);
        const contactRows: string[][] = [];
        shipperContacts.forEach((contact: any, index: number) => {
          contactRows.push(['Additional Contact ' + (index + 1), `${contact.name} - ${contact.email}${contact.phone ? ` - ${contact.phone}` : ''}${contact.isPrimary ? ' (PRIMARY)' : ''}`, '', '', '', '', '']);
        });
        return contactRows.length > 0 ? contactRows : [['Additional Contacts', 'None Available', '', '', '', '', '']];
      })()),
      ['', '', '', '', '', '', ''],
      
      // Destination Warehouse Details - Dynamic based on actual selection
      ['=== FINAL DESTINATION DETAILS ===', '', '', '', '', '', ''],
      ['Destination Name', (() => {
        // Handle custom destination
        if (currentShipment?.destination_custom_location || shipmentForm.customDestinationWarehouse) {
          return currentShipment?.destination_custom_location || shipmentForm.customDestinationWarehouse || 'Custom Destination';
        }
        // Handle warehouse destination
        return destinationWarehouse?.name || 'Not Available';
      })(), '', '', '', '', ''],
      ['Warehouse Code', destinationWarehouse?.warehouseCode || 'Not Available', '', '', '', '', ''],
      ['Warehouse Type', destinationWarehouse?.type || 'Not Available', '', '', '', '', ''],
      ['Full Address', destinationWarehouse?.address || 'Not Available', '', '', '', '', ''],
      ['City', destinationWarehouse?.city || 'Not Available', '', '', '', '', ''],
      ['State/Province', destinationWarehouse?.state || 'Not Available', '', '', '', '', ''],
      ['Country', destinationWarehouse?.country || 'Not Available', '', '', '', '', ''],
      ['Postal Code', destinationWarehouse?.postalCode || 'Not Available', '', '', '', '', ''],
      ['Time Zone', destinationWarehouse?.timezone || 'Not Available', '', '', '', '', ''],
      ['Operating Hours', destinationWarehouse?.operatingHours || 'Not Available', '', '', '', '', ''],
      // Physical Specifications
      ['Max Pallet Height', destinationWarehouse?.maxPalletHeightCm ? `${destinationWarehouse.maxPalletHeightCm}cm` : 'Not Available', '', '', '', '', ''],
      ['Max Pallet Weight', destinationWarehouse?.maxPalletWeightKg ? `${destinationWarehouse.maxPalletWeightKg}kg` : 'Not Available', '', '', '', '', ''],
      ['Loading Docks', destinationWarehouse?.loadingDockCount ? `${destinationWarehouse.loadingDockCount} loading docks` : 'Not Available', '', '', '', '', ''],
      ['Storage Capacity', destinationWarehouse?.storageCapacitySqm ? `${destinationWarehouse.storageCapacitySqm.toLocaleString()} m²` : 'Not Available', '', '', '', '', ''],
      ['Shipping Capabilities', formatCapabilities(destinationWarehouse?.capabilities), '', '', '', '', ''],
      ['Main Capabilities', Array.isArray((destinationWarehouse as any)?.mainCapabilities) ? (destinationWarehouse as any).mainCapabilities.join(', ') : 'Not Available', '', '', '', '', ''],
      // Primary Contact
      ...((() => {
        const primaryContact = getPrimaryWarehouseContact(destinationWarehouse?.contacts);
        return primaryContact ? [
          ['Primary Contact Name', primaryContact.name || 'Not Available', '', '', '', '', ''],
          ['Primary Contact Email', primaryContact.email || 'Not Available', '', '', '', '', ''],
          ['Primary Contact Phone', primaryContact.phone || 'Not Available', '', '', '', '', ''],
          ['Primary Contact Extension', primaryContact.extension || 'N/A', '', '', '', '', ''],
        ] : [
          ['Primary Contact Name', destinationWarehouse?.contactName || 'Not Available', '', '', '', '', ''],
          ['Primary Contact Email', destinationWarehouse?.contactEmail || 'Not Available', '', '', '', '', ''],
          ['Primary Contact Phone', destinationWarehouse?.contactPhone || 'Not Available', '', '', '', '', '']
        ];
      })()),
      // Additional Destination Contacts
      ...((() => {
        const destContacts = getWarehouseContacts(destinationWarehouse);
        const contactRows: string[][] = [];
        destContacts.forEach((contact: any, index: number) => {
          contactRows.push(['Additional Contact ' + (index + 1), `${contact.name} - ${contact.email}${contact.phone ? ` - ${contact.phone}` : ''}${contact.isPrimary ? ' (PRIMARY)' : ''}`, '', '', '', '', '']);
        });
        return contactRows.length > 0 ? contactRows : [['Additional Contacts', 'None Available', '', '', '', '', '']];
      })()),
      ['Warehouse Notes', destinationWarehouse?.notes || 'None', '', '', '', '', '']
    ];
    
    const csvContent = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shipment_${selectedShipment.sku.sku.replace(/\([^)]*\)/g, '').replace(/-+$/, '').trim()}_${new Date().toISOString().split('T')[0]}.csv`;
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
  // Ensure forecasts is an array before using
  const forecastsArray = Array.isArray(forecasts) ? forecasts : [];
  const shipmentForecasts = forecastsArray;

  // Helper functions for timeline calculations
  const getShippingIcon = (shippingMethod: string) => {
    if (shippingMethod.includes('SEA')) return '🚢';
    if (shippingMethod.includes('AIR')) return '✈️';
    if (shippingMethod.includes('TRUCK')) return '🚛';
    return '📦';
  };

  // Handle milestone icon click - fetch fresh forecast data directly by ID
  const handleMilestoneClick = async (milestone: 'sales' | 'factory' | 'transit' | 'warehouse', forecast: SalesForecast) => {
    console.log(`🔄 Opening ${milestone} modal for forecast:`, forecast.id);
    
    // Fetch fresh forecast data directly by ID to ensure we have the latest dates
    try {
      const response = await fetch(`/api/cpfr/forecasts/${forecast.id}`);
      
      if (response.ok) {
        const freshForecast = await response.json();
        console.log('✅ Using fresh forecast data from direct API:', freshForecast);
        setStatusChangeModal({
          isOpen: true,
          milestone,
          forecast: freshForecast
        });
      } else {
        console.log('⚠️ Direct forecast API failed, using cached data');
        setStatusChangeModal({
          isOpen: true,
          milestone,
          forecast
        });
      }
    } catch (error) {
      console.error('❌ Failed to fetch fresh forecast data:', error);
      // Fallback to cached data
      setStatusChangeModal({
        isOpen: true,
        milestone,
        forecast
      });
    }
  };

  const calculateMilestoneDates = (forecast: SalesForecast) => {
    // Use the new comprehensive date fields from database instead of calculations
    console.log('📅 Using database date fields for forecast:', forecast.id, {
      customExwDate: forecast.customExwDate,
      estimatedTransitStart: forecast.estimatedTransitStart,
      estimatedWarehouseArrival: forecast.estimatedWarehouseArrival,
      confirmedDeliveryDate: forecast.confirmedDeliveryDate
    });
    
    // Use database dates if available, otherwise fallback to calculations
    const exwDate = forecast.customExwDate ? new Date(forecast.customExwDate) : null;
    const transitStartDate = forecast.estimatedTransitStart ? new Date(forecast.estimatedTransitStart) : exwDate;
    const warehouseArrivalDate = forecast.estimatedWarehouseArrival ? new Date(forecast.estimatedWarehouseArrival) : null;
    const finalDeliveryDate = forecast.confirmedDeliveryDate ? new Date(forecast.confirmedDeliveryDate) : null;
    
    // Fallback calculations if database dates are missing
    if (!exwDate || !transitStartDate || !warehouseArrivalDate || !finalDeliveryDate) {
      console.log('⚠️ Some database dates missing, using fallback calculations');
      
      // Parse delivery week as fallback
      const [year, week] = forecast.deliveryWeek.split('-W').map(Number);
      const deliveryWeekDate = new Date(year, 0, 1 + (week - 1) * 7);
      
      // Extract shipping days from shipping preference
      let shippingDays = 21; // Default
      if (forecast.shippingPreference.includes('AIR')) {
        const airMatch = forecast.shippingPreference.match(/AIR_(\d+)_DAYS/);
        shippingDays = airMatch ? parseInt(airMatch[1]) : 14;
      }
      
      const fallbackExwDate = exwDate || new Date(deliveryWeekDate.getTime() - (shippingDays * 24 * 60 * 60 * 1000));
      const fallbackTransitStart = transitStartDate || fallbackExwDate;
      const fallbackWarehouseArrival = warehouseArrivalDate || new Date(fallbackExwDate.getTime() + (shippingDays * 24 * 60 * 60 * 1000));
      const fallbackDelivery = finalDeliveryDate || deliveryWeekDate;
      
      return {
        salesDate: new Date(forecast.createdAt),
        exwDate: fallbackExwDate,
        departureDate: fallbackTransitStart, // Transit start = departure
        arrivalDate: fallbackWarehouseArrival,
        deliveryDate: fallbackDelivery,
        transitDays: shippingDays
      };
    }
    
    // Use database dates (preferred)
    const transitDays = forecast.manualTransitTime || 
      Math.ceil((warehouseArrivalDate.getTime() - transitStartDate.getTime()) / (24 * 60 * 60 * 1000));
    
    return {
      salesDate: new Date(forecast.createdAt),
      exwDate: exwDate,
      departureDate: transitStartDate, // Use estimatedTransitStart from database
      arrivalDate: warehouseArrivalDate, // Use estimatedWarehouseArrival from database
      deliveryDate: finalDeliveryDate, // Use confirmedDeliveryDate from database
      transitDays: transitDays
    };
  };

  const getTimelineProgress = (forecast: SalesForecast) => {
    const milestones = calculateMilestoneDates(forecast);
    const now = new Date();
    
    let completedMilestones = 0;
    
    // Check for rejected status first - overrides everything
    if (forecast.salesSignal === 'rejected' || 
        forecast.factorySignal === 'rejected' || 
        forecast.shippingSignal === 'rejected' ||
        forecast.transitSignal === 'rejected' ||
        forecast.warehouseSignal === 'rejected') {
      return 0; // Rejected = 0 milestones (red bar)
    }
    
    // Sales milestone: submitted or confirmed counts as completed
    if (forecast.salesSignal === 'submitted' || forecast.salesSignal === 'confirmed') completedMilestones = 1;
    
    // Factory milestone: confirmed counts as completed (reviewing doesn't)
    if (forecast.factorySignal === 'confirmed') completedMilestones = 2;
    if (forecast.factorySignal === 'confirmed' && now >= milestones.departureDate) completedMilestones = 3;
    
    // Check if shipment has been created for this forecast (from database or local state)
    const hasShipmentInDB = actualShipmentsArray.some((shipment: any) => shipment.forecast_id === forecast.id);
    const hasShipmentLocal = createdShipments.has(forecast.id);
    
    if (hasShipmentInDB || hasShipmentLocal) {
      // Shipment created - show awaiting status for shipping milestone
      if (completedMilestones >= 2) completedMilestones = 3; // Transport shows "awaiting"
    }
    
    // Warehouse milestone: check warehouse_signal instead of shipping_signal
    if (forecast.warehouseSignal === 'confirmed') completedMilestones = 4;
    
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
      (statusFilter === 'delivered' && forecast.shippingSignal === 'confirmed');
    
    const matchesMethod = methodFilter === 'all' || 
      forecast.shippingPreference.includes(methodFilter);
    
    return matchesSearch && matchesStatus && matchesMethod;
  });

  return (
    <div className="flex-1 p-3 sm:p-4 lg:p-8 space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-4 sm:p-6">
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <SemanticBDIIcon semantic="shipping" size={24} className="sm:w-8 sm:h-8" />
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">{tc('shipmentsTitle', 'Shipments')}</h1>
                  <p className="text-sm sm:text-base text-muted-foreground">{tc('shipmentsDescription', 'Track cargo shipments and delivery status')}</p>
                </div>
                <div className="flex items-center space-x-2 mt-2 sm:mt-0">
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="px-2 text-xs"
                    >
                      <SemanticBDIIcon semantic="analytics" size={12} className="mr-1" />
                      Timeline
                    </Button>
                    <Button
                      variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('calendar')}
                      className="px-2 text-xs"
                    >
                      <SemanticBDIIcon semantic="calendar" size={12} className="mr-1" />
                      Calendar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <SemanticBDIIcon semantic="forecasts" size={20} className="text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">{tc('totalShipments', 'Total Shipments')}</p>
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
                <p className="text-sm text-gray-600">{tc('inTransit', 'In Transit')}</p>
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
                <p className="text-sm text-gray-600">{tc('delivered', 'Delivered')}</p>
                <p className="text-2xl font-bold text-green-600">
                  {shipmentForecasts.filter(f => f.shippingSignal === 'confirmed').length}
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
                <p className="text-sm text-gray-600">{tc('totalUnits', 'Total Units')}</p>
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
            placeholder={tc('searchShipmentPlaceholder', 'Search by SKU, product name, or delivery week...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Label htmlFor="status-filter">{tc('status', 'Status')}:</Label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{tc('allStatus', 'All Status')}</option>
              <option value="planning">{tc('planning', 'Planning')}</option>
              <option value="in_transit">{tc('inTransit', 'In Transit')}</option>
              <option value="delivered">{tc('delivered', 'Delivered')}</option>
            </select>
          </div>
          <div className="flex items-center space-x-2">
            <Label htmlFor="method-filter">{tc('method', 'Method')}:</Label>
            <select
              id="method-filter"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{tc('allMethods', 'All Methods')}</option>
              <option value="SEA">🚢 {tc('seaFreight', 'Sea Freight')}</option>
              <option value="AIR">✈️ {tc('airFreight', 'Air Freight')}</option>
              <option value="TRUCK">🚛 {tc('ground', 'Ground')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Shipments List/Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <SemanticBDIIcon semantic="shipping" size={20} />
            <span>{tc('shipmentsTimeline', 'Shipments Timeline')} ({filteredShipments.length})</span>
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
                  <div key={forecast.id} className="border rounded-lg p-3 sm:p-4 lg:p-6 hover:bg-gray-50 transition-colors">
                    {/* Shipment Header */}
                    <div className="flex flex-col space-y-3 sm:flex-row sm:items-start sm:justify-between sm:space-y-0 mb-4">
                      <div className="flex-1">
                        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-3 mb-3">
                          <h3 className="font-semibold text-base sm:text-lg break-all">
                            <DynamicTranslation userLanguage={userLocale} context="manufacturing">
                              {forecast.sku.sku} - {forecast.sku.name}
                            </DynamicTranslation>
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            <Badge className="bg-blue-100 text-blue-800 text-xs">
                              {forecast.quantity.toLocaleString()} {tc('units', 'units')}
                            </Badge>
                            <Badge className="bg-purple-100 text-purple-800 text-xs">
                              {forecast.deliveryWeek}
                            </Badge>
                            <Badge className="bg-cyan-100 text-cyan-800 text-xs">
                              {shippingIcon} <span className="hidden sm:inline">{forecast.shippingPreference}</span>
                            </Badge>
                          </div>
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
                      
                      <div className="flex items-center justify-center sm:justify-end">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSelectedShipment(forecast)}
                          className="w-full sm:w-auto"
                        >
                          <SemanticBDIIcon semantic="analytics" size={14} className="mr-1" />
                          {(() => {
                            const existingShipment = actualShipmentsArray.find((shipment: any) => shipment.forecast_id === forecast.id);
                            const localShipment = createdShipments.get(forecast.id);
                            return (existingShipment || localShipment) ? tc('edit', 'Edit') : tc('create', 'Create');
                          })()}
                        </Button>
                      </div>
                    </div>

                    {/* AWESOME MILESTONE TIMELINE */}
                    <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-3 sm:p-4 rounded-lg border">
                      <div className="flex items-center justify-between relative">
                        {/* Progress Line */}
                        <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-300"></div>
                        <div 
                          className="absolute top-6 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-1000"
                          style={{ width: `${(progress / 4) * 100}%` }}
                        ></div>

                        {/* Milestone 1: Sales */}
                        <div className="flex flex-col items-center space-y-2 relative z-10">
                          <button
                            onClick={() => handleMilestoneClick('sales', forecast)}
                            className={`w-8 sm:w-12 h-8 sm:h-12 rounded-full flex items-center justify-center border-2 bg-white transition-all hover:scale-105 hover:shadow-lg cursor-pointer ${
                              forecast.salesSignal === 'rejected' ? 'border-red-500 bg-red-50' :
                              forecast.salesSignal === 'confirmed' ? 'border-green-500 bg-green-50' :
                              forecast.salesSignal === 'submitted' ? 'border-blue-500 bg-blue-50' :
                              'border-gray-300'
                            }`}
                            title="Click to change sales status"
                          >
                            <span className={`text-base sm:text-lg ${
                              forecast.salesSignal === 'rejected' ? 'text-red-600' :
                              forecast.salesSignal === 'confirmed' ? 'text-green-600' :
                              forecast.salesSignal === 'submitted' ? 'text-blue-600' :
                              'text-gray-600'
                            }`}>👤</span>
                          </button>
                          <div className="text-center">
                            <p className="text-xs font-medium text-gray-800 hidden sm:block">Sales</p>
                            <p className="text-xs font-medium text-gray-800 sm:hidden">S</p>
                            <p className="text-xs text-gray-600 hidden sm:block">
                              {milestones.salesDate.toLocaleDateString()}
                            </p>
                            <Badge className={
                              forecast.salesSignal === 'rejected' ? 'bg-red-100 text-red-800' :
                              forecast.salesSignal === 'confirmed' ? 'bg-green-100 text-green-800' :
                              forecast.salesSignal === 'submitted' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-600'
                            }>
                              {forecast.salesSignal}
                            </Badge>
                          </div>
                        </div>

                        {/* Milestone 2: Factory EXW */}
                        <div className="flex flex-col items-center space-y-2 relative z-10">
                          <button
                            onClick={() => handleMilestoneClick('factory', forecast)}
                            className={`w-8 sm:w-12 h-8 sm:h-12 rounded-full flex items-center justify-center border-2 bg-white transition-all hover:scale-105 hover:shadow-lg cursor-pointer ${
                              forecast.factorySignal === 'rejected' ? 'border-red-500 bg-red-50' :
                              forecast.factorySignal === 'confirmed' ? 'border-green-500 bg-green-50' :
                              forecast.factorySignal === 'reviewing' ? 'border-orange-500 bg-orange-50' :
                              'border-gray-300'
                            }`}
                            title="Click to change factory status"
                          >
                            <span className={`text-base sm:text-lg ${
                              forecast.factorySignal === 'rejected' ? 'text-red-600' :
                              forecast.factorySignal === 'confirmed' ? 'text-green-600' :
                              forecast.factorySignal === 'reviewing' ? 'text-orange-600' :
                              'text-gray-600'
                            }`}>🏭</span>
                          </button>
                          <div className="text-center">
                            <p className="text-xs font-medium text-gray-800 hidden sm:block">Factory EXW</p>
                            <p className="text-xs font-medium text-gray-800 sm:hidden">F</p>
                            <p className="text-xs text-gray-600 hidden sm:block">
                              {milestones.exwDate.toLocaleDateString()}
                            </p>
                            <Badge className={
                              forecast.factorySignal === 'rejected' ? 'bg-red-100 text-red-800' :
                              forecast.factorySignal === 'confirmed' ? 'bg-green-100 text-green-800' :
                              forecast.factorySignal === 'reviewing' ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-600'
                            }>
                              {forecast.factorySignal}
                            </Badge>
                          </div>
                        </div>

                        {/* Milestone 3: In Transit */}
                        <div className="flex flex-col items-center space-y-2 relative z-10">
                          <button
                            onClick={() => handleMilestoneClick('transit', forecast)}
                            className={`w-8 sm:w-12 h-8 sm:h-12 rounded-full flex items-center justify-center border-2 bg-white transition-all hover:scale-105 hover:shadow-lg cursor-pointer ${
                              progress >= 3 ? 'border-blue-500' : 'border-gray-300'
                            }`}
                            title="Click to change transit status"
                          >
                            <span className={`text-base sm:text-lg ${
                              progress >= 3 ? 'text-blue-600' : 'text-gray-600'
                            }`}>{shippingIcon}</span>
                          </button>
                          <div className="text-center">
                            <p className="text-xs font-medium text-gray-800 hidden sm:block">In Transit</p>
                            <p className="text-xs font-medium text-gray-800 sm:hidden">T</p>
                            <p className="text-xs text-gray-600 hidden sm:block">
                              {milestones.departureDate.toLocaleDateString()}
                            </p>
                            <Badge className={
                              forecast.transitSignal === 'confirmed' ? 'bg-green-100 text-green-800' :
                              forecast.transitSignal === 'submitted' ? 'bg-blue-100 text-blue-800' :
                              forecast.transitSignal === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-600'
                            }>
                              {forecast.transitSignal === 'confirmed' ? 'delivered' :
                               forecast.transitSignal === 'submitted' ? 'in transit' :
                               forecast.transitSignal === 'rejected' ? 'delayed' :
                               forecast.transitSignal === 'pending' ? 'pending' :
                               'unknown'}
                            </Badge>
                          </div>
                        </div>

                        {/* Milestone 4: Warehouse Arrival */}
                        <div className="flex flex-col items-center space-y-2 relative z-10">
                          <button
                            onClick={() => handleMilestoneClick('warehouse', forecast)}
                            className={`w-8 sm:w-12 h-8 sm:h-12 rounded-full flex items-center justify-center border-2 bg-white transition-all hover:scale-105 hover:shadow-lg cursor-pointer ${
                              forecast.warehouseSignal === 'confirmed' ? 'border-green-500' :
                              forecast.warehouseSignal === 'submitted' ? 'border-orange-500' :
                              'border-gray-300'
                            }`}
                            title="Click to change warehouse status"
                          >
                            <span className={`text-base sm:text-lg ${
                              forecast.warehouseSignal === 'confirmed' ? 'text-green-600' :
                              forecast.warehouseSignal === 'submitted' ? 'text-orange-600' :
                              'text-gray-600'
                            }`}>🏢</span>
                          </button>
                          <div className="text-center">
                            <p className="text-xs font-medium text-gray-800 hidden sm:block">Warehouse</p>
                            <p className="text-xs font-medium text-gray-800 sm:hidden">W</p>
                            <p className="text-xs text-gray-600 hidden sm:block">
                              {milestones.deliveryDate ? milestones.deliveryDate.toLocaleDateString() : milestones.arrivalDate.toLocaleDateString()}
                            </p>
                            <Badge className={
                              forecast.warehouseSignal === 'confirmed' ? 'bg-green-100 text-green-800' :
                              forecast.warehouseSignal === 'submitted' ? 'bg-orange-100 text-orange-800' :
                              'bg-gray-100 text-gray-600'
                            }>
                              {forecast.warehouseSignal}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      {/* Shipment Details */}
                      <div className="mt-4 pt-4 border-t border-blue-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          {(() => {
                            // Use the same calculation function as the Details modal
                            const timelineShippingData = calculateShippingData(forecast.sku, forecast.quantity, 5);
                            
                            return (
                              <>
                                <div>
                                  <span className="text-gray-600">Estimated Transit:</span>
                                  <p className="font-medium">
                                    {milestones.transitDays} days
                                  </p>
                                </div>
                                <div>
                                  <span className="text-gray-600">Estimated Pallets:</span>
                                  <p className="font-medium">
                                    {timelineShippingData.palletCount} pallets
                                  </p>
                                </div>
                                <div>
                                  <span className="text-gray-600">Estimated Weight:</span>
                                  <p className="font-medium">
                                    {parseFloat(timelineShippingData.totalShippingWeight).toLocaleString()} kg
                                  </p>
                                </div>
                              </>
                            );
                          })()}
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
              <span>
                {(() => {
                  const existingShipment = actualShipmentsArray.find((shipment: any) => shipment.forecast_id === selectedShipment?.id);
                  const localShipment = createdShipments.get(selectedShipment?.id || '');
                  return (existingShipment || localShipment) 
                    ? `${tc('editShipmentButton', 'Edit Shipment')}: ${selectedShipment?.sku.sku}` 
                    : `${tc('createButton', 'Create')} ${tc('shipmentsTitle', 'Shipment')}: ${selectedShipment?.sku.sku}`;
                })()}
              </span>
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
                          {tcpfr(`signals.${selectedShipment.status}`, selectedShipment.status)}
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
                      Shipment Route Configuration
                    </h3>
                    
                    <div className="space-y-6">
                      {/* Step 1: Origin Factory */}
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                          🏭 Step 1: Origin Factory
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="originFactory">Manufacturing Partner *</Label>
                            <select
                              id="originFactory"
                              value={shipmentForm.originFactoryId}
                              onChange={(e) => {
                                setShipmentForm(prev => ({ 
                                  ...prev, 
                                  originFactoryId: e.target.value,
                                  customOriginFactory: e.target.value === 'custom' ? prev.customOriginFactory : ''
                                }));
                              }}
                              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            >
                              <option value="">Select manufacturing partner...</option>
                              {manufacturingOrganizations.map((org: any) => (
                                <option key={org.id} value={org.id}>
                                  🏭 {org.name} ({org.code})
                                </option>
                              ))}
                              {/* Add warehouses as potential origins for special cases */}
                              {allWarehouses.filter((w: any) => w.warehouseCode !== 'MTN-FACTORY').map((warehouse: any) => (
                                <option key={`warehouse-${warehouse.id}`} value={warehouse.id}>
                                  📦 {warehouse.name} ({warehouse.warehouseCode}) - Special Origin
                                </option>
                              ))}
                              <option value="custom">🔧 Custom Entry (Other Location)</option>
                            </select>
                            <div className="text-xs text-gray-600 mt-1">
                              Select factory/manufacturer, warehouse (e.g., EMG internal transfer), or custom entry
                            </div>
                          </div>
                          
                          {/* Custom Origin Entry */}
                          {shipmentForm.originFactoryId === 'custom' && (
                            <div>
                              <Label htmlFor="customOriginFactory">Custom Origin Location *</Label>
                              <input
                                id="customOriginFactory"
                                type="text"
                                value={shipmentForm.customOriginFactory || ''}
                                onChange={(e) => setShipmentForm(prev => ({ ...prev, customOriginFactory: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Enter custom origin location (e.g., EMG Internal Transfer, Customer Return, etc.)"
                                required
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step 2: Shipping Partner */}
                      <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                        <h4 className="font-semibold text-green-800 mb-3 flex items-center">
                          🚚 Step 2: Shipping Partner
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="shippingPartner">Logistics Organization *</Label>
                            <select
                              id="shippingPartner"
                              value={shipmentForm.shippingOrganizationId}
                              onChange={(e) => {
                                setShipmentForm(prev => ({ 
                                  ...prev, 
                                  shippingOrganizationId: e.target.value,
                                  customShippingPartner: e.target.value === 'custom' ? prev.customShippingPartner : ''
                                }));
                              }}
                              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                              required
                            >
                              <option value="">Select logistics partner...</option>
                              {shippingOrganizations.map((org: any) => (
                                <option key={org.id} value={org.id}>
                                  📦 {org.name} ({org.code})
                                </option>
                              ))}
                              {(!Array.isArray(shippingOrganizations) || shippingOrganizations.length === 0) && user?.organization?.type === 'shipping_logistics' && (
                                <option value={user.organization.id}>
                                  📦 {user.organization.name} ({user.organization.code})
                                </option>
                              )}
                              <option value="lcl">🚢 LCL (Less than Container Load)</option>
                              <option value="custom">🔧 Custom Entry (Other Shipper)</option>
                            </select>
                            <div className="text-xs text-gray-600 mt-1">
                              Select logistics partner, use LCL option, or enter custom shipper
                            </div>
                          </div>
                          
                          {/* Custom Shipping Partner Entry */}
                          {shipmentForm.shippingOrganizationId === 'custom' && (
                            <div>
                              <Label htmlFor="customShippingPartner">Custom Shipping Partner *</Label>
                              <input
                                id="customShippingPartner"
                                type="text"
                                value={shipmentForm.customShippingPartner || ''}
                                onChange={(e) => setShipmentForm(prev => ({ ...prev, customShippingPartner: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="Enter custom shipping partner (e.g., DHL Express, FedEx, Local Courier, etc.)"
                                required
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step 3: Final Destination */}
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <h4 className="font-semibold text-purple-800 mb-3 flex items-center">
                          📦 Step 3: Final Destination
                        </h4>
                        <div className="space-y-3">
                          <div>
                            <Label htmlFor="destinationWarehouse">Destination Warehouse *</Label>
                            <select
                              id="destinationWarehouse"
                              value={shipmentForm.destinationWarehouseId}
                              onChange={(e) => {
                                setShipmentForm(prev => ({ 
                                  ...prev, 
                                  destinationWarehouseId: e.target.value,
                                  customDestinationWarehouse: e.target.value === 'custom' ? prev.customDestinationWarehouse : ''
                                }));
                              }}
                              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                              required
                            >
                              <option value="">Select destination warehouse...</option>
                              {allWarehouses.map((warehouse: any) => (
                                <option key={warehouse.id} value={warehouse.id}>
                                  🏢 {warehouse.name} ({warehouse.warehouseCode})
                                </option>
                              ))}
                              <option value="custom">🔧 Custom Entry (Other Destination)</option>
                            </select>
                            <div className="text-xs text-gray-600 mt-1">
                              Select warehouse (EMG, Complete CATV, etc.) or enter custom destination
                            </div>
                          </div>
                          
                          {/* Custom Destination Entry */}
                          {shipmentForm.destinationWarehouseId === 'custom' && (
                            <div>
                              <Label htmlFor="customDestinationWarehouse">Custom Destination Location *</Label>
                              <input
                                id="customDestinationWarehouse"
                                type="text"
                                value={shipmentForm.customDestinationWarehouse || ''}
                                onChange={(e) => setShipmentForm(prev => ({ ...prev, customDestinationWarehouse: e.target.value }))}
                                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                placeholder="Enter custom destination (e.g., Direct to Customer, Amazon Warehouse, Retail Store, etc.)"
                                required
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Visual Flow Summary */}
                      {shipmentForm.originFactoryId && shipmentForm.shippingOrganizationId && shipmentForm.destinationWarehouseId && (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                          <h4 className="font-semibold mb-2 text-gray-700">📋 Shipment Route Summary:</h4>
                          <div className="text-center text-lg font-medium text-gray-800">
                            🏭 {manufacturingOrganizations.find((o: any) => o.id === shipmentForm.originFactoryId)?.code || 'Factory'} 
                            {' ──🚚──> '}
                            📦 {shippingOrganizations.find((o: any) => o.id === shipmentForm.shippingOrganizationId)?.code || user?.organization?.code || 'Shipper'} 
                            {' ──📦──> '}
                            🏢 {allWarehouses.find((w: any) => w.id === shipmentForm.destinationWarehouseId)?.name || 'Warehouse'}
                          </div>
                        </div>
                      )}

                      <div>
                        <Label htmlFor="shipperReference">Shipper Reference Number (JJOLM)</Label>
                        <div className="flex gap-2 mt-1">
                          <select
                            id="shipperReference"
                            value={shipmentForm.shipperReference}
                            onChange={(e) => setShipmentForm(prev => ({ ...prev, shipperReference: e.target.value }))}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select JJOLM Number</option>
                            {(jjolmData?.data || []).map((jjolm: any) => (
                              <option key={jjolm.id} value={jjolm.jjolmNumber}>
                                {jjolm.jjolmNumber} - {jjolm.customerReferenceNumber || 'No Customer Ref'} ({jjolm.mode || 'Unknown Mode'})
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setShowJjolmModal(true)}
                            className="px-3"
                            title="Upload JJOLM Reports"
                          >
                            <SemanticBDIIcon semantic="plus" size={14} />
                          </Button>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Select from uploaded JJOLM tracking numbers. Click + to upload new reports.
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
                            <div><strong>Shipment Number:</strong> {createdShipments.get(selectedShipment.id)?.shipment_number}</div>
                            <div><strong>Status:</strong> Pending Shipper Confirmation</div>
                            <div><strong>Organization:</strong> {shippingOrganizations.find((o: any) => o.id === shipmentForm.shippingOrganizationId)?.name || 'Shipping Partner'}</div>
                            {shipmentForm.factoryWarehouseId && (
                              <div><strong>Factory/Origin:</strong> {
                                (() => {
                                  const selectedWarehouse = warehouses?.find(w => w.id === shipmentForm.factoryWarehouseId);
                                  return selectedWarehouse ? `${selectedWarehouse.name} - ${selectedWarehouse.city || 'Location TBD'}` : 'Warehouse Selected';
                                })()
                              }</div>
                            )}
                            {shipmentForm.shipperReference && (
                              <div><strong>Reference:</strong> {shipmentForm.shipperReference}</div>
                            )}
                            {currentShipmentDocs.length > 0 && (
                              <div><strong>Documents:</strong> {currentShipmentDocs.length} files attached</div>
                            )}
                            <div className="mt-2 text-xs text-green-600">
                              ✅ Timeline shows "Awaiting Quote" status • Documents saved to database
                            </div>
                            
                            {/* Show loading state for documents */}
                            {loadingDocuments && (
                              <div className="mt-3 pt-3 border-t border-blue-200">
                                <div className="flex items-center space-x-2">
                                  <SemanticBDIIcon semantic="loading" size={14} className="animate-spin text-blue-600" />
                                  <span className="text-sm text-blue-600">Loading existing documents...</span>
                                </div>
                              </div>
                            )}
                            
                            {/* Show uploaded documents from database */}
                            {(() => {
                              console.log('🖥️ RENDER CHECK - loadingDocuments:', loadingDocuments);
                              console.log('🖥️ RENDER CHECK - documentsForCurrentShipment:', documentsForCurrentShipment);
                              // Show documents section only if there are actual documents
                              return documentsForCurrentShipment.length > 0;
                            })() && (
                              <div className="mt-3 pt-3 border-t border-green-200">
                                <h5 className="text-sm font-medium text-green-800 mb-2">Existing Documents:</h5>
                                <div className="space-y-1">
                                  {documentsForCurrentShipment.length > 0 ? (
                                    documentsForCurrentShipment.map((doc: any, index: number) => (
                                      <div key={doc.id || doc.file_name || index} className="flex items-center justify-between bg-green-100 p-2 rounded">
                                        <div className="flex items-center space-x-2">
                                          <SemanticBDIIcon semantic="document" size={12} className="text-green-600" />
                                          <span className="text-xs text-green-800">{doc.file_name || doc.name || 'Unknown File'}</span>
                                          <span className="text-xs text-green-600">
                                            ({doc.file_size ? (doc.file_size / 1024).toFixed(1) : 'Unknown'} KB)
                                          </span>
                                        </div>
                                        <button
                                          onClick={() => {
                                            const shipmentId = createdShipments.get(selectedShipment.id)?.id || 
                                                             actualShipmentsArray.find((s: any) => s.forecast_id === selectedShipment.id)?.id;
                                            if (shipmentId) {
                                              window.open(`/api/cpfr/shipments/${shipmentId}/documents/${doc.id || doc.name}`, '_blank');
                                            } else {
                                              alert('Shipment not found - cannot download document');
                                            }
                                          }}
                                          className="text-green-600 hover:text-green-800 text-xs underline"
                                        >
                                          Download
                                        </button>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-gray-500 italic">No documents uploaded yet</div>
                                  )}
                                </div>
                              </div>
                            )}
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
                                onChange={(e) => setShipmentForm(prev => ({ ...prev, unitsPerCarton: parseInt(e.target.value) || selectedShipment?.sku?.boxesPerCarton || 5 }))}
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

                          {/* Status History & Notes Display */}
                          {(() => {
                            const currentShipment = actualShipmentsArray.find((s: any) => s.forecast_id === selectedShipment.id);
                            // Show notes from database OR from current form (for immediate display after updates)
                            const shipmentNotes = currentShipment?.notes || shipmentForm.notes;
                            
                            if (shipmentNotes) {
                              return (
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                                  <h4 className="font-medium text-blue-800 mb-3 flex items-center">
                                    <SemanticBDIIcon semantic="notes" size={16} className="mr-2 text-blue-600" />
                                    Status History & Notes
                                  </h4>
                                  <div className="bg-white p-3 rounded border">
                                    <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
                                      {shipmentNotes}
                                    </pre>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Cost Estimate Documents - Drag & Drop */}
                          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <h4 className="font-medium text-gray-800 mb-3 flex items-center">
                              <SemanticBDIIcon semantic="document" size={16} className="mr-2 text-gray-600" />
                              Cost Estimate Documents
                            </h4>
                            
                            <div className="space-y-3">
                              {/* Drag & Drop Zone with File Count */}
                              <div
                                {...getRootProps()}
                                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-200 ${
                                  isDragActive 
                                    ? 'border-blue-500 bg-blue-50 scale-105' 
                                    : currentShipmentDocs.length > 0
                                    ? 'border-green-400 bg-green-50 hover:border-green-500'
                                    : 'border-gray-300 hover:border-gray-400 hover:bg-gray-100'
                                }`}
                              >
                                <input {...getInputProps()} />
                                <div className="flex flex-col items-center">
                                  <SemanticBDIIcon 
                                    semantic="upload" 
                                    size={24} 
                                    className={`mb-2 ${
                                      isDragActive ? 'text-blue-500' : 
                                      currentShipmentDocs.length > 0 ? 'text-green-500' : 'text-gray-400'
                                    }`} 
                                  />
                                  {currentShipmentDocs.length > 0 && (
                                    <div className="mb-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                                      {currentShipmentDocs.length} files ready
                                    </div>
                                  )}
                                  {isDragActive ? (
                                    <p className="text-blue-600 font-medium">Drop cost estimate files here...</p>
                                  ) : (
                                    <div>
                                      <p className="text-gray-600 font-medium mb-1">
                                        {currentShipmentDocs.length > 0 ? 'Add more files or click to browse' : 'Drag & drop cost estimates here, or click to browse'}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        Supports: PDF, DOC, XLS, Images • Multiple files allowed
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* File Preview Cards - Shipment Specific */}
                              {currentShipmentDocs.length > 0 && (
                                <div className="space-y-2">
                                  <h5 className="text-sm font-medium text-gray-700 flex items-center">
                                    <SemanticBDIIcon semantic="document" size={14} className="mr-1" />
                                    Files for {selectedShipment.sku.sku} Shipment ({currentShipmentDocs.length})
                                  </h5>
                                  {currentShipmentDocs.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200 shadow-sm">
                                      <div className="flex items-center space-x-3">
                                        <div className={`w-8 h-8 rounded flex items-center justify-center ${
                                          file.type.includes('pdf') ? 'bg-red-100' :
                                          file.type.includes('excel') || file.type.includes('sheet') ? 'bg-green-100' :
                                          file.type.includes('word') ? 'bg-blue-100' :
                                          file.type.includes('image') ? 'bg-purple-100' : 'bg-gray-100'
                                        }`}>
                                          <SemanticBDIIcon 
                                            semantic="document" 
                                            size={14} 
                                            className={
                                              file.type.includes('pdf') ? 'text-red-600' :
                                              file.type.includes('excel') || file.type.includes('sheet') ? 'text-green-600' :
                                              file.type.includes('word') ? 'text-blue-600' :
                                              file.type.includes('image') ? 'text-purple-600' : 'text-gray-600'
                                            }
                                          />
                                        </div>
                                        <div>
                                          <div className="text-sm font-medium text-gray-900">{file.name}</div>
                                          <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</div>
                                        </div>
                                      </div>
                                      <button
                                        onClick={() => {
                                          if (selectedShipment) {
                                            setShipmentDocuments(prev => {
                                              const newMap = new Map(prev);
                                              const existingDocs = newMap.get(selectedShipment.id) || [];
                                              newMap.set(selectedShipment.id, existingDocs.filter((_, i) => i !== index));
                                              return newMap;
                                            });
                                          }
                                        }}
                                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50"
                                      >
                                        <SemanticBDIIcon semantic="close" size={16} />
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

                {/* Show uploaded documents from database */}
                {documentsForCurrentShipment.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-green-200">
                    <h5 className="text-sm font-medium text-green-800 mb-3">Existing Documents</h5>
                    <div className="space-y-2">
                      {documentsForCurrentShipment.map((doc: any, index: number) => (
                        <div key={doc.id || doc.file_name || index} className="flex items-center justify-between bg-green-50 p-3 rounded border border-green-200">
                          <div className="flex items-center space-x-3">
                            <SemanticBDIIcon semantic="document" size={16} className="text-green-600" />
                            <span className="text-sm text-green-800">{doc.file_name || doc.name || 'Unknown File'}</span>
                            <span className="text-sm text-green-600">
                              ({doc.file_size ? (doc.file_size / 1024).toFixed(1) : 'Unknown'} KB)
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              const shipmentId = createdShipments.get(selectedShipment.id)?.id || 
                                               actualShipmentsArray.find((s: any) => s.forecast_id === selectedShipment.id)?.id;
                              if (shipmentId) {
                                window.open(`/api/cpfr/shipments/${shipmentId}/documents/${doc.id || doc.name}`, '_blank');
                              }
                            }}
                            className="text-green-600 hover:text-green-800 text-sm underline"
                          >
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="flex space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedShipment(null)}
                  >
                    {tc('cancel', 'Cancel')}
                  </Button>
                  <Button
                    onClick={handleCreateShipment}
                    disabled={isCreatingShipment || !shipmentForm.originFactoryId || !shipmentForm.shippingOrganizationId || !shipmentForm.destinationWarehouseId}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isCreatingShipment ? (
                      <>
                        <SemanticBDIIcon semantic="loading" size={16} className="mr-2 animate-spin" />
                        {(() => {
                          const existingShipment = actualShipmentsArray.find((shipment: any) => shipment.forecast_id === selectedShipment?.id);
                          const localShipment = createdShipments.get(selectedShipment?.id || '');
                          return (existingShipment || localShipment) ? 'Updating Shipment...' : 'Creating Shipment...';
                        })()}
                      </>
                    ) : (
                      <>
                        <SemanticBDIIcon semantic="shipping" size={16} className="mr-2" />
                        {(() => {
                          const existingShipment = actualShipmentsArray.find((shipment: any) => shipment.forecast_id === selectedShipment?.id);
                          const localShipment = createdShipments.get(selectedShipment?.id || '');
                          return (existingShipment || localShipment) ? tc('updateShipmentButton', 'Update Shipment') : tc('createButton', 'Create Shipment');
                        })()}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Change Modal */}
      <Dialog open={statusChangeModal.isOpen} onOpenChange={(open) => setStatusChangeModal(prev => ({ ...prev, isOpen: open }))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <SemanticBDIIcon 
                semantic={
                  statusChangeModal.milestone === 'sales' ? 'profile' :
                  statusChangeModal.milestone === 'factory' ? 'manufacturing' :
                  statusChangeModal.milestone === 'transit' ? 'shipping' :
                  'warehouse'
                } 
                size={20} 
              />
              <span>
                Update {statusChangeModal.milestone === 'sales' ? 'Sales' :
                       statusChangeModal.milestone === 'factory' ? 'Factory' :
                       statusChangeModal.milestone === 'transit' ? 'Transit' :
                       'Warehouse'} Status
              </span>
            </DialogTitle>
            <DialogDescription>
              Change the status for {statusChangeModal.forecast?.sku.sku} - {statusChangeModal.forecast?.sku.name}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="newStatus">New Status</Label>
              <select
                id="newStatus"
                className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                defaultValue={
                  statusChangeModal.milestone === 'sales' ? statusChangeModal.forecast?.salesSignal :
                  statusChangeModal.milestone === 'factory' ? statusChangeModal.forecast?.factorySignal :
                  statusChangeModal.milestone === 'transit' ? (statusChangeModal.forecast?.transitSignal || 'unknown') :
                  statusChangeModal.milestone === 'warehouse' ? (statusChangeModal.forecast?.warehouseSignal || 'unknown') :
                  'unknown'
                }
              >
                {statusChangeModal.milestone === 'sales' && (
                  <>
                    <option value="unknown">{tcpfr('signals.unknown', 'Unknown')}</option>
                    <option value="draft">{tcpfr('signals.draft', 'Draft')}</option>
                    <option value="submitted">{tcpfr('signals.submitted', 'Submitted')}</option>
                    <option value="confirmed">{tcpfr('signals.confirmed', 'Confirmed')}</option>
                    <option value="rejected">{tcpfr('signals.rejected', 'Rejected')}</option>
                  </>
                )}
                {statusChangeModal.milestone === 'factory' && (
                  <>
                    <option value="unknown">{tcpfr('signals.unknown', 'Unknown')}</option>
                    <option value="reviewing">{tcpfr('signals.reviewing', 'Reviewing')}</option>
                    <option value="confirmed">{tcpfr('signals.confirmed', 'Confirmed')}</option>
                    <option value="rejected">{tcpfr('signals.rejected', 'Rejected')}</option>
                  </>
                )}
                {statusChangeModal.milestone === 'transit' && (
                  <>
                    <option value="unknown">Unknown</option>
                    <option value="pending">Pending</option>
                    <option value="submitted">In Transit</option>
                    <option value="confirmed">Delivered</option>
                    <option value="rejected">Delayed/Issues</option>
                  </>
                )}
                {statusChangeModal.milestone === 'warehouse' && (
                  <>
                    <option value="unknown">Unknown</option>
                    <option value="pending">Scheduled</option>
                    <option value="confirmed">Received</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Complete</option>
                  </>
                )}
              </select>
            </div>
            
            {/* Date Management Section - Based on Stakeholder Authority */}
            {statusChangeModal.milestone && (
              <div className="border-t pt-4">
                <div className="mb-3">
                  <h4 className="font-medium text-gray-900 mb-2">📅 Date Management</h4>
                  <p className="text-sm text-gray-600">
                    {statusChangeModal.milestone === 'sales' && 'Update delivery dates and customer commitments'}
                    {statusChangeModal.milestone === 'factory' && 'Update EXW (Ex-Works) production dates'}
                    {statusChangeModal.milestone === 'transit' && 'Update transit and shipping timeline'}
                    {statusChangeModal.milestone === 'warehouse' && 'Update warehouse processing and final delivery'}
                  </p>
                  <div className="text-xs text-gray-400 mt-1">
                    Forecast ID: {statusChangeModal.forecast?.id}
                  </div>
                </div>

                {/* Sales: Can modify delivery dates */}
                {statusChangeModal.milestone === 'sales' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="deliveryWeek">Delivery Week</Label>
                      <input
                        id="deliveryWeek"
                        type="text"
                        defaultValue={statusChangeModal.forecast?.deliveryWeek}
                        className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 2025-W48"
                      />
                    </div>
                    <div>
                      <Label htmlFor="confirmedDeliveryDate">Confirmed Delivery Date</Label>
                      <input
                        id="confirmedDeliveryDate"
                        type="date"
                        defaultValue={statusChangeModal.forecast?.confirmedDeliveryDate || ''}
                        className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                {/* Factory: Can modify EXW date only */}
                {statusChangeModal.milestone === 'factory' && (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="customExwDate">EXW (Ex-Works) Date</Label>
                      <input
                        id="customExwDate"
                        type="date"
                        defaultValue={statusChangeModal.forecast?.customExwDate}
                        className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Current DB value: {statusChangeModal.forecast?.customExwDate || 'None'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Transit: Can modify transit time only */}
                {statusChangeModal.milestone === 'transit' && (
                  <div className="space-y-3">
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                      <h4 className="font-medium text-blue-900 mb-2">📅 Current Timeline</h4>
                      <div className="text-sm text-blue-800 space-y-1">
                        <div><strong>EXW (Pickup) Date:</strong> {statusChangeModal.forecast?.customExwDate || 'Set by Factory'}</div>
                        <div><strong>Current Transit Start:</strong> {statusChangeModal.forecast?.estimatedTransitStart || 'TBD'}</div>
                        <div><strong>Current Warehouse Arrival:</strong> {statusChangeModal.forecast?.estimatedWarehouseArrival || 'TBD'}</div>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="manualTransitTime">Transit Time (days)</Label>
                      <input
                        id="manualTransitTime"
                        type="number"
                        min="1"
                        max="90"
                        defaultValue={statusChangeModal.forecast?.manualTransitTime || '21'}
                        className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., 21"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Changes transit duration and automatically calculates new warehouse arrival date
                      </div>
                    </div>
                  </div>
                )}

                {/* Warehouse: Can modify final delivery date only */}
                {statusChangeModal.milestone === 'warehouse' && (
                  <div className="space-y-3">
                    <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-4">
                      <h4 className="font-medium text-green-900 mb-2">📅 Current Timeline</h4>
                      <div className="text-sm text-green-800 space-y-1">
                        <div><strong>EXW (Pickup) Date:</strong> {statusChangeModal.forecast?.customExwDate || 'Set by Factory'}</div>
                        <div><strong>Transit Time:</strong> {statusChangeModal.forecast?.manualTransitTime || '21'} days</div>
                        <div><strong>Warehouse Arrival:</strong> {statusChangeModal.forecast?.estimatedWarehouseArrival || 'TBD'}</div>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="finalDeliveryDate">Final Delivery Date</Label>
                      <input
                        id="finalDeliveryDate"
                        type="date"
                        defaultValue={statusChangeModal.forecast?.confirmedDeliveryDate || ''}
                        className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Current DB value: {statusChangeModal.forecast?.confirmedDeliveryDate || 'None'}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        This is the final customer delivery commitment date. Adjust for customs delays, processing issues, or expedited delivery.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="dateChangeReason">Reason for Date Change (Optional)</Label>
              <select
                id="dateChangeReason"
                className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select reason...</option>
                <option value="supplier_delay">Supplier Delay</option>
                <option value="capacity_constraint">Capacity Constraint</option>
                <option value="material_shortage">Material Shortage</option>
                <option value="quality_issue">Quality Issue</option>
                <option value="shipping_delay">Shipping Delay</option>
                <option value="port_congestion">Port Congestion</option>
                <option value="customs_delay">Customs Delay</option>
                <option value="weather_delay">Weather Delay</option>
                <option value="customer_request">Customer Request</option>
                <option value="expedite_request">Expedite Request</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <Label htmlFor="statusNotes">Notes (Optional)</Label>
              <textarea
                id="statusNotes"
                className="w-full mt-1 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Add any notes about this status change..."
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setStatusChangeModal(prev => ({ ...prev, isOpen: false }))}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                const newStatus = (document.getElementById('newStatus') as HTMLSelectElement)?.value;
                const notes = (document.getElementById('statusNotes') as HTMLTextAreaElement)?.value;
                const dateChangeReason = (document.getElementById('dateChangeReason') as HTMLSelectElement)?.value;
                
                // Capture date changes based on milestone
                const dateChanges: any = {};
                
                console.log('📅 Modal form values being captured:', {
                  milestone: statusChangeModal.milestone,
                  currentForecastData: statusChangeModal.forecast,
                  notesValue: notes,
                  dateChangeReasonValue: dateChangeReason
                });
                
                if (statusChangeModal.milestone === 'sales') {
                  const deliveryWeek = (document.getElementById('deliveryWeek') as HTMLInputElement)?.value;
                  const confirmedDeliveryDate = (document.getElementById('confirmedDeliveryDate') as HTMLInputElement)?.value;
                  
                  console.log('📅 Sales form values captured:', {
                    deliveryWeek,
                    confirmedDeliveryDate,
                    currentForecastDeliveryWeek: statusChangeModal.forecast?.deliveryWeek,
                    currentForecastConfirmedDeliveryDate: statusChangeModal.forecast?.confirmedDeliveryDate
                  });
                  
                  if (deliveryWeek) dateChanges.deliveryWeek = deliveryWeek;
                  if (confirmedDeliveryDate) dateChanges.confirmedDeliveryDate = confirmedDeliveryDate;
                }
                
                if (statusChangeModal.milestone === 'factory') {
                  const customExwDate = (document.getElementById('customExwDate') as HTMLInputElement)?.value;
                  
                  console.log('📅 Factory form values captured:', {
                    customExwDate,
                    currentForecastExwDate: statusChangeModal.forecast?.customExwDate,
                    originalExwDate: statusChangeModal.forecast?.originalExwDate
                  });
                  
                  if (customExwDate) dateChanges.customExwDate = customExwDate;
                }
                
                if (statusChangeModal.milestone === 'transit') {
                  const manualTransitTime = (document.getElementById('manualTransitTime') as HTMLInputElement)?.value;
                  
                  console.log('📅 Transit form values captured:', {
                    manualTransitTime,
                    currentForecastTransitTime: statusChangeModal.forecast?.manualTransitTime,
                    currentExwDate: statusChangeModal.forecast?.customExwDate,
                    currentTransitStart: statusChangeModal.forecast?.estimatedTransitStart,
                    currentWarehouseArrival: statusChangeModal.forecast?.estimatedWarehouseArrival
                  });
                  
                  if (manualTransitTime) dateChanges.manualTransitTime = parseInt(manualTransitTime);
                }
                
                if (statusChangeModal.milestone === 'warehouse') {
                  const finalDeliveryDate = (document.getElementById('finalDeliveryDate') as HTMLInputElement)?.value;
                  
                  console.log('📅 Warehouse form values captured:', {
                    finalDeliveryDate,
                    currentForecastConfirmedDeliveryDate: statusChangeModal.forecast?.confirmedDeliveryDate,
                    currentWarehouseArrival: statusChangeModal.forecast?.estimatedWarehouseArrival,
                    currentExwDate: statusChangeModal.forecast?.customExwDate
                  });
                  
                  // CRITICAL: Use correct camelCase field name for API
                  if (finalDeliveryDate) dateChanges.confirmedDeliveryDate = finalDeliveryDate;
                }
                
                if (!statusChangeModal.forecast || !statusChangeModal.milestone) return;

                try {
                  // 🔄 NEW: Update shipment status (which will sync to forecast)
                  // First, find the shipment for this forecast
                  const shipment = actualShipmentsArray.find(s => s.forecast_id === statusChangeModal.forecast?.id);
                  
                  let response;
                  
                  // Prepare the request body with both status and date changes
                  const requestBody = {
                    milestone: statusChangeModal.milestone,
                    status: newStatus,
                    notes: notes || undefined,
                    dateChanges: Object.keys(dateChanges).length > 0 ? dateChanges : undefined,
                    dateChangeReason: dateChangeReason || undefined
                  };

                  console.log('📤 Sending request to API:', requestBody);
                  
                  if (shipment) {
                    console.log(`🔄 Updating shipment ${shipment.id} signal: ${statusChangeModal.milestone} → ${newStatus}`, dateChanges);
                    
                    response = await fetch(`/api/cpfr/shipments/${shipment.id}/status`, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(requestBody),
                    });
                  } else {
                    // Fallback: Update forecast directly if no shipment exists
                    console.log(`🔄 No shipment found, updating forecast ${statusChangeModal.forecast.id} directly`, dateChanges);
                    
                    response = await fetch(`/api/cpfr/forecasts/${statusChangeModal.forecast.id}/status`, {
                      method: 'PUT',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(requestBody),
                    });
                  }

                  if (response) {
                    const result = await response.json();
                    
                    if (result.success) {
                      const syncMessage = result.syncedShipments ? ` (synced ${result.syncedShipments} shipments)` : 
                                         result.syncedForecast ? ' (synced forecast)' : '';
                      alert(`✅ ${statusChangeModal.milestone} status updated to ${newStatus}!${syncMessage}`);
                      
                      // Refresh both forecasts and shipments data
                      await mutateForecasts();
                      await mutateShipments();
                      
                      // Update the local forecast data with the fresh data
                      if (result.forecast) {
                        console.log('🔄 Updating local forecast data with API response');
                        // The forecast data should be updated by the mutate calls above
                      }
                    } else {
                      alert(`❌ Error: ${result.error}`);
                    }
                  }
                } catch (error) {
                  console.error('Status update error:', error);
                  alert('❌ Failed to update status. Please try again.');
                }
                
                setStatusChangeModal(prev => ({ ...prev, isOpen: false }));
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <SemanticBDIIcon semantic="check" size={16} className="mr-2" />
              {tc('updateStatus', 'Update Status')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* JJOLM Upload Modal */}
      <Dialog open={showJjolmModal} onOpenChange={setShowJjolmModal}>
        <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SemanticBDIIcon semantic="analytics" size={20} />
              JJOLM Shipment Reports
            </DialogTitle>
            <DialogDescription>
              Upload BOUNDLESS-DEVICES-SHIPMENT-REPORT Excel files to manage JJOLM tracking numbers
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 p-4 sm:p-6 lg:p-8">
            {/* Upload Section */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-3 text-lg">
                      <SemanticBDIIcon semantic="plus" size={20} />
                      Upload JJOLM Report
                    </CardTitle>
                    <CardDescription>
                      Upload Excel files with format: BOUNDLESS-DEVICES-SHIPMENT-REPORT_[date].xlsx
                    </CardDescription>
                  </div>
                  {(jjolmData?.data || []).length > 0 && (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Last Updated</div>
                      <div className="text-sm font-medium">
                        {new Date((jjolmData.data[0]?.lastUpdated || jjolmData.data[0]?.uploadDate)).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1">
                    <Input
                      id="jjolm-file-upload"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleJjolmFileSelect}
                      disabled={uploadingJjolm}
                    />
                  </div>
                  <Button
                    onClick={handleJjolmUpload}
                    disabled={!jjolmFile || uploadingJjolm}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {uploadingJjolm ? (
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

                {jjolmFile && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2">
                      <SemanticBDIIcon semantic="analytics" size={16} className="text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">
                        Selected: {jjolmFile.name}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {(jjolmFile.size / 1024).toFixed(1)} KB
                      </Badge>
                    </div>
                  </div>
                )}

                {jjolmUploadResult && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-start gap-3">
                      <SemanticBDIIcon semantic="check" size={20} className="text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-green-800 mb-2">
                          Upload Successful!
                        </h4>
                        <div className="text-sm text-green-700 space-y-1">
                          <p><strong>File:</strong> {jjolmUploadResult.summary?.fileName}</p>
                          <p><strong>Total Processed:</strong> {jjolmUploadResult.summary?.totalProcessed}</p>
                          <p><strong>New Records:</strong> {jjolmUploadResult.summary?.newRecords}</p>
                          <p><strong>Updated Records:</strong> {jjolmUploadResult.summary?.updatedRecords}</p>
                          {jjolmUploadResult.summary?.errors > 0 && (
                            <p><strong>Errors:</strong> {jjolmUploadResult.summary?.errors}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* JJOLM Records */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <SemanticBDIIcon semantic="shipping" size={20} />
                  Available JJOLM Numbers ({(jjolmData?.data || []).length.toLocaleString()})
                </CardTitle>
                <CardDescription>
                  Click any JJOLM number to view its timeline and tracking history
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(jjolmData?.data || []).length === 0 ? (
                  <div className="text-center py-8">
                    <SemanticBDIIcon semantic="shipping" size={48} className="mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No JJOLM records found. Upload a report to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {(jjolmData?.data || []).slice(0, 20).map((record: any) => (
                      <div
                        key={record.id}
                        className="p-3 sm:p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleViewJjolmTimeline(record.jjolmNumber)}
                      >
                        {/* Mobile Layout */}
                        <div className="block sm:hidden space-y-2">
                          <div className="font-medium text-sm text-blue-600">
                            {record.jjolmNumber}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {record.customerReferenceNumber && (
                              <div>Customer: {record.customerReferenceNumber}</div>
                            )}
                            {record.mode && <div>Mode: {record.mode}</div>}
                            <div>Updates: {record.updateCount}</div>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            {record.status && (
                              <Badge variant="outline" className="text-xs">
                                {record.status}
                              </Badge>
                            )}
                            <div className="text-xs text-muted-foreground">
                              {record.lastUpdated && new Date(record.lastUpdated).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        {/* Desktop Layout */}
                        <div className="hidden sm:flex items-center justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm text-blue-600 hover:text-blue-800">
                              {record.jjolmNumber}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {record.customerReferenceNumber && (
                                <span>Customer: {record.customerReferenceNumber} • </span>
                              )}
                              {record.mode && <span>Mode: {record.mode} • </span>}
                              Updates: {record.updateCount}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            {record.status && (
                              <Badge variant="outline" className="text-xs">
                                {record.status}
                              </Badge>
                            )}
                            <div className="text-xs text-muted-foreground min-w-[80px]">
                              {record.lastUpdated && new Date(record.lastUpdated).toLocaleDateString()}
                            </div>
                            <SemanticBDIIcon semantic="analytics" size={16} className="text-blue-500" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* JJOLM Timeline Modal */}
      <Dialog open={showJjolmTimeline} onOpenChange={setShowJjolmTimeline}>
        <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SemanticBDIIcon semantic="analytics" size={20} />
              JJOLM Timeline: {selectedJjolmForTimeline}
            </DialogTitle>
            <DialogDescription>
              Shipment tracking history and status progression
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 sm:p-6 lg:p-8">
            {timelineLoading ? (
            <div className="flex items-center justify-center py-8">
              <SemanticBDIIcon semantic="sync" size={32} className="animate-spin text-blue-500" />
              <span className="ml-2">Loading timeline...</span>
            </div>
          ) : timelineData?.data ? (
            <div className="space-y-6">
              {/* Current Status Summary */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-800 mb-3">Current Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-blue-700">Customer Ref:</span>
                    <span className="ml-1">{timelineData.data.currentStatus.customerReferenceNumber || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Mode:</span>
                    <span className="ml-1">{timelineData.data.currentStatus.mode || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Status:</span>
                    <span className="ml-1">{timelineData.data.currentStatus.status || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Origin:</span>
                    <span className="ml-1">{timelineData.data.currentStatus.origin || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Destination:</span>
                    <span className="ml-1">{timelineData.data.currentStatus.destination || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Carrier:</span>
                    <span className="ml-1">{timelineData.data.currentStatus.carrier || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Pickup Date:</span>
                    <span className="ml-1">{formatDate(timelineData.data.currentStatus.pickupDate)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Delivery Date:</span>
                    <span className="ml-1">{formatDate(timelineData.data.currentStatus.deliveryDate)}</span>
                  </div>
                  <div>
                    <span className="font-medium text-blue-700">Est. Delivery:</span>
                    <span className="ml-1">{formatDate(timelineData.data.currentStatus.estimatedDeliveryDate)}</span>
                  </div>
                </div>
              </div>

              {/* Timeline Events */}
              <div>
                <h3 className="font-semibold mb-4">Timeline ({timelineData.data.timeline.length} events)</h3>
                <div className="space-y-4">
                  {timelineData.data.timeline.map((event: any, index: number) => (
                    <div key={event.id} className="flex items-start gap-4">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getEventColor(event.color)}`}>
                          <SemanticBDIIcon semantic={getEventIcon(event.icon)} size={14} />
                        </div>
                        {index < timelineData.data.timeline.length - 1 && (
                          <div className="w-0.5 h-8 bg-gray-200 mt-2"></div>
                        )}
                      </div>

                      {/* Event content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{event.title}</h4>
                            <p className="text-sm text-muted-foreground">{event.description}</p>
                            {event.user && (
                              <p className="text-xs text-muted-foreground mt-1">
                                by {event.user.name} ({event.user.email})
                              </p>
                            )}
                            {event.data?.sourceFileName && (
                              <p className="text-xs text-muted-foreground">
                                Source: {event.data.sourceFileName}
                              </p>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground ml-4">
                            {new Date(event.timestamp).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <SemanticBDIIcon semantic="analytics" size={48} className="mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No timeline data available</p>
              </div>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}