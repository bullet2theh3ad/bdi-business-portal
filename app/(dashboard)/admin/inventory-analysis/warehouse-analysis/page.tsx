'use client';

import React, { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import WarehouseSummaryContent from '@/components/WarehouseSummaryContent';

function WarehouseAnalysisContent() {
  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <SemanticBDIIcon semantic="chart" size={32} />
            Warehouse Analysis
          </h1>
          <p className="text-muted-foreground mt-2">
            Complete inventory overview across all warehouses with advanced analytics
          </p>
        </div>
      </div>

      {/* Main Content - Warehouse Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SemanticBDIIcon semantic="inventory_items" size={20} />
            Warehouse Inventory Summary
          </CardTitle>
          <CardDescription>
            Real-time inventory data from EMG and CATV warehouses
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WarehouseSummaryContent 
            emgData={null} 
            catvData={null}
            onClose={() => {}} // No-op since we're on a page, not a modal
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function WarehouseAnalysisPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Warehouse Analysis...</p>
        </div>
      </div>
    }>
      <WarehouseAnalysisContent />
    </Suspense>
  );
}

