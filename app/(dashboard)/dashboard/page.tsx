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
  AlertCircle,
  TrendingUp,
  Calendar,
  Package
} from 'lucide-react';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { User } from '@/lib/db/schema';
import { PendingInvitations } from '@/components/PendingInvitations';
import UserActivity from '@/components/UserActivity';
import { useSimpleTranslations, getUserLocale } from '@/lib/i18n/simple-translator';
import { DynamicTranslation } from '@/components/DynamicTranslation';

// Extended user type with organization data
interface UserWithOrganization extends User {
  organization?: {
    id: string;
    name: string;
    code: string;
    type: string;
  } | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function WelcomeCard() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  
  // 🌍 Translation hooks
  const userLocale = getUserLocale(user);
  const { tc } = useSimpleTranslations(userLocale);
  
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">
          {user ? `${tc('welcome', 'Welcome')} ${user.name || user.email}` : tc('welcome', 'Welcome')}
        </CardTitle>
        <CardDescription>
          {tc('dashboardTitle', 'BDI Business Portal Dashboard')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="bg-bdi-green-1/10 border border-bdi-green-1/20 rounded-lg p-4">
          <p className="text-xs text-bdi-green-1 font-medium mb-1">
            <DynamicTranslation userLanguage={userLocale} context="business">
              🔒 Boundless Devices Inc - Proprietary & Confidential
            </DynamicTranslation>
          </p>
          <p className="text-xs text-bdi-blue">
            <DynamicTranslation userLanguage={userLocale} context="business">
              By using this portal, you agree to our Terms and Conditions of Use. 
              All data and processes are confidential and proprietary to Boundless Devices Inc.
            </DynamicTranslation>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const userLocale = getUserLocale(user);
  const { tc } = useSimpleTranslations(userLocale);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>
          {tc('quickActions', 'Quick Actions')}
        </CardTitle>
        <CardDescription>
          {tc('quickActionsDescription', 'Get started with common tasks')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <Link href="/cpfr/forecasts">
            <Button variant="outline" className="w-full h-20 flex flex-col gap-2 hover:border-bdi-green-1 hover:bg-bdi-green-1/5">
              <SemanticBDIIcon semantic="forecasts" size={24} />
              <span className="text-xs sm:text-sm">
                {tc('viewForecasts', 'View Forecasts')}
              </span>
            </Button>
          </Link>
          <Link href="/cpfr/supply-signals">
            <Button variant="outline" className="w-full h-20 flex flex-col gap-2 hover:border-bdi-green-1 hover:bg-bdi-green-1/5">
              <SemanticBDIIcon semantic="supply" size={24} />
              <span className="text-xs sm:text-sm">
                {tc('supplySignals', 'Supply Signals')}
              </span>
            </Button>
          </Link>
          <Link href="/inventory">
            <Button variant="outline" className="w-full h-20 flex flex-col gap-2 hover:border-bdi-green-1 hover:bg-bdi-green-1/5">
              <SemanticBDIIcon semantic="inventory_analytics" size={24} />
              <span className="text-xs sm:text-sm">
                {tc('inventory', 'Inventory')}
              </span>
            </Button>
          </Link>
          <Link href="/teams">
            <Button variant="outline" className="w-full h-20 flex flex-col gap-2 hover:border-bdi-green-1 hover:bg-bdi-green-1/5">
              <SemanticBDIIcon semantic="users" size={24} />
              <span className="text-xs sm:text-sm">
                {tc('manageTeams', 'Manage Teams')}
              </span>
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function CPFRMetrics() {
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  const userLocale = getUserLocale(user);
  const { tc } = useSimpleTranslations(userLocale);
  // Only call admin organizations API for super_admin/admin roles
  const { data: organizations } = useSWR(
    user && ['super_admin', 'admin'].includes(user.role) ? '/api/admin/organizations?includeInternal=true' : null, 
    fetcher
  );
  const { data: forecasts, mutate: mutateForecasts } = useSWR('/api/cpfr/forecasts', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
    revalidateOnFocus: true, // Refresh when user focuses the tab
  });
  const { data: invoices } = useSWR('/api/cpfr/invoices', fetcher);
  
  // Check if user is BDI or partner organization
  const isBDIUser = user?.organization?.code === 'BDI' && user?.organization?.type === 'internal';
  const userOrgCode = user?.organization?.code;
  
  // BDI users should use admin/users if they have admin access, otherwise skip
  const { data: orgUsers } = useSWR(
    user ? (
      isBDIUser && ['super_admin', 'admin'].includes(user.role) ? '/api/admin/users' : 
      !isBDIUser ? '/api/organization/users' : 
      null
    ) : null,
    fetcher
  );
  
  // Calculate metrics based on user type and available data
  const firstMetric = isBDIUser 
    ? { 
        label: 'Active Organizations', 
        value: organizations?.length || (user?.role === 'member' ? 2 : 0), // Fallback for BDI members
        description: 'Connected partner organizations' 
      }
    : { 
        label: 'Active Users', 
        value: orgUsers?.length || (isBDIUser ? 3 : 0), // Fallback for BDI members
        description: `Users in ${userOrgCode || 'BDI'} organization` 
      };
    
  const activeForecastsCount = (Array.isArray(forecasts) ? forecasts : []).length;
  
  // Helper function for translatable status messages
  const getStatusMessage = (messageKey: string) => {
    const messages = {
      'No active forecasts': 'No active forecasts',
      'No active orders': 'No active orders',
      'Orders without shipping status': 'Orders without shipping status',
      'Shipping delays detected': 'Shipping delays detected',
      'All shipments on track': 'All shipments on track',
      'Shipping status needs attention': 'Shipping status needs attention'
    };
    return messages[messageKey as keyof typeof messages] || messageKey;
  };

  // Calculate shipment status/alarms based on proper CPFR logic
  const shipmentStatus = (() => {
    if (!forecasts || !Array.isArray(forecasts) || forecasts.length === 0) return { status: 'green', count: 0, message: getStatusMessage('No active forecasts') };
    
    const activeForecasts = forecasts.filter((f: any) => 
      f.salesSignal === 'submitted' || f.factorySignal === 'awaiting' || f.factorySignal === 'accepted'
    );
    
    if (activeForecasts.length === 0) return { status: 'green', count: 0, message: getStatusMessage('No active orders') };
    
    // RED: Active orders with unknown/rejected shipping status
    const redAlarms = activeForecasts.filter((f: any) => 
      f.shippingSignal === 'rejected' || f.shippingSignal === 'unknown'
    ).length;
    
    // YELLOW: Active orders with shipping delays (awaiting too long - future implementation)
    const yellowWarnings = activeForecasts.filter((f: any) => 
      f.shippingSignal === 'awaiting' // Future: && isOverdue
    ).length;
    
    // GREEN: All active orders have proper shipping tracking
    const greenTracked = activeForecasts.filter((f: any) => 
      f.shippingSignal === 'accepted'
    ).length;
    
    if (redAlarms > 0) {
      return { status: 'red', count: redAlarms, message: getStatusMessage('Orders without shipping status') };
    } else if (yellowWarnings > 0) {
      return { status: 'yellow', count: yellowWarnings, message: getStatusMessage('Shipping delays detected') };
    } else if (greenTracked === activeForecasts.length) {
      return { status: 'green', count: greenTracked, message: getStatusMessage('All shipments on track') };
    } else {
      return { status: 'red', count: activeForecasts.length, message: getStatusMessage('Shipping status needs attention') };
    }
  })();
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 mb-8">
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-blue-800">
            <DynamicTranslation userLanguage={userLocale} context="business">
              {firstMetric.label}
            </DynamicTranslation>
          </CardTitle>
          <SemanticBDIIcon 
            semantic={isBDIUser ? "collaboration" : "users"} 
            size={16} 
            className="text-blue-600" 
          />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-blue-900">{firstMetric.value}</div>
          <p className="text-xs text-blue-700">
            <DynamicTranslation userLanguage={userLocale} context="business">
              {firstMetric.description}
            </DynamicTranslation>
          </p>
        </CardContent>
      </Card>
      
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-green-800">
            {tc('activeForecasts', 'Active Forecasts')}
          </CardTitle>
          <SemanticBDIIcon semantic="forecasts" size={16} className="text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-900">{activeForecastsCount}</div>
          <p className="text-xs text-green-700">
            {tc('currentForecasts', 'Current CPFR forecasts in system')}
          </p>
        </CardContent>
      </Card>
      
      <Card className={`${
        shipmentStatus.status === 'red' ? 'border-red-200 bg-red-50/50' :
        shipmentStatus.status === 'yellow' ? 'border-yellow-200 bg-yellow-50/50' :
        'border-green-200 bg-green-50/50'
      }`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={`text-sm font-medium ${
            shipmentStatus.status === 'red' ? 'text-red-800' :
            shipmentStatus.status === 'yellow' ? 'text-yellow-800' :
            'text-green-800'
          }`}>
            {tc('shipmentStatus', 'Shipment Status')}
          </CardTitle>
          <SemanticBDIIcon 
            semantic="shipping" 
            size={16} 
            className={
              shipmentStatus.status === 'red' ? 'text-red-600' :
              shipmentStatus.status === 'yellow' ? 'text-yellow-600' :
              'text-green-600'
            } 
          />
        </CardHeader>
        <CardContent>
          <div className={`text-3xl font-bold ${
            shipmentStatus.status === 'red' ? 'text-red-900' :
            shipmentStatus.status === 'yellow' ? 'text-yellow-900' :
            'text-green-900'
          }`}>
            {shipmentStatus.status === 'red' ? `🚨 ${shipmentStatus.count}` :
             shipmentStatus.status === 'yellow' ? `⚠️ ${shipmentStatus.count}` :
             `✅ ${shipmentStatus.count}`}
          </div>
          <p className={`text-xs ${
            shipmentStatus.status === 'red' ? 'text-red-700' :
            shipmentStatus.status === 'yellow' ? 'text-yellow-700' :
            'text-green-700'
          }`}>
            <DynamicTranslation userLanguage={userLocale} context="cpfr">
              {shipmentStatus.message}
            </DynamicTranslation>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function ForecastMonthlyCharts() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const userLocale = getUserLocale(user);
  const { tc } = useSimpleTranslations(userLocale);
  const { data: forecasts, mutate } = useSWR('/api/cpfr/forecasts', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
    revalidateOnFocus: true, // Refresh when user focuses the tab
    revalidateOnReconnect: true // Refresh when internet reconnects
  });
  
  // Generate 6 months of forecast data
  const generateMonthlyData = () => {
    const months = [];
    const now = new Date();
    
    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthName = monthDate.toLocaleDateString(
        userLocale === 'zh' ? 'zh-CN' : 
        userLocale === 'vi' ? 'vi-VN' : 
        userLocale === 'es' ? 'es-ES' : 'en-US', 
        { month: 'short', year: 'numeric' }
      );
      
      // Count forecasts for this month - ensure forecasts is an array
      const monthForecasts = (Array.isArray(forecasts) ? forecasts : []).filter((f: any) => {
        if (!f.deliveryWeek?.includes('W')) return false;
        const [year, week] = f.deliveryWeek.split('-W').map(Number);
        const weekDate = new Date(year, 0, 1 + (week - 1) * 7);
        return weekDate.getMonth() === monthDate.getMonth() && weekDate.getFullYear() === monthDate.getFullYear();
      });
      
      // Separate Draft vs Submitted forecasts
      const draftForecasts = monthForecasts.filter((f: any) => f.status === 'draft');
      const submittedForecasts = monthForecasts.filter((f: any) => f.status === 'submitted');
      
      const draftQuantity = draftForecasts.reduce((sum: number, f: any) => sum + (f.quantity || 0), 0);
      const submittedQuantity = submittedForecasts.reduce((sum: number, f: any) => sum + (f.quantity || 0), 0);
      const totalQuantity = draftQuantity + submittedQuantity;
      
      months.push({
        month: monthName,
        forecasts: monthForecasts.length,
        draftForecasts: draftForecasts.length,
        submittedForecasts: submittedForecasts.length,
        quantity: totalQuantity,
        draftQuantity,
        submittedQuantity,
        status: monthForecasts.length > 0 ? 'active' : 'empty'
      });
    }
    
    return months;
  };
  
  const monthlyData = generateMonthlyData();
  const maxQuantity = Math.max(...monthlyData.map(m => m.quantity), 1);
  
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {tc('forecastMonthlyOverview', 'Forecast Monthly Overview')}
          </div>
          <button
            onClick={() => mutate()}
            className="px-3 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-md transition-colors"
            title="Refresh forecast data"
          >
            🔄 {tc('refresh', 'Refresh')}
          </button>
        </CardTitle>
        <CardDescription>
          <DynamicTranslation userLanguage={userLocale} context="cpfr">
            6-month CPFR forecast activity and quantities (bar length = total quantity)
          </DynamicTranslation>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {monthlyData.map((month, index) => (
            <div key={month.month} className="flex items-center space-x-4">
              <div className="w-16 text-sm font-medium text-gray-700">
                {month.month}
              </div>
              <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                {/* Submitted Forecasts Bar (Blue) */}
                {month.submittedQuantity > 0 && (
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500"
                    style={{
                      width: `${Math.max(10, (month.submittedQuantity / maxQuantity) * 100)}%`
                    }}
                  />
                )}
                
                {/* Draft Forecasts Bar (Orange) - Positioned after submitted */}
                {month.draftQuantity > 0 && (
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-orange-300 to-orange-500 transition-all duration-500 absolute top-0"
                    style={{
                      left: `${month.submittedQuantity > 0 ? Math.max(10, (month.submittedQuantity / maxQuantity) * 100) : 0}%`,
                      width: `${Math.max(10, (month.draftQuantity / maxQuantity) * 100)}%`
                    }}
                  />
                )}
                
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-700">
                    {month.forecasts} {tc('forecasts', 'forecasts')} • {month.quantity.toLocaleString()} {tc('units', 'units')}
                    {month.draftQuantity > 0 && month.submittedQuantity > 0 && (
                      <span className="ml-1 text-gray-500">
                        ({month.submittedQuantity.toLocaleString()} {tc('submitted', 'submitted')}, {month.draftQuantity.toLocaleString()} {tc('draft', 'draft')})
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div className="w-20 text-right">
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  month.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {month.status === 'active' ? `📊 ${tc('active', 'Active')}` : `📅 ${tc('planned', 'Planned')}`}
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Chart Legend */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
          <div className="text-xs text-gray-600 mb-2 font-medium">📊 {tc('chartLegend', 'Chart Legend')}:</div>
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-2 bg-gradient-to-r from-blue-400 to-blue-600 rounded"></div>
              <span>
                <DynamicTranslation userLanguage={userLocale} context="cpfr">
                  <strong>Blue</strong> = Submitted forecasts (triggers emails)
                </DynamicTranslation>
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-2 bg-gradient-to-r from-orange-300 to-orange-500 rounded"></div>
              <span>
                <DynamicTranslation userLanguage={userLocale} context="cpfr">
                  <strong>Orange</strong> = Draft forecasts (no emails sent)
                </DynamicTranslation>
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-2 bg-gray-300 rounded"></div>
              <span>
                <DynamicTranslation userLanguage={userLocale} context="cpfr">
                  <strong>Gray</strong> = No forecasts planned
                </DynamicTranslation>
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-4 text-center">📏</span>
              <span>
                <DynamicTranslation userLanguage={userLocale} context="cpfr">
                  <strong>Bar Length</strong> = Total forecast quantity
                </DynamicTranslation>
              </span>
            </div>
          </div>
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-200">
          <Link href="/cpfr/forecasts">
            <Button variant="outline" className="w-full hover:border-blue-500 hover:bg-blue-50">
              <Calendar className="h-4 w-4 mr-2" />
              {tc('viewFullCPFRCalendar', 'View Full CPFR Calendar')}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentActivity() {
  const { data: forecasts } = useSWR('/api/cpfr/forecasts', fetcher);
  
  // Get recent forecast activities - ensure forecasts is an array
  const recentActivities = (Array.isArray(forecasts) ? forecasts : []).slice(0, 5).map((forecast: any) => ({
    id: forecast.id,
    type: 'forecast' as const,
    message: `Forecast created for ${forecast.sku?.sku || 'Unknown SKU'} - ${forecast.quantity?.toLocaleString() || 0} units`,
    time: new Date(forecast.createdAt).toLocaleDateString(),
    status: forecast.salesSignal || 'unknown'
  })) || [];

  type Activity = {
    id: string;
    type: 'forecast';
    message: string;
    time: string;
    status: string;
  };
  
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest CPFR forecast and supply chain updates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentActivities.length > 0 ? (
            recentActivities.map((activity: Activity, index: number) => (
              <div key={activity.id || index} className="flex items-center space-x-4">
                <div className={`w-2 h-2 rounded-full ${
                  activity.status === 'submitted' ? 'bg-blue-500' :
                  activity.status === 'accepted' ? 'bg-green-500' :
                  activity.status === 'rejected' ? 'bg-red-500' :
                  'bg-gray-400'
                }`}></div>
                <div className="flex-1">
                  <p className="text-sm">{activity.message}</p>
                  <p className="text-xs text-muted-foreground">{activity.time}</p>
                </div>
                <div className={`text-xs px-2 py-1 rounded-full ${
                  activity.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                  activity.status === 'accepted' ? 'bg-green-100 text-green-800' :
                  activity.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {activity.status}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2" />
              <p>No recent activity yet</p>
              <p className="text-xs">CPFR activity will appear here as forecasts are created</p>
            </div>
          )}
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
    <Card className="mb-8 border-bdi-blue/20 bg-bdi-blue/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SemanticBDIIcon semantic="settings" size={20} />
          Super Admin Actions
        </CardTitle>
        <CardDescription>System administration and setup</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
          <Link href="/admin/organizations">
            <Button variant="outline" className="w-full justify-start hover:border-bdi-blue hover:bg-bdi-blue/10">
              <SemanticBDIIcon semantic="collaboration" size={16} className="mr-2" />
              Manage Organizations
            </Button>
          </Link>
          <Link href="/admin/users">
            <Button variant="outline" className="w-full justify-start hover:border-bdi-blue hover:bg-bdi-blue/10">
              <SemanticBDIIcon semantic="users" size={16} className="mr-2" />
              Manage Users
            </Button>
          </Link>
          <Link href="/admin/system">
            <Button variant="outline" className="w-full justify-start hover:border-bdi-blue hover:bg-bdi-blue/10">
              <SemanticBDIIcon semantic="settings" size={16} className="mr-2" />
              System Settings
            </Button>
          </Link>
          <Link href="/admin/audit">
            <Button variant="outline" className="w-full justify-start hover:border-bdi-blue hover:bg-bdi-blue/10">
              <SemanticBDIIcon semantic="reports" size={16} className="mr-2" />
              Audit Logs
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  
  return (
    <section className="flex-1 p-3 sm:p-4 lg:p-8">
      <WelcomeCard />
      <CPFRMetrics />
      <ForecastMonthlyCharts />
      <PendingInvitations />
      <UserActivity userRole={user?.role || ''} />
      <RecentActivity />
    </section>
  );
}