'use client';

import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function UserGuidePage() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">📚 Portal User Guide</h1>
          <p className="text-xl text-gray-600">
            Complete guide to the Boundless Devices Inc. Business Portal
          </p>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-green-500 mx-auto mt-4 rounded-full"></div>
        </div>
        
        <div className="space-y-8">
          {/* Getting Started */}
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                🚀 <span>Getting Started</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg text-gray-700">
                Welcome to the <strong className="text-blue-600">BDI Business Portal</strong> - your comprehensive 
                <strong className="text-green-600"> CPFR (Collaborative Planning, Forecasting & Replenishment)</strong> 
                supply chain management platform.
              </p>
              
              <div className="bg-gradient-to-r from-blue-50 to-green-50 p-6 rounded-lg border">
                <h3 className="font-bold text-xl mb-4 text-gray-800">🎯 Core Capabilities</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <strong className="text-blue-700">CPFR Management:</strong> Real-time demand forecasting
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <strong className="text-green-700">Inventory Intelligence:</strong> SKU tracking & allocation
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                      <strong className="text-purple-700">Email Automation:</strong> CPFR notifications & alerts
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                      <strong className="text-orange-700">Executive Dashboard:</strong> Business intelligence
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Navigation Guide */}
          <Card className="border-l-4 border-l-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                🧭 <span>Navigation Guide</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Dashboard */}
                <div className="bg-blue-50 p-5 rounded-lg border border-blue-200">
                  <h4 className="font-bold text-lg text-blue-800 mb-3">
                    📊 <Link href="/dashboard" className="hover:underline text-blue-600">Dashboard</Link>
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                      Executive CPFR metrics & KPIs
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                      6-month forecast activity charts
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                      Shipment status & alerts
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                      Real-time activity feed
                    </li>
                  </ul>
                </div>

                {/* CPFR */}
                <div className="bg-green-50 p-5 rounded-lg border border-green-200">
                  <h4 className="font-bold text-lg text-green-800 mb-3">📈 CPFR</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      <Link href="/cpfr/invoices" className="hover:underline text-green-600">
                        Invoices - Inventory & document management
                      </Link>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      <Link href="/cpfr/forecasts" className="hover:underline text-green-600">
                        Forecasts - Demand planning & CPFR signals
                      </Link>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      <Link href="/cpfr/purchase-orders" className="hover:underline text-green-600">
                        Purchase Orders - Procurement workflow
                      </Link>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      <Link href="/cpfr/shipments" className="hover:underline text-green-600">
                        Shipments - Logistics tracking
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Inventory */}
                <div className="bg-purple-50 p-5 rounded-lg border border-purple-200">
                  <h4 className="font-bold text-lg text-purple-800 mb-3">📦 Inventory</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                      <Link href="/admin/skus" className="hover:underline text-purple-600">
                        SKUs - Product catalog & specifications
                      </Link>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                      <Link href="/inventory/warehouses" className="hover:underline text-purple-600">
                        Warehouses - Location management
                      </Link>
                    </li>
                  </ul>
                </div>

                {/* Admin */}
                <div className="bg-orange-50 p-5 rounded-lg border border-orange-200">
                  <h4 className="font-bold text-lg text-orange-800 mb-3">⚙️ Admin</h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                      <Link href="/admin/organizations" className="hover:underline text-orange-600">
                        Organizations - Partner & CPFR contacts
                      </Link>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                      <Link href="/admin/connections" className="hover:underline text-orange-600">
                        Connections - Business relationships
                      </Link>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full"></span>
                      <Link href="/admin/users" className="hover:underline text-orange-600">
                        Users - Access control & roles
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CPFR Workflow */}
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                🔄 <span>CPFR Workflow</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg">
                <h3 className="font-bold text-xl mb-4 text-gray-800">📋 Complete CPFR Process</h3>
                
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                    <div>
                      <h4 className="font-semibold text-blue-700">Create Invoices & Inventory</h4>
                      <p className="text-gray-600 text-sm">Upload invoices with SKU quantities to establish available inventory</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
                    <div>
                      <h4 className="font-semibold text-green-700">Draft Forecasts</h4>
                      <p className="text-gray-600 text-sm">Create demand forecasts with intelligent inventory allocation</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
                    <div>
                      <h4 className="font-semibold text-yellow-700">Submit to Partners</h4>
                      <p className="text-gray-600 text-sm">Submit forecasts → Automatic email notifications to factory partners</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold text-sm">4</div>
                    <div>
                      <h4 className="font-semibold text-purple-700">CPFR Collaboration</h4>
                      <p className="text-gray-600 text-sm">Track Sales → Factory → Shipping signals with real-time status</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Features & Capabilities */}
          <Card className="border-l-4 border-l-indigo-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                ⭐ <span>Key Features</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-indigo-700">🎯 Smart Intelligence</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      Real-time inventory availability calculation
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      Color-coded inventory alerts (red/yellow/green)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      Smart week validation for delivery planning
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      Draft vs Submitted forecast tracking
                    </li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-indigo-700">📧 Email Automation</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      Automatic CPFR notifications to partners
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      24-hour response SLA tracking
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      Escalation management
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      Bi-directional signal notifications
                    </li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-indigo-700">📊 Dashboard Analytics</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      6-month forecast activity visualization
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      Organization-specific metrics
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      Shipment status monitoring
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      Real-time data refresh
                    </li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-indigo-700">🔐 Security & Access</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      Organization-based data isolation
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      Role-based permissions
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      Secure partner portal access
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-green-500">✅</span>
                      Document management with RLS
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Status & Roadmap */}
          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                🚀 <span>System Status & Roadmap</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 flex items-center gap-2">
                    ✅ <span>Production Ready Features</span>
                  </h4>
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 text-green-700">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Executive Dashboard with real-time metrics
                    </div>
                    <div className="flex items-center gap-2 text-green-700">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Invoice management with file uploads
                    </div>
                    <div className="flex items-center gap-2 text-green-700">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      CPFR forecasting with smart validation
                    </div>
                    <div className="flex items-center gap-2 text-green-700">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      SKU catalog with HTS codes
                    </div>
                    <div className="flex items-center gap-2 text-green-700">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Email automation & notifications
                    </div>
                    <div className="flex items-center gap-2 text-green-700">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Organization & user management
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-semibold text-amber-800 flex items-center gap-2">
                    🔄 <span>Coming Soon</span>
                  </h4>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-amber-700">
                      <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                      Purchase Orders workflow & management
                    </div>
                    <div className="flex items-center gap-2 text-amber-700">
                      <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                      Warehouses location management
                    </div>
                    <div className="flex items-center gap-2 text-amber-700">
                      <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                      Shipments tracking & logistics
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Support */}
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                🆘 <span>Support & Contact</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-bold text-blue-800 mb-2">📧 Technical Support</h4>
                    <p className="text-blue-700">
                      Email: <a href="mailto:scistulli@boundlessdevices.com" className="text-blue-600 hover:underline font-medium">scistulli@boundlessdevices.com</a>
                    </p>
                  </div>
                  <div>
                    <h4 className="font-bold text-blue-800 mb-2">🏢 Business Contact</h4>
                    <p className="text-blue-700">
                      Primary: <a href="mailto:dzand@boundlessdevices.com" className="text-blue-600 hover:underline font-medium">dzand@boundlessdevices.com</a>
                    </p>
                  </div>
                </div>
                
                <div className="mt-4 p-4 bg-white rounded border border-blue-200">
                  <p className="text-sm text-gray-600">
                    <strong>Portal Version:</strong> 2.0 (CPFR Intelligence) • 
                    <strong> Last Updated:</strong> December 2024 • 
                    <strong> Status:</strong> <span className="text-green-600">Production Ready</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}