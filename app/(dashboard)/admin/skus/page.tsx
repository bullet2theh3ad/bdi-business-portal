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
  const [skuBuilder, setSkuBuilder] = useState({
    brand: '',
    productType: '',
    modelNumber: '',
    modelYear: '',
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
          category: formData.get('category'),
          subcategory: formData.get('subcategory'),
          model: formData.get('model'),
          version: formData.get('version'),
          dimensions: formData.get('dimensions'),
          weight: formData.get('weight') ? parseFloat(formData.get('weight') as string) : null,
          color: formData.get('color'),
          unitCost: formData.get('unitCost') ? parseFloat(formData.get('unitCost') as string) : null,
          msrp: formData.get('msrp') ? parseFloat(formData.get('msrp') as string) : null,
          moq: formData.get('moq') ? parseInt(formData.get('moq') as string) : 1,
          leadTimeDays: formData.get('leadTimeDays') ? parseInt(formData.get('leadTimeDays') as string) : 30,
          tags: formData.get('tags') ? (formData.get('tags') as string).split(',').map(t => t.trim()) : [],
        }),
      });

      if (response.ok) {
        mutateSkus();
        setShowCreateModal(false);
      } else {
        alert('Failed to create SKU');
      }
    } catch (error) {
      console.error('Error creating SKU:', error);
      alert('Failed to create SKU');
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
    
    const matchesCategory = categoryFilter === 'all' || sku.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  // Get unique categories for filter
  const categories = Array.from(new Set(skusArray.map(sku => sku.category).filter(Boolean)));

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
    // Variants removed - not needed in new format
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

  // Generate SKU from builder selections - Format: MNQ1525-30W-U
  const generateSku = () => {
    const { brand, productType, modelNumber, modelYear, region, color, charger, carrier } = skuBuilder;
    
    // First part: Brand + ProductType + ModelNumber + ModelYear (e.g., MNQ1525)
    const firstPart = `${brand}${productType}${modelNumber}${modelYear}`;
    
    // Second part: Region + Color (e.g., 30W)
    const secondPart = `${region}${color}`;
    
    // Third part: Charger (e.g., U)
    const thirdPart = charger;
    
    // Fourth part: Carrier (can be empty)
    const fourthPart = carrier;
    
    // Combine with proper formatting: MNQ1525-30W-U or MNQ1525-30W-U-T
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
              <option key={category} value={category || ''}>{category}</option>
            ))}
          </select>
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
                        {sku.msrp && (
                          <div>
                            <span className="text-gray-500">MSRP:</span>
                            <p className="font-medium">${sku.msrp}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-500">MOQ:</span>
                          <p className="font-medium">{sku.moq} units</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Lead Time:</span>
                          <p className="font-medium">{sku.leadTimeDays} days</p>
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
          )}
        </CardContent>
      </Card>

      {/* Create SKU Modal */}
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <SemanticBDIIcon semantic="plus" size={24} className="mr-2" />
                Add New SKU
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleCreateSku(new FormData(e.currentTarget));
            }} className="space-y-6">
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

              {/* Unit Selection */}
              <div className="flex items-center space-x-4 py-2">
                <Label className="text-sm font-medium">Measurement Units:</Label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="units"
                      value="metric"
                      defaultChecked
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">Metric (cm, kg)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="units"
                      value="imperial"
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">Imperial (in, lbs)</span>
                  </label>
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
                    <Label className="text-xs">Length</Label>
                    <Input
                      name="boxLength"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width</Label>
                    <Input
                      name="boxWidth"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height</Label>
                    <Input
                      name="boxHeight"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight</Label>
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
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <Label className="text-xs">Length</Label>
                    <Input
                      name="cartonLength"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width</Label>
                    <Input
                      name="cartonWidth"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height</Label>
                    <Input
                      name="cartonHeight"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight</Label>
                    <Input
                      name="cartonWeight"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Boxes per carton</Label>
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
                    <Label className="text-xs">Length</Label>
                    <Input
                      name="palletLength"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width</Label>
                    <Input
                      name="palletWidth"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height</Label>
                    <Input
                      name="palletHeight"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight</Label>
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
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <SemanticBDIIcon semantic="settings" size={20} className="mr-2" />
                Edit SKU: {selectedSku.sku}
              </DialogTitle>
            </DialogHeader>
            <form className="space-y-6">
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
                    defaultValue={selectedSku.name}
                    placeholder="Enter product name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="editDescription">Description</Label>
                <Input
                  id="editDescription"
                  defaultValue={selectedSku.description || ''}
                  placeholder="Brief product description"
                />
              </div>

              {/* Unit Selection */}
              <div className="flex items-center space-x-4 py-2">
                <Label className="text-sm font-medium">Measurement Units:</Label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="editUnits"
                      value="metric"
                      defaultChecked
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">Metric (cm, kg)</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="editUnits"
                      value="imperial"
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm">Imperial (in, lbs)</span>
                  </label>
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
                    <Label className="text-xs">Length</Label>
                    <Input
                      name="editBoxLength"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width</Label>
                    <Input
                      name="editBoxWidth"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height</Label>
                    <Input
                      name="editBoxHeight"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight</Label>
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
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <Label className="text-xs">Length</Label>
                    <Input
                      name="editCartonLength"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width</Label>
                    <Input
                      name="editCartonWidth"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height</Label>
                    <Input
                      name="editCartonHeight"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight</Label>
                    <Input
                      name="editCartonWeight"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Boxes per carton</Label>
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
                    <Label className="text-xs">Length</Label>
                    <Input
                      name="editPalletLength"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Width</Label>
                    <Input
                      name="editPalletWidth"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Height</Label>
                    <Input
                      name="editPalletHeight"
                      type="number"
                      step="0.1"
                      placeholder="0.0"
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Weight</Label>
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
