'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, Construction } from 'lucide-react';
import Link from 'next/link';

export default function RMAAnalyticsPage() {
  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/warehouse-wip/dashboard">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">RMA Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Comprehensive RMA inventory and return management analytics
          </p>
        </div>
      </div>

      {/* Coming Soon Card */}
      <Card className="border-2 border-dashed">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Construction className="h-8 w-8 text-orange-500" />
            <div>
              <CardTitle>RMA Analytics - Coming Soon</CardTitle>
              <CardDescription>
                This section will display comprehensive RMA data when available in the Excel import
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted p-4">
            <h3 className="font-semibold mb-3">Planned Features:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-orange-500 flex-shrink-0" />
                <span>
                  <strong>RMA Inventory Overview:</strong> Current RMA units by SKU, source, and status
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-orange-500 flex-shrink-0" />
                <span>
                  <strong>Return Metrics:</strong> Average return time, top return reasons, failure rates
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-orange-500 flex-shrink-0" />
                <span>
                  <strong>Aging Analysis:</strong> How long RMA units have been in the system
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-orange-500 flex-shrink-0" />
                <span>
                  <strong>Source Breakdown:</strong> RMA rates by customer/channel (Amazon, Target, etc.)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 text-orange-500 flex-shrink-0" />
                <span>
                  <strong>Disposition Tracking:</strong> What happens to RMA units (repair, scrap, restock)
                </span>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              💡 This page will automatically populate with data once RMA-specific columns are included 
              in the weekly Excel import. The WIP Flow system already tracks RMA stage and aging.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Preview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current RMA Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">--</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting data</p>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg. RMA Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">--</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting data</p>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Return Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-muted-foreground">--</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting data</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

