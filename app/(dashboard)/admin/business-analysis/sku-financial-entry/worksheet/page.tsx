'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { X, Plus, Trash2, Save, ArrowLeft } from 'lucide-react';

// SKU Worksheet Data Structure
interface SKUWorksheetData {
  skuName: string;
  channel: string;
  country: string;
  
  // Top Section
  asp: number;
  fbaFeePercent: number;
  fbaFeeAmount: number;
  amazonReferralFeePercent: number;
  amazonReferralFeeAmount: number;
  acosPercent: number;
  acosAmount: number;
  otherFeesAndAdvertising: { label: string; value: number }[]; // Dynamic line items for fees
  
  // Less Frontend Section
  motorolaRoyaltiesPercent: number;
  motorolaRoyaltiesAmount: number;
  rtvFreightAssumptions: number;
  rtvRepairCosts: number;
  doaCreditsPercent: number;
  doaCreditsAmount: number;
  invoiceFactoringNet: number;
  salesCommissionsPercent: number;
  salesCommissionsAmount: number;
  otherFrontendCosts: { label: string; value: number }[];
  
  // Landed DDP Calculations Section
  importDutiesPercent: number;
  importDutiesAmount: number;
  exWorksStandard: number;
  importShippingSea: number;
  gryphonSoftware: number;
  otherLandedCosts: { label: string; value: number }[];
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

function SKUWorksheetPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scenarioId = searchParams.get('id'); // For editing existing scenarios
  
  const [worksheetData, setWorksheetData] = useState<SKUWorksheetData>({
    skuName: '',
    channel: '',
    country: 'US', // Default to United States
    
    // Top Section
    asp: 0,
    fbaFeePercent: 8,
    fbaFeeAmount: 0,
    amazonReferralFeePercent: 8,
    amazonReferralFeeAmount: 0,
    acosPercent: 8,
    acosAmount: 0,
    otherFeesAndAdvertising: [],
    
    // Less Frontend Section
    motorolaRoyaltiesPercent: 5,
    motorolaRoyaltiesAmount: 0,
    rtvFreightAssumptions: 0.80,
    rtvRepairCosts: 2.93,
    doaCreditsPercent: 0,
    doaCreditsAmount: 0,
    invoiceFactoringNet: 0,
    salesCommissionsPercent: 0,
    salesCommissionsAmount: 0,
    otherFrontendCosts: [],
    
    // Landed DDP Calculations Section
    importDutiesPercent: 0,
    importDutiesAmount: 0,
    exWorksStandard: 0,
    importShippingSea: 0,
    gryphonSoftware: 2.50,
    otherLandedCosts: [],
  });

  const [availableSKUs, setAvailableSKUs] = useState<{ id: string; sku: string; name: string }[]>([]);
  const [isCustomSKU, setIsCustomSKU] = useState(false);
  const [isCustomChannel, setIsCustomChannel] = useState(false);
  const [customChannelName, setCustomChannelName] = useState('');
  
