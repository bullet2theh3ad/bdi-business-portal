'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingDown, Calendar, AlertCircle, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function CashFlowAnalysisPage() {
  const router = useRouter();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <DollarSign className="h-8 w-8 text-green-600" />
          Cash Flow Analysis
        </h1>
        <p className="text-gray-600 mt-2">
          13-week rolling cash flow projections with NRE, inventory, and operating expenses
        </p>
      </div>

      {/* Setup Required Banner */}
      <Card className="mb-6 border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">Setup Required</h3>
              <p className="text-sm text-blue-800 mb-4">
                Before you can view cash flow analysis, please complete the following setup steps:
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                      1
                    </div>
                    <div>
                      <div className="font-medium">Configure Inventory Payments</div>
                      <div className="text-sm text-gray-600">Set up PO payment schedules</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push('/admin/inventory-analysis/inventory-payments')}
                  >
                    Go to Setup <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
                      2
                    </div>
                    <div>
                      <div className="font-medium">Assign GL Codes</div>
                      <div className="text-sm text-gray-600">Map QuickBooks GL codes to categories</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push('/admin/inventory-analysis/gl-code-assignment')}
                  >
                    Go to Setup <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 bg-white rounded-lg opacity-50">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-semibold">
                      3
                    </div>
                    <div>
                      <div className="font-medium">View Cash Flow Dashboard</div>
                      <div className="text-sm text-gray-600">Available after completing steps 1 & 2</div>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" disabled>
                    Coming Soon
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview/Mockup of what's coming */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-600" />
              Total Outflows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-400">$XXX,XXX</div>
            <p className="text-sm text-gray-500 mt-2">Next 13 weeks</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Peak Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-400">$XX,XXX</div>
            <p className="text-sm text-gray-500 mt-2">Highest burn week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Avg Weekly
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-400">$X,XXX</div>
            <p className="text-sm text-gray-500 mt-2">Average per week</p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Preview */}
      <Card>
        <CardHeader>
          <CardTitle>13-Week Cash Flow Timeline (Preview)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <Calendar className="h-24 w-24 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-600 font-medium">Horizontal Stacked Timeline</p>
            <p className="text-sm text-gray-500 mt-2">
              Weekly breakdown of NRE, Inventory, and OpEx payments
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Available once payment schedules and GL codes are configured
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Features List */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Planned Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-green-500 mt-2"></div>
              <div>
                <div className="font-medium">13-Week Rolling View</div>
                <div className="text-sm text-gray-600">Horizontal stacked visualization by week</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-green-500 mt-2"></div>
              <div>
                <div className="font-medium">Multi-Stream Cash Flows</div>
                <div className="text-sm text-gray-600">NRE, Inventory, and Operating Expenses</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-green-500 mt-2"></div>
              <div>
                <div className="font-medium">Color-Coded Burn Levels</div>
                <div className="text-sm text-gray-600">Visual indicators for high-spend weeks</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-green-500 mt-2"></div>
              <div>
                <div className="font-medium">Export & Reporting</div>
                <div className="text-sm text-gray-600">CSV export for CFO review</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-yellow-500 mt-2"></div>
              <div>
                <div className="font-medium">Scenario Planning</div>
                <div className="text-sm text-gray-600">What-if analysis for future payments</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 rounded-full bg-yellow-500 mt-2"></div>
              <div>
                <div className="font-medium">Cash Runway Calculator</div>
                <div className="text-sm text-gray-600">Projected runway based on current burn</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

