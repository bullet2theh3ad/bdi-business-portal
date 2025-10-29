'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calculator, FolderOpen, Edit, Trash2, Search, Copy, Grid3x3, List, Download } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface Scenario {
  id: string;
  scenarioName: string;
  description?: string;
  skuName: string;
  channel: string;
  countryCode: string;
  asp: string;
  createdAt: string;
  updatedAt: string;
  creatorName?: string;
  // Calculated fields from view
  grossProfit?: string;
  grossMarginPercent?: string;
  // All detailed fields for CSV export
  fbaFeePercent?: string;
  fbaFeeAmount?: string;
  amazonReferralFeePercent?: string;
  amazonReferralFeeAmount?: string;
  acosPercent?: string;
  acosAmount?: string;
  otherFeesAndAdvertising?: Array<{label: string; percent?: number; value: number}>;
  motorolaRoyaltiesPercent?: string;
  motorolaRoyaltiesAmount?: string;
  rtvFreightAssumptions?: string;
  rtvRepairCosts?: string;
  doaCreditsPercent?: string;
  doaCreditsAmount?: string;
  invoiceFactoringNet?: string;
  salesCommissionsPercent?: string;
  salesCommissionsAmount?: string;
  otherFrontendCosts?: Array<{label: string; value: number}>;
  importDutiesPercent?: string;
  importDutiesAmount?: string;
  exWorksStandard?: string;
  importShippingSea?: string;
  gryphonSoftware?: string;
  otherLandedCosts?: Array<{label: string; value: number}>;
}

