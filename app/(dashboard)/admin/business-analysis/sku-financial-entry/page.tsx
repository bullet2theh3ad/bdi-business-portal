'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calculator, FolderOpen, Edit, Trash2, Search, Copy } from 'lucide-react';
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
}

export default function SKUFinancialEntryPage() {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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

  const filteredScenarios = scenarios.filter(scenario =>
    scenario.scenarioName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    scenario.skuName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    scenario.channel.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container mx-auto p-4 sm:p-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">SKU Financial Entry</h1>
        <p className="text-sm sm:text-base text-gray-600">Create and manage SKU financial scenarios with detailed cost analysis</p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Button 
          onClick={handleNewWorksheet}
          className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
        >
          <Calculator className="w-4 h-4 mr-2" />
          New SKU Worksheet
        </Button>
        
        {/* Search */}
        {scenarios.length > 0 && (
          <div className="relative flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search scenarios..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        )}
      </div>

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

      {/* Scenarios Grid */}
      {!isLoading && filteredScenarios.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-800">
            Saved Scenarios ({filteredScenarios.length})
          </h2>
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
                        <span className="font-semibold text-blue-600">${parseFloat(scenario.grossProfit).toFixed(2)}</span>
                      </div>
                    )}
                    {scenario.grossMarginPercent && (
                      <div className="flex justify-between gap-2">
                        <span className="text-gray-600 flex-shrink-0">GP %:</span>
                        <span className="font-semibold text-purple-600">{parseFloat(scenario.grossMarginPercent).toFixed(1)}%</span>
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
