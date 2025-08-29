'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function UserGuidePage() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-2xl font-bold mb-6">BDI Portal User Guide</h1>
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>
              Welcome to BDI Portal - your comprehensive CPFR (Collaborative Planning, 
              Forecasting & Replenishment) supply chain management platform.
            </p>
            
            <h3 className="font-semibold text-lg">Key Features</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>CPFR Management:</strong> Collaborate on forecasts and supply signals</li>
              <li><strong>Inventory Tracking:</strong> Monitor items and sites across your network</li>
              <li><strong>Team Collaboration:</strong> Manage organizations, teams, and user access</li>
              <li><strong>Admin Controls:</strong> Super admin capabilities for system management</li>
            </ul>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Navigation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold">CPFR</h4>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• Forecasts - Manage demand forecasts</li>
                  <li>• Supply Signals - ODM/supplier commitments</li>
                  <li>• Cycles - Planning cycle management</li>
                  <li>• Overview - Supply vs demand analysis</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold">Inventory</h4>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• Items - SKU master data</li>
                  <li>• Sites - Warehouse/location management</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold">Teams</h4>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• Team management and collaboration</li>
                  <li>• Role-based access control</li>
                </ul>
              </div>
              
              <div>
                <h4 className="font-semibold">My Account</h4>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• Profile - Personal information</li>
                  <li>• Settings - User preferences</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-800">🚧 Setup in Progress</h4>
              <p className="text-yellow-700 mt-2">
                The BDI Portal is currently being set up. Database migrations and 
                initial configuration are in progress. Some features may not be 
                fully functional yet.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
