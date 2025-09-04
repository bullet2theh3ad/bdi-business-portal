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
          <p className="text-sm text-gray-500 mt-2">
            Last Updated: {new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
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
                supply chain management platform with full API integration capabilities.
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
                      <strong className="text-green-700">Inventory Intelligence:</strong> SKU tracking & warehouse management
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                      <strong className="text-purple-700">Organization Management:</strong> Multi-tenant partner ecosystem
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                      <strong className="text-indigo-700">API Integration:</strong> Programmatic access for external partners
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                      <strong className="text-orange-700">Production Files:</strong> Factory data management & sharing
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      <strong className="text-red-700">Shipment Tracking:</strong> Multi-stage logistics visibility
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                      <strong className="text-teal-700">Email Automation:</strong> CPFR notifications & alerts
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-pink-500 rounded-full"></span>
                      <strong className="text-pink-700">Executive Dashboard:</strong> Business intelligence & metrics
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
                      Real-time activity feed & auto-refresh
                    </li>
                  </ul>
                </div>

                {/* CPFR */}
                <div className="bg-green-50 p-5 rounded-lg border border-green-200">
                  <h4 className="font-bold text-lg text-green-800 mb-3">
                    📈 CPFR (Collaborative Planning)
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      <Link href="/cpfr/forecasts" className="hover:underline text-green-600">Sales Forecasts</Link> - Multi-level calendar with CPFR signals
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      <Link href="/cpfr/invoices" className="hover:underline text-green-600">Invoices</Link> - Invoice management with line items & documents
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      <Link href="/cpfr/purchase-orders" className="hover:underline text-green-600">Purchase Orders</Link> - PO creation & tracking
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      <Link href="/cpfr/shipments" className="hover:underline text-green-600">Shipments</Link> - Multi-stage logistics timeline
                    </li>
                  </ul>
                </div>

                {/* Inventory */}
                <div className="bg-purple-50 p-5 rounded-lg border border-purple-200">
                  <h4 className="font-bold text-lg text-purple-800 mb-3">
                    📦 Inventory Management
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                      <Link href="/admin/skus" className="hover:underline text-purple-600">SKUs</Link> - Product catalog with dimensional data
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                      <Link href="/inventory/warehouses" className="hover:underline text-purple-600">Warehouses</Link> - Location management & capabilities
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full"></span>
                      <Link href="/inventory/production-files" className="hover:underline text-purple-600">Production Files</Link> - Factory data & device tracking
                    </li>
                  </ul>
                </div>

                {/* Admin (Super Admin Only) */}
                <div className="bg-red-50 p-5 rounded-lg border border-red-200">
                  <h4 className="font-bold text-lg text-red-800 mb-3">
                    ⚙️ Admin (Super Admin Only)
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                      <Link href="/admin/organizations" className="hover:underline text-red-600">Organizations</Link> - Partner management & user administration
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                      <Link href="/admin/api-keys" className="hover:underline text-red-600">API Keys</Link> - External partner API access management
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                      <Link href="/admin/connections" className="hover:underline text-red-600">Connections</Link> - Cross-organization permissions matrix
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                      <Link href="/admin/users" className="hover:underline text-red-600">Users</Link> - BDI team member management
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Super Admin Features */}
          <Card className="border-l-4 border-l-red-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                👑 <span>Super Admin Features</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                
                {/* Organization Management */}
                <div className="bg-gradient-to-r from-red-50 to-orange-50 p-6 rounded-lg border border-red-200">
                  <h3 className="font-bold text-xl mb-4 text-red-800">🏢 Organization Management</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-semibold text-red-700">Organization Creation:</h4>
                      <ul className="space-y-1 text-sm">
                        <li>• <strong>Add Organization:</strong> Direct creation with immediate access</li>
                        <li>• <strong>Invite Organization:</strong> Traditional invitation workflow</li>
                        <li>• <strong>Organization Types:</strong> Contractor, ODM, R&D Partner, Logistics, etc.</li>
                        <li>• <strong>Capability Assignment:</strong> CPFR, API Access, Advanced Reporting</li>
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-semibold text-red-700">Organization Management:</h4>
                      <ul className="space-y-1 text-sm">
                        <li>• <strong>Edit Organization Details:</strong> Code, name, legal name with cascade updates</li>
                        <li>• <strong>User Management:</strong> Add, edit, activate/deactivate users across organizations</li>
                        <li>• <strong>API Settings:</strong> Generate API keys for external partner integration</li>
                        <li>• <strong>CPFR Contacts:</strong> Notification preferences and escalation contacts</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* API Management */}
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-lg border border-purple-200">
                  <h3 className="font-bold text-xl mb-4 text-purple-800">🔑 API Management System</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <h4 className="font-semibold text-purple-700">API Key Generation:</h4>
                      <ul className="space-y-1 text-sm">
                        <li>• <strong>Partner-Specific Keys:</strong> Generate secure API keys for external organizations</li>
                        <li>• <strong>Granular Permissions:</strong> Production Files (read/upload/download), Advanced Reporting</li>
                        <li>• <strong>Rate Limiting:</strong> Configurable request limits per hour</li>
                        <li>• <strong>Expiration Control:</strong> Set key expiration dates for security</li>
                      </ul>
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-semibold text-purple-700">API Access Control:</h4>
                      <ul className="space-y-1 text-sm">
                        <li>• <strong>Connection-Based Access:</strong> API permissions respect organization connections</li>
                        <li>• <strong>Usage Monitoring:</strong> Track API key usage and last access times</li>
                        <li>• <strong>Security Management:</strong> Activate/deactivate keys, delete compromised keys</li>
                        <li>• <strong>Documentation:</strong> Complete API reference for external partners</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="mt-4 bg-purple-100 p-4 rounded border border-purple-300">
                    <h4 className="font-semibold text-purple-800 mb-2">🌐 API Endpoints Available:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                      <div><code className="bg-white px-2 py-1 rounded">GET /api/v1/production-files</code></div>
                      <div><code className="bg-white px-2 py-1 rounded">POST /api/v1/production-files</code></div>
                      <div><code className="bg-white px-2 py-1 rounded">GET /api/v1/production-files/{'{id}'}/download</code></div>
                    </div>
                  </div>
                </div>

                {/* Connections & Permissions */}
                <div className="bg-gradient-to-r from-teal-50 to-cyan-50 p-6 rounded-lg border border-teal-200">
                  <h3 className="font-bold text-xl mb-4 text-teal-800">🔗 Connections & Permissions</h3>
                  <div className="space-y-4">
                    <p className="text-teal-700">
                      The Connections system enables <strong>granular cross-organization access control</strong> with directional permissions.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <h4 className="font-semibold text-teal-700">Permission Types:</h4>
                        <ul className="space-y-1 text-sm">
                          <li>• <strong>Can View Files:</strong> Access production files from connected organizations</li>
                          <li>• <strong>Can Download Files:</strong> Download files from connected organizations</li>
                          <li>• <strong>Advanced Reporting:</strong> BDI-level access to all organizational data</li>
                          <li>• <strong>Data Categories:</strong> Public, Partner, Confidential, Internal access levels</li>
                        </ul>
                      </div>
                      <div className="space-y-2">
                        <h4 className="font-semibold text-teal-700">Example Use Cases:</h4>
                        <ul className="space-y-1 text-sm">
                          <li>• <strong>GPN → MTN:</strong> R&D Partner accesses ODM production files</li>
                          <li>• <strong>OLM → All:</strong> Logistics partner views shipment data across organizations</li>
                          <li>• <strong>TC1 → BDI:</strong> Contractor shares manufacturing updates</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CPFR System */}
          <Card className="border-l-4 border-l-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                📈 <span>CPFR System</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                
                {/* Sales Forecasts */}
                <div className="bg-green-50 p-5 rounded-lg border border-green-200">
                  <h3 className="font-bold text-lg text-green-800 mb-3">
                    🎯 <Link href="/cpfr/forecasts" className="hover:underline text-green-600">Sales Forecasts</Link>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-green-700">Forecast Creation:</h4>
                      <ul className="space-y-1 text-sm">
                        <li>• <strong>Multi-level Calendar:</strong> Navigate months → weeks → specific delivery dates</li>
                        <li>• <strong>SKU Selection:</strong> Choose from available product catalog</li>
                        <li>• <strong>Quantity Planning:</strong> Set demand quantities with confidence levels</li>
                        <li>• <strong>Smart Week Validation:</strong> Automatic selection of valid delivery weeks</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-green-700">CPFR Collaboration:</h4>
                      <ul className="space-y-1 text-sm">
                        <li>• <strong>4-Stage Signals:</strong> Sales → Factory → Transit → Warehouse</li>
                        <li>• <strong>Color-Coded Status:</strong> Green (accepted), Yellow (awaiting), Red (rejected)</li>
                        <li>• <strong>Email Automation:</strong> Notifications for every signal state change</li>
                        <li>• <strong>Inventory Intelligence:</strong> Real-time availability tracking</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Shipments */}
                <div className="bg-blue-50 p-5 rounded-lg border border-blue-200">
                  <h3 className="font-bold text-lg text-blue-800 mb-3">
                    🚚 <Link href="/cpfr/shipments" className="hover:underline text-blue-600">Shipments</Link>
                  </h3>
                  <p className="text-sm text-blue-700 mb-3">
                    Visual timeline tracking with clickable milestone management for comprehensive logistics visibility.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white p-2 rounded border">
                      <strong>Sales:</strong> Draft → Submitted → Confirmed → Rejected
                    </div>
                    <div className="bg-white p-2 rounded border">
                      <strong>Factory:</strong> Pending → In Production → Ready → Shipped
                    </div>
                    <div className="bg-white p-2 rounded border">
                      <strong>Transit:</strong> Unknown → Pending → In Transit → Delivered
                    </div>
                    <div className="bg-white p-2 rounded border">
                      <strong>Warehouse:</strong> Unknown → Scheduled → Received → Complete
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Production Files & API Integration */}
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                🏭 <span>Production Files & API Integration</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                
                {/* Production Files Portal */}
                <div className="bg-orange-50 p-5 rounded-lg border border-orange-200">
                  <h3 className="font-bold text-lg text-orange-800 mb-3">
                    📁 <Link href="/inventory/production-files" className="hover:underline text-orange-600">Production Files Portal</Link>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h4 className="font-semibold text-orange-700">File Management:</h4>
                      <ul className="space-y-1 text-sm">
                        <li>• <strong>Drag & Drop Upload:</strong> Excel, CSV, TXT, JSON file support</li>
                        <li>• <strong>Automatic Device Counting:</strong> Parse uploaded files for device quantities</li>
                        <li>• <strong>Shipment Integration:</strong> Link files to BDI shipment numbers</li>
                        <li>• <strong>Organization Filtering:</strong> View files by company (BDI sees all)</li>
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-semibold text-orange-700">Access Control:</h4>
                      <ul className="space-y-1 text-sm">
                        <li>• <strong>Organization Isolation:</strong> Each org sees only their files by default</li>
                        <li>• <strong>Connection-Based Access:</strong> Shared access via organization connections</li>
                        <li>• <strong>Advanced Reporting:</strong> R&D Partners with special access see all files</li>
                        <li>• <strong>File Templates:</strong> Downloadable production file templates</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* API Integration */}
                <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-200">
                  <h3 className="font-bold text-lg text-indigo-800 mb-3">
                    🔌 API Integration for External Partners
                  </h3>
                  <div className="space-y-4">
                    <p className="text-indigo-700">
                      <strong>External partners (ODMs, R&D Partners)</strong> can integrate directly with BDI systems via secure REST APIs.
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white p-4 rounded border border-indigo-300">
                        <h4 className="font-semibold text-indigo-700 mb-2">📤 ODM Upload (MTN)</h4>
                        <ul className="space-y-1 text-xs">
                          <li>• Upload production files from factory</li>
                          <li>• Automatic shipment number generation</li>
                          <li>• Device count parsing & metadata</li>
                          <li>• Real-time file processing</li>
                        </ul>
                      </div>
                      
                      <div className="bg-white p-4 rounded border border-indigo-300">
                        <h4 className="font-semibold text-indigo-700 mb-2">📥 Partner Download (GPN)</h4>
                        <ul className="space-y-1 text-xs">
                          <li>• Access connected org's files</li>
                          <li>• Filtered file listing & search</li>
                          <li>• Secure download URLs</li>
                          <li>• Connection-based permissions</li>
                        </ul>
                      </div>
                      
                      <div className="bg-white p-4 rounded border border-indigo-300">
                        <h4 className="font-semibold text-indigo-700 mb-2">🔐 Authentication</h4>
                        <ul className="space-y-1 text-xs">
                          <li>• Bearer token authentication</li>
                          <li>• SHA256 key hashing</li>
                          <li>• Rate limiting & usage tracking</li>
                          <li>• Expiration & security controls</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-indigo-100 p-4 rounded border border-indigo-300">
                      <h4 className="font-semibold text-indigo-800 mb-2">🚀 API Quick Start Example:</h4>
                      <div className="bg-white p-3 rounded font-mono text-xs overflow-x-auto">
                        {`# MTN uploads production file
curl -X POST \\
     -H "Authorization: Bearer bdi_mtn_abc123..." \\
     -F "file=@production_Q1_2025.xlsx" \\
     "https://www.bdibusinessportal.com/api/v1/production-files"

# GPN downloads MTN's file
curl -H "Authorization: Bearer bdi_gpn_xyz789..." \\
     "https://www.bdibusinessportal.com/api/v1/production-files?organization=MTN"`}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Warehouse Management */}
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                🏬 <span>Warehouse Management</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-purple-50 p-5 rounded-lg border border-purple-200">
                <h3 className="font-bold text-lg text-purple-800 mb-3">
                  📍 <Link href="/inventory/warehouses" className="hover:underline text-purple-600">Warehouses</Link>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-purple-700">Warehouse Profiles:</h4>
                    <ul className="space-y-1 text-sm">
                      <li>• <strong>Location Details:</strong> Complete address and contact information</li>
                      <li>• <strong>Multiple Capabilities:</strong> General, Distribution, Fulfillment, Cold Storage, etc.</li>
                      <li>• <strong>Operating Hours:</strong> Time picker with 15-minute increments</li>
                      <li>• <strong>Physical Specifications:</strong> Dimensions, capacity, and equipment details</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-purple-700">Contact Management:</h4>
                    <ul className="space-y-1 text-sm">
                      <li>• <strong>Multiple Contacts:</strong> Primary and additional contact entries</li>
                      <li>• <strong>Contact Details:</strong> Name, email, phone, and extension support</li>
                      <li>• <strong>Document Storage:</strong> Warehouse-specific document uploads</li>
                      <li>• <strong>Full Edit Capability:</strong> Update all warehouse information</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Management */}
          <Card className="border-l-4 border-l-teal-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                👤 <span>Account Management</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Profile Management */}
                <div className="bg-teal-50 p-5 rounded-lg border border-teal-200">
                  <h4 className="font-bold text-lg text-teal-800 mb-3">
                    📝 <Link href="/account/profile" className="hover:underline text-teal-600">Profile Management</Link>
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>
                      <strong>Personal Information:</strong> Name, email, phone, title, department
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>
                      <strong>Organization Details:</strong> Admin users can edit company information
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>
                      <strong>Business Information:</strong> DUNS, Tax ID, industry codes, addresses
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-teal-500 rounded-full"></span>
                      <strong>Banking Details:</strong> Complete payment and wire transfer information
                    </li>
                  </ul>
                </div>

                {/* Organization Users */}
                <div className="bg-cyan-50 p-5 rounded-lg border border-cyan-200">
                  <h4 className="font-bold text-lg text-cyan-800 mb-3">
                    👥 <Link href="/organization/users" className="hover:underline text-cyan-600">Organization Users</Link>
                  </h4>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
                      <strong>User Invitations:</strong> Invite team members with role assignment
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
                      <strong>Role Management:</strong> Admin and Member roles with different permissions
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
                      <strong>User Profiles:</strong> View and manage team member details
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full"></span>
                      <strong>Access Control:</strong> Organization-specific user visibility
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* External Partner Integration */}
          <Card className="border-l-4 border-l-indigo-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                🤝 <span>External Partner Integration</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                
                {/* API Documentation */}
                <div className="bg-indigo-50 p-5 rounded-lg border border-indigo-200">
                  <h3 className="font-bold text-lg text-indigo-800 mb-3">
                    📚 <Link href="/admin/api-keys/documentation" className="hover:underline text-indigo-600">API Documentation</Link>
                  </h3>
                  <p className="text-sm text-indigo-700 mb-4">
                    Complete REST API documentation for external partner integration with production examples.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded border border-indigo-300">
                      <h4 className="font-semibold text-indigo-700 mb-2">🐍 Python Integration</h4>
                      <div className="bg-gray-100 p-2 rounded font-mono text-xs">
                        {`import requests

API_KEY = "bdi_mtn_abc123..."
BASE_URL = "https://www.bdibusinessportal.com/api/v1"

# Upload production file
files = {'file': open('production.xlsx', 'rb')}
response = requests.post(f"{BASE_URL}/production-files", 
                       headers={"Authorization": f"Bearer {API_KEY}"}, 
                       files=files)`}
                      </div>
                    </div>
                    
                    <div className="bg-white p-4 rounded border border-indigo-300">
                      <h4 className="font-semibold text-indigo-700 mb-2">🔧 cURL Integration</h4>
                      <div className="bg-gray-100 p-2 rounded font-mono text-xs">
                        {`# List production files
curl -H "Authorization: Bearer bdi_gpn_xyz..." \\
     "https://www.bdibusinessportal.com/api/v1/production-files"

# Download file
curl -H "Authorization: Bearer bdi_gpn_xyz..." \\
     "https://www.bdibusinessportal.com/api/v1/production-files/ID/download"`}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Partner Workflow Examples */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-5 rounded-lg border border-indigo-200">
                  <h3 className="font-bold text-lg text-indigo-800 mb-4">🔄 Partner Integration Workflows</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <h4 className="font-semibold text-indigo-700">🏭 ODM Partner (MTN) - Factory Integration:</h4>
                      <div className="bg-white p-3 rounded border border-indigo-300 text-sm">
                        <ol className="space-y-1">
                          <li><strong>1.</strong> Factory completes production run</li>
                          <li><strong>2.</strong> System generates production file (Excel/CSV)</li>
                          <li><strong>3.</strong> API uploads file to BDI Portal automatically</li>
                          <li><strong>4.</strong> BDI receives notification of new production data</li>
                          <li><strong>5.</strong> Connected partners (GPN) gain access via permissions</li>
                        </ol>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <h4 className="font-semibold text-indigo-700">🔬 R&D Partner (GPN) - Data Access:</h4>
                      <div className="bg-white p-3 rounded border border-indigo-300 text-sm">
                        <ol className="space-y-1">
                          <li><strong>1.</strong> API queries for new production files</li>
                          <li><strong>2.</strong> Receives list of available files from connected orgs</li>
                          <li><strong>3.</strong> Downloads relevant production data</li>
                          <li><strong>4.</strong> Processes data in R&D systems</li>
                          <li><strong>5.</strong> Provides feedback or analysis back to BDI</li>
                        </ol>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security & Permissions */}
          <Card className="border-l-4 border-l-gray-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                🔒 <span>Security & Permissions</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-lg text-gray-700">
                  The BDI Business Portal implements <strong>comprehensive security measures</strong> and 
                  <strong> granular permission controls</strong> to protect sensitive business data.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-3">🔐 Authentication Methods</h4>
                    <ul className="space-y-1 text-sm">
                      <li>• <strong>SOC 2, Type 2 Compliant:</strong> Enterprise-grade security controls and auditing</li>
                      <li>• <strong>FIPS 140-2 Compliant Encryption:</strong> Federal-grade cryptographic standards</li>
                      <li>• <strong>API Keys:</strong> Secure programmatic access for external partners</li>
                      <li>• <strong>Role-Based Access:</strong> Super Admin, Admin, Member, Developer roles</li>
                      <li>• <strong>Organization Isolation:</strong> Multi-tenant data separation</li>
                    </ul>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 className="font-semibold text-gray-800 mb-3">🎯 Permission Levels</h4>
                    <ul className="space-y-1 text-sm">
                      <li>• <strong>Public Data:</strong> Basic information accessible to connected partners</li>
                      <li>• <strong>Partner Data:</strong> Shared information between connected organizations</li>
                      <li>• <strong>Confidential Data:</strong> Sensitive business information with restricted access</li>
                      <li>• <strong>Internal Data:</strong> BDI-only information and strategic data</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Support & Contact */}
          <Card className="border-l-4 border-l-yellow-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                📞 <span>Support & Contact</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <h4 className="font-semibold text-yellow-800 mb-2">🛠️ Technical Support</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• <strong>Portal Issues:</strong> <a href="mailto:support@boundlessdevices.com" className="text-blue-600 hover:underline">support@boundlessdevices.com</a></li>
                    <li>• <strong>API Integration:</strong> <a href="mailto:api-support@boundlessdevices.com" className="text-blue-600 hover:underline">api-support@boundlessdevices.com</a></li>
                    <li>• <strong>CPFR Questions:</strong> <a href="mailto:cpfr@boundlessdevices.com" className="text-blue-600 hover:underline">cpfr@boundlessdevices.com</a></li>
                  </ul>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">💼 Business Development</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• <strong>Partnerships:</strong> <a href="mailto:partnerships@boundlessdevices.com" className="text-blue-600 hover:underline">partnerships@boundlessdevices.com</a></li>
                    <li>• <strong>New Organizations:</strong> <a href="mailto:onboarding@boundlessdevices.com" className="text-blue-600 hover:underline">onboarding@boundlessdevices.com</a></li>
                    <li>• <strong>Business Inquiries:</strong> <a href="mailto:business@boundlessdevices.com" className="text-blue-600 hover:underline">business@boundlessdevices.com</a></li>
                  </ul>
                </div>
                
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-800 mb-2">🎓 Training & Resources</h4>
                  <ul className="space-y-1 text-sm">
                    <li>• <strong>API Documentation:</strong> <Link href="/admin/api-keys/documentation" className="text-blue-600 hover:underline">Complete API Reference</Link></li>
                    <li>• <strong>CPFR Training:</strong> <a href="mailto:training@boundlessdevices.com" className="text-blue-600 hover:underline">training@boundlessdevices.com</a></li>
                    <li>• <strong>Best Practices:</strong> <a href="mailto:consulting@boundlessdevices.com" className="text-blue-600 hover:underline">consulting@boundlessdevices.com</a></li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-6 bg-gradient-to-r from-blue-50 to-green-50 p-4 rounded-lg border">
                <h4 className="font-semibold text-gray-800 mb-2">🏢 Boundless Devices Inc.</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p><strong>Business Address:</strong></p>
                    <p>Boundless Devices, Inc</p>
                    <p>17875 VON KARMAN AVE. SUITE 150</p>
                    <p>IRVINE, CA 92614</p>
                  </div>
                  <div>
                    <p><strong>General Contact:</strong></p>
                    <p>Phone: <a href="tel:949-994-7791" className="text-blue-600 hover:underline">949-994-7791</a></p>
                    <p>Email: <a href="mailto:info@boundlessdevices.com" className="text-blue-600 hover:underline">info@boundlessdevices.com</a></p>
                    <p>Portal: <a href="https://www.bdibusinessportal.com" className="text-blue-600 hover:underline">www.bdibusinessportal.com</a></p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Version Information */}
          <Card className="border-l-4 border-l-gray-400">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                ℹ️ <span>Version Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p><strong>Portal Version:</strong> Latest</p>
                    <p><strong>Last Updated:</strong> {new Date().toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p><strong>API Version:</strong> v1</p>
                    <p><strong>Documentation:</strong> <Link href="/admin/api-keys/documentation" className="text-blue-600 hover:underline">API Reference</Link></p>
                  </div>
                  <div>
                    <p><strong>Support:</strong> 24/7 Available</p>
                    <p><strong>Status:</strong> <span className="text-green-600">All Systems Operational</span></p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}