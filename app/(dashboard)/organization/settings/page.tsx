'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { Badge } from '@/components/ui/badge';
import useSWR from 'swr';
import { useSimpleTranslations, getUserLocale } from '@/lib/i18n/simple-translator';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface PageAccessSettings {
  cpfr_forecasts: boolean;
  cpfr_shipments: boolean;
  cpfr_invoices: boolean;
  cpfr_purchase_orders: boolean;
  inventory_production_files: boolean;
  inventory_warehouses: boolean;
  organization_users: boolean;
  organization_analytics: boolean;
}

export default function OrganizationSettingsPage() {
  const { data: user } = useSWR('/api/user', fetcher);
  
  // 🌍 Translation hooks
  const userLocale = getUserLocale(user);
  const { tc } = useSimpleTranslations(userLocale);
  
  const { data: orgSettings } = useSWR('/api/organization/settings', fetcher);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pageSettings, setPageSettings] = useState<PageAccessSettings>({
    cpfr_forecasts: true,
    cpfr_shipments: true,
    cpfr_invoices: true,
    cpfr_purchase_orders: true,
    inventory_production_files: true,
    inventory_warehouses: true,
    organization_users: true,
    organization_analytics: false,
  });

  // Load current settings when available
  useEffect(() => {
    if (orgSettings?.enabledPages) {
      setPageSettings(prev => ({ ...prev, ...orgSettings.enabledPages }));
    }
  }, [orgSettings]);

  // Only organization admins can access settings
  if (!user || !['admin', 'super_admin'].includes(user.role)) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="security" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Access denied. Organization Admin required.</p>
          </div>
        </div>
      </div>
    );
  }

  const handleUpdateSettings = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch('/api/organization/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabledPages: pageSettings }),
      });

      if (response.ok) {
        alert('Page access settings updated successfully!');
      } else {
        const error = await response.json();
        console.error('Settings update error:', error);
        alert(`Error: ${error.error || 'Failed to update settings'}`);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Failed to update settings. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const pageCategories = [
    {
      title: 'CPFR Pages',
      description: 'Collaborative Planning, Forecasting & Replenishment',
      icon: 'analytics',
      pages: [
        { key: 'cpfr_forecasts', label: 'Forecasts', description: 'Sales forecasts and demand planning' },
        { key: 'cpfr_shipments', label: 'Shipments', description: 'Shipment tracking and logistics' },
        { key: 'cpfr_invoices', label: 'Invoices', description: 'Invoice management and billing' },
        { key: 'cpfr_purchase_orders', label: 'Purchase Orders', description: 'Purchase order management' },
      ]
    },
    {
      title: 'Inventory Pages',
      description: 'Inventory and warehouse management',
      icon: 'inventory',
      pages: [
        { key: 'inventory_production_files', label: 'Production Files', description: 'Production planning files and templates' },
        { key: 'inventory_warehouses', label: 'Warehouses', description: 'Warehouse management and capacity' },
      ]
    },
    {
      title: 'Organization Pages',
      description: 'Organization management and analytics',
      icon: 'collaboration',
      pages: [
        { key: 'organization_users', label: 'Users', description: 'User management and invitations' },
        { key: 'organization_analytics', label: 'Analytics', description: 'Organization analytics and reports (requires connections)' },
      ]
    }
  ];

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-2">
          <SemanticBDIIcon semantic="settings" size={32} />
          <div>
            <h1 className="text-3xl font-bold">{tc('organizationSettingsTitle', 'Organization Settings')}</h1>
            <p className="text-muted-foreground">{tc('organizationSettingsDescription', 'Configure organization preferences and settings')}</p>
          </div>
        </div>
        {user?.organization && (
          <Badge variant="secondary" className="mt-2">
            {user.organization.name} ({user.organization.code})
          </Badge>
        )}
      </div>

      {/* Page Access Control */}
      <div className="space-y-6">
        {pageCategories.map((category) => (
          <Card key={category.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <SemanticBDIIcon semantic={category.icon as any} size={24} />
                {category.title}
              </CardTitle>
              <CardDescription>{category.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {category.pages.map((page) => (
                  <div key={page.key} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <Label htmlFor={page.key} className="font-medium">
                        {page.label}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {page.description}
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      id={page.key}
                      checked={pageSettings[page.key as keyof PageAccessSettings]}
                      onChange={(e) => 
                        setPageSettings(prev => ({ ...prev, [page.key]: e.target.checked }))
                      }
                      className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button 
            onClick={handleUpdateSettings}
            disabled={isUpdating}
            className="bg-green-600 hover:bg-green-700"
          >
            {isUpdating ? 'Updating...' : 'Save Settings'}
          </Button>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <SemanticBDIIcon semantic="info" size={20} className="text-blue-600 mt-1" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-2">Page Access Control Information:</p>
                <ul className="space-y-1 text-xs">
                  <li>• <strong>Enabled pages:</strong> Users in your organization can access these pages</li>
                  <li>• <strong>Disabled pages:</strong> Will show "Access Denied" message to users</li>
                  <li>• <strong>Data isolation:</strong> Users only see data from your organization</li>
                  <li>• <strong>Connections:</strong> Enable cross-organization data sharing via Connections page</li>
                  <li>• <strong>BDI Admin:</strong> Can override these settings for all organizations</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
