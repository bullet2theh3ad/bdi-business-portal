'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Label, LabelList } from 'recharts';
import { Warehouse, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

interface SkuDetail {
  sku: string;
  units: number;
  value: number;
}

interface AgingBucket {
  bucket: string;
  days: string;
  totalUnits: number;
  totalValue: number;
  skuCount: number;
  skuDetails: SkuDetail[];
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
  const [expandedBuckets, setExpandedBuckets] = useState<Set<string>>(new Set());

  const toggleBucket = (bucketName: string) => {
    setExpandedBuckets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bucketName)) {
        newSet.delete(bucketName);
      } else {
        newSet.add(bucketName);
      }
      return newSet;
    });
  };

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
            <button
              onClick={() => {
                // Expand all or collapse all
                if (expandedBuckets.size === buckets.length) {
                  setExpandedBuckets(new Set());
                } else {
                  setExpandedBuckets(new Set(buckets.map(b => b.bucket)));
                }
              }}
              className="ml-2 text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1"
            >
              {expandedBuckets.size === buckets.length ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  <span className="text-xs">Collapse All</span>
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  <span className="text-xs">Expand All</span>
                </>
              )}
            </button>
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
        {/* Axis Labels - Prominent and Clear */}
        <div className="flex items-center justify-between mb-2 px-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-md">
              ← Inventory Value ($)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-md">
              Aging (Days) →
            </span>
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData} margin={{ top: 20, right: 40, left: 60, bottom: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fill: '#374151', fontSize: 14, fontWeight: 600 }}
              axisLine={{ stroke: '#9ca3af', strokeWidth: 2 }}
              tickLine={{ stroke: '#9ca3af' }}
              height={60}
            />
            <YAxis
              tick={{ fill: '#374151', fontSize: 13, fontWeight: 500 }}
              axisLine={{ stroke: '#9ca3af', strokeWidth: 2 }}
              tickLine={{ stroke: '#9ca3af' }}
              width={80}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
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

        {/* Detailed SKU Breakdown - Expandable by Bucket */}
        <div className="mt-6 pt-4 border-t">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Aging Breakdown by Bucket</h3>
          <div className="grid grid-cols-4 gap-3">
            {buckets.map((bucket, index) => {
              const isExpanded = expandedBuckets.has(bucket.bucket);
              const hasSkus = bucket.skuDetails && bucket.skuDetails.length > 0;
              
              return (
                <div 
                  key={bucket.bucket} 
                  className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                  style={{ borderColor: colors.gradient[index], borderWidth: 2 }}
                >
                  {/* Bucket Header - Clickable to expand/collapse */}
                  <div 
                    className={`p-3 cursor-pointer ${hasSkus ? 'hover:bg-gray-50' : ''}`}
                    onClick={() => hasSkus && toggleBucket(bucket.bucket)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-600">{bucket.days} days</span>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: colors.gradient[index] }}
                        ></div>
                        {hasSkus && (
                          isExpanded ? 
                            <ChevronUp className="h-4 w-4 text-gray-500" /> : 
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-600">Value:</span>
                        <span className="text-sm font-bold" style={{ color: colors.gradient[index] }}>
                          {formatCurrency(bucket.totalValue)}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-600">Units:</span>
                        <span className="text-sm font-semibold text-gray-700">
                          {formatNumber(bucket.totalUnits)}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-600">SKUs:</span>
                        <span className="text-sm font-semibold text-gray-700">
                          {bucket.skuCount}
                        </span>
                      </div>
                      {bucket.totalUnits > 0 && (
                        <div className="pt-1 mt-1 border-t border-gray-200">
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs text-gray-500">Avg/unit:</span>
                            <span className="text-xs font-medium text-gray-600">
                              {formatCurrency(bucket.totalValue / bucket.totalUnits)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Expanded SKU Details */}
                  {isExpanded && hasSkus && (
                    <div className="border-t px-2 py-2 bg-gray-50 max-h-64 overflow-y-auto">
                      <div className="text-xs font-semibold text-gray-700 mb-1 px-1">SKU Details:</div>
                      <div className="space-y-1">
                        {bucket.skuDetails.map((sku, skuIndex) => (
                          <div 
                            key={skuIndex}
                            className="flex justify-between items-center bg-white rounded px-2 py-1 text-xs hover:bg-gray-100"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-800">{sku.sku}</span>
                              <span className="text-gray-500">{formatNumber(sku.units)} units</span>
                            </div>
                            <span className="font-semibold" style={{ color: colors.gradient[index] }}>
                              {formatCurrency(sku.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

