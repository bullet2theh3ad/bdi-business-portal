'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Package,
  AlertTriangle,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6'];

export default function RMAAnalyticsPage() {
  const [importBatchId, setImportBatchId] = useState<string>('');

  // Fetch RMA data
  const { data: rmaData, isLoading } = useSWR(
    `/api/warehouse/wip/rma?${importBatchId ? `importBatchId=${importBatchId}` : ''}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  );

  const { data: importsData } = useSWR('/api/warehouse/wip/imports', fetcher);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  const totalRmaUnits = rmaData?.totalRmaUnits || 0;
  const bySku = rmaData?.bySku || [];
  const bySource = rmaData?.bySource || [];
  const byStage = rmaData?.byStage || [];
  const recentRmaUnits = rmaData?.recentRmaUnits || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">RMA Analytics</h1>
          <p className="text-gray-600 mt-1">Return Merchandise Authorization inventory tracking</p>
        </div>

        {/* Import Batch Filter */}
        {importsData?.imports && importsData.imports.length > 0 && (
          <div className="w-full sm:w-64">
            <Select value={importBatchId} onValueChange={setImportBatchId}>
              <SelectTrigger>
                <SelectValue placeholder="All Imports (Latest)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Imports (Latest)</SelectItem>
                {importsData.imports.map((imp: any) => (
                  <SelectItem key={imp.id} value={imp.id}>
                    {new Date(imp.completed_at).toLocaleDateString()} - {imp.file_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total RMA Units</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalRmaUnits.toLocaleString()}</div>
            <p className="text-xs text-gray-600 mt-1">Units flagged for RMA</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique SKUs</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bySku.length}</div>
            <p className="text-xs text-gray-600 mt-1">SKUs with RMA inventory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sources</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bySource.length}</div>
            <p className="text-xs text-gray-600 mt-1">Different sources</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RMA Units by SKU */}
        <Card>
          <CardHeader>
            <CardTitle>RMA Inventory by SKU</CardTitle>
            <CardDescription>Top SKUs with RMA units</CardDescription>
          </CardHeader>
          <CardContent>
            {bySku.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={bySku.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="sku" 
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    fontSize={12}
                  />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#ef4444" name="RMA Units" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                No RMA units found
              </div>
            )}
          </CardContent>
        </Card>

        {/* RMA Units by Stage */}
        <Card>
          <CardHeader>
            <CardTitle>RMA Units by Stage</CardTitle>
            <CardDescription>Distribution across workflow stages</CardDescription>
          </CardHeader>
          <CardContent>
            {byStage.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={byStage}
                    dataKey="count"
                    nameKey="stage"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry: any) => `${entry.stage}: ${entry.count}`}
                  >
                    {byStage.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                No RMA units found
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RMA Units by SKU Table */}
      <Card>
        <CardHeader>
          <CardTitle>RMA Inventory Levels by SKU</CardTitle>
          <CardDescription>Detailed breakdown of RMA units per SKU</CardDescription>
        </CardHeader>
        <CardContent>
          {bySku.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">SKU</th>
                    <th className="text-right py-3 px-4 font-semibold">RMA Units</th>
                    <th className="text-right py-3 px-4 font-semibold">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bySku.map((item: any, index: number) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{item.sku}</td>
                      <td className="text-right py-3 px-4">
                        <Badge variant="destructive">{item.count.toLocaleString()}</Badge>
                      </td>
                      <td className="text-right py-3 px-4 text-gray-600">
                        {((item.count / totalRmaUnits) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No RMA units found
            </div>
          )}
        </CardContent>
      </Card>

      {/* RMA Units by Source */}
      <Card>
        <CardHeader>
          <CardTitle>RMA Units by Source</CardTitle>
          <CardDescription>Where RMA units are coming from</CardDescription>
        </CardHeader>
        <CardContent>
          {bySource.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Source</th>
                    <th className="text-right py-3 px-4 font-semibold">RMA Units</th>
                    <th className="text-right py-3 px-4 font-semibold">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bySource.map((item: any, index: number) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">{item.source}</td>
                      <td className="text-right py-3 px-4">
                        <Badge variant="outline">{item.count.toLocaleString()}</Badge>
                      </td>
                      <td className="text-right py-3 px-4 text-gray-600">
                        {((item.count / totalRmaUnits) * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No RMA units found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent RMA Units */}
      <Card>
        <CardHeader>
          <CardTitle>Recent RMA Units</CardTitle>
          <CardDescription>Last 20 units flagged for RMA</CardDescription>
        </CardHeader>
        <CardContent>
          {recentRmaUnits.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Serial Number</th>
                    <th className="text-left py-3 px-4 font-semibold">Model</th>
                    <th className="text-left py-3 px-4 font-semibold">Source</th>
                    <th className="text-left py-3 px-4 font-semibold">Received Date</th>
                    <th className="text-left py-3 px-4 font-semibold">Stage</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRmaUnits.map((unit: any, index: number) => (
                    <tr key={index} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-xs">{unit.serialNumber}</td>
                      <td className="py-3 px-4 font-medium">{unit.modelNumber}</td>
                      <td className="py-3 px-4 text-gray-600">{unit.source}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {unit.receivedDate ? new Date(unit.receivedDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">{unit.stage}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No RMA units found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
