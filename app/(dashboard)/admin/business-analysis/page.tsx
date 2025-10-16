'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  DollarSign, 
  BarChart3, 
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Calendar,
  Database,
  Zap,
  Target,
  Activity
} from 'lucide-react';

export default function BusinessAnalysisPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const response = await fetch('/api/user');
        const data = await response.json();
        setUser(data);
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Business Analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <TrendingUp className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Business Analysis</h1>
            <p className="text-gray-600">Comprehensive business intelligence and forecasting</p>
          </div>
        </div>
      </div>

      {/* Welcome Card */}
      <Card className="mb-8 border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Welcome to Business Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            This is your central hub for advanced business intelligence, combining data from multiple sources 
            to provide actionable insights for strategic decision-making.
          </p>
          <div className="bg-white rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-gray-600">
              <strong>👤 Current User:</strong> {user?.name || 'Loading...'} ({user?.email || '...'})
            </p>
            <p className="text-sm text-gray-600 mt-1">
              <strong>🔐 Access Level:</strong> {user?.role || 'Loading...'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Planned Features Grid */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Target className="h-6 w-6 text-blue-600" />
          Planned Analysis Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Cash Flow Analysis */}
          <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <DollarSign className="h-5 w-5 text-green-600" />
                Cash Flow Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Real-time cash flow tracking and projections based on QuickBooks data, CPFR forecasts, and payment terms.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• 30/60/90 day cash projections</li>
                <li>• Accounts receivable aging</li>
                <li>• Payment collection forecasts</li>
                <li>• Working capital analysis</li>
              </ul>
              <div className="mt-4 pt-4 border-t">
                <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                  Coming Soon
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Sales Forecast Analysis */}
          <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <LineChartIcon className="h-5 w-5 text-blue-600" />
                Sales Forecast Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Advanced forecasting using CPFR data, historical sales, seasonality patterns, and market trends.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Forecast accuracy tracking</li>
                <li>• Variance analysis</li>
                <li>• SKU-level predictions</li>
                <li>• Customer demand patterns</li>
              </ul>
              <div className="mt-4 pt-4 border-t">
                <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                  Coming Soon
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Profitability Analysis */}
          <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-purple-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <PieChartIcon className="h-5 w-5 text-purple-600" />
                Profitability Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Deep-dive into margins, costs, and profitability by SKU, customer, and channel.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Gross margin by SKU</li>
                <li>• Customer profitability ranking</li>
                <li>• Channel performance comparison</li>
                <li>• Cost trend analysis</li>
              </ul>
              <div className="mt-4 pt-4 border-t">
                <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                  Coming Soon
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Intelligence */}
          <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-orange-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-orange-600" />
                Inventory Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Optimize inventory levels using demand forecasts, lead times, and carrying costs.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Safety stock calculations</li>
                <li>• Reorder point optimization</li>
                <li>• Stockout risk alerts</li>
                <li>• Inventory turnover analysis</li>
              </ul>
              <div className="mt-4 pt-4 border-t">
                <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                  Coming Soon
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Scenario Planning */}
          <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-red-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-red-600" />
                Scenario Planning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                What-if analysis for pricing changes, volume shifts, and cost variations.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Price sensitivity modeling</li>
                <li>• Volume impact projections</li>
                <li>• Cost change simulations</li>
                <li>• Revenue optimization</li>
              </ul>
              <div className="mt-4 pt-4 border-t">
                <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                  Coming Soon
                </span>
              </div>
            </CardContent>
          </Card>

          {/* KPI Dashboard */}
          <Card className="hover:shadow-lg transition-shadow border-t-4 border-t-indigo-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-indigo-600" />
                Executive KPI Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Real-time executive dashboard with key performance indicators across all business areas.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Revenue vs. forecast tracking</li>
                <li>• Cash position monitoring</li>
                <li>• Operational efficiency metrics</li>
                <li>• Customer satisfaction scores</li>
              </ul>
              <div className="mt-4 pt-4 border-t">
                <span className="inline-block px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                  Coming Soon
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Data Sources */}
      <Card className="border-l-4 border-l-indigo-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-600" />
            Integrated Data Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 mb-4">
            Business Analysis will pull data from multiple integrated systems:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="p-2 bg-green-100 rounded">
                <DollarSign className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">QuickBooks</p>
                <p className="text-xs text-gray-600">Financial data, invoices, payments, expenses</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="p-2 bg-blue-100 rounded">
                <LineChartIcon className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">CPFR Forecasts</p>
                <p className="text-xs text-gray-600">Demand forecasts, purchase orders, inventory plans</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="p-2 bg-purple-100 rounded">
                <BarChart3 className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">Amazon Financial Events</p>
                <p className="text-xs text-gray-600">Sales, refunds, fees, advertising spend</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="p-2 bg-orange-100 rounded">
                <Database className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">Warehouse & WIP</p>
                <p className="text-xs text-gray-600">Inventory levels, WIP tracking, fulfillment data</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer Note */}
      <div className="mt-8 text-center text-sm text-gray-500">
        <p>🔒 This is a restricted feature. Access is limited to authorized users only.</p>
        <p className="mt-1">Features will be rolled out incrementally in "baby steps" for testing and refinement.</p>
      </div>
    </div>
  );
}

