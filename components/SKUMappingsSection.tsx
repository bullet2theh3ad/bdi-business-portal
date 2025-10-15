'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Save, X } from 'lucide-react';

interface SKUMapping {
  id?: string;
  externalIdentifier: string;
  channel: string;
  notes?: string;
}

interface SKUMappingsSectionProps {
  skuId?: string; // If editing existing SKU
  onMappingsChange?: (mappings: SKUMapping[]) => void; // For create mode
  mode: 'create' | 'edit';
}

const CHANNEL_OPTIONS = [
  { value: 'amazon_asin', label: 'Amazon ASIN' },
  { value: 'amazon_seller_sku', label: 'Amazon Seller SKU' },
  { value: 'walmart_sku', label: 'Walmart SKU' },
  { value: 'ebay_sku', label: 'eBay SKU' },
  { value: 'upc', label: 'UPC' },
  { value: 'ean', label: 'EAN' },
  { value: 'gtin', label: 'GTIN' },
  { value: 'manufacturer_sku', label: 'Manufacturer SKU' },
  { value: 'distributor_sku', label: 'Distributor SKU' },
  { value: 'other', label: 'Other' },
];

export function SKUMappingsSection({ skuId, onMappingsChange, mode }: SKUMappingsSectionProps) {
  const [mappings, setMappings] = useState<SKUMapping[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // For create mode, start with one empty mapping
  // For edit mode, fetch existing mappings
  useEffect(() => {
    if (mode === 'create') {
      setMappings([{ externalIdentifier: '', channel: 'amazon_asin', notes: '' }]);
    } else if (mode === 'edit' && skuId) {
      fetchMappings();
    }
  }, [mode, skuId]);

  async function fetchMappings() {
    if (!skuId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/skus/${skuId}/mappings`);
      if (response.ok) {
        const data = await response.json();
        setMappings(data.length > 0 ? data : [{ externalIdentifier: '', channel: 'amazon_asin', notes: '' }]);
      }
    } catch (error) {
      console.error('Failed to fetch mappings:', error);
    } finally {
      setLoading(false);
    }
  }

  function addMapping() {
    const newMappings = [...mappings, { externalIdentifier: '', channel: 'amazon_asin', notes: '' }];
    setMappings(newMappings);
    if (mode === 'create' && onMappingsChange) {
      onMappingsChange(newMappings);
    }
  }

  function updateMapping(index: number, field: keyof SKUMapping, value: string) {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setMappings(newMappings);
    if (mode === 'create' && onMappingsChange) {
      onMappingsChange(newMappings);
    }
  }

  function removeMapping(index: number) {
    const mapping = mappings[index];
    
    // If editing and mapping has an ID, delete from database
    if (mode === 'edit' && mapping.id && skuId) {
      deleteMapping(mapping.id, index);
    } else {
      // Just remove from local state
      const newMappings = mappings.filter((_, i) => i !== index);
      setMappings(newMappings.length > 0 ? newMappings : [{ externalIdentifier: '', channel: 'amazon_asin', notes: '' }]);
      if (mode === 'create' && onMappingsChange) {
        onMappingsChange(newMappings);
      }
    }
  }

  async function deleteMapping(mappingId: string, index: number) {
    if (!confirm('Delete this mapping?')) return;
    
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/skus/${skuId}/mappings?mappingId=${mappingId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        const newMappings = mappings.filter((_, i) => i !== index);
        setMappings(newMappings.length > 0 ? newMappings : [{ externalIdentifier: '', channel: 'amazon_asin', notes: '' }]);
      } else {
        alert('Failed to delete mapping');
      }
    } catch (error) {
      console.error('Error deleting mapping:', error);
      alert('Failed to delete mapping');
    } finally {
      setSaving(false);
    }
  }

  async function saveMappings() {
    if (!skuId || mode !== 'edit') return;
    
    // Filter out empty mappings and mappings that already have IDs
    const newMappings = mappings.filter(m => 
      m.externalIdentifier.trim() !== '' && !m.id
    );
    
    if (newMappings.length === 0) {
      alert('No new mappings to save');
      return;
    }
    
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/skus/${skuId}/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: newMappings }),
      });
      
      if (response.ok) {
        alert('Mappings saved successfully!');
        fetchMappings(); // Reload to get IDs
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save mappings');
      }
    } catch (error) {
      console.error('Error saving mappings:', error);
      alert('Failed to save mappings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-2 border-purple-200 bg-purple-50/30">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-lg">
          <span className="flex items-center gap-2">
            🔗 SKU Mappings
            <Badge variant="secondary" className="text-xs">
              Channel Integration
            </Badge>
          </span>
          {mode === 'edit' && mappings.some(m => !m.id && m.externalIdentifier.trim() !== '') && (
            <Button
              type="button"
              size="sm"
              onClick={saveMappings}
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Save className="h-4 w-4 mr-1" />
              Save Mappings
            </Button>
          )}
        </CardTitle>
        <p className="text-sm text-gray-600 mt-1">
          Map this SKU to external identifiers (Amazon ASINs, UPCs, channel-specific SKUs, etc.)
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-center py-4 text-gray-500">Loading mappings...</div>
        ) : (
          <>
            {mappings.map((mapping, index) => (
              <div key={index} className="border border-gray-300 rounded-lg p-4 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                  {/* Channel */}
                  <div className="md:col-span-3">
                    <Label htmlFor={`channel-${index}`} className="text-xs font-semibold">
                      Channel *
                    </Label>
                    <select
                      id={`channel-${index}`}
                      value={mapping.channel}
                      onChange={(e) => updateMapping(index, 'channel', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={!!mapping.id} // Can't change channel after saving
                    >
                      {CHANNEL_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* External Identifier */}
                  <div className="md:col-span-4">
                    <Label htmlFor={`identifier-${index}`} className="text-xs font-semibold">
                      External Identifier *
                    </Label>
                    <Input
                      id={`identifier-${index}`}
                      type="text"
                      value={mapping.externalIdentifier}
                      onChange={(e) => updateMapping(index, 'externalIdentifier', e.target.value)}
                      placeholder="e.g., B08XYZ123, 012345678901"
                      className="text-sm font-mono"
                      disabled={!!mapping.id} // Can't change identifier after saving
                    />
                  </div>

                  {/* Notes */}
                  <div className="md:col-span-4">
                    <Label htmlFor={`notes-${index}`} className="text-xs font-semibold">
                      Notes (Optional)
                    </Label>
                    <Input
                      id={`notes-${index}`}
                      type="text"
                      value={mapping.notes || ''}
                      onChange={(e) => updateMapping(index, 'notes', e.target.value)}
                      placeholder="e.g., US marketplace, single pack"
                      className="text-sm"
                    />
                  </div>

                  {/* Remove Button */}
                  <div className="md:col-span-1 flex items-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMapping(index)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 w-full"
                      disabled={saving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Saved indicator */}
                {mapping.id && (
                  <div className="mt-2">
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                      ✓ Saved
                    </Badge>
                  </div>
                )}
              </div>
            ))}

            {/* Add Another Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMapping}
              className="w-full border-dashed border-2 border-purple-300 hover:bg-purple-50 text-purple-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Mapping
            </Button>

            {mode === 'create' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                <strong>Note:</strong> Mappings will be saved after the SKU is created. Leave blank if you don't have mappings yet.
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

