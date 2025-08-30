'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { Separator } from '@/components/ui/separator';
import useSWR from 'swr';
import { User } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Mock data for external organizations (partners/vendors)
const mockExternalOrgs = [
  {
    id: '1',
    name: 'ACME Manufacturing Corp',
    legalName: 'ACME Manufacturing Corporation',
    code: 'ACME',
    type: 'oem_partner',
    dunsNumber: '987654321',
    taxId: '98-7654321',
    industryCode: '336411',
    companySize: '201-1000',
    contactEmail: 'admin@acme-mfg.com',
    contactPhone: '+1-555-0123',
    businessAddress: '456 Manufacturing Blvd\nDetroit, MI 48201\nUnited States',
    adminUsers: [
      { name: 'John Smith', email: 'john.smith@acme-mfg.com', role: 'admin', status: 'active' },
      { name: 'Sarah Johnson', email: 'sarah.j@acme-mfg.com', role: 'member', status: 'pending' }
    ],
    totalUsers: 12,
    apiKeys: 2,
    lastActivity: '2024-01-15',
    status: 'active',
    createdAt: '2024-01-01'
  },
  {
    id: '2',
    name: 'TechCorp Solutions',
    legalName: 'TechCorp Solutions LLC',
    code: 'TECH',
    type: 'supplier',
    dunsNumber: '456789123',
    taxId: '45-6789123',
    industryCode: '541511',
    companySize: '51-200',
    contactEmail: 'contact@techcorp.com',
    contactPhone: '+1-555-0456',
    businessAddress: '789 Tech Drive\nAustin, TX 78701\nUnited States',
    adminUsers: [
      { name: 'Mike Chen', email: 'mike.chen@techcorp.com', role: 'admin', status: 'active' }
    ],
    totalUsers: 5,
    apiKeys: 1,
    lastActivity: '2024-01-10',
    status: 'active',
    createdAt: '2023-12-15'
  },
  {
    id: '3',
    name: 'Global Logistics Inc',
    legalName: 'Global Logistics Incorporated',
    code: 'GLOBAL',
    type: '3pl',
    dunsNumber: '789123456',
    taxId: '78-9123456',
    industryCode: '484110',
    companySize: '1000+',
    contactEmail: 'ops@globallogistics.com',
    contactPhone: '+1-555-0789',
    businessAddress: '321 Logistics Way\nMemphis, TN 38118\nUnited States',
    adminUsers: [
      { name: 'Lisa Wang', email: 'lisa.wang@globallogistics.com', role: 'admin', status: 'pending' }
    ],
    totalUsers: 0,
    apiKeys: 0,
    lastActivity: 'Never',
    status: 'pending',
    createdAt: '2024-01-20'
  }
];

