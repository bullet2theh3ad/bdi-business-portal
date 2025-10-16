'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { X, Plus, Trash2, Calculator, Save, FolderOpen } from 'lucide-react';
// import { toast } from 'sonner'; // TODO: Add toast library

// SKU Worksheet Data Structure
interface SKUWorksheetData {
  skuName: string;
  channel: string;
  country: string;
  asp: number;
  resellerMargin: number;
  marketingReserve: number;
  fulfillmentCosts: number;
  productCostFOB: number;
  swLicenseFee: number;
  otherProductCosts: { label: string; value: number }[];
  returnsFreight: number;
  returnsHandling: number;
  doaChannelCredit: number;
  financingCost: number;
  ppsHandlingFee: number;
  inboundShippingCost: number;
  outboundShippingCost: number;
  greenfileMarketing: number;
  otherCoGS: { label: string; value: number }[];
}

// Channel and Country Constants
const CHANNELS = {
  'D2C (Direct to Consumer)': [
    { value: 'amazon_fba', label: 'Amazon (FBA)' },
    { value: 'shopify', label: 'Shopify' },
    { value: 'custom_d2c', label: 'Custom D2C Channel' }
  ],
  'B2B (Business to Business)': [
    { value: 'best_buy_direct', label: 'Best Buy (Direct)' },
    { value: 'costco_direct', label: 'Costco (Direct)' },
    { value: 'walmart_direct', label: 'Walmart (Direct)' },
    { value: 'tekpoint', label: 'Tekpoint (Distributor)' },
    { value: 'emg', label: 'EMG (Distributor)' },
    { value: 'custom_b2b', label: 'Custom B2B Channel' }
  ]
};

const COUNTRIES = [
  'United States',
  'Canada',
  'Mexico',
  'United Kingdom',
  'Germany',
  'France',
  'Other'
];

