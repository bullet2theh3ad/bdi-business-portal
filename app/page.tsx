import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-bdi-green-1/10 to-bdi-green-2/10">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
                  <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
          BDI Business Portal
        </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Collaborative Planning, Forecasting & Replenishment (CPFR) 
            Supply Chain Management Platform
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/sign-in">
              <Button size="lg" className="bg-bdi-green-1 hover:bg-bdi-green-2">
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button size="lg" variant="outline">
                Sign Up
              </Button>
            </Link>
          </div>
          
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold mb-2">CPFR Management</h3>
              <p className="text-gray-600">Collaborate on forecasts and supply signals with partners</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold mb-2">Inventory Tracking</h3>
              <p className="text-gray-600">Monitor items and sites across your supply network</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="text-lg font-semibold mb-2">Team Collaboration</h3>
              <p className="text-gray-600">Manage organizations, teams, and user access</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );  
} 