export default function AdminOrganizationsPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);

  if (!user || user.role !== 'super_admin') {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="settings" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Access denied. Super Admin required.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <SemanticBDIIcon semantic="collaboration" size={32} />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Organizations</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Manage external partner companies, suppliers, and vendors</p>
            </div>
          </div>
          <Button 
            className="bg-bdi-green-1 hover:bg-bdi-green-2 w-full sm:w-auto justify-center" 
            onClick={() => setShowCreateModal(true)}
          >
            <SemanticBDIIcon semantic="collaboration" size={16} className="mr-2 brightness-0 invert" />
            <span className="sm:hidden">Create New Organization</span>
            <span className="hidden sm:inline">Create Organization</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-1">{mockExternalOrgs.length}</div>
            <p className="text-xs text-muted-foreground">External partners</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-2">
              {mockExternalOrgs.filter(org => org.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">Currently operational</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total External Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-blue">
              {mockExternalOrgs.reduce((total, org) => total + org.totalUsers, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all partners</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">API Integrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-1">
              {mockExternalOrgs.reduce((total, org) => total + org.apiKeys, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Active API keys</p>
          </CardContent>
        </Card>
      </div>

      {/* Organizations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="collaboration" size={20} className="mr-2" />
            External Organizations
          </CardTitle>
          <CardDescription>
            Partner companies, suppliers, and vendors with access to BDI Business Portal
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockExternalOrgs.map((org) => (
              <div key={org.id} className="border rounded-lg p-4 lg:p-6 hover:bg-gray-50 transition-colors">
                {/* Mobile-first Organization Layout */}
                <div className="flex flex-col space-y-4">
                  {/* Organization Header - Mobile Optimized */}
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 lg:w-16 lg:h-16 bg-bdi-green-1/10 rounded-xl flex items-center justify-center flex-shrink-0">
                      <SemanticBDIIcon 
                        semantic={org.type === 'oem_partner' ? 'collaboration' : org.type === 'supplier' ? 'supply' : 'sync'} 
                        size={20} 
                        className="text-bdi-green-1" 
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <h3 className="text-lg lg:text-xl font-semibold">{org.name}</h3>
                        <Badge variant={org.type === 'oem_partner' ? 'default' : 'secondary'} className="bg-bdi-blue text-white text-xs">
                          {org.type.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <Badge variant={org.status === 'active' ? 'default' : 'secondary'} 
                               className={org.status === 'active' ? 'bg-bdi-green-1 text-white text-xs' : 'text-xs'}>
                          {org.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div><strong>Legal Name:</strong> {org.legalName}</div>
                        <div className="flex flex-wrap gap-2">
                          <span><strong>Code:</strong> {org.code}</span>
                          <span><strong>DUNS:</strong> {org.dunsNumber}</span>
                          <span><strong>Tax ID:</strong> {org.taxId}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span><strong>Industry:</strong> {org.industryCode}</span>
                          <span><strong>Size:</strong> {org.companySize} employees</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Buttons - Mobile Optimized */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full sm:w-auto justify-center sm:justify-start"
                      onClick={() => setSelectedOrg(org)}
                    >
                      <SemanticBDIIcon semantic="settings" size={14} className="mr-2 sm:mr-1" />
                      <span className="sm:hidden">Manage Organization</span>
                      <span className="hidden sm:inline">Manage</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full sm:w-auto justify-center sm:justify-start bg-bdi-blue/10 hover:bg-bdi-blue/20"
                    >
                      <SemanticBDIIcon semantic="notifications" size={14} className="mr-2 sm:mr-1" />
                      <span className="sm:hidden">Invite Admin</span>
                      <span className="hidden sm:inline">Invite Admin</span>
                    </Button>
                  </div>
                </div>

                {/* Organization Stats - Mobile Optimized */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <SemanticBDIIcon semantic="users" size={16} className="mx-auto mb-1" />
                    <div className="text-base lg:text-lg font-semibold">{org.totalUsers}</div>
                    <div className="text-xs text-gray-500">Users</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <SemanticBDIIcon semantic="connect" size={16} className="mx-auto mb-1" />
                    <div className="text-base lg:text-lg font-semibold">{org.apiKeys}</div>
                    <div className="text-xs text-gray-500">API Keys</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <SemanticBDIIcon semantic="analytics" size={16} className="mx-auto mb-1" />
                    <div className="text-base lg:text-lg font-semibold">{org.lastActivity}</div>
                    <div className="text-xs text-gray-500">Last Activity</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <SemanticBDIIcon semantic="reports" size={16} className="mx-auto mb-1" />
                    <div className="text-base lg:text-lg font-semibold">{new Date(org.createdAt).toLocaleDateString()}</div>
                    <div className="text-xs text-gray-500">Created</div>
                  </div>
                </div>

                {/* Organization Admins */}
                <div>
                  <h4 className="font-medium mb-2 flex items-center">
                    <SemanticBDIIcon semantic="users" size={16} className="mr-2" />
                    Organization Administrators
                  </h4>
                  <div className="space-y-3">
                    {org.adminUsers.map((admin, index) => (
                      <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-50 rounded-lg space-y-2 sm:space-y-0">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-bdi-green-1/10 rounded-full flex items-center justify-center flex-shrink-0">
                            <SemanticBDIIcon semantic="profile" size={12} className="text-bdi-green-1" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{admin.name}</div>
                            <div className="text-xs text-gray-500 break-all">{admin.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-start sm:justify-end space-x-2">
                          <Badge variant={admin.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                            {admin.role.toUpperCase()}
                          </Badge>
                          <Badge variant={admin.status === 'active' ? 'default' : 'secondary'} 
                                 className={admin.status === 'active' ? 'bg-bdi-green-1 text-white text-xs' : 'text-xs'}>
                            {admin.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contact Information - Mobile Optimized */}
                <Separator className="my-4" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <div className="font-medium text-gray-700 flex items-center">
                      <SemanticBDIIcon semantic="connect" size={14} className="mr-2" />
                      Contact Information
                    </div>
                    <div className="text-gray-600 space-y-1">
                      <div className="break-all">{org.contactEmail}</div>
                      <div>{org.contactPhone}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-medium text-gray-700 flex items-center">
                      <SemanticBDIIcon semantic="sites" size={14} className="mr-2" />
                      Business Address
                    </div>
                    <div className="text-gray-600 whitespace-pre-line text-sm">
                      {org.businessAddress}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Super Admin Global Controls */}
      <Card className="mt-8 border-bdi-blue/20 bg-bdi-blue/5">
        <CardHeader>
          <CardTitle className="flex items-center text-bdi-blue">
            <SemanticBDIIcon semantic="settings" size={20} className="mr-2" />
            Super Admin Global Controls
          </CardTitle>
          <CardDescription>Cross-organization management and system administration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button variant="outline" className="h-16 flex flex-col gap-2 hover:border-bdi-blue hover:bg-bdi-blue/10">
              <SemanticBDIIcon semantic="analytics" size={20} />
              <span className="text-sm">Global Analytics</span>
            </Button>
            <Button variant="outline" className="h-16 flex flex-col gap-2 hover:border-bdi-blue hover:bg-bdi-blue/10">
              <SemanticBDIIcon semantic="sync" size={20} />
              <span className="text-sm">Cross-Org Sync</span>
            </Button>
            <Button variant="outline" className="h-16 flex flex-col gap-2 hover:border-bdi-blue hover:bg-bdi-blue/10">
              <SemanticBDIIcon semantic="reports" size={20} />
              <span className="text-sm">System Reports</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Organization Detail Modal */}
      {selectedOrg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <SemanticBDIIcon semantic="collaboration" size={24} className="mr-2" />
                  {selectedOrg.name}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setSelectedOrg(null)}>
                  ×
                </Button>
              </div>
              <CardDescription>Complete organization management and user administration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Organization Details */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Organization Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Company Name</Label>
                      <Input value={selectedOrg.name} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Legal Business Name</Label>
                      <Input value={selectedOrg.legalName} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>DUNS Number</Label>
                      <Input value={selectedOrg.dunsNumber} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Tax ID / EIN</Label>
                      <Input value={selectedOrg.taxId} disabled className="mt-1" />
                    </div>
                  </div>
                </div>

                {/* User Management */}
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">User Management</h3>
                    <Button size="sm" className="bg-bdi-green-1 hover:bg-bdi-green-2">
                      <SemanticBDIIcon semantic="notifications" size={14} className="mr-1 brightness-0 invert" />
                      Invite User
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {selectedOrg.adminUsers.map((admin: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-bdi-green-1/10 rounded-full flex items-center justify-center">
                            <SemanticBDIIcon semantic="profile" size={16} className="text-bdi-green-1" />
                          </div>
                          <div>
                            <div className="font-medium">{admin.name}</div>
                            <div className="text-sm text-gray-500">{admin.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={admin.role === 'admin' ? 'default' : 'secondary'}>
                            {admin.role.toUpperCase()}
                          </Badge>
                          <Badge variant={admin.status === 'active' ? 'default' : 'secondary'} 
                                 className={admin.status === 'active' ? 'bg-bdi-green-1 text-white' : ''}>
                            {admin.status.toUpperCase()}
                          </Badge>
                          <Button variant="outline" size="sm">
                            <SemanticBDIIcon semantic="settings" size={12} className="mr-1" />
                            Manage
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* API & Integration Management */}
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-4">API & Integration Management</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">API Access</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{selectedOrg.apiKeys} Active Keys</div>
                            <div className="text-sm text-gray-500">Developer access enabled</div>
                          </div>
                          <Button variant="outline" size="sm">
                            <SemanticBDIIcon semantic="connect" size={12} className="mr-1" />
                            Manage Keys
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Data Access</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">CPFR Portal</div>
                            <div className="text-sm text-gray-500">Full access granted</div>
                          </div>
                          <Button variant="outline" size="sm">
                            <SemanticBDIIcon semantic="analytics" size={12} className="mr-1" />
                            View Access
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Organization Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center">
                <SemanticBDIIcon semantic="collaboration" size={24} className="mr-2" />
                Create New Organization
              </CardTitle>
              <CardDescription>Add a new partner company, supplier, or vendor</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="orgName">Company Name</Label>
                    <Input id="orgName" placeholder="ACME Manufacturing Corp" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="orgCode">Organization Code</Label>
                    <Input id="orgCode" placeholder="ACME" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="orgType">Organization Type</Label>
                    <select className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm">
                      <option value="oem_partner">OEM Partner</option>
                      <option value="supplier">Supplier</option>
                      <option value="3pl">3PL Provider</option>
                      <option value="customer">Customer</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="adminEmail">Admin Email</Label>
                    <Input id="adminEmail" type="email" placeholder="admin@company.com" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="orgDescription">Description</Label>
                  <textarea
                    id="orgDescription"
                    placeholder="Brief description of the organization and partnership"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button className="bg-bdi-green-1 hover:bg-bdi-green-2">
                    Create & Send Invitation
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
