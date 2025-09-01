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
  } | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function SKUsPage() {
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  const { data: skus, mutate: mutateSkus } = useSWR<ProductSku[]>('/api/admin/skus', fetcher);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSku, setSelectedSku] = useState<ProductSku | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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
  });

  // Access control - only BDI Super Admins and Admins can manage SKUs
  if (!user || !['super_admin', 'admin'].includes(user.role) || (user as any).organization?.code !== 'BDI') {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="settings" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">Only BDI Admins can manage product SKUs.</p>
          </div>
        </div>
      </div>
    );
  }

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
        });
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
      { code: '', name: 'None (Leave Empty)' },
    ],
  };

  // Generate SKU from builder selections - Format: MNQ1525-D30W-U (with variant) or MNQ1525-30W-U (no variant)
  const generateSku = () => {
    const { brand, productType, modelNumber, modelYear, variant, region, color, charger, carrier } = skuBuilder;
    
    // First part: Brand + ProductType + ModelNumber + ModelYear (e.g., MNQ1525)
    const firstPart = `${brand}${productType}${modelNumber}${modelYear}`;
    
    // Second part: Variant + Region + Color (e.g., D30W or 30W)
    const secondPart = variant ? `${variant}${region}${color}` : `${region}${color}`;
    
    // Third part: Charger (e.g., U)
    const thirdPart = charger;
    
    // Fourth part: Carrier (can be empty)
    const fourthPart = carrier;
    
    // Combine with proper formatting: MNQ1525-D30W-U or MNQ1525-30W-U
    if (!brand || !productType || !modelNumber || !modelYear || !region || !color || !charger) {
      return '';
    }
    
    let sku = `${firstPart}-${secondPart}-${thirdPart}`;
    if (fourthPart) {
      sku += `-${fourthPart}`;
    }
    
    return sku;
  };

  // Update generated SKU when builder changes
  const updateGeneratedSku = (field: string, value: string) => {
    const newBuilder = { ...skuBuilder, [field]: value };
    setSkuBuilder(newBuilder);
    setGeneratedSku(generateSku());
  };

  return (
    <div className="flex-1 p-4 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <SemanticBDIIcon semantic="inventory" size={32} />
            <div>
              <h1 className="text-3xl font-bold">Product SKUs</h1>
              <p className="text-muted-foreground">Manage your product catalog for CPFR planning</p>
            </div>
          </div>
          <Button className="bg-bdi-green-1 hover:bg-bdi-green-2" onClick={() => setShowCreateModal(true)}>
            <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
            Add SKU
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search SKUs, names, or descriptions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="category-filter">Category:</Label>
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 border rounded-md"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category || ''}>
                {category && category.length === 1 ? `${category} - Product Type` : category}
              </option>
            ))}
          </select>
          
          <div className="flex border rounded-md ml-4">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm transition-colors ${viewMode === 'list' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              📋 List
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 text-sm transition-colors ${viewMode === 'grid' ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              🔲 Grid
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
                <div className="space-y-4">
                  {filteredSkus.map((sku) => (
                <div key={sku.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-lg">{sku.name}</h3>
                        <Badge variant="outline" className="font-mono text-xs">
                          {sku.sku}
                        </Badge>
                        {sku.category && (
                          <Badge variant="secondary">{sku.category}</Badge>
                        )}
                        {!sku.isActive && (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                        {sku.isDiscontinued && (
                          <Badge variant="outline" className="text-orange-600 border-orange-600">
                            Discontinued
                          </Badge>
                        )}
                      </div>
                      {sku.description && (
                        <p className="text-muted-foreground mb-3">{sku.description}</p>
                      )}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        {sku.model && (
                          <div>
                            <span className="text-gray-500">Model:</span>
                            <p className="font-medium">{sku.model}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">MOQ:</span>
                          <p className="font-medium">{sku.moq || 1} units</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Lead Time:</span>
                          <p className="font-medium">{sku.leadTimeDays || 30} days</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedSku(sku)}
                      >
                        <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
                  {filteredSkus.map((sku) => {
                    const productType = sku.sku.length >= 3 ? sku.sku.charAt(2) : 'C';
                    return (
                      <div 
                        key={sku.id} 
                        className={`relative border-2 rounded-lg p-3 cursor-pointer hover:shadow-md transition-all ${getProductTypeColor(productType)}`}
                        onClick={() => setSelectedSku(sku)}
                      >
                        <div className="text-center">
                          <div className="text-xs font-mono font-bold mb-1 truncate">
                            {sku.sku}
                          </div>
                          <div className="text-xs font-medium leading-tight line-clamp-2 min-h-[2.5rem] flex items-center justify-center">
                            {sku.name}
                          </div>
                          {!sku.isActive && (
                            <div className="absolute top-1 left-1">
                              <Badge variant="destructive" className="text-xs px-1 py-0">
                                ✕
                              </Badge>
                            </div>
                          )}
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
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 text-sm">
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
                      <select
                        value={skuBuilder.carrier}
                        onChange={(e) => updateGeneratedSku('carrier', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">None</option>
                        {skuConfig.carriers.filter(c => c.code !== '').map(carrier => (
                          <option key={carrier.code} value={carrier.code}>
                            {carrier.code} - {carrier.name}
                          </option>
                        ))}
                      </select>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Length (cm)</Label>
                    <Input
                      name="boxLength"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width (cm)</Label>
                    <Input
                      name="boxWidth"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height (cm)</Label>
                    <Input
                      name="boxHeight"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input
                      name="boxWeight"
                      type="number"
                      step="0.1"
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
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width (cm)</Label>
                    <Input
                      name="cartonWidth"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height (cm)</Label>
                    <Input
                      name="cartonHeight"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input
                      name="cartonWeight"
                      type="number"
                      step="0.1"
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
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width (cm)</Label>
                    <Input
                      name="palletWidth"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height (cm)</Label>
                    <Input
                      name="palletHeight"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input
                      name="palletWeight"
                      type="number"
                      step="0.1"
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
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
                    <Input
                      name="mfg"
                      type="text"
                      placeholder="e.g., MOT, HYT, KEN"
                      className="text-sm"
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      Manufacturer code or name
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs">Length (cm)</Label>
                    <Input
                      name="editBoxLength"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width (cm)</Label>
                    <Input
                      name="editBoxWidth"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height (cm)</Label>
                    <Input
                      name="editBoxHeight"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input
                      name="editBoxWeight"
                      type="number"
                      step="0.1"
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
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width (cm)</Label>
                    <Input
                      name="editCartonWidth"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height (cm)</Label>
                    <Input
                      name="editCartonHeight"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input
                      name="editCartonWeight"
                      type="number"
                      step="0.1"
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
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width (cm)</Label>
                    <Input
                      name="editPalletWidth"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height (cm)</Label>
                    <Input
                      name="editPalletHeight"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight (kg)</Label>
                    <Input
                      name="editPalletWeight"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <textarea
                    name="editPalletNotes"
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
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
                    <Input
                      name="editMfg"
                      type="text"
                      defaultValue={selectedSku?.mfg || ''}
                      placeholder="e.g., MOT, HYT, KEN"
                      className="text-sm"
                    />
                    <div className="mt-1 text-xs text-gray-600">
                      Manufacturer code or name
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
    </div>
  );
}
