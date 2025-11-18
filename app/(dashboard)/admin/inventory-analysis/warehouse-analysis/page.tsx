'use client';

import React, { Suspense, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { Download } from 'lucide-react';
import WarehouseSummaryContent from '@/components/WarehouseSummaryContent';

function WarehouseAnalysisContent() {
  const [exporting, setExporting] = useState(false);

  const handleExportCSV = async () => {
    try {
      setExporting(true);
      
      // Fetch warehouse summary data
      const response = await fetch('/api/inventory/warehouse-summary');
      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error('Failed to fetch warehouse data');
      }

      const data = result.data;
      
      // Create separate rows for each warehouse location
      const inventoryRows: Array<{
        sku: string;
        description: string;
        location: string;
        quantity: number;
        value: number;
      }> = [];

      // Process EMG Warehouse data
      if (data.emg?.allSkus) {
        data.emg.allSkus.forEach((item: any) => {
          const quantity = item.qtyOnHand || 0;
          if (quantity > 0) {
            inventoryRows.push({
              sku: item.bdiSku || item.model,
              description: item.description || '',
              location: 'EMG Warehouse',
              quantity: quantity,
              value: item.totalValue || 0
            });
          }
        });
      }

      // Process CATV Warehouse data (WIP and RMA separately)
      if (data.catv?.allSkus) {
        data.catv.allSkus.forEach((item: any) => {
          const sku = item.bdiSku || item.sku;
          const wipUnits = item.stages?.WIP || 0;
          const rmaUnits = item.stages?.RMA || 0;
          
          // Add WIP units as regular CATV Warehouse
          if (wipUnits > 0) {
            inventoryRows.push({
              sku: sku,
              description: '',
              location: 'CATV Warehouse',
              quantity: wipUnits,
              value: wipUnits * (item.standardCost || 0)
            });
          }
          
          // Add RMA units separately
          if (rmaUnits > 0) {
            inventoryRows.push({
              sku: sku,
              description: '',
              location: 'CATV Warehouse (RMA)',
              quantity: rmaUnits,
              value: rmaUnits * (item.standardCost || 0)
            });
          }
        });
      }

      // Process Amazon FBA data
      if (data.amazon?.allSkus) {
        data.amazon.allSkus.forEach((item: any) => {
          // Use fulfillable quantity (available to sell) as the primary quantity
          const quantity = item.fulfillableQuantity || 0;
          if (quantity > 0) {
            inventoryRows.push({
              sku: item.sku,
              description: '',
              location: 'Amazon FBA',
              quantity: quantity,
              value: item.totalValue || 0
            });
          }
        });
      }

      // Sort by SKU then by location
      inventoryRows.sort((a, b) => {
        const skuCompare = a.sku.localeCompare(b.sku);
        if (skuCompare !== 0) return skuCompare;
        return a.location.localeCompare(b.location);
      });

      // Generate CSV content
      const headers = ['SKU', 'Description', 'Warehouse Location', 'Quantity', 'Value (USD)'];
      const csvRows = [headers.join(',')];

      inventoryRows.forEach(item => {
        const row = [
          `"${item.sku}"`,
          `"${item.description.replace(/"/g, '""')}"`,
          `"${item.location}"`,
          item.quantity,
          item.value.toFixed(2)
        ];
        csvRows.push(row.join(','));
      });

      // Add summary totals
      csvRows.push('');
      csvRows.push('Summary');
      csvRows.push(`Total Rows,${inventoryRows.length}`);
      csvRows.push(`Total Units,${inventoryRows.reduce((sum, item) => sum + item.quantity, 0)}`);
      csvRows.push(`Total Value,${inventoryRows.reduce((sum, item) => sum + item.value, 0).toFixed(2)}`);
      
      // Count unique SKUs
      const uniqueSkus = new Set(inventoryRows.map(item => item.sku));
      csvRows.push(`Unique SKUs,${uniqueSkus.size}`);

      const csvContent = csvRows.join('\n');

      // Create and download CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `Consolidated_Warehouse_Report_${timestamp}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="container mx-auto p-2 sm:p-4 space-y-4 sm:space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <SemanticBDIIcon semantic="chart" size={24} className="sm:w-8 sm:h-8" />
            <span>Warehouse Analysis</span>
          </h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-xs sm:text-sm">
            Comprehensive inventory overview across all warehouses
          </p>
        </div>
        
        {/* Export CSV Button */}
        <Button 
          onClick={handleExportCSV}
          disabled={exporting}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Download className="mr-2 h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export Consolidated Warehouse Report (CSV)'}
        </Button>
      </div>

      {/* Main Content - Warehouse Summary */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <SemanticBDIIcon semantic="inventory_items" size={16} className="sm:w-5 sm:h-5" />
            <span>Warehouse Inventory Summary</span>
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Inventory data from BDI warehouse locations
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

