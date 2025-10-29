'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  channel: string; // D2C or B2B specific channel
  country: string;
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

// Channel structure
const CHANNELS = {
  D2C: [
    'Amazon (FBA)',
    'Shopify',
    'Custom D2C Channel'
  ],
  B2B: [
    'Best Buy (Direct)',
    'Costco (Direct)',
    'Walmart (Direct)',
    'Tekpoint (Distributor)',
    'EMG (Distributor)',
    'Custom B2B Channel'
  ]
};

// Countries
const COUNTRIES = [
  'United States',
  'Canada',
  'Mexico',
  'United Kingdom',
  'Germany',
  'France',
  'Other'
];

export default function BusinessAnalysisPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [showSKUWorksheet, setShowSKUWorksheet] = useState(false);
  const [showSalesVelocityModal, setShowSalesVelocityModal] = useState(false);
  const [availableSKUs, setAvailableSKUs] = useState<string[]>([]);
  const [isCustomSKU, setIsCustomSKU] = useState(false);
  
  // SKU Worksheet State
  const [worksheetData, setWorksheetData] = useState<SKUWorksheetData>({
    skuName: '',
    channel: '',
    country: 'United States',
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

  const [isCustomChannel, setIsCustomChannel] = useState(false);
  const [customChannelName, setCustomChannelName] = useState('');

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
          
          // Extract SKU NUMBER (skuCode) which is unique, not the name
          const skuNumbers = skuList
            .map((sku: any) => sku.skuCode || sku.sku_code)
            .filter(Boolean);
          
          console.log('Extracted SKU numbers:', skuNumbers);
          setAvailableSKUs(skuNumbers);
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
          <Card 
            className="hover:shadow-lg transition-shadow border-t-4 border-t-green-500 cursor-pointer"
            onClick={() => router.push('/admin/business-analysis/cash-flow')}
          >
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
                <li>• 13-week cash flow view</li>
                <li>• NRE & inventory payments</li>
                <li>• Operating expense tracking</li>
                <li>• Payment schedule builder</li>
              </ul>
              <div className="mt-4 pt-4 border-t">
                <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                  Active
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

          {/* Sales Velocity */}
          <Card 
            className="hover:shadow-lg transition-shadow border-t-4 border-t-purple-500 cursor-pointer"
            onClick={() => setShowSalesVelocityModal(true)}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-purple-600" />
                Sales Velocity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-3">
                Track daily sales rates and calculate days of inventory remaining across all channels.
              </p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• Daily sales velocity by SKU</li>
                <li>• Days of inventory (Amazon + Warehouses)</li>
                <li>• Reorder alerts & timing</li>
                <li>• Historical trends since Aug 2024</li>
              </ul>
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-purple-50 p-2 rounded">
                    <div className="font-semibold text-purple-900">Data Sources</div>
                    <div className="text-purple-700 mt-1">
                      Amazon FBA<br/>
                      EMG Warehouse<br/>
                      CATV Warehouse
                    </div>
                  </div>
                  <div className="bg-purple-50 p-2 rounded">
                    <div className="font-semibold text-purple-900">Status</div>
                    <div className="text-purple-700 mt-1">
                      🔄 Building...<br/>
                      Step 2 of 4
                    </div>
                  </div>
                </div>
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
                          SKU Number
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
                              placeholder="Enter custom SKU number"
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

                      {/* Channel Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Sales Channel
                        </label>
                        {!isCustomChannel ? (
                          <select
                            value={worksheetData.channel}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (value === '__CUSTOM_D2C__' || value === '__CUSTOM_B2B__') {
                                setIsCustomChannel(true);
                                setWorksheetData({...worksheetData, channel: ''});
                              } else {
                                setWorksheetData({...worksheetData, channel: value});
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          >
                            <option value="">Select a channel...</option>
                            <optgroup label="D2C (Direct to Consumer)">
                              {CHANNELS.D2C.filter(ch => ch !== 'Custom D2C Channel').map((ch) => (
                                <option key={ch} value={ch}>{ch}</option>
                              ))}
                              <option value="__CUSTOM_D2C__">── Custom D2C Channel ──</option>
                            </optgroup>
                            <optgroup label="B2B (Business to Business)">
                              {CHANNELS.B2B.filter(ch => ch !== 'Custom B2B Channel').map((ch) => (
                                <option key={ch} value={ch}>{ch}</option>
                              ))}
                              <option value="__CUSTOM_B2B__">── Custom B2B Channel ──</option>
                            </optgroup>
                          </select>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={customChannelName}
                              onChange={(e) => setCustomChannelName(e.target.value)}
                              onBlur={() => {
                                if (customChannelName.trim()) {
                                  setWorksheetData({...worksheetData, channel: customChannelName});
                                }
                              }}
                              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Enter custom channel name"
                              autoFocus
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setIsCustomChannel(false);
                                setCustomChannelName('');
                                setWorksheetData({...worksheetData, channel: ''});
                              }}
                              className="text-xs"
                            >
                              Back
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Country Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Country
                        </label>
                        <select
                          value={worksheetData.country}
                          onChange={(e) => setWorksheetData({...worksheetData, country: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          {COUNTRIES.map((country) => (
                            <option key={country} value={country}>{country}</option>
                          ))}
                        </select>
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
                            Greenfield Marketing
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

      {/* Sales Velocity Modal (Full Screen) */}
      {showSalesVelocityModal && (
        <SalesVelocityModal onClose={() => setShowSalesVelocityModal(false)} />
      )}
    </div>
  );
}