  // Save dialog state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [scenarioName, setScenarioName] = useState('');
  const [scenarioDescription, setScenarioDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Load available SKUs
  useEffect(() => {
    async function loadSKUs() {
      try {
        const response = await fetch('/api/admin/skus');
        if (response.ok) {
          const data = await response.json();
          console.log('Loaded SKUs:', data); // Debug log
          // API returns array directly, not wrapped
          setAvailableSKUs(Array.isArray(data) ? data : []);
        } else {
          console.error('Failed to load SKUs:', response.status, response.statusText);
        }
      } catch (error) {
        console.error('Error loading SKUs:', error);
      }
    }
    loadSKUs();
  }, []);

  // Recalculate Motorola Royalties when Net Sales changes
  useEffect(() => {
    if (worksheetData.motorolaRoyaltiesPercent > 0) {
      const otherFeesTotal = worksheetData.otherFeesAndAdvertising.reduce((sum, item) => sum + item.value, 0);
      const netSales = worksheetData.asp - worksheetData.fbaFeeAmount - worksheetData.amazonReferralFeeAmount - worksheetData.acosAmount - otherFeesTotal;
      const newAmount = (netSales * worksheetData.motorolaRoyaltiesPercent) / 100;
      if (Math.abs(newAmount - worksheetData.motorolaRoyaltiesAmount) > 0.01) {
        setWorksheetData(prev => ({
          ...prev,
          motorolaRoyaltiesAmount: newAmount
        }));
      }
    }
  }, [worksheetData.asp, worksheetData.fbaFeeAmount, worksheetData.amazonReferralFeeAmount, worksheetData.acosAmount, worksheetData.otherFeesAndAdvertising, worksheetData.motorolaRoyaltiesPercent]);

  // Recalculate DOA Credits when Net Sales changes
  useEffect(() => {
    if (worksheetData.doaCreditsPercent > 0) {
      const otherFeesTotal = worksheetData.otherFeesAndAdvertising.reduce((sum, item) => sum + item.value, 0);
      const netSales = worksheetData.asp - worksheetData.fbaFeeAmount - worksheetData.amazonReferralFeeAmount - worksheetData.acosAmount - otherFeesTotal;
      const newAmount = (netSales * worksheetData.doaCreditsPercent) / 100;
      if (Math.abs(newAmount - worksheetData.doaCreditsAmount) > 0.01) {
        setWorksheetData(prev => ({
          ...prev,
          doaCreditsAmount: newAmount
        }));
      }
    }
  }, [worksheetData.asp, worksheetData.fbaFeeAmount, worksheetData.amazonReferralFeeAmount, worksheetData.acosAmount, worksheetData.otherFeesAndAdvertising, worksheetData.doaCreditsPercent]);

  // Load existing scenario if editing
  useEffect(() => {
    if (scenarioId) {
      loadScenario(scenarioId);
    }
  }, [scenarioId]);

  async function loadScenario(id: string) {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/business-analysis/sku-scenarios/${id}`);
      if (response.ok) {
        const { scenario } = await response.json();
        console.log('Loaded scenario:', scenario);
        
        // Map API response to worksheet data
        setWorksheetData({
          skuName: scenario.skuName || '',
          channel: scenario.channel || '',
          country: scenario.countryCode || 'US',
          
          // Top Section
          asp: parseFloat(scenario.asp) || 0,
          fbaFeePercent: parseFloat(scenario.fbaFeePercent) || 8,
          fbaFeeAmount: parseFloat(scenario.fbaFeeAmount) || 0,
          amazonReferralFeePercent: parseFloat(scenario.amazonReferralFeePercent) || 8,
          amazonReferralFeeAmount: parseFloat(scenario.amazonReferralFeeAmount) || 0,
          acosPercent: parseFloat(scenario.acosPercent) || 8,
          acosAmount: parseFloat(scenario.acosAmount) || 0,
          otherFeesAndAdvertising: scenario.otherFeesAndAdvertising || [],
          
          // Less Frontend Section
          motorolaRoyaltiesPercent: parseFloat(scenario.motorolaRoyaltiesPercent) || 5,
          motorolaRoyaltiesAmount: parseFloat(scenario.motorolaRoyaltiesAmount) || 0,
          rtvFreightAssumptions: parseFloat(scenario.rtvFreightAssumptions) || 0.80,
          rtvRepairCosts: parseFloat(scenario.rtvRepairCosts) || 2.93,
          doaCreditsPercent: parseFloat(scenario.doaCreditsPercent) || 0,
          doaCreditsAmount: parseFloat(scenario.doaCreditsAmount) || 0,
          invoiceFactoringNet: parseFloat(scenario.invoiceFactoringNet) || 0,
          salesCommissionsPercent: parseFloat(scenario.salesCommissionsPercent) || 0,
          salesCommissionsAmount: parseFloat(scenario.salesCommissionsAmount) || 0,
          otherFrontendCosts: scenario.otherFrontendCosts || [],
          
          // Landed DDP Calculations Section
          importDutiesPercent: parseFloat(scenario.importDutiesPercent) || 0,
          importDutiesAmount: parseFloat(scenario.importDutiesAmount) || 0,
          exWorksStandard: parseFloat(scenario.exWorksStandard) || 0,
          importShippingSea: parseFloat(scenario.importShippingSea) || 0,
          gryphonSoftware: parseFloat(scenario.gryphonSoftware) || 2.50,
          otherLandedCosts: scenario.otherLandedCosts || [],
        });
        
        setScenarioName(scenario.scenarioName || '');
        setScenarioDescription(scenario.description || '');
      } else {
        alert('Failed to load scenario');
        router.push('/admin/business-analysis/sku-financial-entry');
      }
    } catch (error) {
      console.error('Error loading scenario:', error);
      alert('Error loading scenario');
    } finally {
      setIsLoading(false);
    }
  }

  // Calculation functions based on Excel structure
  
  // Auto-calculate amounts from percentages or vice versa
  const syncFbaFee = (percent?: number, amount?: number) => {
    if (percent !== undefined) {
      setWorksheetData(prev => ({
        ...prev,
        fbaFeePercent: percent,
        fbaFeeAmount: (prev.asp * percent) / 100
      }));
    } else if (amount !== undefined) {
      setWorksheetData(prev => ({
        ...prev,
        fbaFeeAmount: amount,
        fbaFeePercent: prev.asp > 0 ? (amount / prev.asp) * 100 : 0
      }));
    }
  };

  const syncAmazonReferralFee = (percent?: number, amount?: number) => {
    if (percent !== undefined) {
      setWorksheetData(prev => ({
        ...prev,
        amazonReferralFeePercent: percent,
        amazonReferralFeeAmount: (prev.asp * percent) / 100
      }));
    } else if (amount !== undefined) {
      setWorksheetData(prev => ({
        ...prev,
        amazonReferralFeeAmount: amount,
        amazonReferralFeePercent: prev.asp > 0 ? (amount / prev.asp) * 100 : 0
      }));
    }
  };

  const syncAcos = (percent?: number, amount?: number) => {
    if (percent !== undefined) {
      setWorksheetData(prev => ({
        ...prev,
        acosPercent: percent,
        acosAmount: (prev.asp * percent) / 100
      }));
    } else if (amount !== undefined) {
      setWorksheetData(prev => ({
        ...prev,
        acosAmount: amount,
        acosPercent: prev.asp > 0 ? (amount / prev.asp) * 100 : 0
      }));
    }
  };

  const syncMotorolaRoyalties = (percent?: number, amount?: number) => {
    const netSales = calculateNetSales();
    if (percent !== undefined) {
      const calculatedAmount = (netSales * percent) / 100;
      setWorksheetData(prev => ({
        ...prev,
        motorolaRoyaltiesPercent: percent,
        motorolaRoyaltiesAmount: calculatedAmount
      }));
    } else if (amount !== undefined) {
      const calculatedPercent = netSales > 0 ? (amount / netSales) * 100 : 0;
      setWorksheetData(prev => ({
        ...prev,
        motorolaRoyaltiesAmount: amount,
        motorolaRoyaltiesPercent: calculatedPercent
      }));
    }
  };

  const syncDoaCredits = (percent?: number, amount?: number) => {
    if (percent !== undefined) {
      setWorksheetData(prev => {
        const netSales = prev.asp - prev.fbaFeeAmount - prev.amazonReferralFeeAmount - prev.acosAmount;
        return {
          ...prev,
          doaCreditsPercent: percent,
          doaCreditsAmount: (netSales * percent) / 100
        };
      });
    } else if (amount !== undefined) {
      setWorksheetData(prev => {
        const netSales = prev.asp - prev.fbaFeeAmount - prev.amazonReferralFeeAmount - prev.acosAmount;
        return {
          ...prev,
          doaCreditsAmount: amount,
          doaCreditsPercent: netSales > 0 ? (amount / netSales) * 100 : 0
        };
      });
    }
  };

  const syncSalesCommissions = (percent?: number, amount?: number) => {
    if (percent !== undefined) {
      setWorksheetData(prev => ({
        ...prev,
        salesCommissionsPercent: percent,
        salesCommissionsAmount: (prev.asp * percent) / 100
      }));
    } else if (amount !== undefined) {
      setWorksheetData(prev => ({
        ...prev,
        salesCommissionsAmount: amount,
        salesCommissionsPercent: prev.asp > 0 ? (amount / prev.asp) * 100 : 0
      }));
    }
  };

  const syncImportDuties = (percent?: number, amount?: number) => {
    if (percent !== undefined) {
      setWorksheetData(prev => ({
        ...prev,
        importDutiesPercent: percent,
        importDutiesAmount: (prev.exWorksStandard * percent) / 100
      }));
    } else if (amount !== undefined) {
      setWorksheetData(prev => ({
        ...prev,
        importDutiesAmount: amount,
        importDutiesPercent: prev.exWorksStandard > 0 ? (amount / prev.exWorksStandard) * 100 : 0
      }));
    }
  };

  // Net Sales = ASP - FBA Fee - Amazon Referral Fee - ACOS
  const calculateNetSales = () => {
    const otherFeesTotal = worksheetData.otherFeesAndAdvertising.reduce((sum, item) => sum + item.value, 0);
    return worksheetData.asp - worksheetData.fbaFeeAmount - worksheetData.amazonReferralFeeAmount - worksheetData.acosAmount - otherFeesTotal;
  };

  // Total Backend Costs (calculated from individual line items)
  const calculateTotalBackendCosts = () => {
    const { motorolaRoyaltiesAmount, rtvFreightAssumptions, rtvRepairCosts, doaCreditsAmount, invoiceFactoringNet, salesCommissionsAmount } = worksheetData;
    return motorolaRoyaltiesAmount + rtvFreightAssumptions + rtvRepairCosts + doaCreditsAmount + invoiceFactoringNet + salesCommissionsAmount;
  };

  // Total Frontend Costs (includes backend costs + other frontend costs)
  const calculateTotalFrontendCosts = () => {
    const backendCosts = calculateTotalBackendCosts();
    const otherTotal = worksheetData.otherFrontendCosts.reduce((sum, item) => sum + item.value, 0);
    return backendCosts + otherTotal;
  };

  // Landed DDP = ExWorks + Import Duties + Import Shipping + Gryphon Software + Other
  const calculateLandedDDP = () => {
    const { exWorksStandard, importDutiesAmount, importShippingSea, gryphonSoftware, otherLandedCosts } = worksheetData;
    const otherTotal = otherLandedCosts.reduce((sum, item) => sum + item.value, 0);
    return exWorksStandard + importDutiesAmount + importShippingSea + gryphonSoftware + otherTotal;
  };

  // Gross Profit = Net Sales - Total Frontend Costs - Landed DDP
  const calculateGrossProfit = () => {
    return calculateNetSales() - calculateTotalFrontendCosts() - calculateLandedDDP();
  };

  // Gross Margin % = (Gross Profit / Net Sales) * 100
  const calculateGrossMargin = () => {
    const netSales = calculateNetSales();
    return netSales > 0 ? (calculateGrossProfit() / netSales) * 100 : 0;
  };

  const handleSave = () => {
    // Validate required fields
    if (!worksheetData.skuName) {
      alert('Please select or enter a SKU name');
      return;
    }
    if (!worksheetData.channel) {
      alert('Please select a sales channel');
      return;
    }
    
    // Open save dialog
    setShowSaveDialog(true);
  };

  const handleSaveConfirm = async () => {
    if (!scenarioName.trim()) {
      alert('Please enter a scenario name');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        scenarioName: scenarioName.trim(),
        description: scenarioDescription.trim() || null,
        skuName: worksheetData.skuName,
        channel: worksheetData.channel,
        countryCode: worksheetData.country,
        
        // Top Section
        asp: worksheetData.asp,
        fbaFeePercent: worksheetData.fbaFeePercent,
        fbaFeeAmount: worksheetData.fbaFeeAmount,
        amazonReferralFeePercent: worksheetData.amazonReferralFeePercent,
        amazonReferralFeeAmount: worksheetData.amazonReferralFeeAmount,
        acosPercent: worksheetData.acosPercent,
        acosAmount: worksheetData.acosAmount,
        otherFeesAndAdvertising: worksheetData.otherFeesAndAdvertising,
        
        // Less Frontend Section
        motorolaRoyaltiesPercent: worksheetData.motorolaRoyaltiesPercent,
        motorolaRoyaltiesAmount: worksheetData.motorolaRoyaltiesAmount,
        rtvFreightAssumptions: worksheetData.rtvFreightAssumptions,
        rtvRepairCosts: worksheetData.rtvRepairCosts,
        doaCreditsPercent: worksheetData.doaCreditsPercent,
        doaCreditsAmount: worksheetData.doaCreditsAmount,
        invoiceFactoringNet: worksheetData.invoiceFactoringNet,
        salesCommissionsPercent: worksheetData.salesCommissionsPercent,
        salesCommissionsAmount: worksheetData.salesCommissionsAmount,
        otherFrontendCosts: worksheetData.otherFrontendCosts,
        
        // Landed DDP Calculations Section
        importDutiesPercent: worksheetData.importDutiesPercent,
        importDutiesAmount: worksheetData.importDutiesAmount,
        exWorksStandard: worksheetData.exWorksStandard,
        importShippingSea: worksheetData.importShippingSea,
        gryphonSoftware: worksheetData.gryphonSoftware,
        otherLandedCosts: worksheetData.otherLandedCosts,
      };

      let response;
      if (scenarioId) {
        // Update existing scenario
        response = await fetch(`/api/business-analysis/sku-scenarios/${scenarioId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        // Create new scenario
        response = await fetch('/api/business-analysis/sku-scenarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (response.ok) {
        const data = await response.json();
        console.log('Saved scenario:', data);
        alert(scenarioId ? 'Scenario updated successfully!' : 'Scenario saved successfully!');
        setShowSaveDialog(false);
        router.push('/admin/business-analysis/sku-financial-entry');
      } else {
        const error = await response.json();
        alert(`Failed to save scenario: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving scenario:', error);
      alert('Error saving scenario');
    } finally {
      setIsSaving(false);
    }
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
                      {availableSKUs.map((skuItem) => (
                        <SelectItem key={skuItem.id} value={skuItem.sku}>
                          {skuItem.sku} - {skuItem.name}
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
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <Input
                    id="asp"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-7"
                    value={worksheetData.asp || ''}
                    onChange={(e) => {
                      const newAsp = parseFloat(e.target.value) || 0;
                      setWorksheetData(prev => ({ ...prev, asp: newAsp }));
                      // Recalculate all percentage-based amounts
                      syncFbaFee(worksheetData.fbaFeePercent);
                      syncAmazonReferralFee(worksheetData.amazonReferralFeePercent);
                      syncAcos(worksheetData.acosPercent);
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Fees & Advertising */}
        <Card className="border-2 border-orange-200">
          <CardHeader className="bg-orange-50">
            <CardTitle className="text-lg sm:text-xl">2. Fees & Advertising</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* FBA Fee */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="fba-fee-percent">FBA Fee (%)</Label>
                  <div className="relative">
                    <Input
                      id="fba-fee-percent"
                      type="number"
                      step="0.01"
                      placeholder="8"
                      className="pr-7"
                      value={worksheetData.fbaFeePercent || ''}
                      onChange={(e) => syncFbaFee(parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                    />
                    <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fba-fee-amount">FBA Fee ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <Input
                      id="fba-fee-amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-7"
                      value={worksheetData.fbaFeeAmount || ''}
                      onChange={(e) => syncFbaFee(undefined, parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-500 italic">
                  Enter either % or $ - the other will auto-calculate
                </div>
              </div>

              {/* Amazon Referral Fee */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="amazon-referral-percent">Amazon Referral Fee (%)</Label>
                  <div className="relative">
                    <Input
                      id="amazon-referral-percent"
                      type="number"
                      step="0.01"
                      placeholder="8"
                      className="pr-7"
                      value={worksheetData.amazonReferralFeePercent || ''}
                      onChange={(e) => syncAmazonReferralFee(parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                    />
                    <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amazon-referral-amount">Amazon Referral Fee ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <Input
                      id="amazon-referral-amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-7"
                      value={worksheetData.amazonReferralFeeAmount || ''}
                      onChange={(e) => syncAmazonReferralFee(undefined, parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-500 italic">
                  Enter either % or $ - the other will auto-calculate
                </div>
              </div>

              {/* ACOS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="acos-percent">ACOS (%)</Label>
                  <div className="relative">
                    <Input
                      id="acos-percent"
                      type="number"
                      step="0.01"
                      placeholder="8"
                      className="pr-7"
                      value={worksheetData.acosPercent || ''}
                      onChange={(e) => syncAcos(parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                    />
                    <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="acos-amount">ACOS ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <Input
                      id="acos-amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-7"
                      value={worksheetData.acosAmount || ''}
                      onChange={(e) => syncAcos(undefined, parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-500 italic">
                  Advertising Cost of Sale
                </div>
              </div>

              {/* Other Fees & Advertising (Dynamic) */}
              <div className="space-y-2 border-t pt-4 mt-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Other Fees & Advertising</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setWorksheetData(prev => ({
                        ...prev,
                        otherFeesAndAdvertising: [...prev.otherFeesAndAdvertising, { label: '', value: 0 }]
                      }));
                    }}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Line Item
                  </Button>
                </div>
                {worksheetData.otherFeesAndAdvertising.map((item, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      placeholder="Fee name (e.g., Shopify Fee)"
                      value={item.label}
                      onChange={(e) => {
                        const newItems = [...worksheetData.otherFeesAndAdvertising];
                        newItems[index].label = e.target.value;
                        setWorksheetData(prev => ({ ...prev, otherFeesAndAdvertising: newItems }));
                      }}
                      className="flex-1"
                    />
                    <div className="relative w-32">
                      <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="pl-7"
                        value={item.value || ''}
                        onChange={(e) => {
                          const newItems = [...worksheetData.otherFeesAndAdvertising];
                          newItems[index].value = parseFloat(e.target.value) || 0;
                          setWorksheetData(prev => ({ ...prev, otherFeesAndAdvertising: newItems }));
                        }}
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setWorksheetData(prev => ({
                          ...prev,
                          otherFeesAndAdvertising: prev.otherFeesAndAdvertising.filter((_, i) => i !== index)
                        }));
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Net Sales (Calculated) */}
        <Card className="border-2 border-green-200">
          <CardHeader className="bg-green-50">
            <CardTitle className="text-lg sm:text-xl">3. Net Sales (Calculated)</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-center">
              <Label className="text-sm font-medium text-gray-600">Net Sales</Label>
              <p className="text-3xl font-bold text-green-600">${calculateNetSales().toFixed(2)}</p>
              <p className="text-sm text-gray-500 mt-2">ASP - FBA Fee - Amazon Referral Fee - ACOS</p>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Less Frontend Costs */}
        <Card className="border-2 border-purple-200">
          <CardHeader className="bg-purple-50">
            <CardTitle className="text-lg sm:text-xl">4. Less Frontend Costs</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Motorola Royalties */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="motorola-royalties-percent">Motorola Royalties (%)</Label>
                  <div className="relative">
                    <Input
                      id="motorola-royalties-percent"
                      type="number"
                      step="0.01"
                      placeholder="5"
                      className="pr-7"
                      value={worksheetData.motorolaRoyaltiesPercent || ''}
                      onChange={(e) => syncMotorolaRoyalties(parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                    />
                    <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="motorola-royalties-amount">Motorola Royalties ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <Input
                      id="motorola-royalties-amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-7"
                      value={worksheetData.motorolaRoyaltiesAmount || ''}
                      onChange={(e) => syncMotorolaRoyalties(undefined, parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-500 italic">
                  % of Net Sales
                </div>
              </div>

              {/* RTV Freight Assumptions */}
              <div className="space-y-2">
                <Label htmlFor="rtv-freight">RTV Freight Assumptions</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <Input
                    id="rtv-freight"
                    type="number"
                    step="0.01"
                    placeholder="0.80"
                    className="pl-7"
                    value={worksheetData.rtvFreightAssumptions || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, rtvFreightAssumptions: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>

              {/* RTV Repair Costs */}
              <div className="space-y-2">
                <Label htmlFor="rtv-repair">RTV Repair Costs</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <Input
                    id="rtv-repair"
                    type="number"
                    step="0.01"
                    placeholder="2.93"
                    className="pl-7"
                    value={worksheetData.rtvRepairCosts || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, rtvRepairCosts: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>

              {/* DOA Credits */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="doa-credits-percent">DOA Credits (%)</Label>
                  <div className="relative">
                    <Input
                      id="doa-credits-percent"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      className="pr-7"
                      value={worksheetData.doaCreditsPercent || ''}
                      onChange={(e) => syncDoaCredits(parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                    />
                    <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doa-credits-amount">DOA Credits ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <Input
                      id="doa-credits-amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-7"
                      value={worksheetData.doaCreditsAmount || ''}
                      onChange={(e) => syncDoaCredits(undefined, parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-500 italic">
                  % of Net Sales
                </div>
              </div>

              {/* Invoice Factoring Net */}
              <div className="space-y-2">
                <Label htmlFor="invoice-factoring">Invoice Factoring (Net)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <Input
                    id="invoice-factoring"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-7"
                    value={worksheetData.invoiceFactoringNet || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, invoiceFactoringNet: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>

              {/* Sales Commissions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="sales-commissions-percent">Sales Commissions (%)</Label>
                  <div className="relative">
                    <Input
                      id="sales-commissions-percent"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      className="pr-7"
                      value={worksheetData.salesCommissionsPercent || ''}
                      onChange={(e) => syncSalesCommissions(parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                    />
                    <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sales-commissions-amount">Sales Commissions ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <Input
                      id="sales-commissions-amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-7"
                      value={worksheetData.salesCommissionsAmount || ''}
                      onChange={(e) => syncSalesCommissions(undefined, parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-500 italic">
                  % of ASP
                </div>
              </div>

              {/* Total Backend Costs (Calculated) */}
              <div className="pt-4 border-t">
                <Label className="text-sm font-medium text-gray-600">Total Backend Costs</Label>
                <p className="text-2xl font-bold text-purple-600">${calculateTotalBackendCosts().toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-1">Sum of all backend costs above</p>
              </div>

              {/* Other Frontend Costs (Dynamic) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Other Frontend Costs</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setWorksheetData(prev => ({
                      ...prev,
                      otherFrontendCosts: [...prev.otherFrontendCosts, { label: '', value: 0 }]
                    }))}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Line
                  </Button>
                </div>
                {worksheetData.otherFrontendCosts.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Cost name..."
                      value={item.label}
                      onChange={(e) => {
                        const newItems = [...worksheetData.otherFrontendCosts];
                        newItems[index].label = e.target.value;
                        setWorksheetData(prev => ({ ...prev, otherFrontendCosts: newItems }));
                      }}
                      className="flex-1"
                    />
                    <div className="relative w-32">
                      <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="pl-7"
                        value={item.value || ''}
                        onChange={(e) => {
                          const newItems = [...worksheetData.otherFrontendCosts];
                          newItems[index].value = parseFloat(e.target.value) || 0;
                          setWorksheetData(prev => ({ ...prev, otherFrontendCosts: newItems }));
                        }}
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newItems = worksheetData.otherFrontendCosts.filter((_, i) => i !== index);
                        setWorksheetData(prev => ({ ...prev, otherFrontendCosts: newItems }));
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Total Frontend Costs (Calculated) */}
              <div className="pt-4 border-t">
                <Label className="text-sm font-medium text-gray-600">Total Frontend Costs</Label>
                <p className="text-2xl font-bold text-purple-600">${calculateTotalFrontendCosts().toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Landed DDP Calculations */}
        <Card className="border-2 border-blue-200">
          <CardHeader className="bg-blue-50">
            <CardTitle className="text-lg sm:text-xl">5. Landed DDP Calculations</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Import Duties */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="import-duties-percent">Import Duties (%)</Label>
                  <div className="relative">
                    <Input
                      id="import-duties-percent"
                      type="number"
                      step="0.01"
                      placeholder="0"
                      className="pr-7"
                      value={worksheetData.importDutiesPercent || ''}
                      onChange={(e) => syncImportDuties(parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                    />
                    <span className="absolute right-3 top-2.5 text-gray-500">%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="import-duties-amount">Import Duties ($)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                    <Input
                      id="import-duties-amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="pl-7"
                      value={worksheetData.importDutiesAmount || ''}
                      onChange={(e) => syncImportDuties(undefined, parseFloat(e.target.value) || 0)}
                      onFocus={(e) => e.target.select()}
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-500 italic">
                  % of ExWorks Standard
                </div>
              </div>

              {/* ExWorks Standard */}
              <div className="space-y-2">
                <Label htmlFor="exworks">ExWorks Standard</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <Input
                    id="exworks"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-7"
                    value={worksheetData.exWorksStandard || ''}
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value) || 0;
                      setWorksheetData(prev => ({ ...prev, exWorksStandard: newValue }));
                      // Recalculate import duties if percentage is set
                      if (worksheetData.importDutiesPercent > 0) {
                        syncImportDuties(worksheetData.importDutiesPercent);
                      }
                    }}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>

              {/* Import Shipping */}
              <div className="space-y-2">
                <Label htmlFor="import-shipping">Import Shipping</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <Input
                    id="import-shipping"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-7"
                    value={worksheetData.importShippingSea || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, importShippingSea: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>

              {/* Gryphon Software */}
              <div className="space-y-2">
                <Label htmlFor="gryphon">Gryphon Software</Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                  <Input
                    id="gryphon"
                    type="number"
                    step="0.01"
                    placeholder="2.50"
                    className="pl-7"
                    value={worksheetData.gryphonSoftware || ''}
                    onChange={(e) => setWorksheetData(prev => ({ ...prev, gryphonSoftware: parseFloat(e.target.value) || 0 }))}
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              </div>

              {/* Other Landed Costs (Dynamic) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Other Landed Costs</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setWorksheetData(prev => ({
                      ...prev,
                      otherLandedCosts: [...prev.otherLandedCosts, { label: '', value: 0 }]
                    }))}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Line
                  </Button>
                </div>
                {worksheetData.otherLandedCosts.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      placeholder="Cost name..."
                      value={item.label}
                      onChange={(e) => {
                        const newItems = [...worksheetData.otherLandedCosts];
                        newItems[index].label = e.target.value;
                        setWorksheetData(prev => ({ ...prev, otherLandedCosts: newItems }));
                      }}
                      className="flex-1"
                    />
                    <div className="relative w-32">
                      <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        className="pl-7"
                        value={item.value || ''}
                        onChange={(e) => {
                          const newItems = [...worksheetData.otherLandedCosts];
                          newItems[index].value = parseFloat(e.target.value) || 0;
                          setWorksheetData(prev => ({ ...prev, otherLandedCosts: newItems }));
                        }}
                        onFocus={(e) => e.target.select()}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newItems = worksheetData.otherLandedCosts.filter((_, i) => i !== index);
                        setWorksheetData(prev => ({ ...prev, otherLandedCosts: newItems }));
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Landed DDP Total (Calculated) */}
              <div className="pt-4 border-t">
                <Label className="text-sm font-medium text-gray-600">Landed DDP</Label>
                <p className="text-2xl font-bold text-blue-600">${calculateLandedDDP().toFixed(2)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 6: Gross Profit & Margin (Calculated) */}
        <Card className="border-2 border-green-200">
          <CardHeader className="bg-green-50">
            <CardTitle className="text-lg sm:text-xl">6. Gross Profit & Margin</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="text-center">
                <Label className="text-sm font-medium text-gray-600">Gross Profit</Label>
                <p className="text-3xl font-bold text-green-600">${calculateGrossProfit().toFixed(2)}</p>
              </div>
              <div className="text-center">
                <Label className="text-sm font-medium text-gray-600">Gross Margin</Label>
                <p className="text-3xl font-bold text-green-600">{calculateGrossMargin().toFixed(0)}%</p>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4 text-center">
              Gross Profit = Net Sales - Total Frontend Costs - Landed DDP
            </p>
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
            disabled={isLoading}
          >
            <Save className="w-4 h-4 mr-2" />
            {scenarioId ? 'Update Scenario' : 'Save Scenario'}
          </Button>
        </div>
      </div>

      {/* Save Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{scenarioId ? 'Update Scenario' : 'Save Scenario'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="scenario-name">Scenario Name *</Label>
              <Input
                id="scenario-name"
                placeholder="e.g., MNQ15 Amazon FBA US - Q1 2025"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scenario-description">Description (Optional)</Label>
              <Input
                id="scenario-description"
                placeholder="Add notes about this scenario..."
                value={scenarioDescription}
                onChange={(e) => setScenarioDescription(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </div>
            <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
              <p><strong>SKU:</strong> {worksheetData.skuName || 'Not selected'}</p>
              <p><strong>Channel:</strong> {worksheetData.channel || 'Not selected'}</p>
              <p><strong>Country:</strong> {COUNTRIES.find(c => c.code === worksheetData.country)?.name || worksheetData.country}</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => setShowSaveDialog(false)}
              variant="outline"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfirm}
              className="bg-green-600 hover:bg-green-700"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : (scenarioId ? 'Update' : 'Save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Wrapper component with Suspense boundary
export default function SKUWorksheetPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto p-6 text-center">
        <p className="text-gray-500">Loading worksheet...</p>
      </div>
    }>
      <SKUWorksheetPageContent />
    </Suspense>
  );
}

