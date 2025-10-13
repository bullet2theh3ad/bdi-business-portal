'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RMAAnalyticsPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">RMA Analytics</h1>
      <Card>
        <CardHeader>
          <CardTitle>RMA Analytics Dashboard</CardTitle>
          <CardDescription>Coming Soon</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            RMA (Return Merchandise Authorization) analytics and reporting will be available here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
