'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import useSWR from 'swr';
import Link from 'next/link';
import { 
  Building2, 
  Users, 
  Package, 
  TrendingUp, 
  AlertCircle,
  BarChart3,
  Calendar,
  Settings
} from 'lucide-react';
import { User } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function WelcomeCard() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-2xl">
          {user ? `Welcome ${user.name || user.email}` : 'Welcome'}
        </CardTitle>
        <CardDescription>
          BDI Business Portal Dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-xs text-amber-800 font-medium mb-1">
            🔒 Boundless Devices Inc - Proprietary & Confidential
          </p>
          <p className="text-xs text-amber-700">
            By using this portal, you agree to our Terms and Conditions of Use. 
            All data and processes are confidential and proprietary to Boundless Devices Inc.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Get started with common tasks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/cpfr/forecasts">
            <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
              <TrendingUp className="h-6 w-6" />
              <span className="text-sm">View Forecasts</span>
            </Button>
          </Link>
          <Link href="/cpfr/supply-signals">
            <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
              <Package className="h-6 w-6" />
              <span className="text-sm">Supply Signals</span>
            </Button>
          </Link>
          <Link href="/inventory">
            <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
              <BarChart3 className="h-6 w-6" />
              <span className="text-sm">Inventory</span>
            </Button>
          </Link>
          <Link href="/teams">
            <Button variant="outline" className="w-full h-20 flex flex-col gap-2">
              <Users className="h-6 w-6" />
              <span className="text-sm">Manage Teams</span>
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function SystemOverview() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const isSuperAdmin = user?.role === 'super_admin';
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Organizations</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">--</div>
          <p className="text-xs text-muted-foreground">
            Organizations in the system
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Forecasts</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">--</div>
          <p className="text-xs text-muted-foreground">
            Current period forecasts
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Supply Commitments</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">--</div>
          <p className="text-xs text-muted-foreground">
            Confirmed supply signals
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RecentActivity() {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest updates across your CPFR processes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-sm">System initialized - ready for configuration</p>
              <p className="text-xs text-muted-foreground">Just now</p>
            </div>
          </div>
          <div className="text-center py-4 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>No recent activity yet</p>
            <p className="text-xs">Activity will appear here as you use the system</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminActions() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const isSuperAdmin = user?.role === 'super_admin';
  
  if (!isSuperAdmin) {
    return null;
  }
  
  return (
    <Card className="mb-8 border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Super Admin Actions
        </CardTitle>
        <CardDescription>System administration and setup</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link href="/admin/organizations">
            <Button variant="outline" className="w-full justify-start">
              <Building2 className="h-4 w-4 mr-2" />
              Manage Organizations
            </Button>
          </Link>
          <Link href="/admin/users">
            <Button variant="outline" className="w-full justify-start">
              <Users className="h-4 w-4 mr-2" />
              Manage Users
            </Button>
          </Link>
          <Link href="/admin/system">
            <Button variant="outline" className="w-full justify-start">
              <Settings className="h-4 w-4 mr-2" />
              System Settings
            </Button>
          </Link>
          <Link href="/admin/audit">
            <Button variant="outline" className="w-full justify-start">
              <Calendar className="h-4 w-4 mr-2" />
              Audit Logs
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <WelcomeCard />
      <AdminActions />
      <QuickActions />
      <SystemOverview />
      <RecentActivity />
    </section>
  );
}