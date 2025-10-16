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
  Activity,
  Plus,
  Trash2
} from 'lucide-react';

// SKU Worksheet Data Structure
interface SKUWorksheetData {
  // Section 1: SKU Selection & Pricing
  skuName: string;
  asp: number;
  resellerMargin: number; // percentage
  marketingReserve: number; // percentage
  fulfillmentCosts: number;
  
  // Section 4: Product Costs
  productCostFOB: number;
  swLicenseFee: number;
  otherProductCosts: { label: string; value: number }[];
  
  // Section 6: All CoGS Breakdown
  returnsFreight: number;
  returnsHandling: number;
  doaChannelCredit: number;
  financingCost: number;
  ppsHandlingFee: number;
  inboundShippingCost: number;
  outboundShippingCost: number;
  greenfileMarketing: number;
  otherCoGS: { label: string; value: number }[];
}

export default function BusinessAnalysisPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showSKUWorksheet, setShowSKUWorksheet] = useState(false);
  const [availableSKUs, setAvailableSKUs] = useState<string[]>([]);
  const [isCustomSKU, setIsCustomSKU] = useState(false);
  
  // SKU Worksheet State
  const [worksheetData, setWorksheetData] = useState<SKUWorksheetData>({
    skuName: '',
    asp: 0,
    resellerMargin: 0,
    marketingReserve: 0,
    fulfillmentCosts: 0,
    productCostFOB: 0,
    swLicenseFee: 0,
    otherProductCosts: [],
    returnsFreight: 13.00,
    returnsHandling: 0.45,
    doaChannelCredit: 0,
    financingCost: 0,
    ppsHandlingFee: 0,
    inboundShippingCost: 0,
    outboundShippingCost: 0,
    greenfileMarketing: 0,
    otherCoGS: [],
  });

  // Calculated Values
  const calculateAllDeductions = () => {
    return (worksheetData.asp * worksheetData.resellerMargin / 100) + 
           (worksheetData.asp * worksheetData.marketingReserve / 100) + 
           worksheetData.fulfillmentCosts;
  };

  const calculateNetReceipts = () => {
    return worksheetData.asp - calculateAllDeductions();
  };

  const calculateTotalProductCosts = () => {
    const otherCosts = worksheetData.otherProductCosts.reduce((sum, item) => sum + item.value, 0);
    return worksheetData.productCostFOB + worksheetData.swLicenseFee + otherCosts;
  };

  const calculateRoyalty = () => {
    return calculateNetReceipts() * 0.05; // 5% of Net Receipts
  };

  const calculateTotalCoGS = () => {
    const baseCoGS = worksheetData.returnsFreight + worksheetData.returnsHandling + 
                     worksheetData.doaChannelCredit + worksheetData.financingCost + 
                     worksheetData.ppsHandlingFee + worksheetData.inboundShippingCost + 
                     worksheetData.outboundShippingCost + worksheetData.greenfileMarketing;
    const otherCoGS = worksheetData.otherCoGS.reduce((sum, item) => sum + item.value, 0);
    return baseCoGS + otherCoGS;
  };

  const calculateGrossProfit = () => {
    return calculateNetReceipts() - calculateTotalProductCosts() - calculateRoyalty() - calculateTotalCoGS();
  };

  const calculateGrossMargin = () => {
    const netReceipts = calculateNetReceipts();
    if (netReceipts === 0) return 0;
    return (calculateGrossProfit() / netReceipts) * 100;
  };

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

  // Fetch available SKUs
  useEffect(() => {
    async function fetchSKUs() {
      try {
        const response = await fetch('/api/admin/skus');
        if (response.ok) {
          const data = await response.json();
          console.log('SKU API Response:', data);
          
          // Handle different response formats
          let skuList = [];
          if (Array.isArray(data)) {
            skuList = data;
          } else if (data.skus && Array.isArray(data.skus)) {
            skuList = data.skus;
          } else if (data.data && Array.isArray(data.data)) {
            skuList = data.data;
          }
          
          const skuNames = skuList
            .map((sku: any) => sku.skuCode || sku.sku_code || sku.name || sku.sku_name)
            .filter(Boolean);
          
          console.log('Extracted SKU names:', skuNames);
          setAvailableSKUs(skuNames);
        }
      } catch (error) {
        console.error('Error fetching SKUs:', error);
      }
    }
    fetchSKUs();
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
          <Card 
            className="hover:shadow-lg transition-shadow border-t-4 border-t-orange-500 cursor-pointer"
            onClick={() => setShowInventoryModal(true)}
          >
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
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowInventoryModal(true);
                  }}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  Open Analysis
                </Button>
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

      {/* Inventory Intelligence Modal */}
      {showInventoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full h-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-orange-50 to-white">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Database className="h-7 w-7 text-orange-600" />
                  Inventory Intelligence
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Forecast demand vs. shipment timeline analysis
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowSKUWorksheet(true)}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  SKU Worksheet
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInventoryModal(false)}
                  className="hover:bg-orange-100"
                >
                  <span className="text-2xl">&times;</span>
                </Button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  📊 Demand Forecast vs. Shipment Timeline
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Visualize "AS-IS" demand forecasts against planned shipment dates. Adjust parameters to see "TO-BE" scenarios.
                </p>
              </div>

              {/* Placeholder for Timeline Graph */}
              <div className="bg-gradient-to-br from-orange-50 to-white rounded-lg border-2 border-orange-200 p-8 mb-6">
                <div className="text-center">
                  <BarChart3 className="h-16 w-16 text-orange-400 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-gray-700 mb-2">
                    Forecast Timeline Graph (Coming Soon)
                  </h4>
                  <p className="text-sm text-gray-600 max-w-2xl mx-auto mb-4">
                    This will display a stacked bar chart showing:
                  </p>
                  <ul className="text-sm text-gray-600 text-left max-w-xl mx-auto space-y-2">
                    <li>• <strong>Demand Forecast</strong> by SKU over time (from CPFR data)</li>
                    <li>• <strong>Shipment Dates</strong> overlaid on the timeline</li>
                    <li>• <strong>Zero-lag indicators</strong> for shipments without confirmed dates</li>
                    <li>• <strong>Interactive filtering</strong> by SKU, date range, and forecast scenario</li>
                  </ul>
                  <div className="mt-6 p-4 bg-white rounded border border-orange-300">
                    <p className="text-xs text-gray-500">
                      💡 <strong>Next Implementation Step:</strong> Connect to CPFR forecast API and shipment tracking data
                    </p>
                  </div>
                </div>
              </div>

              {/* Analysis Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">AS-IS Scenario</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-gray-600">Current forecast data with existing shipment plans</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">TO-BE Scenario</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-gray-600">Adjusted parameters and optimized shipment timing</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-purple-500">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Impact Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-gray-600">Profitability and cost implications of changes</p>
                  </CardContent>
                </Card>
              </div>

              {/* Key Insights Section */}
              <Card className="bg-gradient-to-r from-blue-50 to-white">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-blue-600" />
                    Key Insights & Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3 p-3 bg-white rounded border border-blue-200">
                      <div className="p-2 bg-blue-100 rounded">
                        <Activity className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900">Safety Stock Analysis</p>
                        <p className="text-xs text-gray-600">Calculate optimal safety stock levels based on demand variability</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white rounded border border-green-200">
                      <div className="p-2 bg-green-100 rounded">
                        <Calendar className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900">Reorder Point Optimization</p>
                        <p className="text-xs text-gray-600">Identify optimal reorder points to minimize stockouts and carrying costs</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-white rounded border border-orange-200">
                      <div className="p-2 bg-orange-100 rounded">
                        <Zap className="h-4 w-4 text-orange-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900">Lead Time Impact</p>
                        <p className="text-xs text-gray-600">Assess how shipment timing affects inventory levels and fulfillment</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* SKU Worksheet Modal (Full Screen) */}
      {showSKUWorksheet && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full h-full max-h-[95vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-green-50 to-white">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <DollarSign className="h-7 w-7 text-green-600" />
                  SKU Worksheet & CoGS Calculator
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Detailed cost analysis and profitability modeling
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSKUWorksheet(false)}
                className="hover:bg-green-100"
              >
                <span className="text-2xl">&times;</span>
              </Button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="max-w-6xl mx-auto space-y-6">
                
                {/* Section 1: SKU Selection & Pricing */}
                <Card className="border-l-4 border-l-blue-500">
                  <CardHeader className="bg-gradient-to-r from-blue-50 to-white">
                    <CardTitle className="text-lg">1. SKU Selection & Pricing</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          SKU Name
                        </label>
                        {!isCustomSKU ? (
                          <div className="flex gap-2">
                            <select
                              value={worksheetData.skuName}
                              onChange={(e) => {
                                if (e.target.value === '__CUSTOM__') {
                                  setIsCustomSKU(true);
                                  setWorksheetData({...worksheetData, skuName: ''});
                                } else {
                                  setWorksheetData({...worksheetData, skuName: e.target.value});
                                }
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="">Select a SKU...</option>
                              {availableSKUs.map((sku) => (
                                <option key={sku} value={sku}>{sku}</option>
                              ))}
                              <option value="__CUSTOM__">── Custom Entry ──</option>
                            </select>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={worksheetData.skuName}
                              onChange={(e) => setWorksheetData({...worksheetData, skuName: e.target.value})}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Enter custom SKU name"
                              autoFocus
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsCustomSKU(false);
                                setWorksheetData({...worksheetData, skuName: ''});
                              }}
                              className="text-xs"
                            >
                              Back to List
                            </Button>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          ASP (Average Selling Price)
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={worksheetData.asp}
                            onChange={(e) => setWorksheetData({...worksheetData, asp: parseFloat(e.target.value) || 0})}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Reseller Margin (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={worksheetData.resellerMargin}
                            onChange={(e) => setWorksheetData({...worksheetData, resellerMargin: parseFloat(e.target.value) || 0})}
                            onFocus={(e) => e.target.select()}
                            className="w-full pr-7 pl-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <span className="absolute right-3 top-2 text-gray-500">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Marketing Reserve (%)
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            value={worksheetData.marketingReserve}
                            onChange={(e) => setWorksheetData({...worksheetData, marketingReserve: parseFloat(e.target.value) || 0})}
                            onFocus={(e) => e.target.select()}
                            className="w-full pr-7 pl-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <span className="absolute right-3 top-2 text-gray-500">%</span>
                        </div>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Fulfillment Costs
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-gray-500">$</span>
                          <input
                            type="number"
                            step="0.01"
                            value={worksheetData.fulfillmentCosts}
                            onChange={(e) => setWorksheetData({...worksheetData, fulfillmentCosts: parseFloat(e.target.value) || 0})}
                            onFocus={(e) => e.target.select()}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Section 2: All Deductions (Calculated) */}
                <Card className="border-l-4 border-l-purple-500 bg-purple-50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>2. All Deductions</span>
                      <span className="text-2xl font-bold text-purple-600">
                        ${calculateAllDeductions().toFixed(2)}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-gray-700 space-y-1">
                      <p>• Reseller Margin: ${(worksheetData.asp * worksheetData.resellerMargin / 100).toFixed(2)}</p>
                      <p>• Marketing Reserve: ${(worksheetData.asp * worksheetData.marketingReserve / 100).toFixed(2)}</p>
                      <p>• Fulfillment Costs: ${worksheetData.fulfillmentCosts.toFixed(2)}</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Section 3: Net Receipts (Calculated) */}
                <Card className="border-l-4 border-l-green-500 bg-green-50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>3. Net Receipts</span>
                      <span className="text-2xl font-bold text-green-600">
                        ${calculateNetReceipts().toFixed(2)}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700">
                      ASP (${worksheetData.asp.toFixed(2)}) - All Deductions (${calculateAllDeductions().toFixed(2)})
                    </p>
                  </CardContent>
                </Card>

                {/* Section 4: Product Costs */}
                <Card className="border-l-4 border-l-orange-500">
                  <CardHeader className="bg-gradient-to-r from-orange-50 to-white">
                    <CardTitle className="text-lg">4. Product Costs</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Product Cost (FOB)
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={worksheetData.productCostFOB}
                              onChange={(e) => setWorksheetData({...worksheetData, productCostFOB: parseFloat(e.target.value) || 0})}
                              onFocus={(e) => e.target.select()}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            SW License Fee
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={worksheetData.swLicenseFee}
                              onChange={(e) => setWorksheetData({...worksheetData, swLicenseFee: parseFloat(e.target.value) || 0})}
                              onFocus={(e) => e.target.select()}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Other Product Costs (Dynamic) */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Other Product Costs
                          </label>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setWorksheetData({
                              ...worksheetData,
                              otherProductCosts: [...worksheetData.otherProductCosts, { label: '', value: 0 }]
                            })}
                            className="text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Line Item
                          </Button>
                        </div>
                        {worksheetData.otherProductCosts.map((item, index) => (
                          <div key={index} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              placeholder="Description"
                              value={item.label}
                              onChange={(e) => {
                                const updated = [...worksheetData.otherProductCosts];
                                updated[index].label = e.target.value;
                                setWorksheetData({...worksheetData, otherProductCosts: updated});
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                            />
                            <div className="relative w-32">
                              <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={item.value}
                                onChange={(e) => {
                                  const updated = [...worksheetData.otherProductCosts];
                                  updated[index].value = parseFloat(e.target.value) || 0;
                                  setWorksheetData({...worksheetData, otherProductCosts: updated});
                                }}
                                onFocus={(e) => e.target.select()}
                                className="w-full pl-7 pr-2 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const updated = worksheetData.otherProductCosts.filter((_, i) => i !== index);
                                setWorksheetData({...worksheetData, otherProductCosts: updated});
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 border-t">
                        <p className="text-sm font-semibold text-gray-900">
                          Total Product Costs: <span className="text-orange-600">${calculateTotalProductCosts().toFixed(2)}</span>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Section 5: Royalty (Calculated) */}
                <Card className="border-l-4 border-l-indigo-500 bg-indigo-50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>5. Royalty (5% of Net Receipts)</span>
                      <span className="text-2xl font-bold text-indigo-600">
                        ${calculateRoyalty().toFixed(2)}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-700">
                      5% × Net Receipts (${calculateNetReceipts().toFixed(2)})
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Note: Royalty is calculated on Net Receipts, not ASP
                    </p>
                  </CardContent>
                </Card>

                {/* Section 6: All CoGS Breakdown */}
                <Card className="border-l-4 border-l-red-500">
                  <CardHeader className="bg-gradient-to-r from-red-50 to-white">
                    <CardTitle className="text-lg">6. All CoGS Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Returns - Freight
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={worksheetData.returnsFreight}
                              onChange={(e) => setWorksheetData({...worksheetData, returnsFreight: parseFloat(e.target.value) || 0})}
                              onFocus={(e) => e.target.select()}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Returns - Handling
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={worksheetData.returnsHandling}
                              onChange={(e) => setWorksheetData({...worksheetData, returnsHandling: parseFloat(e.target.value) || 0})}
                              onFocus={(e) => e.target.select()}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            DOA Channel Credit
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={worksheetData.doaChannelCredit}
                              onChange={(e) => setWorksheetData({...worksheetData, doaChannelCredit: parseFloat(e.target.value) || 0})}
                              onFocus={(e) => e.target.select()}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Financing Cost
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={worksheetData.financingCost}
                              onChange={(e) => setWorksheetData({...worksheetData, financingCost: parseFloat(e.target.value) || 0})}
                              onFocus={(e) => e.target.select()}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            PPS Handling Fee
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={worksheetData.ppsHandlingFee}
                              onChange={(e) => setWorksheetData({...worksheetData, ppsHandlingFee: parseFloat(e.target.value) || 0})}
                              onFocus={(e) => e.target.select()}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Inbound Shipping Cost
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={worksheetData.inboundShippingCost}
                              onChange={(e) => setWorksheetData({...worksheetData, inboundShippingCost: parseFloat(e.target.value) || 0})}
                              onFocus={(e) => e.target.select()}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Outbound Shipping Cost
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={worksheetData.outboundShippingCost}
                              onChange={(e) => setWorksheetData({...worksheetData, outboundShippingCost: parseFloat(e.target.value) || 0})}
                              onFocus={(e) => e.target.select()}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Greenfile Marketing
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={worksheetData.greenfileMarketing}
                              onChange={(e) => setWorksheetData({...worksheetData, greenfileMarketing: parseFloat(e.target.value) || 0})}
                              onFocus={(e) => e.target.select()}
                            className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Other CoGS (Dynamic) */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700">
                            Other CoGS Items
                          </label>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setWorksheetData({
                              ...worksheetData,
                              otherCoGS: [...worksheetData.otherCoGS, { label: '', value: 0 }]
                            })}
                            className="text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Line Item
                          </Button>
                        </div>
                        {worksheetData.otherCoGS.map((item, index) => (
                          <div key={index} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              placeholder="Description"
                              value={item.label}
                              onChange={(e) => {
                                const updated = [...worksheetData.otherCoGS];
                                updated[index].label = e.target.value;
                                setWorksheetData({...worksheetData, otherCoGS: updated});
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
                            />
                            <div className="relative w-32">
                              <span className="absolute left-3 top-2 text-gray-500 text-sm">$</span>
                              <input
                                type="number"
                                step="0.01"
                                value={item.value}
                                onChange={(e) => {
                                  const updated = [...worksheetData.otherCoGS];
                                  updated[index].value = parseFloat(e.target.value) || 0;
                                  setWorksheetData({...worksheetData, otherCoGS: updated});
                                }}
                                onFocus={(e) => e.target.select()}
                                className="w-full pl-7 pr-2 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent"
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const updated = worksheetData.otherCoGS.filter((_, i) => i !== index);
                                setWorksheetData({...worksheetData, otherCoGS: updated});
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="pt-4 border-t">
                        <p className="text-sm font-semibold text-gray-900">
                          Total CoGS: <span className="text-red-600">${calculateTotalCoGS().toFixed(2)}</span>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Section 7: Gross Profit & Margin (Calculated) */}
                <Card className="border-l-4 border-l-green-600 bg-gradient-to-r from-green-100 to-white">
                  <CardHeader>
                    <CardTitle className="text-xl">7. Gross Profit & Gross Margin</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-4 bg-white rounded-lg border-2 border-green-300">
                          <p className="text-sm text-gray-600 mb-1">Gross Profit</p>
                          <p className="text-3xl font-bold text-green-600">
                            ${calculateGrossProfit().toFixed(2)}
                          </p>
                        </div>
                        <div className="p-4 bg-white rounded-lg border-2 border-green-300">
                          <p className="text-sm text-gray-600 mb-1">Gross Margin (%)</p>
                          <p className="text-3xl font-bold text-green-600">
                            {calculateGrossMargin().toFixed(2)}%
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            As % of Net Receipts
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-white rounded-lg border border-gray-200">
                        <p className="text-sm font-semibold text-gray-900 mb-2">Calculation:</p>
                        <div className="text-sm text-gray-700 space-y-1">
                          <p>Net Receipts: <span className="font-semibold">${calculateNetReceipts().toFixed(2)}</span></p>
                          <p className="text-red-600">- Product Costs: ${calculateTotalProductCosts().toFixed(2)}</p>
                          <p className="text-red-600">- Royalties: ${calculateRoyalty().toFixed(2)}</p>
                          <p className="text-red-600">- All CoGS: ${calculateTotalCoGS().toFixed(2)}</p>
                          <div className="pt-2 mt-2 border-t border-gray-300">
                            <p className="font-bold text-green-600">= Gross Profit: ${calculateGrossProfit().toFixed(2)}</p>
                            <p className="font-bold text-green-600">= Gross Margin: {calculateGrossMargin().toFixed(2)}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

