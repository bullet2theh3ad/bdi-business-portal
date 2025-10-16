'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator, FolderOpen } from 'lucide-react';

export default function SKUFinancialEntryPage() {
  const router = useRouter();

  const handleNewWorksheet = () => {
    router.push('/admin/business-analysis/sku-financial-entry/worksheet');
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
          onClick={handleNewWorksheet}
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
              onClick={handleNewWorksheet}
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
    </div>
  );
}