export default function SKUFinancialEntryPage() {
  const [showSKUWorksheet, setShowSKUWorksheet] = useState(false);
  const [worksheetData, setWorksheetData] = useState<SKUWorksheetData>({
    skuName: '',
    channel: '',
    country: 'United States',
    asp: 0,
    resellerMargin: 0,
    marketingReserve: 0,
    fulfillmentCosts: 0,
    productCostFOB: 0,
    swLicenseFee: 0,
    otherProductCosts: [],
    returnsFreight: 13.00,
    returnsHandling: 0.45,
    doaChannelCredit: 0,
    financingCost: 0,
    ppsHandlingFee: 0,
    inboundShippingCost: 0,
    outboundShippingCost: 0,
    greenfileMarketing: 0,
    otherCoGS: [],
  });

  const [availableSKUs, setAvailableSKUs] = useState<{ id: string; skuCode: string; name: string }[]>([]);
  const [isCustomSKU, setIsCustomSKU] = useState(false);
  const [isCustomChannel, setIsCustomChannel] = useState(false);
  const [customChannelName, setCustomChannelName] = useState('');

  // Load available SKUs
  useEffect(() => {
    async function loadSKUs() {
      try {
        const response = await fetch('/api/admin/skus');
        if (response.ok) {
          const data = await response.json();
          setAvailableSKUs(data.skus || []);
        }
      } catch (error) {
        console.error('Error loading SKUs:', error);
      }
    }
    loadSKUs();
  }, []);

  // Calculation functions
  const calculateAllDeductions = () => {
    const { asp, resellerMargin, marketingReserve, fulfillmentCosts } = worksheetData;
    const resellerDeduction = (asp * resellerMargin) / 100;
    const marketingDeduction = (asp * marketingReserve) / 100;
    return resellerDeduction + marketingDeduction + fulfillmentCosts;
  };

  const calculateNetReceipts = () => {
    return worksheetData.asp - calculateAllDeductions();
  };

  const calculateTotalProductCosts = () => {
    const { productCostFOB, swLicenseFee, otherProductCosts } = worksheetData;
    const otherCostsTotal = otherProductCosts.reduce((sum, item) => sum + item.value, 0);
    return productCostFOB + swLicenseFee + otherCostsTotal;
  };

  const calculateRoyalty = () => {
    return calculateNetReceipts() * 0.05; // 5% of Net Receipts
  };

  const calculateTotalCoGS = () => {
    const { returnsFreight, returnsHandling, doaChannelCredit, financingCost, ppsHandlingFee, inboundShippingCost, outboundShippingCost, greenfileMarketing, otherCoGS } = worksheetData;
    const otherCoGSTotal = otherCoGS.reduce((sum, item) => sum + item.value, 0);
    return returnsFreight + returnsHandling + doaChannelCredit + financingCost + ppsHandlingFee + inboundShippingCost + outboundShippingCost + greenfileMarketing + otherCoGSTotal;
  };

  const calculateGrossProfit = () => {
    return calculateNetReceipts() - calculateRoyalty() - calculateTotalCoGS();
  };

  const calculateGrossMargin = () => {
    const netReceipts = calculateNetReceipts();
    return netReceipts > 0 ? (calculateGrossProfit() / netReceipts) * 100 : 0;
  };

  const handleSave = () => {
    // TODO: Implement save functionality
    alert('SKU Financial Entry saved successfully!');
  };

  const handleLoad = () => {
    // TODO: Implement load functionality
    alert('Load functionality coming soon!');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">SKU Financial Entry</h1>
        <p className="text-gray-600">Create and manage SKU financial scenarios with detailed cost analysis</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 mb-8">
        <Button 
          onClick={() => setShowSKUWorksheet(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Calculator className="w-4 h-4 mr-2" />
          New SKU Worksheet
        </Button>
        
        <Button 
          onClick={handleLoad}
          variant="outline"
          className="border-gray-300"
        >
          <FolderOpen className="w-4 h-4 mr-2" />
          Load Saved Scenario
        </Button>
      </div>

      {/* Placeholder Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">Common SKU financial scenarios</p>
            <Button 
              onClick={() => setShowSKUWorksheet(true)}
              className="w-full"
              variant="outline"
            >
              Create New Analysis
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Scenarios</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500 text-sm">No saved scenarios yet</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">Pre-configured templates</p>
            <Button 
              variant="outline" 
              className="w-full"
              disabled
            >
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* SKU Worksheet Modal */}
      <Dialog open={showSKUWorksheet} onOpenChange={setShowSKUWorksheet}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>SKU Financial Entry Worksheet</span>
              <Button
                onClick={() => setShowSKUWorksheet(false)}
                variant="ghost"
                size="sm"
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-8">
            {/* Section 1: SKU Selection & Pricing */}
            <div className="border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">1. SKU Selection & Pricing</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* SKU Selection */}
                <div className="space-y-2">
                  <Label htmlFor="sku-select">SKU Number *</Label>
                  {!isCustomSKU ? (
                    <Select
                      value={worksheetData.skuName}
                      onValueChange={(value) => {
                        if (value === 'custom') {
                          setIsCustomSKU(true);
                          setWorksheetData(prev => ({ ...prev, skuName: '' }));
                        } else {
                          setWorksheetData(prev => ({ ...prev, skuName: value }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a SKU..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custom">── Custom Entry ──</SelectItem>
                        {availableSKUs.map((sku) => (
                          <SelectItem key={sku.id} value={sku.skuCode}>
                            {sku.skuCode} - {sku.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        placeholder="Enter custom SKU name..."
                        value={worksheetData.skuName}
                        onChange={(e) => setWorksheetData(prev => ({ ...prev, skuName: e.target.value }))}
                        onFocus={(e) => e.target.select()}
                        autoFocus
                      />
                      <Button
                        onClick={() => setIsCustomSKU(false)}
                        variant="outline"
                        size="sm"
                      >
                        Back to List
                      </Button>
                    </div>
                  )}
                </div>

                {/* Sales Channel */}
                <div className="space-y-2">
                  <Label htmlFor="channel-select">Sales Channel *</Label>
                  {!isCustomChannel ? (
                    <Select
                      value={worksheetData.channel}
                      onValueChange={(value) => {
                        if (value === 'custom_d2c' || value === 'custom_b2b') {
                          setIsCustomChannel(true);
                          setWorksheetData(prev => ({ ...prev, channel: value }));
                        } else {
                          setWorksheetData(prev => ({ ...prev, channel: value }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select channel..." />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CHANNELS).map(([category, channels]) => (
                          <div key={category}>
                            <div className="px-2 py-1.5 text-sm font-semibold text-gray-500 bg-gray-50">
                              {category}
                            </div>
                            {channels.map((channel) => (
                              <SelectItem key={channel.value} value={channel.value}>
                                {channel.label}
                              </SelectItem>
                            ))}
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="space-y-2">
                      <Input
                        placeholder="Enter custom channel name..."
                        value={customChannelName}
                        onChange={(e) => setCustomChannelName(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onBlur={() => {
                          if (customChannelName.trim()) {
                            setWorksheetData(prev => ({ ...prev, channel: customChannelName.trim() }));
                          }
                        }}
                        autoFocus
                      />
                      <Button
                        onClick={() => {
                          setIsCustomChannel(false);
                          setCustomChannelName('');
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Back to List
                      </Button>
                    </div>
                  )}
                </div>

                {/* Country */}
                <div className="space-y-2">
                  <Label htmlFor="country-select">Country *</Label>
                  <Select
                    value={worksheetData.country}
                    onValueChange={(value) => setWorksheetData(prev => ({ ...prev, country: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* ASP */}
                <div className="space-y-2">
                  <Label htmlFor="asp">ASP (Average Selling Price) *</Label>
                  <Input
                    id="asp"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={worksheetData.asp || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, asp: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>

                {/* Reseller Margin */}
                <div className="space-y-2">
                  <Label htmlFor="reseller-margin">Reseller Margin (%) *</Label>
                  <Input
                    id="reseller-margin"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={worksheetData.resellerMargin || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, resellerMargin: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>

                {/* Marketing Reserve */}
                <div className="space-y-2">
                  <Label htmlFor="marketing-reserve">Marketing Reserve (%) *</Label>
                  <Input
                    id="marketing-reserve"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={worksheetData.marketingReserve || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, marketingReserve: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>

                {/* Fulfillment Costs */}
                <div className="space-y-2">
                  <Label htmlFor="fulfillment-costs">Fulfillment Costs *</Label>
                  <Input
                    id="fulfillment-costs"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={worksheetData.fulfillmentCosts || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, fulfillmentCosts: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: All Deductions (Calculated) */}
            <div className="border rounded-lg p-6 bg-gray-50">
              <h3 className="text-lg font-semibold mb-4">2. All Deductions (Calculated)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-600">Reseller Deduction</Label>
                  <p className="text-lg font-semibold">${((worksheetData.asp * worksheetData.resellerMargin) / 100).toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Marketing Deduction</Label>
                  <p className="text-lg font-semibold">${((worksheetData.asp * worksheetData.marketingReserve) / 100).toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Fulfillment Costs</Label>
                  <p className="text-lg font-semibold">${worksheetData.fulfillmentCosts.toFixed(2)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-600">Total Deductions</Label>
                  <p className="text-xl font-bold text-red-600">${calculateAllDeductions().toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Section 3: Net Receipts (Calculated) */}
            <div className="border rounded-lg p-6 bg-green-50">
              <h3 className="text-lg font-semibold mb-4">3. Net Receipts (Calculated)</h3>
              <div className="text-center">
                <Label className="text-sm font-medium text-gray-600">Net Receipts</Label>
                <p className="text-3xl font-bold text-green-600">${calculateNetReceipts().toFixed(2)}</p>
                <p className="text-sm text-gray-500 mt-2">
                  ASP (${worksheetData.asp.toFixed(2)}) - Total Deductions (${calculateAllDeductions().toFixed(2)})
                </p>
              </div>
            </div>

            {/* Section 4: Product Costs */}
            <div className="border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">4. Product Costs</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="product-cost-fob">Product Cost (FOB) *</Label>
                  <Input
                    id="product-cost-fob"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={worksheetData.productCostFOB || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, productCostFOB: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sw-license-fee">SW License Fee *</Label>
                  <Input
                    id="sw-license-fee"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={worksheetData.swLicenseFee || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, swLicenseFee: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>

              {/* Other Product Costs */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Other Product Costs</Label>
                  <Button
                    onClick={() => setWorksheetData(prev => ({
                      ...prev,
                      otherProductCosts: [...prev.otherProductCosts, { label: '', value: 0 }]
                    }))}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Line Item
                  </Button>
                </div>
                {worksheetData.otherProductCosts.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input
                      placeholder="Description"
                      value={item.label}
                      onChange={(e) => {
                        const newCosts = [...worksheetData.otherProductCosts];
                        newCosts[index].label = e.target.value;
                        setWorksheetData(prev => ({ ...prev, otherProductCosts: newCosts }));
                      }}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={item.value || ''}
                      onChange={(e) => {
                        const newCosts = [...worksheetData.otherProductCosts];
                        newCosts[index].value = parseFloat(e.target.value) || 0;
                        setWorksheetData(prev => ({ ...prev, otherProductCosts: newCosts }));
                      }}
                      onFocus={(e) => e.target.select()}
                    />
                    <Button
                      onClick={() => setWorksheetData(prev => ({
                        ...prev,
                        otherProductCosts: prev.otherProductCosts.filter((_, i) => i !== index)
                      }))}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <div className="mt-2">
                  <Label className="text-sm font-medium text-gray-600">Total Product Costs</Label>
                  <p className="text-lg font-semibold">${calculateTotalProductCosts().toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Section 5: Royalty (Calculated) */}
            <div className="border rounded-lg p-6 bg-blue-50">
              <h3 className="text-lg font-semibold mb-4">5. Royalty (Calculated)</h3>
              <div className="text-center">
                <Label className="text-sm font-medium text-gray-600">Royalty (5% of Net Receipts)</Label>
                <p className="text-3xl font-bold text-blue-600">${calculateRoyalty().toFixed(2)}</p>
              </div>
            </div>

            {/* Section 6: All CoGS Breakdown */}
            <div className="border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">6. All CoGS Breakdown</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="returns-freight">Returns Freight *</Label>
                  <Input
                    id="returns-freight"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={worksheetData.returnsFreight || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, returnsFreight: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="returns-handling">Returns Handling *</Label>
                  <Input
                    id="returns-handling"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={worksheetData.returnsHandling || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, returnsHandling: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doa-channel-credit">DOA Channel Credit *</Label>
                  <Input
                    id="doa-channel-credit"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={worksheetData.doaChannelCredit || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, doaChannelCredit: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="financing-cost">Financing Cost *</Label>
                  <Input
                    id="financing-cost"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={worksheetData.financingCost || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, financingCost: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pps-handling-fee">PPS Handling Fee *</Label>
                  <Input
                    id="pps-handling-fee"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={worksheetData.ppsHandlingFee || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, ppsHandlingFee: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inbound-shipping">Inbound Shipping Cost *</Label>
                  <Input
                    id="inbound-shipping"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={worksheetData.inboundShippingCost || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, inboundShippingCost: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="outbound-shipping">Outbound Shipping Cost *</Label>
                  <Input
                    id="outbound-shipping"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={worksheetData.outboundShippingCost || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, outboundShippingCost: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="greenfile-marketing">Greenfile Marketing *</Label>
                  <Input
                    id="greenfile-marketing"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={worksheetData.greenfileMarketing || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, greenfileMarketing: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>

              {/* Other CoGS Items */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-medium">Other CoGS Items</Label>
                  <Button
                    onClick={() => setWorksheetData(prev => ({
                      ...prev,
                      otherCoGS: [...prev.otherCoGS, { label: '', value: 0 }]
                    }))}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Line Item
                  </Button>
                </div>
                {worksheetData.otherCoGS.map((item, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <Input
                      placeholder="Description"
                      value={item.label}
                      onChange={(e) => {
                        const newCoGS = [...worksheetData.otherCoGS];
                        newCoGS[index].label = e.target.value;
                        setWorksheetData(prev => ({ ...prev, otherCoGS: newCoGS }));
                      }}
                    />
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={item.value || ''}
                      onChange={(e) => {
                        const newCoGS = [...worksheetData.otherCoGS];
                        newCoGS[index].value = parseFloat(e.target.value) || 0;
                        setWorksheetData(prev => ({ ...prev, otherCoGS: newCoGS }));
                      }}
                      onFocus={(e) => e.target.select()}
                    />
                    <Button
                      onClick={() => setWorksheetData(prev => ({
                        ...prev,
                        otherCoGS: prev.otherCoGS.filter((_, i) => i !== index)
                      }))}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <div className="mt-2">
                  <Label className="text-sm font-medium text-gray-600">Total CoGS</Label>
                  <p className="text-lg font-semibold">${calculateTotalCoGS().toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Section 7: Gross Profit & Gross Margin (Calculated) */}
            <div className="border rounded-lg p-6 bg-green-50">
              <h3 className="text-lg font-semibold mb-4">7. Gross Profit & Gross Margin (Calculated)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-center">
                  <Label className="text-sm font-medium text-gray-600">Gross Profit</Label>
                  <p className="text-3xl font-bold text-green-600">${calculateGrossProfit().toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <Label className="text-sm font-medium text-gray-600">Gross Margin</Label>
                  <p className="text-3xl font-bold text-green-600">{calculateGrossMargin().toFixed(2)}%</p>
                </div>
              </div>
              <div className="mt-4 p-4 bg-white rounded border">
                <h4 className="font-semibold mb-2">Calculation Breakdown:</h4>
                <div className="text-sm space-y-1">
                  <p>• Net Receipts: <strong>${calculateNetReceipts().toFixed(2)}</strong></p>
                  <p>• Less Royalty (5%): <strong>-${calculateRoyalty().toFixed(2)}</strong></p>
                  <p>• Less Total CoGS: <strong>-${calculateTotalCoGS().toFixed(2)}</strong></p>
                  <p>• Gross Profit: <strong>${calculateGrossProfit().toFixed(2)}</strong></p>
                  <p>• Gross Margin: <strong>{calculateGrossMargin().toFixed(2)}%</strong></p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4 pt-6 border-t">
              <Button
                onClick={() => setShowSKUWorksheet(false)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="bg-green-600 hover:bg-green-700"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Scenario
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
