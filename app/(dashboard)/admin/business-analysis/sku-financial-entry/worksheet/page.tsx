'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus, Trash2, Save, ArrowLeft } from 'lucide-react';

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

// Channel Constants
const CHANNELS = {
  'D2C (Direct to Consumer)': [
    { value: 'amazon_fba', label: 'Amazon (FBA)' },
    { value: 'shopify', label: 'Shopify' },
    { value: 'custom_d2c', label: '➕ Add Custom D2C Channel' }
  ],
  'B2B (Business to Business)': [
    { value: 'best_buy_direct', label: 'Best Buy (Direct)' },
    { value: 'costco_direct', label: 'Costco (Direct)' },
    { value: 'walmart_direct', label: 'Walmart (Direct)' },
    { value: 'tekpoint', label: 'Tekpoint (Distributor)' },
    { value: 'emg', label: 'EMG (Distributor)' },
    { value: 'custom_b2b', label: '➕ Add Custom B2B Channel' }
  ]
};

// ISO Country Codes (Common Trading Partners + Major Markets)
const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'MX', name: 'Mexico' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' },
  { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'BE', name: 'Belgium' },
  { code: 'SE', name: 'Sweden' },
  { code: 'DK', name: 'Denmark' },
  { code: 'NO', name: 'Norway' },
  { code: 'FI', name: 'Finland' },
  { code: 'PL', name: 'Poland' },
  { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GR', name: 'Greece' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'HU', name: 'Hungary' },
  { code: 'RO', name: 'Romania' },
  { code: 'JP', name: 'Japan' },
  { code: 'CN', name: 'China' },
  { code: 'KR', name: 'South Korea' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'IN', name: 'India' },
  { code: 'AU', name: 'Australia' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'BR', name: 'Brazil' },
  { code: 'AR', name: 'Argentina' },
  { code: 'CL', name: 'Chile' },
  { code: 'CO', name: 'Colombia' },
  { code: 'PE', name: 'Peru' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'IL', name: 'Israel' },
  { code: 'TR', name: 'Turkey' },
  { code: 'RU', name: 'Russia' },
  { code: 'UA', name: 'Ukraine' },
];

