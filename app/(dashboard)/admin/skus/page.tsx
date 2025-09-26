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
import { useSimpleTranslations, getUserLocale } from '@/lib/i18n/simple-translator';
import { DynamicTranslation } from '@/components/DynamicTranslation';
import { User, ProductSku, Organization } from '@/lib/db/schema';

interface UserWithOrganization extends User {
  organization?: {
    id: string;
    name: string;
    code: string;
    type: string;
  } | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SKUsPage() {
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  const userLocale = getUserLocale(user);
  const { tc } = useSimpleTranslations(userLocale);
  const { data: skus, mutate: mutateSkus } = useSWR<ProductSku[]>('/api/admin/skus', fetcher);
  const { data: organizations } = useSWR<Organization[]>('/api/admin/organizations', fetcher);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSku, setSelectedSku] = useState<ProductSku | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customMfg, setCustomMfg] = useState(false);
  const [editCustomMfg, setEditCustomMfg] = useState(false);
  const [customCarrier, setCustomCarrier] = useState(false);
  const [customCarrierCode, setCustomCarrierCode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [useSkuBuilder, setUseSkuBuilder] = useState(true);
  const [generatedSku, setGeneratedSku] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [skuBuilder, setSkuBuilder] = useState({
    brand: '',
    productType: '',
    modelNumber: '',
    modelYear: '',
    variant: '',
    region: '',
    color: '',
    charger: '',
    carrier: '',
    subSku: '',
  });
  const [customSubSku, setCustomSubSku] = useState(false);
  const [customSubSkuCode, setCustomSubSkuCode] = useState('');
  
  // Create Variant Modal State
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [variantParentSku, setVariantParentSku] = useState<ProductSku | null>(null);
  const [variantExtension, setVariantExtension] = useState<string>('');
  const [isCreatingVariant, setIsCreatingVariant] = useState(false);

  // Access control - only BDI Super Admins and Admins can manage SKUs
  if (!user || !['super_admin', 'admin'].includes(user.role) || (user as any).organization?.code !== 'BDI') {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="settings" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">
              <DynamicTranslation userLanguage={userLocale} context="business">
                Access Denied
              </DynamicTranslation>
            </h2>
            <p className="text-muted-foreground">
              <DynamicTranslation userLanguage={userLocale} context="business">
                Only BDI Admins can manage product SKUs.
              </DynamicTranslation>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleDeleteSku = async (skuId: string, skuName: string) => {
    if (!confirm(`Are you sure you want to delete SKU "${skuName}"? This action cannot be undone.`)) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/skus/${skuId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        mutateSkus(); // Refresh the SKU list
        alert('SKU deleted successfully!');
      } else {
        const errorData = await response.json();
        
        // Show specific error message for foreign key constraints
        if (errorData.code === 'FOREIGN_KEY_CONSTRAINT') {
          alert(`⚠️ Cannot Delete SKU\n\n${errorData.error}\n\nTo delete this SKU:\n1. Remove it from all invoices, purchase orders, and forecasts first\n2. Then try deleting again`);
        } else {
          alert(`Failed to delete SKU: ${errorData.error || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Error deleting SKU:', error);
      alert('Failed to delete SKU. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Create SKU Variant function
  const handleCreateVariant = async () => {
    if (!variantParentSku || !variantExtension.trim()) {
      alert('Please enter a 3-letter variant extension');
      return;
    }

    if (variantExtension.length > 3) {
      alert('Variant extension must be 3 letters or less');
      return;
    }

    setIsCreatingVariant(true);
    try {
      // Create new SKU code with variant extension in parentheses
      const newSkuCode = `${variantParentSku.sku}-(${variantExtension.toUpperCase()})`;
      
      // Create new SKU name with variant extension
      const baseName = variantParentSku.name.replace(/\s*\([^)]*\)\s*$/, ''); // Remove existing parentheses
      const newSkuName = `${baseName} (${variantExtension.toUpperCase()})`;
      
      // Check if SKU with this code already exists
      const existingSkuByCode = skus?.find(s => s.sku === newSkuCode);
      if (existingSkuByCode) {
        alert('A SKU with this variant code already exists');
        return;
      }
      
      // Check if SKU with this name already exists
      const existingSkuByName = skus?.find(s => s.name === newSkuName);
      if (existingSkuByName) {
        alert('A SKU with this variant name already exists');
        return;
      }


      // Copy all attributes from parent SKU (mapping to API expected property names)
      const variantSkuData = {
        sku: newSkuCode, // NEW unique SKU code with variant extension
        name: newSkuName,
        description: variantParentSku.description,
        category: variantParentSku.category,
        subcategory: variantParentSku.subcategory,
        model: variantParentSku.model,
        version: variantParentSku.version,
        dimensions: variantParentSku.dimensions,
        weight: variantParentSku.weight,
        color: variantParentSku.color,
        mfg: variantParentSku.mfg,
        moq: variantParentSku.moq,
        leadTimeDays: variantParentSku.leadTimeDays,
        isActive: true,
        isDiscontinued: false,
        
        // Box dimensions - map from DB names to API expected names
        boxLength: variantParentSku.boxLengthCm ? Number(variantParentSku.boxLengthCm) : undefined,
        boxWidth: variantParentSku.boxWidthCm ? Number(variantParentSku.boxWidthCm) : undefined,
        boxHeight: variantParentSku.boxHeightCm ? Number(variantParentSku.boxHeightCm) : undefined,
        boxWeight: variantParentSku.boxWeightKg ? Number(variantParentSku.boxWeightKg) : undefined,
        
        // Carton dimensions - map from DB names to API expected names
        cartonLength: variantParentSku.cartonLengthCm ? Number(variantParentSku.cartonLengthCm) : undefined,
        cartonWidth: variantParentSku.cartonWidthCm ? Number(variantParentSku.cartonWidthCm) : undefined,
        cartonHeight: variantParentSku.cartonHeightCm ? Number(variantParentSku.cartonHeightCm) : undefined,
        cartonWeight: variantParentSku.cartonWeightKg ? Number(variantParentSku.cartonWeightKg) : undefined,
        boxesPerCarton: variantParentSku.boxesPerCarton,
        
        // Pallet dimensions - map from DB names to API expected names
        palletLength: variantParentSku.palletLengthCm ? Number(variantParentSku.palletLengthCm) : undefined,
        palletWidth: variantParentSku.palletWidthCm ? Number(variantParentSku.palletWidthCm) : undefined,
        palletHeight: variantParentSku.palletHeightCm ? Number(variantParentSku.palletHeightCm) : undefined,
        palletWeight: variantParentSku.palletWeightKg ? Number(variantParentSku.palletWeightKg) : undefined,
        palletMaterialType: variantParentSku.palletMaterialType,
        palletNotes: variantParentSku.palletNotes,
        
        // Other fields
        mpStartDate: variantParentSku.mpStartDate ? 
          (variantParentSku.mpStartDate instanceof Date ? 
            variantParentSku.mpStartDate.toISOString() : 
            variantParentSku.mpStartDate) : undefined,
        htsCode: variantParentSku.htsCode,
        tags: variantParentSku.tags,
        specifications: variantParentSku.specifications
      };

      const response = await fetch('/api/admin/skus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(variantSkuData)
      });
      
      if (response.ok) {
        mutateSkus(); // Refresh the SKU list
        setShowVariantModal(false);
        setVariantParentSku(null);
        setVariantExtension('');
        alert(`SKU variant "${newSkuName}" created successfully!`);
      } else {
        const errorData = await response.json();
        alert(`Failed to create SKU variant: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating SKU variant:', error);
      alert('Failed to create SKU variant. Please try again.');
    } finally {
      setIsCreatingVariant(false);
    }
  };

  const handleCreateSku = async (formData: FormData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: formData.get('sku'),
          name: formData.get('name'),
          description: formData.get('description'),
          
          // Box dimensions/weights (metric)
          boxLength: formData.get('boxLength') ? parseFloat(formData.get('boxLength') as string) : undefined,
          boxWidth: formData.get('boxWidth') ? parseFloat(formData.get('boxWidth') as string) : undefined,
          boxHeight: formData.get('boxHeight') ? parseFloat(formData.get('boxHeight') as string) : undefined,
          boxWeight: formData.get('boxWeight') ? parseFloat(formData.get('boxWeight') as string) : undefined,
          
          // Carton dimensions/weights (metric)
          cartonLength: formData.get('cartonLength') ? parseFloat(formData.get('cartonLength') as string) : undefined,
          cartonWidth: formData.get('cartonWidth') ? parseFloat(formData.get('cartonWidth') as string) : undefined,
          cartonHeight: formData.get('cartonHeight') ? parseFloat(formData.get('cartonHeight') as string) : undefined,
          cartonWeight: formData.get('cartonWeight') ? parseFloat(formData.get('cartonWeight') as string) : undefined,
          boxesPerCarton: formData.get('boxesPerCarton') ? parseInt(formData.get('boxesPerCarton') as string) : undefined,
          
          // Pallet dimensions/weights (metric)
          palletLength: formData.get('palletLength') ? parseFloat(formData.get('palletLength') as string) : undefined,
          palletWidth: formData.get('palletWidth') ? parseFloat(formData.get('palletWidth') as string) : undefined,
          palletHeight: formData.get('palletHeight') ? parseFloat(formData.get('palletHeight') as string) : undefined,
          palletWeight: formData.get('palletWeight') ? parseFloat(formData.get('palletWeight') as string) : undefined,
          palletMaterialType: formData.get('palletMaterialType') || undefined,
          palletNotes: formData.get('palletNotes') || undefined,
          
          // Business terms
          moq: formData.get('moq') ? parseInt(formData.get('moq') as string) : 1,
          leadTimeDays: formData.get('leadTimeDays') ? parseInt(formData.get('leadTimeDays') as string) : 30,
          htsCode: formData.get('htsCode') || undefined,
          mpStartDate: formData.get('mpStartDate'),
          mfg: formData.get('mfg'),
        }),
      });

      if (response.ok) {
        mutateSkus(); // Refresh the SKU list
        setShowCreateModal(false);
        // Reset form
        setGeneratedSku('');
        setSkuBuilder({
          brand: '',
          productType: '',
          modelNumber: '',
          modelYear: '',
          variant: '',
          region: '',
          color: '',
          charger: '',
          carrier: '',
          subSku: '',
        });
        setCustomSubSku(false);
        setCustomSubSkuCode('');
      } else {
        const errorData = await response.json();
        alert(`Failed to create SKU: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating SKU:', error);
      alert('Failed to create SKU');
    }
    setIsLoading(false);
  };

  const handleEditSku = async (formData: FormData) => {
    if (!selectedSku) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/skus/${selectedSku.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('editName'),
          description: formData.get('editDescription'),
          
          // Box dimensions/weights (metric)
          boxLength: formData.get('editBoxLength') ? parseFloat(formData.get('editBoxLength') as string) : undefined,
          boxWidth: formData.get('editBoxWidth') ? parseFloat(formData.get('editBoxWidth') as string) : undefined,
          boxHeight: formData.get('editBoxHeight') ? parseFloat(formData.get('editBoxHeight') as string) : undefined,
          boxWeight: formData.get('editBoxWeight') ? parseFloat(formData.get('editBoxWeight') as string) : undefined,
          
          // Carton dimensions/weights (metric)
          cartonLength: formData.get('editCartonLength') ? parseFloat(formData.get('editCartonLength') as string) : undefined,
          cartonWidth: formData.get('editCartonWidth') ? parseFloat(formData.get('editCartonWidth') as string) : undefined,
          cartonHeight: formData.get('editCartonHeight') ? parseFloat(formData.get('editCartonHeight') as string) : undefined,
          cartonWeight: formData.get('editCartonWeight') ? parseFloat(formData.get('editCartonWeight') as string) : undefined,
          boxesPerCarton: formData.get('editBoxesPerCarton') ? parseInt(formData.get('editBoxesPerCarton') as string) : undefined,
          
          // Pallet dimensions/weights (metric)
          palletLength: formData.get('editPalletLength') ? parseFloat(formData.get('editPalletLength') as string) : undefined,
          palletWidth: formData.get('editPalletWidth') ? parseFloat(formData.get('editPalletWidth') as string) : undefined,
          palletHeight: formData.get('editPalletHeight') ? parseFloat(formData.get('editPalletHeight') as string) : undefined,
          palletWeight: formData.get('editPalletWeight') ? parseFloat(formData.get('editPalletWeight') as string) : undefined,
          palletMaterialType: formData.get('editPalletMaterialType') || undefined,
          palletNotes: formData.get('editPalletNotes') || undefined,
          
          // Business terms
          moq: formData.get('editMoq') ? parseInt(formData.get('editMoq') as string) : 1,
          leadTimeDays: formData.get('editLeadTimeDays') ? parseInt(formData.get('editLeadTimeDays') as string) : 30,
          htsCode: formData.get('htsCode') || undefined,
          editMpStartDate: formData.get('editMpStartDate'),
          editMfg: formData.get('editMfg'),
        }),
      });

      if (response.ok) {
        mutateSkus(); // Refresh the SKU list
        setSelectedSku(null); // Close modal
      } else {
        const errorData = await response.json();
        alert(`Failed to update SKU: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating SKU:', error);
      alert('Failed to update SKU');
    }
    setIsLoading(false);
  };

  // Filter SKUs based on search and category (ensure skus is an array)
  const skusArray = Array.isArray(skus) ? skus : [];
  const filteredSkus = skusArray.filter(sku => {
    const matchesSearch = !searchTerm || 
      sku.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sku.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sku.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Extract product type from SKU for filtering
    const productType = sku.sku.length >= 3 ? sku.sku.charAt(2) : null;
    const matchesCategory = categoryFilter === 'all' || 
      sku.category === categoryFilter || 
      productType === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  // Get unique categories for filter including product types
  const categories = Array.from(new Set([
    ...skusArray.map(sku => sku.category).filter(Boolean),
    ...skusArray.map(sku => {
      // Extract product type from SKU (2nd character: MNQ -> Q)
      const productType = sku.sku.length >= 3 ? sku.sku.charAt(2) : null;
      return productType;
    }).filter(Boolean)
  ]));

  // Color coding for product types
  const getProductTypeColor = (productType: string) => {
    const colors: { [key: string]: string } = {
      'B': 'bg-blue-100 border-blue-300 text-blue-800', // Bridge
      'G': 'bg-green-100 border-green-300 text-green-800', // Gateway
      'Q': 'bg-purple-100 border-purple-300 text-purple-800', // Router/Wifi
      'F': 'bg-orange-100 border-orange-300 text-orange-800', // FWA
      'P': 'bg-pink-100 border-pink-300 text-pink-800', // HotSpot
      'X': 'bg-indigo-100 border-indigo-300 text-indigo-800', // PON
      'A': 'bg-yellow-100 border-yellow-300 text-yellow-800', // Accessories
      'R': 'bg-red-100 border-red-300 text-red-800', // Red Cap
      'M': 'bg-teal-100 border-teal-300 text-teal-800', // Modem
      'C': 'bg-gray-100 border-gray-300 text-gray-800', // Cable/Accessory
    };
    return colors[productType] || 'bg-gray-100 border-gray-300 text-gray-800';
  };

  // SKU Builder Configuration
  const skuConfig = {
    brands: [
      { code: 'MN', name: 'Motorola' },
      { code: 'BDI', name: 'Boundless Devices' },
      { code: 'CU', name: 'Custom' },
    ],
    productTypes: [
      { code: 'B', name: 'Bridge' },
      { code: 'G', name: 'Gateway' },
      { code: 'Q', name: 'Router/Wifi' },
      { code: 'F', name: 'FWA' },
      { code: 'P', name: 'HotSpot' },
      { code: 'X', name: 'PON' },
      { code: 'A', name: 'Accessories' },
      { code: 'R', name: 'Red Cap' },
    ],
    variants: [
      { code: 'T', name: 'Telephony' },
      { code: 'A', name: 'Antenna' },
      { code: 'B', name: 'External Battery' },
      { code: 'D', name: 'Dual Pack' },
      { code: 'M', name: 'Multi Pack' },
      { code: 'S', name: 'Service' },
    ],
    regions: [
      { code: '30', name: 'Local (30)' },
      { code: '80', name: 'Global (80)' },
    ],
    colors: [
      { code: 'W', name: 'White' },
      { code: 'B', name: 'Black' },
    ],
    chargers: [
      { code: 'U', name: 'US Plug' },
      { code: 'K', name: 'UK Plug' },
      { code: 'E', name: 'EU Plug' },
      { code: 'A', name: 'ANZ Plug' },
      { code: 'C', name: 'China Plug' },
      { code: 'J', name: 'Japan Plug' },
      { code: 'B', name: 'Brazil Plug' },
      { code: 'N', name: 'No Charger' },
    ],
    carriers: [
      { code: 'T', name: 'T-Mobile' },
      { code: 'U', name: 'Universal' },
      { code: 'V', name: 'Verizon' },
      { code: 'E', name: 'Europe' },
      { code: 'A', name: 'AT&T' },
      { code: 'CUSTOM', name: '📝 Custom Carrier Code' },
      { code: '', name: 'None (Leave Empty)' },
    ],
    subSkus: [
      { code: 'HSN', name: 'HSN' },
      { code: 'WMT', name: 'WMT' },
      { code: 'CCO', name: 'CCO' },
      { code: 'SPC', name: 'SPC' },
      { code: 'CUSTOM', name: '📝 Custom Sub-SKU Code' },
      { code: '', name: 'None (Leave Empty)' },
    ],
  };

  // Generate SKU from builder selections - Format: MNQ1525-D30W-U-CARRIER-(SUBSKU)
  const generateSku = () => {
    const { brand, productType, modelNumber, modelYear, variant, region, color, charger, carrier, subSku } = skuBuilder;
    
    // First part: Brand + ProductType + ModelNumber + ModelYear (e.g., MNQ1525)
    const firstPart = `${brand}${productType}${modelNumber}${modelYear}`;
    
    // Second part: Variant + Region + Color (e.g., D30W or 30W)
    const secondPart = variant ? `${variant}${region}${color}` : `${region}${color}`;
    
    // Third part: Charger (e.g., U)
    const thirdPart = charger;
    
    // Fourth part: Carrier (with dash prefix, can be empty)
    const fourthPart = carrier ? `-${carrier}` : '';
    
    // Fifth part: Sub-SKU (in parentheses, for BDI internal planning)
    const subSkuCode = customSubSku ? customSubSkuCode : subSku;
    const fifthPart = subSkuCode ? `-(${subSkuCode})` : '';
    
    // Combine with proper formatting: MNQ1525-D30W-U-CARRIER-(SUBSKU)
    if (!brand || !productType || !modelNumber || !modelYear || !region || !color || !charger) {
      return '';
    }
    
    let sku = `${firstPart}-${secondPart}-${thirdPart}${fourthPart}${fifthPart}`;
    
    return sku;
  };

  // Update generated SKU when builder changes
  const updateGeneratedSku = (field: string, value: string) => {
    const newBuilder = { ...skuBuilder, [field]: value };
    setSkuBuilder(newBuilder);
    setGeneratedSku(generateSku());
  };

  return (
    <div className="flex-1 p-3 sm:p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <SemanticBDIIcon semantic="inventory" size={24} className="sm:w-8 sm:h-8" />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">{tc('productSKUsTitle', 'Product SKUs')}</h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                <DynamicTranslation userLanguage={userLocale} context="business">
                  Manage your product catalog for CPFR planning
                </DynamicTranslation>
              </p>
            </div>
          </div>
          <Button className="bg-bdi-green-1 hover:bg-bdi-green-2 w-full sm:w-auto" onClick={() => setShowCreateModal(true)}>
            <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
            {tc('addSKU', 'Add SKU')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col space-y-4 sm:flex-row sm:space-y-0 gap-4">
        <div className="flex-1">
          <Input
            placeholder={tc('searchSKUsPlaceholder', 'Search SKUs, names, or descriptions...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
          <div className="flex items-center space-x-2">
            <Label htmlFor="category-filter" className="text-sm">{tc('category', 'Category')}:</Label>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm flex-1 sm:flex-none"
            >
              <option value="all">{tc('allCategories', 'All Categories')}</option>
              {categories.map(category => (
                <option key={category} value={category || ''}>
                  {category && category.length === 1 ? `${category} - Product Type` : category}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex border rounded-md w-full sm:w-auto">
            <button
              onClick={() => setViewMode('list')}
              className={`px-2 sm:px-3 py-2 text-xs sm:text-sm transition-colors flex-1 sm:flex-none ${viewMode === 'list' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              📋 <span className="hidden sm:inline ml-1">List</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-2 sm:px-3 py-2 text-xs sm:text-sm transition-colors flex-1 sm:flex-none ${viewMode === 'grid' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              🔲 <span className="hidden sm:inline ml-1">Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* SKUs List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="inventory" size={20} className="mr-2" />
            Product Catalog
          </CardTitle>
          <CardDescription>
            Manage your product SKUs for CPFR planning and order management
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!skus ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <SemanticBDIIcon semantic="sync" size={32} className="mx-auto mb-4 text-muted-foreground animate-spin" />
                <p className="text-muted-foreground">Loading SKUs...</p>
              </div>
            </div>
          ) : filteredSkus.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <SemanticBDIIcon semantic="inventory" size={48} className="mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  {skusArray.length === 0 ? 'No SKUs Yet' : 'No SKUs Found'}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {skusArray.length === 0 
                    ? 'Get started by adding your first product SKU'
                    : 'Try adjusting your search or filter criteria'
                  }
                </p>
                {skusArray.length === 0 && (
                  <Button 
                    className="bg-bdi-green-1 hover:bg-bdi-green-2" 
                    onClick={() => setShowCreateModal(true)}
                  >
                    <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
                    Add First SKU
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <>
              {viewMode === 'list' ? (
                <div className="space-y-3">
                  {filteredSkus.map((sku) => (
                <div key={sku.id} className="border rounded-lg p-3 sm:p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 mb-3 sm:mb-0">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3 mb-2">
                        <h3 className="font-semibold text-base sm:text-lg mb-1 sm:mb-0">
                          <DynamicTranslation userLanguage={userLocale} context="manufacturing">
                            {sku.name}
                          </DynamicTranslation>
                        </h3>
                        <div className="flex items-center space-x-2 flex-wrap">
                          <Badge variant="outline" className="font-mono text-xs">
                            {sku.sku}
                          </Badge>
                          {sku.category && (
                            <Badge variant="secondary" className="text-xs">{sku.category}</Badge>
                          )}
                          {!sku.isActive && (
                            <Badge variant="destructive" className="text-xs">{tc('inactive', 'Inactive')}</Badge>
                          )}
                          {sku.isDiscontinued && (
                            <Badge variant="outline" className="text-orange-600 border-orange-600 text-xs">
                              {tc('discontinued', 'Discontinued')}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {sku.description && (
                        <p className="text-muted-foreground text-sm mb-3 overflow-hidden" style={{display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'}}>
                          <DynamicTranslation userLanguage={userLocale} context="manufacturing">
                            {sku.description}
                          </DynamicTranslation>
                        </p>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3 text-sm">
                        {sku.model && (
                          <div>
                            <span className="text-gray-500 text-xs">Model:</span>
                            <p className="font-medium text-xs sm:text-sm">{sku.model}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500 text-xs">MOQ:</span>
                          <p className="font-medium text-xs sm:text-sm">{sku.moq || 1} units</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Lead Time:</span>
                          <p className="font-medium text-xs sm:text-sm">{sku.leadTimeDays || 30} days</p>
                        </div>
                      </div>
                    </div>
                    {/* Mobile-optimized button layout */}
                    <div className="flex flex-row sm:flex-col lg:flex-row space-x-1 sm:space-x-0 sm:space-y-1 lg:space-y-0 lg:space-x-2 sm:ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setVariantParentSku(sku);
                          // Extract existing extension if any (text in parentheses)
                          const match = sku.name.match(/\(([^)]+)\)$/);
                          setVariantExtension(match ? match[1] : '');
                          setShowVariantModal(true);
                        }}
                        disabled={isLoading}
                        className="flex-1 sm:w-auto text-green-600 border-green-300 hover:bg-green-50 text-xs px-2 py-1"
                        title="Create SKU Variant"
                      >
                        <SemanticBDIIcon semantic="plus" size={12} className="mr-1 sm:mr-0 lg:mr-1" />
                        <span className="hidden sm:inline lg:inline">Create</span>
                        <span className="sm:hidden">Variant</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSku(sku)}
                        disabled={isLoading}
                        className="flex-1 sm:w-auto text-xs px-2 py-1"
                      >
                        <SemanticBDIIcon semantic="settings" size={12} className="mr-1 sm:mr-0 lg:mr-1" />
                        <span className="hidden sm:inline lg:inline">Edit</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteSku(sku.id, sku.sku)}
                        disabled={isLoading}
                        className="flex-1 sm:w-auto text-red-600 border-red-300 hover:bg-red-50 text-xs px-2 py-1"
                      >
                        <span className="mr-1 sm:mr-0 lg:mr-1 text-xs">🗑️</span>
                        <span className="hidden sm:inline lg:inline">Delete</span>
                      </Button>
                    </div>
                  </div>
                </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 lg:gap-4">
                  {filteredSkus.map((sku) => {
                    const productType = sku.sku.length >= 3 ? sku.sku.charAt(2) : 'C';
                    return (
                      <div 
                        key={sku.id} 
                        className={`relative border-2 rounded-lg p-3 hover:shadow-md transition-all ${getProductTypeColor(productType)}`}
                      >
                        <div className="text-center">
                          <div className="text-xs font-mono font-bold mb-1 truncate">
                            {sku.sku}
                          </div>
                          <div className="text-xs font-medium leading-tight line-clamp-2 min-h-[2.5rem] flex items-center justify-center mb-2">
                            {sku.name}
                          </div>
                          {!sku.isActive && (
                            <div className="absolute top-1 left-1">
                              <Badge variant="destructive" className="text-xs px-1 py-0">
                                ✕
                              </Badge>
                            </div>
                          )}
                          <div className="flex items-center justify-center space-x-1 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedSku(sku)}
                              disabled={isLoading}
                              className="text-xs px-2 py-1"
                            >
                              <SemanticBDIIcon semantic="settings" size={12} className="mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteSku(sku.id, sku.sku)}
                              disabled={isLoading}
                              className="text-xs px-2 py-1 text-red-600 border-red-300 hover:bg-red-50"
                              title="Delete SKU"
                            >
                              <span className="text-sm">🗑️</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create SKU Modal */}
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <SemanticBDIIcon semantic="plus" size={24} className="mr-2" />
                Add New SKU
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateSku(new FormData(e.currentTarget));
            }} className="space-y-12 p-8">
              {/* SKU Builder Toggle */}
              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="useSkuBuilder"
                  checked={useSkuBuilder}
                  onChange={(e) => setUseSkuBuilder(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="useSkuBuilder" className="font-medium">
                  Use SKU Builder (recommended)
                </Label>
                <Badge variant="secondary">Auto-generates from your selections</Badge>
              </div>

              {/* SKU Builder Section */}
              {useSkuBuilder ? (
                <div className="space-y-4 p-4 border rounded-lg bg-blue-50">
                  <h3 className="font-semibold text-lg flex items-center">
                    <SemanticBDIIcon semantic="settings" size={20} className="mr-2" />
                    SKU Builder
                  </h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 lg:gap-4 text-sm">
                    {/* Brand */}
                    <div className="min-w-0">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Brand *
                      </label>
                      <select
                        value={skuBuilder.brand}
                        onChange={(e) => updateGeneratedSku('brand', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select</option>
                        {skuConfig.brands.map(brand => (
                          <option key={brand.code} value={brand.code}>
                            {brand.code} - {brand.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Product */}
                    <div className="min-w-0">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Product *
                      </label>
                      <select
                        value={skuBuilder.productType}
                        onChange={(e) => updateGeneratedSku('productType', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select</option>
                        {skuConfig.productTypes.map(type => (
                          <option key={type.code} value={type.code}>
                            {type.code} - {type.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Model No. */}
                    <div className="min-w-0">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Model No. *
                      </label>
                      <input
                        type="text"
                        value={skuBuilder.modelNumber}
                        onChange={(e) => updateGeneratedSku('modelNumber', e.target.value)}
                        placeholder="15"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        maxLength={3}
                        required
                      />
                    </div>

                    {/* Model Year */}
                    <div className="min-w-0">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Model Year *
                      </label>
                      <input
                        type="text"
                        value={skuBuilder.modelYear}
                        onChange={(e) => updateGeneratedSku('modelYear', e.target.value)}
                        placeholder="25"
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                        maxLength={2}
                        required
                      />
                    </div>

                    {/* Variant */}
                    <div className="min-w-0">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Variant
                      </label>
                      <select
                        value={skuBuilder.variant}
                        onChange={(e) => updateGeneratedSku('variant', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">None</option>
                        {skuConfig.variants.map(variant => (
                          <option key={variant.code} value={variant.code}>
                            {variant.code} - {variant.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Distribution */}
                    <div className="min-w-0">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Distribution *
                      </label>
                      <select
                        value={skuBuilder.region}
                        onChange={(e) => updateGeneratedSku('region', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select</option>
                        {skuConfig.regions.map(region => (
                          <option key={region.code} value={region.code}>
                            {region.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Color */}
                    <div className="min-w-0">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Color *
                      </label>
                      <select
                        value={skuBuilder.color}
                        onChange={(e) => updateGeneratedSku('color', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select</option>
                        {skuConfig.colors.map(color => (
                          <option key={color.code} value={color.code}>
                            {color.code} - {color.name}
                          </option>
                        ))}
                      </select>
                    </div>



                    {/* Charger */}
                    <div className="min-w-0">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Charger *
                      </label>
                      <select
                        value={skuBuilder.charger}
                        onChange={(e) => updateGeneratedSku('charger', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      >
                        <option value="">Select</option>
                        {skuConfig.chargers.map(charger => (
                          <option key={charger.code} value={charger.code}>
                            {charger.code} - {charger.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Carrier */}
                    <div className="min-w-0">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Carrier
                      </label>
                      {!customCarrier ? (
                        <select
                          value={skuBuilder.carrier}
                          onChange={(e) => {
                            if (e.target.value === 'CUSTOM') {
                              setCustomCarrier(true);
                              setCustomCarrierCode('');
                            } else {
                              updateGeneratedSku('carrier', e.target.value);
                            }
                          }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">None</option>
                          {skuConfig.carriers.map(carrier => (
                            <option key={carrier.code} value={carrier.code}>
                              {carrier.code === '' ? carrier.name : 
                               carrier.code === 'CUSTOM' ? carrier.name :
                               `${carrier.code} - ${carrier.name}`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex space-x-1">
                          <div className="flex items-center">
                            <span className="px-2 py-1.5 text-sm bg-gray-100 border border-r-0 border-gray-300 rounded-l">-</span>
                          </div>
                          <Input
                            value={customCarrierCode}
                            onChange={(e) => {
                              const value = e.target.value.toUpperCase().slice(0, 3);
                              setCustomCarrierCode(value);
                              updateGeneratedSku('carrier', value);
                            }}
                            placeholder="ABC"
                            maxLength={3}
                            className="w-16 text-sm text-center font-mono"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCustomCarrier(false);
                              setCustomCarrierCode('');
                              updateGeneratedSku('carrier', '');
                            }}
                            className="px-2"
                          >
                            ✕
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Sub-SKU (BDI Internal Tracking) */}
                    <div className="min-w-0">
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Sub-SKU (Internal Tracking)
                      </label>
                      {!customSubSku ? (
                        <select
                          value={skuBuilder.subSku}
                          onChange={(e) => {
                            if (e.target.value === 'CUSTOM') {
                              setCustomSubSku(true);
                              setCustomSubSkuCode('');
                            } else {
                              updateGeneratedSku('subSku', e.target.value);
                            }
                          }}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">None</option>
                          {skuConfig.subSkus.map(subSku => (
                            <option key={subSku.code} value={subSku.code}>
                              {subSku.code === '' ? subSku.name : 
                               subSku.code === 'CUSTOM' ? subSku.name :
                               `${subSku.code} - ${subSku.name}`}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex space-x-1">
                          <div className="flex items-center">
                            <span className="px-2 py-1.5 text-sm bg-gray-100 border border-r-0 border-gray-300 rounded-l">-(</span>
                          </div>
                          <Input
                            value={customSubSkuCode}
                            onChange={(e) => {
                              const value = e.target.value.toUpperCase().slice(0, 4);
                              setCustomSubSkuCode(value);
                              updateGeneratedSku('subSku', value);
                            }}
                            placeholder="ABCD"
                            maxLength={4}
                            className="w-20 text-sm text-center font-mono"
                          />
                          <div className="flex items-center">
                            <span className="px-2 py-1.5 text-sm bg-gray-100 border border-l-0 border-r-0 border-gray-300">)</span>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCustomSubSku(false);
                              setCustomSubSkuCode('');
                              updateGeneratedSku('subSku', '');
                            }}
                            className="px-2"
                          >
                            ✕
                          </Button>
                        </div>
                      )}
                      <div className="text-xs text-gray-500 mt-1">
                        For BDI internal tracking. Shown in parentheses.
                      </div>
                    </div>
                  </div>

                  {/* Generated SKU Preview */}
                  <div className="p-3 bg-white border rounded-lg">
                    <Label className="text-sm font-medium text-gray-700">Generated SKU:</Label>
                    <div className="font-mono text-lg font-bold text-bdi-green-1 mt-1">
                      {generateSku() || 'Select options above to generate SKU'}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Manual SKU Entry (when builder is disabled) */}
              {!useSkuBuilder && (
                <div>
                  <Label htmlFor="sku">SKU Code *</Label>
                  <Input
                    id="sku"
                    name="sku"
                    required
                    placeholder="e.g., MN-B-#24-T-1-W-US-U"
                    className="font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter SKU manually (Format: Brand-Type-Model-Variant-Region-Color-Charger-Carrier)
                  </p>
                </div>
              )}

              {/* Hidden field for generated SKU */}
              {useSkuBuilder && (
                <input type="hidden" name="sku" value={generateSku()} />
              )}

              {/* Basic Information */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div>
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    placeholder="e.g., Wireless IoT Sensor"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  name="description"
                  placeholder="Brief product description"
                />
              </div>

              {/* Measurement Units Note */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <div className="flex items-center">
                  <SemanticBDIIcon semantic="info" size={16} className="mr-2 text-amber-600" />
                  <span className="text-xs font-medium text-amber-800">
                    All dimensions in centimeters (cm), all weights in kilograms (kg)
                  </span>
                </div>
              </div>

              {/* Box Dimensions/Weights */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                  <SemanticBDIIcon semantic="inventory" size={16} className="mr-2" />
                  Box Dims/Weights
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                  <div>
                    <Label className="text-xs">Length (cm)</Label>
                    <Input
                      name="boxLength"
                      type="number"
                      step="0.001"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width (cm)</Label>
                    <Input
                      name="boxWidth"
                      type="number"
                      step="0.001"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height (cm)</Label>
                    <Input
                      name="boxHeight"
                      type="number"
                      step="0.001"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input
                      name="boxWeight"
                      type="number"
                      step="0.001"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Carton Dimensions/Weights */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                  <SemanticBDIIcon semantic="inventory" size={16} className="mr-2" />
                  Carton Dims/Weights
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div>
                    <Label className="text-xs">Length (cm)</Label>
                    <Input
                      name="cartonLength"
                      type="number"
                      step="0.001"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width (cm)</Label>
                    <Input
                      name="cartonWidth"
                      type="number"
                      step="0.001"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height (cm)</Label>
                    <Input
                      name="cartonHeight"
                      type="number"
                      step="0.001"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input
                      name="cartonWeight"
                      type="number"
                      step="0.001"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Boxes/Carton</Label>
                    <Input
                      name="boxesPerCarton"
                      type="number"
                      min="1"
                      placeholder="1"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Pallet Dimensions/Weights */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                  <SemanticBDIIcon semantic="inventory" size={16} className="mr-2" />
                  Pallet Dims/Weights
                </h4>
                
                {/* Pallet Material Type */}
                <div className="mb-4">
                  <Label className="text-xs font-medium">Pallet Material Type</Label>
                  <select
                    name="palletMaterialType"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1"
                  >
                    <option value="">Select Material Type</option>
                    <optgroup label="🌲 Wood Pallets (ISPM 15 Required)">
                      <option value="WOOD_HT">Solid Wood - Heat Treated (HT + DB)</option>
                      <option value="WOOD_MB">Solid Wood - Methyl Bromide (MB + DB)</option>
                    </optgroup>
                    <optgroup label="🔧 Alternative Materials (No ISPM 15)">
                      <option value="PLASTIC_HDPE">Plastic - HDPE</option>
                      <option value="PLASTIC_PP">Plastic - PP</option>
                      <option value="PRESSWOOD">Composite/Presswood (Inka, Litco)</option>
                      <option value="PLYWOOD_OSB">Plywood/OSB/MDF (Engineered Wood)</option>
                      <option value="STEEL">Metal - Steel</option>
                      <option value="ALUMINUM">Metal - Aluminum</option>
                      <option value="PAPERBOARD">Cardboard/Paperboard</option>
                    </optgroup>
                  </select>
                  <div className="mt-1 text-xs text-gray-600">
                    <span className="font-medium">ISPM 15:</span> International standard for wood packaging. 
                    <span className="text-blue-600">HT = Heat Treated, MB = Methyl Bromide, DB = Debarked</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div>
                    <Label className="text-xs">Length (cm)</Label>
                    <Input
                      name="palletLength"
                      type="number"
                      step="0.001"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width (cm)</Label>
                    <Input
                      name="palletWidth"
                      type="number"
                      step="0.001"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height (cm)</Label>
                    <Input
                      name="palletHeight"
                      type="number"
                      step="0.001"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input
                      name="palletWeight"
                      type="number"
                      step="0.001"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <textarea
                    name="palletNotes"
                    placeholder="pallet stacking"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    rows={2}
                  />
                </div>
              </div>

              {/* Business Information */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-800 mb-3 flex items-center">
                  <SemanticBDIIcon semantic="orders" size={16} className="mr-2" />
                  Forecast Terms
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-6 xl:gap-12">
                  <div>
                    <Label className="text-xs">Minimum Order Quantity (MOQ)</Label>
                    <Input
                      name="moq"
                      type="number"
                      min="1"
                      defaultValue="1"
                      placeholder="1"
                      className="text-sm"
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      Minimum units that must be ordered
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Lead Time (Days)</Label>
                    <Input
                      name="leadTimeDays"
                      type="number"
                      min="1"
                      defaultValue="30"
                      placeholder="30"
                      className="text-sm"
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      Days from order to delivery
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">HTS Code</Label>
                    <Input
                      name="htsCode"
                      type="text"
                      placeholder="8517.62.0050"
                      maxLength={12}
                      pattern="[0-9]{4}\.[0-9]{2}\.[0-9]{4}"
                      className="text-sm font-mono"
                      onInput={(e) => {
                        // Auto-format HTS code as user types
                        let value = e.currentTarget.value.replace(/[^0-9]/g, '');
                        if (value.length >= 4) {
                          value = value.slice(0, 4) + '.' + value.slice(4);
                        }
                        if (value.length >= 7) {
                          value = value.slice(0, 7) + '.' + value.slice(7);
                        }
                        if (value.length > 12) {
                          value = value.slice(0, 12);
                        }
                        e.currentTarget.value = value;
                      }}
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      🔎 Harmonized Tariff Schedule (e.g., 8517.62.0050 for communication devices)
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">MP Ready Date (EXW)</Label>
                    <Input
                      name="mpStartDate"
                      type="date"
                      className="text-sm"
                      placeholder="Select date..."
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      📅 Manufacturing Program start date
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Manufacturer (MFG)</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="org-mfg"
                          name="mfgOption"
                          checked={!customMfg}
                          onChange={() => setCustomMfg(false)}
                          className="text-green-600"
                        />
                        <label htmlFor="org-mfg" className="text-xs">From Organizations</label>
                      </div>
                      {!customMfg && (
                        <select
                          name="mfg"
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                        >
                          <option value="">Select Organization</option>
                          {organizations?.map((org) => (
                            <option key={org.id} value={org.code || ''}>
                              {org.code || 'N/A'} - {org.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="custom-mfg"
                          name="mfgOption"
                          checked={customMfg}
                          onChange={() => setCustomMfg(true)}
                          className="text-green-600"
                        />
                        <label htmlFor="custom-mfg" className="text-xs">Custom Entry</label>
                      </div>
                      {customMfg && (
                        <Input
                          name="mfg"
                          type="text"
                          placeholder="e.g., MOT, HYT, KEN"
                          className="text-sm"
                        />
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      3-letter organization code or custom manufacturer
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <SemanticBDIIcon semantic="sync" size={16} className="mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
                      Create SKU
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit SKU Modal */}
      {selectedSku && (
        <Dialog open={!!selectedSku} onOpenChange={() => setSelectedSku(null)}>
          <DialogContent className="w-[98vw] h-[98vh] overflow-y-auto" style={{ maxWidth: 'none' }}>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <SemanticBDIIcon semantic="settings" size={20} className="mr-2" />
                Edit SKU: {selectedSku.sku}
              </DialogTitle>
            </DialogHeader>
            <form className="space-y-12 p-8" onSubmit={(e) => {
              e.preventDefault();
              handleEditSku(new FormData(e.currentTarget));
            }}>
              {/* Basic Info */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                <div>
                  <Label htmlFor="editSku">SKU *</Label>
                  <Input
                    id="editSku"
                    defaultValue={selectedSku.sku}
                    className="font-mono bg-gray-50"
                    readOnly
                  />
                </div>
                <div>
                  <Label htmlFor="editName">Product Name *</Label>
                  <Input
                    id="editName"
                    name="editName"
                    defaultValue={selectedSku.name}
                    placeholder="Enter product name"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="editDescription">Description</Label>
                <Input
                  id="editDescription"
                  name="editDescription"
                  defaultValue={selectedSku.description || ''}
                  placeholder="Brief product description"
                />
              </div>

              {/* Measurement Units Note */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <div className="flex items-center">
                  <SemanticBDIIcon semantic="info" size={16} className="mr-2 text-amber-600" />
                  <span className="text-xs font-medium text-amber-800">
                    All dimensions in centimeters (cm), all weights in kilograms (kg)
                  </span>
                </div>
              </div>

              {/* Box Dimensions/Weights */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                  <SemanticBDIIcon semantic="inventory" size={16} className="mr-2" />
                  Box Dims/Weights
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                  <div>
                    <Label className="text-xs">Length (cm)</Label>
                    <Input
                      name="editBoxLength"
                      type="number"
                      step="0.001"
                      defaultValue={selectedSku?.boxLengthCm || ''}
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width (cm)</Label>
                    <Input
                      name="editBoxWidth"
                      type="number"
                      step="0.001"
                      defaultValue={selectedSku?.boxWidthCm || ''}
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height (cm)</Label>
                    <Input
                      name="editBoxHeight"
                      type="number"
                      step="0.001"
                      defaultValue={selectedSku?.boxHeightCm || ''}
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input
                      name="editBoxWeight"
                      type="number"
                      step="0.001"
                      defaultValue={selectedSku?.boxWeightKg || ''}
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Carton Dimensions/Weights */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                  <SemanticBDIIcon semantic="inventory" size={16} className="mr-2" />
                  Carton Dims/Weights
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div>
                    <Label className="text-xs">Length (cm)</Label>
                    <Input
                      name="editCartonLength"
                      type="number"
                      step="0.001"
                      defaultValue={selectedSku?.cartonLengthCm || ''}
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width (cm)</Label>
                    <Input
                      name="editCartonWidth"
                      type="number"
                      step="0.001"
                      defaultValue={selectedSku?.cartonWidthCm || ''}
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height (cm)</Label>
                    <Input
                      name="editCartonHeight"
                      type="number"
                      step="0.001"
                      defaultValue={selectedSku?.cartonHeightCm || ''}
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input
                      name="editCartonWeight"
                      type="number"
                      step="0.001"
                      defaultValue={selectedSku?.cartonWeightKg || ''}
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Boxes/Carton</Label>
                    <Input
                      name="editBoxesPerCarton"
                      type="number"
                      min="1"
                      defaultValue={selectedSku?.boxesPerCarton || ''}
                      placeholder="1"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Pallet Dimensions/Weights */}
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-3 flex items-center">
                  <SemanticBDIIcon semantic="inventory" size={16} className="mr-2" />
                  Pallet Dims/Weights
                </h4>
                
                {/* Pallet Material Type */}
                <div className="mb-4">
                  <Label className="text-xs font-medium">Pallet Material Type</Label>
                  <select
                    name="editPalletMaterialType"
                    defaultValue={selectedSku?.palletMaterialType || ''}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 mt-1"
                  >
                    <option value="">Select Material Type</option>
                    <optgroup label="🌲 Wood Pallets (ISPM 15 Required)">
                      <option value="WOOD_HT">Solid Wood - Heat Treated (HT + DB)</option>
                      <option value="WOOD_MB">Solid Wood - Methyl Bromide (MB + DB)</option>
                    </optgroup>
                    <optgroup label="🔧 Alternative Materials (No ISPM 15)">
                      <option value="PLASTIC_HDPE">Plastic - HDPE</option>
                      <option value="PLASTIC_PP">Plastic - PP</option>
                      <option value="PRESSWOOD">Composite/Presswood (Inka, Litco)</option>
                      <option value="PLYWOOD_OSB">Plywood/OSB/MDF (Engineered Wood)</option>
                      <option value="STEEL">Metal - Steel</option>
                      <option value="ALUMINUM">Metal - Aluminum</option>
                      <option value="PAPERBOARD">Cardboard/Paperboard</option>
                    </optgroup>
                  </select>
                  <div className="mt-1 text-xs text-gray-600">
                    <span className="font-medium">ISPM 15:</span> International standard for wood packaging. 
                    <span className="text-blue-600">HT = Heat Treated, MB = Methyl Bromide, DB = Debarked</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                  <div>
                    <Label className="text-xs">Length (cm)</Label>
                    <Input
                      name="editPalletLength"
                      type="number"
                      step="0.001"
                      defaultValue={selectedSku?.palletLengthCm || ''}
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width (cm)</Label>
                    <Input
                      name="editPalletWidth"
                      type="number"
                      step="0.001"
                      defaultValue={selectedSku?.palletWidthCm || ''}
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height (cm)</Label>
                    <Input
                      name="editPalletHeight"
                      type="number"
                      step="0.001"
                      defaultValue={selectedSku?.palletHeightCm || ''}
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input
                      name="editPalletWeight"
                      type="number"
                      step="0.001"
                      defaultValue={selectedSku?.palletWeightKg || ''}
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <textarea
                    name="editPalletNotes"
                    defaultValue={selectedSku?.palletNotes || ''}
                    placeholder="pallet stacking"
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    rows={2}
                  />
                </div>
              </div>

              {/* Business Information */}
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <h4 className="font-semibold text-green-800 mb-3 flex items-center">
                  <SemanticBDIIcon semantic="orders" size={16} className="mr-2" />
                  Forecast Terms
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-6 xl:gap-12">
                  <div>
                    <Label className="text-xs">Minimum Order Quantity (MOQ)</Label>
                    <Input
                      name="editMoq"
                      type="number"
                      min="1"
                      defaultValue={selectedSku?.moq || 1}
                      placeholder="1"
                      className="text-sm"
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      Minimum units that must be ordered
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Lead Time (Days)</Label>
                    <Input
                      name="editLeadTimeDays"
                      type="number"
                      min="1"
                      defaultValue={selectedSku?.leadTimeDays || 30}
                      placeholder="30"
                      className="text-sm"
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      Days from order to delivery
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">HTS Code</Label>
                    <Input
                      name="htsCode"
                      type="text"
                      defaultValue={(selectedSku as any)?.htsCode || ''}
                      placeholder="8517.62.0050"
                      maxLength={12}
                      pattern="[0-9]{4}\.[0-9]{2}\.[0-9]{4}"
                      className="text-sm font-mono"
                      onInput={(e) => {
                        // Auto-format HTS code as user types
                        let value = e.currentTarget.value.replace(/[^0-9]/g, '');
                        if (value.length >= 4) {
                          value = value.slice(0, 4) + '.' + value.slice(4);
                        }
                        if (value.length >= 7) {
                          value = value.slice(0, 7) + '.' + value.slice(7);
                        }
                        if (value.length > 12) {
                          value = value.slice(0, 12);
                        }
                        e.currentTarget.value = value;
                      }}
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      🔎 Harmonized Tariff Schedule (e.g., 8517.62.0050 for communication devices)
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">MP Ready Date (EXW)</Label>
                    <Input
                      name="editMpStartDate"
                      type="date"
                      defaultValue={selectedSku?.mpStartDate ? new Date(selectedSku.mpStartDate).toISOString().split('T')[0] : ''}
                      className="text-sm"
                      placeholder="Select date..."
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      📅 Manufacturing Program start date
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Manufacturer (MFG)</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="edit-org-mfg"
                          name="editMfgOption"
                          checked={!editCustomMfg}
                          onChange={() => setEditCustomMfg(false)}
                          className="text-green-600"
                        />
                        <label htmlFor="edit-org-mfg" className="text-xs">From Organizations</label>
                      </div>
                      {!editCustomMfg && (
                        <select
                          name="editMfg"
                          defaultValue={selectedSku?.mfg || ''}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                        >
                          <option value="">Select Organization</option>
                          {organizations?.map((org) => (
                            <option key={org.id} value={org.code || ''}>
                              {org.code || 'N/A'} - {org.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="edit-custom-mfg"
                          name="editMfgOption"
                          checked={editCustomMfg}
                          onChange={() => setEditCustomMfg(true)}
                          className="text-green-600"
                        />
                        <label htmlFor="edit-custom-mfg" className="text-xs">Custom Entry</label>
                      </div>
                      {editCustomMfg && (
                        <Input
                          name="editMfg"
                          type="text"
                          defaultValue={selectedSku?.mfg || ''}
                          placeholder="e.g., MOT, HYT, KEN"
                          className="text-sm"
                        />
                      )}
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      3-letter organization code or custom manufacturer
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedSku(null)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <SemanticBDIIcon semantic="sync" size={16} className="mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <SemanticBDIIcon semantic="settings" size={16} className="mr-2" />
                      Update SKU
                    </>
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Create SKU Variant Modal */}
      {showVariantModal && variantParentSku && (
        <Dialog open={showVariantModal} onOpenChange={setShowVariantModal}>
          <DialogContent className="w-[95vw] max-w-md mx-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center text-lg">
                <SemanticBDIIcon semantic="plus" size={20} className="mr-2 text-green-600" />
                Create SKU Variant
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Parent SKU Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Parent SKU:</p>
                <p className="font-mono font-bold text-sm">{variantParentSku.sku}</p>
                <p className="text-sm text-gray-700 break-all">{variantParentSku.name}</p>
              </div>
              
              {/* Variant Extension Input */}
              <div className="space-y-2">
                <Label htmlFor="variantExtension" className="text-sm font-medium">
                  3-Letter Variant Extension
                </Label>
                <Input
                  id="variantExtension"
                  value={variantExtension}
                  onChange={(e) => setVariantExtension(e.target.value.toUpperCase())}
                  placeholder="ABC"
                  maxLength={3}
                  className="font-mono text-center text-lg"
                />
                <p className="text-xs text-gray-500">
                  Will be added to name: <span className="font-medium">
                    {variantParentSku.name.replace(/\s*\([^)]*\)\s*$/, '')} 
                    {variantExtension && ` (${variantExtension.toUpperCase()})`}
                  </span>
                </p>
              </div>
              
              {/* Preview */}
               <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                 <p className="text-sm text-blue-800 font-medium mb-1">New Variant Preview:</p>
                 <p className="font-mono text-sm font-bold">
                   {variantParentSku.sku}{variantExtension && `-(${variantExtension.toUpperCase()})`}
                 </p>
                 <p className="text-sm break-all">
                   {variantParentSku.name.replace(/\s*\([^)]*\)\s*$/, '')}
                   {variantExtension && ` (${variantExtension.toUpperCase()})`}
                 </p>
                 <p className="text-xs text-blue-600 mt-2">
                   ✅ Inherits ALL attributes from parent SKU
                 </p>
               </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowVariantModal(false);
                    setVariantParentSku(null);
                    setVariantExtension('');
                  }}
                  disabled={isCreatingVariant}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateVariant}
                  disabled={isCreatingVariant || !variantExtension.trim()}
                  className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                >
                  {isCreatingVariant ? (
                    <>
                      <SemanticBDIIcon semantic="sync" size={16} className="mr-2 animate-spin" />
                      Creating Variant...
                    </>
                  ) : (
                    <>
                      <SemanticBDIIcon semantic="plus" size={16} className="mr-2" />
                      Create Variant
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
