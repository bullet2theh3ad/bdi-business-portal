'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Label, LabelList } from 'recharts';
import { Warehouse, TrendingUp } from 'lucide-react';

interface AgingBucket {
  bucket: string;
  days: string;
  totalUnits: number;
  totalValue: number;
  skuCount: number;
}

interface WarehouseAgingChartProps {
  title: string;
  warehouse: 'EMG' | 'CATV';
  buckets: AgingBucket[];
  totalValue: number;
  totalUnits: number;
  lastUpdated: string | null;
}

export default function WarehouseAgingChart({
  title,
  warehouse,
  buckets,
  totalValue,
  totalUnits,
  lastUpdated,
}: WarehouseAgingChartProps) {
  // Color scheme by warehouse
  const colors = warehouse === 'EMG' 
    ? {
        primary: '#3B82F6',    // Blue
        gradient: ['#60A5FA', '#3B82F6', '#2563EB', '#1E40AF'], // Light to dark blue
        background: 'from-blue-50 to-blue-100',
        textColor: 'text-blue-800',
      }
    : {
        primary: '#10B981',    // Green
        gradient: ['#6EE7B7', '#34D399', '#10B981', '#059669'], // Light to dark green
        background: 'from-green-50 to-green-100',
        textColor: 'text-green-800',
      };

  // Prepare chart data
  const chartData = buckets.map((bucket, index) => ({
    name: bucket.days,
    value: bucket.totalValue,
    units: bucket.totalUnits,
    skus: bucket.skuCount,
    fill: colors.gradient[index],
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  // Custom label to show value ON the bar
  const renderCustomLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    if (value === 0) return null;
    
    return (
      <text
        x={x + width / 2}
        y={y + height / 2}
        fill="white"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="14"
        fontWeight="bold"
      >
        {formatCurrency(value)}
      </text>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className={`bg-gradient-to-r ${colors.background}`}>
        <div className="flex items-center justify-between">
          <CardTitle className={`flex items-center gap-2 ${colors.textColor}`}>
            <Warehouse className="h-5 w-5" />
            {title}
          </CardTitle>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <TrendingUp className={`h-4 w-4 ${colors.textColor}`} />
              <span className={`text-sm font-semibold ${colors.textColor}`}>
                Total: {formatCurrency(totalValue)}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatNumber(totalUnits)} units
              {lastUpdated && ` • Updated: ${new Date(lastUpdated).toLocaleDateString()}`}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#6b7280', fontSize: 14, fontWeight: 500 }}
              axisLine={{ stroke: '#d1d5db' }}
            >
              <Label
                value="Aging (Days)"
                position="insideBottom"
                offset={-5}
                style={{ fill: '#6b7280', fontSize: 14, fontWeight: 600 }}
              />
            </XAxis>
            <YAxis
              tick={{ fill: '#6b7280', fontSize: 12 }}
              axisLine={{ stroke: '#d1d5db' }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            >
              <Label
                value="Inventory Value ($)"
                angle={-90}
                position="insideLeft"
                style={{ fill: '#6b7280', fontSize: 14, fontWeight: 600 }}
              />
            </YAxis>
            <Tooltip
              cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                      <p className="font-semibold text-gray-900 mb-1">
                        Aging: {data.name} days
                      </p>
                      <div className="space-y-1 text-sm">
                        <p className="text-gray-700">
                          <span className="font-medium">Value:</span> {formatCurrency(data.value)}
                        </p>
                        <p className="text-gray-700">
                          <span className="font-medium">Units:</span> {formatNumber(data.units)}
                        </p>
                        <p className="text-gray-700">
                          <span className="font-medium">SKUs:</span> {data.skus}
                        </p>
                        {data.units > 0 && (
                          <p className="text-gray-600 text-xs border-t pt-1 mt-1">
                            Avg: {formatCurrency(data.value / data.units)}/unit
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
              <LabelList content={renderCustomLabel} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Summary Stats Below Chart */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-4 border-t">
          {buckets.map((bucket, index) => (
            <div key={bucket.bucket} className="text-center">
              <div className={`text-xl font-bold mb-1`} style={{ color: colors.gradient[index] }}>
                {formatCurrency(bucket.totalValue)}
              </div>
              <div className="text-xs text-muted-foreground mb-1">{bucket.days} days</div>
              <div className="text-xs text-gray-600">
                {formatNumber(bucket.totalUnits)} units • {bucket.skuCount} SKUs
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

