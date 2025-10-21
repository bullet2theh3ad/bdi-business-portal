'use client';

import React, { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import WarehouseSummaryContent from '@/components/WarehouseSummaryContent';

function WarehouseAnalysisContent() {
  return (
    <div className="container mx-auto p-2 sm:p-4 space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <SemanticBDIIcon semantic="chart" size={24} className="sm:w-8 sm:h-8" />
            <span>Warehouse Analysis</span>
          </h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-xs sm:text-sm">
            Complete inventory overview across all warehouses with advanced analytics
          </p>
        </div>
      </div>

      {/* Main Content - Warehouse Summary */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <SemanticBDIIcon semantic="inventory_items" size={16} className="sm:w-5 sm:h-5" />
            <span>Warehouse Inventory Summary</span>
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
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