export default function SKUWorksheetPage() {
  const router = useRouter();
  const [worksheetData, setWorksheetData] = useState<SKUWorksheetData>({
    skuName: '',
    channel: '',
    country: 'US', // Default to United States
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

  const handleBack = () => {
    router.push('/admin/business-analysis/sku-financial-entry');
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Button
              onClick={handleBack}
              variant="ghost"
              size="sm"
              className="p-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">SKU Financial Entry Worksheet</h1>
          </div>
          <p className="text-gray-600 text-sm sm:text-base ml-12">Complete cost analysis and profitability model</p>
        </div>
        <Button
          onClick={handleSave}
          className="bg-green-600 hover:bg-green-700"
        >
          <Save className="w-4 h-4 mr-2" />
          Save Scenario
        </Button>
      </div>

      <div className="space-y-6">
        {/* Section 1: SKU Selection & Pricing */}
        <Card className="border-2 border-blue-200">
          <CardHeader className="bg-blue-50">
            <CardTitle className="text-lg sm:text-xl">1. SKU Selection & Pricing</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
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
                      if (value === 'custom_d2c' || value === 'custom_b2c') {
                        setIsCustomChannel(true);
                        setCustomChannelName('');
                        setWorksheetData(prev => ({ ...prev, channel: '' }));
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
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter custom channel name..."
                        value={customChannelName}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCustomChannelName(value);
                          setWorksheetData(prev => ({ ...prev, channel: value }));
                        }}
                        onFocus={(e) => e.target.select()}
                        autoFocus
                        className="flex-1"
                      />
                      <Button
                        onClick={() => {
                          setIsCustomChannel(false);
                          if (!customChannelName.trim()) {
                            setWorksheetData(prev => ({ ...prev, channel: '' }));
                          }
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Done
                      </Button>
                    </div>
                    {customChannelName && (
                      <p className="text-sm text-green-600">✓ Custom channel: {customChannelName}</p>
                    )}
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
                    <SelectValue placeholder="Select country..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name} ({country.code})
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
          </CardContent>
        </Card>

        {/* Section 2: All Deductions (Calculated) */}
        <Card className="border-2 border-red-200">
          <CardHeader className="bg-red-50">
            <CardTitle className="text-lg sm:text-xl">2. All Deductions (Calculated)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          </CardContent>
        </Card>

        {/* Section 3: Net Receipts (Calculated) */}
        <Card className="border-2 border-green-200">
          <CardHeader className="bg-green-50">
            <CardTitle className="text-lg sm:text-xl">3. Net Receipts (Calculated)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-center">
              <Label className="text-sm font-medium text-gray-600">Net Receipts</Label>
              <p className="text-3xl sm:text-4xl font-bold text-green-600">${calculateNetReceipts().toFixed(2)}</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-2">
                ASP (${worksheetData.asp.toFixed(2)}) - Total Deductions (${calculateAllDeductions().toFixed(2)})
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Product Costs */}
        <Card className="border-2 border-purple-200">
          <CardHeader className="bg-purple-50">
            <CardTitle className="text-lg sm:text-xl">4. Product Costs</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                    className="flex-1"
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
                    className="w-32"
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
              <div className="mt-4 p-3 bg-purple-50 rounded border border-purple-200">
                <Label className="text-sm font-medium text-gray-600">Total Product Costs</Label>
                <p className="text-2xl font-bold text-purple-700">${calculateTotalProductCosts().toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Royalty (Calculated) */}
        <Card className="border-2 border-blue-200">
          <CardHeader className="bg-blue-50">
            <CardTitle className="text-lg sm:text-xl">5. Royalty (Calculated)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-center">
              <Label className="text-sm font-medium text-gray-600">Royalty (5% of Net Receipts)</Label>
              <p className="text-3xl sm:text-4xl font-bold text-blue-600">${calculateRoyalty().toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Section 6: All CoGS Breakdown */}
        <Card className="border-2 border-orange-200">
          <CardHeader className="bg-orange-50">
            <CardTitle className="text-lg sm:text-xl">6. All CoGS Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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
                    className="flex-1"
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
                    className="w-32"
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
              <div className="mt-4 p-3 bg-orange-50 rounded border border-orange-200">
                <Label className="text-sm font-medium text-gray-600">Total CoGS</Label>
                <p className="text-2xl font-bold text-orange-700">${calculateTotalCoGS().toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 7: Gross Profit & Gross Margin (Calculated) */}
        <Card className="border-2 border-green-200">
          <CardHeader className="bg-green-50">
            <CardTitle className="text-lg sm:text-xl">7. Gross Profit & Gross Margin (Calculated)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-4">
              <div className="text-center p-4 bg-white rounded border border-green-300">
                <Label className="text-sm font-medium text-gray-600">Gross Profit</Label>
                <p className="text-3xl sm:text-4xl font-bold text-green-600">${calculateGrossProfit().toFixed(2)}</p>
              </div>
              <div className="text-center p-4 bg-white rounded border border-green-300">
                <Label className="text-sm font-medium text-gray-600">Gross Margin</Label>
                <p className="text-3xl sm:text-4xl font-bold text-green-600">{calculateGrossMargin().toFixed(2)}%</p>
              </div>
            </div>
            <div className="p-4 bg-white rounded border border-gray-200">
              <h4 className="font-semibold mb-2 text-sm sm:text-base">Calculation Breakdown:</h4>
              <div className="text-sm space-y-1">
                <p>• Net Receipts: <strong>${calculateNetReceipts().toFixed(2)}</strong></p>
                <p>• Less Royalty (5%): <strong>-${calculateRoyalty().toFixed(2)}</strong></p>
                <p>• Less Total CoGS: <strong>-${calculateTotalCoGS().toFixed(2)}</strong></p>
                <hr className="my-2" />
                <p>• Gross Profit: <strong className="text-green-600">${calculateGrossProfit().toFixed(2)}</strong></p>
                <p>• Gross Margin: <strong className="text-green-600">{calculateGrossMargin().toFixed(2)}%</strong></p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sticky Bottom Actions (Mobile Optimized) */}
        <div className="sticky bottom-0 bg-white border-t-2 border-gray-200 p-4 flex justify-between gap-4 z-10">
          <Button
            onClick={handleBack}
            variant="outline"
            className="flex-1 sm:flex-initial"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="bg-green-600 hover:bg-green-700 flex-1 sm:flex-initial"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Scenario
          </Button>
        </div>
      </div>
    </div>
  );
}