// =====================================================
// Sales Velocity Modal Component
// =====================================================
interface SalesVelocityModalProps {
  onClose: () => void;
}

function SalesVelocityModal({ onClose }: SalesVelocityModalProps) {
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [calculationProgress, setCalculationProgress] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [calculation, setCalculation] = useState<any>(null);
  const [view, setView] = useState<'latest' | 'stockout' | 'top_movers'>('latest');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'velocity' | 'inventory' | 'risk'>('velocity');

  useEffect(() => {
    fetchMetrics();
  }, [view]);

  async function fetchMetrics() {
    try {
      setLoading(true);
      const response = await fetch(`/api/sales-velocity/metrics?view=${view}`);
      if (response.ok) {
        const data = await response.json();
        setMetrics(data.metrics || []);
        setCalculation(data.calculation);
      }
    } catch (error) {
      console.error('Error fetching velocity metrics:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCalculate() {
    if (!confirm('This will recalculate sales velocity for all SKUs. This may take a few minutes. Continue?')) {
      return;
    }

    try {
      setCalculating(true);
      setCalculationProgress([]);
      
      // Add progress updates
      const addProgress = (message: string) => {
        setCalculationProgress(prev => [...prev, message]);
      };

      addProgress('🚀 Starting calculation...');
      addProgress('📦 Step 1/4: Syncing Amazon FBA Inventory...');
      
      // Simulate progress updates (in real implementation, use Server-Sent Events or polling)
      setTimeout(() => addProgress('💰 Step 2/4: Fetching Amazon Financial Data (Aug 2024 - Today)...'), 1000);
      setTimeout(() => addProgress('📊 Step 3/4: Processing sales data...'), 2000);
      setTimeout(() => addProgress('🏭 Step 4/4: Pulling warehouse data (EMG + CATV)...'), 3000);
      
      const response = await fetch('/api/sales-velocity/calculate', {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        addProgress('✅ Calculation complete!');
        addProgress(`📊 ${data.skusAnalyzed} SKUs analyzed`);
        addProgress(`📈 ${data.metricsCreated} metrics created`);
        
        setTimeout(() => {
          alert(`✅ Calculation complete!\n\n${data.skusAnalyzed} SKUs analyzed\n${data.metricsCreated} metrics created`);
          fetchMetrics();
          setCalculationProgress([]);
        }, 1000);
      } else {
        const error = await response.json();
        addProgress(`❌ Calculation failed: ${error.error}`);
        setTimeout(() => {
          alert(`❌ Calculation failed: ${error.error}\n\nCheck console for details.`);
          setCalculationProgress([]);
        }, 1000);
      }
    } catch (error: any) {
      console.error('Error calculating velocity:', error);
      setCalculationProgress(prev => [...prev, `❌ Error: ${error.message}`]);
      setTimeout(() => {
        alert(`❌ Error: ${error.message}`);
        setCalculationProgress([]);
      }, 1000);
    } finally {
      setCalculating(false);
    }
  }

  // Filter and sort metrics
  const filteredMetrics = metrics
    .filter(m => 
      !searchTerm || 
      m.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.product_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === 'velocity') {
        return parseFloat(b.daily_sales_velocity || 0) - parseFloat(a.daily_sales_velocity || 0);
      } else if (sortBy === 'inventory') {
        return (b.total_available_inventory || 0) - (a.total_available_inventory || 0);
      } else {
        // Sort by risk: CRITICAL > HIGH > MEDIUM > LOW
        const riskOrder: any = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (riskOrder[b.stockout_risk] || 0) - (riskOrder[a.stockout_risk] || 0);
      }
    });

  // Calculate summary stats
  const totalSKUs = metrics.length;
  const avgVelocity = metrics.reduce((sum, m) => sum + parseFloat(m.daily_sales_velocity || 0), 0) / (totalSKUs || 1);
  const totalInventory = metrics.reduce((sum, m) => sum + (m.total_available_inventory || 0), 0);
  const criticalCount = metrics.filter(m => m.stockout_risk === 'CRITICAL').length;
  const highCount = metrics.filter(m => m.stockout_risk === 'HIGH').length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full h-full max-h-[98vh] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 border-b bg-gradient-to-r from-purple-50 to-white gap-4">
          <div className="flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Activity className="h-6 w-6 sm:h-7 sm:w-7 text-purple-600" />
              Sales Velocity Analysis
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              {calculation ? `Last calculated: ${new Date(calculation.calculation_date).toLocaleDateString()}` : 'No calculations yet'}
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              onClick={handleCalculate}
              disabled={calculating}
              className="flex-1 sm:flex-none bg-purple-600 hover:bg-purple-700 text-sm"
            >
              {calculating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Calculating...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Calculate Now
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="hover:bg-purple-100"
            >
              <span className="text-2xl">&times;</span>
            </Button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {/* Progress Display */}
          {calculating && calculationProgress.length > 0 && (
            <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-purple-900 mb-3 flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
                Calculation in Progress
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {calculationProgress.map((msg, idx) => (
                  <div key={idx} className="text-sm text-purple-800 font-mono">
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : metrics.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Available</h3>
              <p className="text-gray-600 mb-4">Click "Calculate Now" to generate sales velocity metrics</p>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <Card className="border-l-4 border-l-purple-500">
                  <CardContent className="p-3 sm:p-4">
                    <p className="text-xs text-gray-600 mb-1">Total SKUs</p>
                    <p className="text-xl sm:text-2xl font-bold text-purple-600">{totalSKUs}</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-blue-500">
                  <CardContent className="p-3 sm:p-4">
                    <p className="text-xs text-gray-600 mb-1">Avg Daily Velocity</p>
                    <p className="text-xl sm:text-2xl font-bold text-blue-600">{avgVelocity.toFixed(1)}</p>
                    <p className="text-xs text-gray-500">units/day</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-green-500">
                  <CardContent className="p-3 sm:p-4">
                    <p className="text-xs text-gray-600 mb-1">Total Inventory</p>
                    <p className="text-xl sm:text-2xl font-bold text-green-600">{totalInventory.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">units</p>
                  </CardContent>
                </Card>
                <Card className="border-l-4 border-l-red-500">
                  <CardContent className="p-3 sm:p-4">
                    <p className="text-xs text-gray-600 mb-1">At Risk</p>
                    <p className="text-xl sm:text-2xl font-bold text-red-600">{criticalCount + highCount}</p>
                    <p className="text-xs text-gray-500">SKUs</p>
                  </CardContent>
                </Card>
              </div>

              {/* View Tabs */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Button
                  variant={view === 'latest' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setView('latest')}
                  className={view === 'latest' ? 'bg-purple-600' : ''}
                >
                  All SKUs
                </Button>
                <Button
                  variant={view === 'stockout' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setView('stockout')}
                  className={view === 'stockout' ? 'bg-red-600' : ''}
                >
                  Stockout Risk
                </Button>
                <Button
                  variant={view === 'top_movers' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setView('top_movers')}
                  className={view === 'top_movers' ? 'bg-green-600' : ''}
                >
                  Top Movers
                </Button>
              </div>

              {/* Search and Sort */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Search SKU or product name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="velocity">Sort by Velocity</option>
                  <option value="inventory">Sort by Inventory</option>
                  <option value="risk">Sort by Risk</option>
                </select>
              </div>

              {/* Data Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700">SKU</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 hidden sm:table-cell">Product</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Velocity</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700">Inventory</th>
                        <th className="px-3 py-2 text-right font-semibold text-gray-700 hidden md:table-cell">Days Left</th>
                        <th className="px-3 py-2 text-center font-semibold text-gray-700">Risk</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredMetrics.map((metric, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-xs">{metric.sku}</td>
                          <td className="px-3 py-2 text-xs hidden sm:table-cell truncate max-w-[200px]">
                            {metric.product_name || '-'}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="font-semibold">{parseFloat(metric.daily_sales_velocity || 0).toFixed(1)}</div>
                            <div className="text-xs text-gray-500">units/day</div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="font-semibold">{metric.total_available_inventory || 0}</div>
                            <div className="text-xs text-gray-500">
                              FBA: {metric.amazon_fba_quantity || 0}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right hidden md:table-cell">
                            {metric.days_of_inventory ? (
                              <div className="font-semibold">{parseFloat(metric.days_of_inventory).toFixed(0)} days</div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                              metric.stockout_risk === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                              metric.stockout_risk === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                              metric.stockout_risk === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {metric.stockout_risk || 'LOW'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {filteredMetrics.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No SKUs match your search criteria
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