export default function SKUFinancialEntryPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [skuFilter, setSkuFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean; id: string; name: string}>({
    show: false,
    id: '',
    name: ''
  });
  const [duplicateDialog, setDuplicateDialog] = useState<{show: boolean; id: string; originalName: string; originalDescription: string}>({
    show: false,
    id: '',
    originalName: '',
    originalDescription: ''
  });
  const [newScenarioName, setNewScenarioName] = useState('');
  const [newScenarioDescription, setNewScenarioDescription] = useState('');

  useEffect(() => {
    loadScenarios();
  }, []);

  async function loadScenarios() {
    setIsLoading(true);
    try {
      const response = await fetch('/api/business-analysis/sku-scenarios');
      if (response.ok) {
        const data = await response.json();
        setScenarios(data.scenarios || []);
      } else {
        console.error('Failed to load scenarios');
      }
    } catch (error) {
      console.error('Error loading scenarios:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const handleNewWorksheet = () => {
    router.push('/admin/business-analysis/sku-financial-entry/worksheet');
  };

  const handleEdit = (scenarioId: string) => {
    router.push(`/admin/business-analysis/sku-financial-entry/worksheet?id=${scenarioId}`);
  };

  const handleDeleteClick = (scenarioId: string, scenarioName: string) => {
    setDeleteConfirm({ show: true, id: scenarioId, name: scenarioName });
  };

  const handleDeleteConfirm = async () => {
    try {
      const response = await fetch(`/api/business-analysis/sku-scenarios/${deleteConfirm.id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setScenarios(scenarios.filter(s => s.id !== deleteConfirm.id));
        setDeleteConfirm({ show: false, id: '', name: '' });
        alert('Scenario deleted successfully');
      } else {
        alert('Failed to delete scenario');
      }
    } catch (error) {
      console.error('Error deleting scenario:', error);
      alert('Error deleting scenario');
    }
  };

  const handleDuplicateClick = (scenarioId: string, scenarioName: string, scenarioDescription?: string) => {
    setNewScenarioName(`${scenarioName} (Copy)`);
    setNewScenarioDescription(scenarioDescription ? `${scenarioDescription} (Duplicated)` : 'Duplicated scenario');
    setDuplicateDialog({ show: true, id: scenarioId, originalName: scenarioName, originalDescription: scenarioDescription || '' });
  };

  const handleDuplicateConfirm = async () => {
    if (!newScenarioName.trim()) {
      alert('Please enter a name for the duplicated scenario');
      return;
    }

    // Check if name already exists
    if (scenarios.some(s => s.scenarioName.toLowerCase() === newScenarioName.toLowerCase())) {
      alert('A scenario with this name already exists. Please choose a different name.');
      return;
    }

    try {
      // First, fetch the full scenario data
      const getResponse = await fetch(`/api/business-analysis/sku-scenarios/${duplicateDialog.id}`);
      if (!getResponse.ok) {
        alert('Failed to load scenario data');
        return;
      }
      
      const responseData = await getResponse.json();
      const scenarioData = responseData.scenario; // API returns { scenario: {...} }
      
      // Convert string values to numbers for the API
      const duplicateData = {
        scenarioName: newScenarioName,
        description: newScenarioDescription,
        skuName: scenarioData.skuName,
        channel: scenarioData.channel,
        countryCode: scenarioData.countryCode,
        
        // Convert all numeric fields from strings to numbers
        asp: parseFloat(scenarioData.asp || 0),
        fbaFeePercent: parseFloat(scenarioData.fbaFeePercent || 0),
        fbaFeeAmount: parseFloat(scenarioData.fbaFeeAmount || 0),
        amazonReferralFeePercent: parseFloat(scenarioData.amazonReferralFeePercent || 0),
        amazonReferralFeeAmount: parseFloat(scenarioData.amazonReferralFeeAmount || 0),
        acosPercent: parseFloat(scenarioData.acosPercent || 0),
        acosAmount: parseFloat(scenarioData.acosAmount || 0),
        otherFeesAndAdvertising: scenarioData.otherFeesAndAdvertising || [],
        
        motorolaRoyaltiesPercent: parseFloat(scenarioData.motorolaRoyaltiesPercent || 0),
        motorolaRoyaltiesAmount: parseFloat(scenarioData.motorolaRoyaltiesAmount || 0),
        rtvFreightAssumptions: parseFloat(scenarioData.rtvFreightAssumptions || 0),
        rtvRepairCosts: parseFloat(scenarioData.rtvRepairCosts || 0),
        doaCreditsPercent: parseFloat(scenarioData.doaCreditsPercent || 0),
        doaCreditsAmount: parseFloat(scenarioData.doaCreditsAmount || 0),
        invoiceFactoringNet: parseFloat(scenarioData.invoiceFactoringNet || 0),
        salesCommissionsPercent: parseFloat(scenarioData.salesCommissionsPercent || 0),
        salesCommissionsAmount: parseFloat(scenarioData.salesCommissionsAmount || 0),
        otherFrontendCosts: scenarioData.otherFrontendCosts || [],
        
        importDutiesPercent: parseFloat(scenarioData.importDutiesPercent || 0),
        importDutiesAmount: parseFloat(scenarioData.importDutiesAmount || 0),
        exWorksStandard: parseFloat(scenarioData.exWorksStandard || 0),
        importShippingSea: parseFloat(scenarioData.importShippingSea || 0),
        gryphonSoftware: parseFloat(scenarioData.gryphonSoftware || 0),
        otherLandedCosts: scenarioData.otherLandedCosts || [],
      };

      const createResponse = await fetch('/api/business-analysis/sku-scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicateData),
      });

      if (createResponse.ok) {
        setDuplicateDialog({ show: false, id: '', originalName: '', originalDescription: '' });
        setNewScenarioName('');
        setNewScenarioDescription('');
        loadScenarios(); // Reload the list
        alert('Scenario duplicated successfully!');
      } else {
        const error = await createResponse.json();
        alert(`Failed to duplicate scenario: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error duplicating scenario:', error);
      alert('Error duplicating scenario');
    }
  };

  // Channel categorization
  const D2C_CHANNELS = ['amazon_fba', 'Amazon (FBA)', 'shopify', 'Shopify'];
  const B2B_CHANNELS = ['best_buy_direct', 'Best Buy (Direct)', 'costco_direct', 'Costco (Direct)', 
                        'walmart_direct', 'Walmart (Direct)', 'tekpoint', 'Tekpoint (Distributor)', 
                        'emg', 'EMG (Distributor)'];
  
  const isD2CChannel = (channel: string) => {
    return D2C_CHANNELS.some(d2c => channel.toLowerCase().includes(d2c.toLowerCase())) ||
           channel.toLowerCase().includes('d2c');
  };
  
  const isB2BChannel = (channel: string) => {
    return B2B_CHANNELS.some(b2b => channel.toLowerCase().includes(b2b.toLowerCase())) ||
           channel.toLowerCase().includes('b2b');
  };

  // Helper to abbreviate channel name
  const abbreviateChannel = (channel: string): string => {
    if (channel.toLowerCase().includes('amazon')) return 'AMZ';
    if (channel.toLowerCase().includes('shopify')) return 'Shopify';
    if (channel.toLowerCase().includes('best buy')) return 'Best Buy';
    if (channel.toLowerCase().includes('costco')) return 'Costco';
    if (channel.toLowerCase().includes('walmart')) return 'Walmart';
    if (channel.toLowerCase().includes('tekpoint')) return 'Tekpoint';
    if (channel.toLowerCase().includes('emg')) return 'EMG';
    if (channel.length > 15) return channel.substring(0, 15) + '...';
    return channel;
  };

  // CSV Export function
  const exportToCSV = () => {
    if (scenarios.length === 0) {
      alert('No scenarios to export');
      return;
    }

    // Collect all unique dynamic field labels
    const allOtherFeesLabels = new Set<string>();
    const allOtherFrontendLabels = new Set<string>();
    const allOtherLandedLabels = new Set<string>();

    scenarios.forEach(scenario => {
      scenario.otherFeesAndAdvertising?.forEach(item => allOtherFeesLabels.add(item.label));
      scenario.otherFrontendCosts?.forEach(item => allOtherFrontendLabels.add(item.label));
      scenario.otherLandedCosts?.forEach(item => allOtherLandedLabels.add(item.label));
    });

    // Create CSV header
    const baseHeaders = [
      'Scenario Name',
      'Description',
      'SKU Name',
      'Channel',
      'Country Code',
      'ASP',
      'FBA Fee %',
      'FBA Fee $',
      'Amazon Referral Fee %',
      'Amazon Referral Fee $',
      'ACOS %',
      'ACOS $',
    ];

    // Add dynamic "Other Fees & Advertising" columns
    const otherFeesHeaders: string[] = [];
    allOtherFeesLabels.forEach(label => {
      otherFeesHeaders.push(`${label} %`);
      otherFeesHeaders.push(`${label} $`);
    });

    const backendHeaders = [
      'Motorola Royalties %',
      'Motorola Royalties $',
      'RTV Freight Assumptions',
      'RTV Repair Costs',
      'DOA Credits %',
      'DOA Credits $',
      'Invoice Factoring Net',
      'Sales Commissions %',
      'Sales Commissions $',
    ];

    // Add dynamic "Other Frontend Costs" columns
    const otherFrontendHeaders: string[] = [];
    allOtherFrontendLabels.forEach(label => {
      otherFrontendHeaders.push(label);
    });

    const landedHeaders = [
      'Import Duties %',
      'Import Duties $',
      'ExWorks Standard',
      'Import Shipping Sea',
      'Gryphon Software',
    ];

    // Add dynamic "Other Landed Costs" columns
    const otherLandedHeaders: string[] = [];
    allOtherLandedLabels.forEach(label => {
      otherLandedHeaders.push(label);
    });

    const calculatedHeaders = [
      'Gross Profit',
      'Gross Margin %',
      'Created At',
      'Updated At',
      'Created By'
    ];

    const headers = [
      ...baseHeaders,
      ...otherFeesHeaders,
      ...backendHeaders,
      ...otherFrontendHeaders,
      ...landedHeaders,
      ...otherLandedHeaders,
      ...calculatedHeaders
    ];

    // Create CSV rows
    const rows = scenarios.map(scenario => {
      const baseValues = [
        scenario.scenarioName || '',
        scenario.description || '',
        scenario.skuName || '',
        scenario.channel || '',
        scenario.countryCode || '',
        scenario.asp || '0',
        scenario.fbaFeePercent || '0',
        scenario.fbaFeeAmount || '0',
        scenario.amazonReferralFeePercent || '0',
        scenario.amazonReferralFeeAmount || '0',
        scenario.acosPercent || '0',
        scenario.acosAmount || '0',
      ];

      // Add dynamic "Other Fees & Advertising" values
      const otherFeesValues: string[] = [];
      allOtherFeesLabels.forEach(label => {
        const item = scenario.otherFeesAndAdvertising?.find(i => i.label === label);
        otherFeesValues.push(item?.percent?.toString() || '0');
        otherFeesValues.push(item?.value?.toString() || '0');
      });

      const backendValues = [
        scenario.motorolaRoyaltiesPercent || '0',
        scenario.motorolaRoyaltiesAmount || '0',
        scenario.rtvFreightAssumptions || '0',
        scenario.rtvRepairCosts || '0',
        scenario.doaCreditsPercent || '0',
        scenario.doaCreditsAmount || '0',
        scenario.invoiceFactoringNet || '0',
        scenario.salesCommissionsPercent || '0',
        scenario.salesCommissionsAmount || '0',
      ];

      // Add dynamic "Other Frontend Costs" values
      const otherFrontendValues: string[] = [];
      allOtherFrontendLabels.forEach(label => {
        const item = scenario.otherFrontendCosts?.find(i => i.label === label);
        otherFrontendValues.push(item?.value?.toString() || '0');
      });

      const landedValues = [
        scenario.importDutiesPercent || '0',
        scenario.importDutiesAmount || '0',
        scenario.exWorksStandard || '0',
        scenario.importShippingSea || '0',
        scenario.gryphonSoftware || '0',
      ];

      // Add dynamic "Other Landed Costs" values
      const otherLandedValues: string[] = [];
      allOtherLandedLabels.forEach(label => {
        const item = scenario.otherLandedCosts?.find(i => i.label === label);
        otherLandedValues.push(item?.value?.toString() || '0');
      });

      const calculatedValues = [
        scenario.grossProfit || '0',
        scenario.grossMarginPercent || '0',
        scenario.createdAt || '',
        scenario.updatedAt || '',
        scenario.creatorName || ''
      ];

      return [
        ...baseValues,
        ...otherFeesValues,
        ...backendValues,
        ...otherFrontendValues,
        ...landedValues,
        ...otherLandedValues,
        ...calculatedValues
      ];
    });

    // Convert to CSV string
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(v => `"${v}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `sku_financial_scenarios_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Get unique values for filters
  const uniqueSkus = Array.from(new Set(scenarios.map(s => s.skuName))).sort();
  const uniqueChannels = Array.from(new Set(scenarios.map(s => s.channel))).sort();
  const uniqueCountries = Array.from(new Set(scenarios.map(s => s.countryCode))).sort();
  
  // Count scenarios per channel category
  const d2cCount = scenarios.filter(s => isD2CChannel(s.channel)).length;
  const b2bCount = scenarios.filter(s => isB2BChannel(s.channel)).length;

  // Apply all filters
  const filteredScenarios = scenarios.filter(scenario => {
    const matchesSearch = scenario.scenarioName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scenario.skuName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scenario.channel.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSku = skuFilter === 'all' || scenario.skuName === skuFilter;
    
    // Enhanced channel filter logic
    let matchesChannel = true;
    if (channelFilter === 'all') {
      matchesChannel = true;
    } else if (channelFilter === 'all_d2c') {
      matchesChannel = isD2CChannel(scenario.channel);
    } else if (channelFilter === 'all_b2b') {
      matchesChannel = isB2BChannel(scenario.channel);
    } else {
      matchesChannel = scenario.channel === channelFilter;
    }
    
    const matchesCountry = countryFilter === 'all' || scenario.countryCode === countryFilter;
    
    return matchesSearch && matchesSku && matchesChannel && matchesCountry;
  });

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">SKU Financial Entry</h1>
        <p className="text-sm sm:text-base text-gray-600">Create and manage SKU financial scenarios with detailed cost analysis</p>
      </div>

      {/* Action Button and View Toggle */}
      <div className="mb-6 flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
        <Button 
          onClick={handleNewWorksheet}
          className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
        >
          <Calculator className="w-4 h-4 mr-2" />
          New SKU Worksheet
        </Button>

        {/* View Toggle & Export */}
        {scenarios.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="flex-1 sm:flex-initial gap-2"
            >
              <Grid3x3 className="h-4 w-4" />
              <span className="hidden sm:inline">Grid</span>
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="flex-1 sm:flex-initial gap-2"
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportToCSV}
              className="flex-1 sm:flex-initial gap-2"
              title="Export all scenarios to CSV"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      {scenarios.length > 0 && (
        <div className="mb-6 space-y-4">
          {/* Search */}
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search scenarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* SKU Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Filter by SKU</label>
              <select
                value={skuFilter}
                onChange={(e) => setSkuFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">All SKUs ({scenarios.length})</option>
                {uniqueSkus.map(sku => (
                  <option key={sku} value={sku}>
                    {sku} ({scenarios.filter(s => s.skuName === sku).length})
                  </option>
                ))}
              </select>
            </div>

            {/* Channel Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Filter by Channel</label>
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">All Channels ({scenarios.length})</option>
                {d2cCount > 0 && (
                  <option value="all_d2c" className="font-semibold">
                    📦 All D2C ({d2cCount})
                  </option>
                )}
                {b2bCount > 0 && (
                  <option value="all_b2b" className="font-semibold">
                    🏢 All B2B ({b2bCount})
                  </option>
                )}
                {d2cCount > 0 && <option disabled>──────────</option>}
                {uniqueChannels.filter(ch => isD2CChannel(ch)).map(channel => (
                  <option key={channel} value={channel} className="pl-4">
                    &nbsp;&nbsp;{channel} ({scenarios.filter(s => s.channel === channel).length})
                  </option>
                ))}
                {b2bCount > 0 && d2cCount > 0 && <option disabled>──────────</option>}
                {uniqueChannels.filter(ch => isB2BChannel(ch)).map(channel => (
                  <option key={channel} value={channel} className="pl-4">
                    &nbsp;&nbsp;{channel} ({scenarios.filter(s => s.channel === channel).length})
                  </option>
                ))}
                {uniqueChannels.filter(ch => !isD2CChannel(ch) && !isB2BChannel(ch)).length > 0 && (
                  <option disabled>──────────</option>
                )}
                {uniqueChannels.filter(ch => !isD2CChannel(ch) && !isB2BChannel(ch)).map(channel => (
                  <option key={channel} value={channel}>
                    {channel} ({scenarios.filter(s => s.channel === channel).length})
                  </option>
                ))}
              </select>
            </div>

            {/* Country Filter */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-600">Filter by Country</label>
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">All Countries ({scenarios.length})</option>
                {uniqueCountries.map(country => (
                  <option key={country} value={country}>
                    {country} ({scenarios.filter(s => s.countryCode === country).length})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filters Display */}
          {(skuFilter !== 'all' || channelFilter !== 'all' || countryFilter !== 'all') && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-600 font-medium">Active filters:</span>
              {skuFilter !== 'all' && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full flex items-center gap-1">
                  SKU: {skuFilter}
                  <button
                    onClick={() => setSkuFilter('all')}
                    className="hover:bg-blue-200 rounded-full p-0.5"
                    title="Clear filter"
                  >
                    ×
                  </button>
                </span>
              )}
              {channelFilter !== 'all' && (
                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full flex items-center gap-1">
                  Channel: {channelFilter === 'all_d2c' ? '📦 All D2C' : channelFilter === 'all_b2b' ? '🏢 All B2B' : channelFilter}
                  <button
                    onClick={() => setChannelFilter('all')}
                    className="hover:bg-green-200 rounded-full p-0.5"
                    title="Clear filter"
                  >
                    ×
                  </button>
                </span>
              )}
              {countryFilter !== 'all' && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full flex items-center gap-1">
                  Country: {countryFilter}
                  <button
                    onClick={() => setCountryFilter('all')}
                    className="hover:bg-purple-200 rounded-full p-0.5"
                    title="Clear filter"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setSkuFilter('all');
                  setChannelFilter('all');
                  setCountryFilter('all');
                }}
                className="px-2 py-1 text-gray-600 hover:text-gray-900 underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">Loading scenarios...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && scenarios.length === 0 && (
        <Card className="mt-8">
          <CardContent className="py-12 text-center">
            <Calculator className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No scenarios yet</h3>
            <p className="text-gray-500 mb-6">Get started by creating your first SKU financial scenario</p>
            <Button 
              onClick={handleNewWorksheet}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Calculator className="w-4 h-4 mr-2" />
              Create First Scenario
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Scenarios Display */}
      {!isLoading && filteredScenarios.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Saved Scenarios ({filteredScenarios.length})
          </h2>

          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredScenarios.map((scenario) => (
                <Card key={scenario.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle 
                      className="text-sm sm:text-base leading-tight truncate" 
                      title={scenario.scenarioName}
                    >
                      {scenario.scenarioName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 text-xs sm:text-sm mb-4">
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-600 flex-shrink-0">SKU:</span>
                        <span className="font-semibold text-gray-900 break-all text-right">{scenario.skuName}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-600 flex-shrink-0">Channel:</span>
                        <span className="font-medium text-gray-800 break-words text-right">{scenario.channel}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-600 flex-shrink-0">Country:</span>
                        <span className="font-medium text-gray-800">{scenario.countryCode}</span>
                      </div>
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-600 flex-shrink-0">ASP:</span>
                        <span className="font-semibold text-green-600">${parseFloat(scenario.asp).toFixed(2)}</span>
                      </div>
                      {scenario.grossProfit && (
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-600 flex-shrink-0">GP:</span>
                          <span className={`font-semibold ${
                            parseFloat(scenario.grossProfit) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>${parseFloat(scenario.grossProfit).toFixed(2)}</span>
                        </div>
                      )}
                      {scenario.grossMarginPercent && (
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-600 flex-shrink-0">GP %:</span>
                          <span className={`font-semibold ${
                            parseFloat(scenario.grossMarginPercent) <= 0 ? 'text-red-600' : 
                            parseFloat(scenario.grossMarginPercent) <= 10 ? 'text-yellow-600' : 
                            'text-green-600'
                          }`}>{parseFloat(scenario.grossMarginPercent).toFixed(2)}%</span>
                        </div>
                      )}
                      {scenario.description && (
                        <div className="mt-2 pt-2 border-t">
                          <p className="text-xs text-gray-500 italic line-clamp-2 break-words">{scenario.description}</p>
                        </div>
                      )}
                      <div className="mt-2 pt-2 border-t text-xs text-gray-400">
                        Updated: {new Date(scenario.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleEdit(scenario.id)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs sm:text-sm"
                        size="sm"
                      >
                        <Edit className="w-3 h-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDuplicateClick(scenario.id, scenario.scenarioName, scenario.description)}
                        variant="outline"
                        className="border-green-300 text-green-600 hover:bg-green-50"
                        size="sm"
                        title="Duplicate scenario"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteClick(scenario.id, scenario.scenarioName)}
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        size="sm"
                        title="Delete scenario"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <div className="bg-white border rounded-lg overflow-hidden">
              {/* Header - Hidden on mobile */}
              <div className="hidden md:grid md:grid-cols-12 gap-2 px-4 py-3 bg-gray-50 border-b text-xs font-semibold text-gray-600">
                <div className="col-span-3">Scenario Name</div>
                <div className="col-span-2">SKU</div>
                <div className="col-span-2">Channel</div>
                <div className="col-span-1 text-right">ASP</div>
                <div className="col-span-1 text-right">GP</div>
                <div className="col-span-1 text-right">GP%</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {/* List Items */}
              <div className="divide-y">
                {filteredScenarios.map((scenario) => (
                  <div 
                    key={scenario.id} 
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-3 hover:bg-gray-50 transition-colors items-center text-sm"
                  >
                    {/* Mobile layout */}
                    <div className="col-span-1 md:col-span-3">
                      <div 
                        className="font-medium text-gray-900 truncate cursor-help" 
                        title={scenario.scenarioName}
                      >
                        {scenario.scenarioName.length > 40 
                          ? scenario.scenarioName.substring(0, 40) + '...' 
                          : scenario.scenarioName}
                      </div>
                      <div className="md:hidden text-xs text-gray-500 mt-1">
                        {scenario.skuName} • {abbreviateChannel(scenario.channel)}
                      </div>
                    </div>

                    {/* Desktop columns */}
                    <div className="hidden md:block md:col-span-2 text-gray-700">
                      {scenario.skuName}
                    </div>

                    <div className="hidden md:block md:col-span-2">
                      <span 
                        className="text-gray-700 cursor-help" 
                        title={scenario.channel}
                      >
                        {abbreviateChannel(scenario.channel)}
                      </span>
                    </div>

                    <div className="hidden md:block md:col-span-1 text-right text-green-600 font-medium">
                      ${parseFloat(scenario.asp).toFixed(2)}
                    </div>

                    <div className={`hidden md:block md:col-span-1 text-right font-medium ${
                      scenario.grossProfit && parseFloat(scenario.grossProfit) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {scenario.grossProfit ? `$${parseFloat(scenario.grossProfit).toFixed(2)}` : '-'}
                    </div>

                    <div className={`hidden md:block md:col-span-1 text-right font-medium ${
                      !scenario.grossMarginPercent ? 'text-gray-400' :
                      parseFloat(scenario.grossMarginPercent) <= 0 ? 'text-red-600' : 
                      parseFloat(scenario.grossMarginPercent) <= 10 ? 'text-yellow-600' : 
                      'text-green-600'
                    }`}>
                      {scenario.grossMarginPercent ? `${parseFloat(scenario.grossMarginPercent).toFixed(2)}%` : '-'}
                    </div>

                    {/* Mobile stats row */}
                    <div className="md:hidden flex gap-4 text-xs mt-2">
                      <div>
                        <span className="text-gray-500">ASP: </span>
                        <span className="text-green-600 font-medium">${parseFloat(scenario.asp).toFixed(2)}</span>
                      </div>
                      {scenario.grossProfit && (
                        <div>
                          <span className="text-gray-500">GP: </span>
                          <span className={`font-medium ${
                            parseFloat(scenario.grossProfit) >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>${parseFloat(scenario.grossProfit).toFixed(2)}</span>
                        </div>
                      )}
                      {scenario.grossMarginPercent && (
                        <div>
                          <span className="text-gray-500">GP%: </span>
                          <span className={`font-medium ${
                            parseFloat(scenario.grossMarginPercent) <= 0 ? 'text-red-600' : 
                            parseFloat(scenario.grossMarginPercent) <= 10 ? 'text-yellow-600' : 
                            'text-green-600'
                          }`}>{parseFloat(scenario.grossMarginPercent).toFixed(2)}%</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="col-span-1 md:col-span-2 flex gap-2 justify-end mt-3 md:mt-0">
                      <Button
                        onClick={() => handleEdit(scenario.id)}
                        className="bg-blue-600 hover:bg-blue-700 flex-1 md:flex-initial"
                        size="sm"
                      >
                        <Edit className="w-3 h-3 md:mr-1" />
                        <span className="hidden md:inline">Edit</span>
                      </Button>
                      <Button
                        onClick={() => handleDuplicateClick(scenario.id, scenario.scenarioName, scenario.description)}
                        variant="outline"
                        className="border-green-300 text-green-600 hover:bg-green-50"
                        size="sm"
                        title="Duplicate scenario"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                      <Button
                        onClick={() => handleDeleteClick(scenario.id, scenario.scenarioName)}
                        variant="outline"
                        className="border-red-300 text-red-600 hover:bg-red-50"
                        size="sm"
                        title="Delete scenario"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Search Results */}
      {!isLoading && scenarios.length > 0 && filteredScenarios.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No scenarios match your search</p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.show} onOpenChange={(show) => setDeleteConfirm({...deleteConfirm, show})}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Scenario</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteConfirm.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              onClick={() => setDeleteConfirm({ show: false, id: '', name: '' })}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Duplicate Scenario Dialog */}
      <Dialog open={duplicateDialog.show} onOpenChange={(show) => setDuplicateDialog({...duplicateDialog, show})}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Duplicate Scenario</DialogTitle>
            <DialogDescription>
              Create a copy of "{duplicateDialog.originalName}". Please provide a unique name and description for the new scenario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="new-scenario-name">Scenario Name *</Label>
              <Input
                id="new-scenario-name"
                value={newScenarioName}
                onChange={(e) => setNewScenarioName(e.target.value)}
                placeholder="Enter new scenario name..."
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-scenario-description">Description</Label>
              <textarea
                id="new-scenario-description"
                value={newScenarioDescription}
                onChange={(e) => setNewScenarioDescription(e.target.value)}
                placeholder="Enter scenario description..."
                className="w-full min-h-[100px] px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                rows={4}
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button
                onClick={() => {
                  setDuplicateDialog({ show: false, id: '', originalName: '', originalDescription: '' });
                  setNewScenarioName('');
                  setNewScenarioDescription('');
                }}
                variant="outline"
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDuplicateConfirm}
                className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
              >
                <Copy className="w-4 h-4 mr-2" />
                Duplicate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
