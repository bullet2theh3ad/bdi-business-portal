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

// Define available capabilities that can be granted to organizations
const AVAILABLE_CAPABILITIES = [
  { id: 'cpfr', name: 'CPFR Portal', description: 'Access to Collaborative Planning, Forecasting & Replenishment' },
  { id: 'inventory', name: 'Inventory Analytics', description: 'View inventory levels, analytics, and reports' },
  { id: 'supply_chain', name: 'Supply Chain', description: 'Supply chain visibility and management tools' },
  { id: 'api_access', name: 'API Access', description: 'Programmatic access to data and services' },
  { id: 'reporting', name: 'Advanced Reporting', description: 'Custom reports and data exports' },
  { id: 'collaboration', name: 'Team Collaboration', description: 'Cross-organization team features' },
  { id: 'document_management', name: 'Document Management', description: 'Upload and manage business documents' },
] as const;

type CapabilityId = typeof AVAILABLE_CAPABILITIES[number]['id'];

interface OrganizationInvitation {
  companyName: string;
  organizationCode: string;
  organizationType: 'contractor' | 'shipping_logistics' | 'oem_partner' | 'rd_partner' | 'distributor' | 'retail_partner' | 'threpl_partner';
  adminName: string;
  adminEmail: string;
  capabilities: CapabilityId[];
  description?: string;
}

export default function AdminOrganizationsPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const { data: organizations, mutate: mutateOrganizations } = useSWR('/api/admin/organizations', fetcher);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [inviteForm, setInviteForm] = useState<OrganizationInvitation>({
    companyName: '',
    organizationCode: '',
    organizationType: 'contractor',
    adminName: '',
    adminEmail: '',
    capabilities: ['document_management'], // Default capability
    description: ''
  });

  const handleInviteOrganization = async () => {
    if (!inviteForm.companyName || !inviteForm.adminEmail || !inviteForm.adminName) {
      alert('Please fill in all required fields');
      return;
    }

    setIsInviting(true);
    try {
      const response = await fetch('/api/admin/organizations/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm)
      });

      if (!response.ok) {
        throw new Error('Failed to send invitation');
      }

      const result = await response.json();
      console.log('Organization invitation sent:', result);
      
      // Reset form and close modal
      setInviteForm({
        companyName: '',
        organizationCode: '',
        organizationType: 'contractor',
        adminName: '',
        adminEmail: '',
        capabilities: ['document_management'],
        description: ''
      });
      setShowInviteModal(false);
      
      // Refresh organizations list
      mutateOrganizations();
      
      alert('Organization invitation sent successfully!');
    } catch (error) {
      console.error('Error sending invitation:', error);
      alert('Failed to send invitation. Please try again.');
    } finally {
      setIsInviting(false);
    }
  };

  const toggleCapability = (capabilityId: CapabilityId) => {
    setInviteForm(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(capabilityId)
        ? prev.capabilities.filter(id => id !== capabilityId)
        : [...prev.capabilities, capabilityId]
    }));
  };

  const handleDeleteOrganization = async (orgId: string, orgName: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${orgName}"? This will remove the organization, all its users, and cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/organizations/${orgId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete organization');
      }

      const result = await response.json();
      console.log('Organization deleted:', result);
      
      // Close modal and refresh organizations list
      setSelectedOrg(null);
      mutateOrganizations();
      
      alert(`Organization "${orgName}" has been permanently deleted.`);
    } catch (error) {
      console.error('Error deleting organization:', error);
      alert('Failed to delete organization. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRevokeInvitation = async (orgId: string, orgName: string) => {
    if (!confirm(`Are you sure you want to revoke the invitation for "${orgName}"? This will delete the pending organization and admin user.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/organizations/${orgId}/revoke`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke invitation');
      }

      const result = await response.json();
      console.log('Invitation revoked:', result);
      
      // Close modal and refresh organizations list
      setSelectedOrg(null);
      mutateOrganizations();
      
      alert(`Invitation for "${orgName}" has been revoked and organization deleted.`);
    } catch (error) {
      console.error('Error revoking invitation:', error);
      alert('Failed to revoke invitation. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

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
            onClick={() => setShowInviteModal(true)}
          >
            <SemanticBDIIcon semantic="notifications" size={16} className="mr-2 brightness-0 invert" />
            <span className="sm:hidden">Invite New Organization</span>
            <span className="hidden sm:inline">Invite Organization</span>
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
            <div className="text-2xl font-bold text-bdi-green-1">
              {Array.isArray(organizations) ? organizations.length : '...'}
            </div>
            <p className="text-xs text-muted-foreground">External partners</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-2">
              {Array.isArray(organizations) ? organizations.filter((org: any) => org.isActive).length : '...'}
            </div>
            <p className="text-xs text-muted-foreground">Currently operational</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-blue">
              {Array.isArray(organizations) ? organizations.filter((org: any) => !org.isActive).length : '...'}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting setup</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Capabilities Granted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-1">
              {AVAILABLE_CAPABILITIES.length}
            </div>
            <p className="text-xs text-muted-foreground">Available features</p>
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
          {!organizations ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <SemanticBDIIcon semantic="sync" size={32} className="mx-auto mb-4 text-muted-foreground animate-spin" />
                <p className="text-muted-foreground">Loading organizations...</p>
              </div>
            </div>
          ) : !Array.isArray(organizations) || organizations.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <SemanticBDIIcon semantic="collaboration" size={48} className="mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Organizations Yet</h3>
                <p className="text-muted-foreground mb-4">Get started by inviting your first partner organization</p>
                <Button 
                  className="bg-bdi-green-1 hover:bg-bdi-green-2" 
                  onClick={() => setShowInviteModal(true)}
                >
                  <SemanticBDIIcon semantic="notifications" size={16} className="mr-2 brightness-0 invert" />
                  Invite Organization
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {organizations.map((org: any) => (
                <div key={org.id} className="border rounded-lg p-4 lg:p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col space-y-4">
                    {/* Organization Header */}
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 lg:w-16 lg:h-16 bg-bdi-green-1/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <SemanticBDIIcon 
                          semantic="collaboration" 
                          size={20} 
                          className="text-bdi-green-1" 
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="text-lg lg:text-xl font-semibold">{org.name}</h3>
                          <Badge variant={org.isActive ? 'default' : 'secondary'} 
                                 className={org.isActive ? 'bg-bdi-green-1 text-white text-xs' : 'text-xs'}>
                            {org.isActive ? 'ACTIVE' : 'PENDING'}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div><strong>Code:</strong> {org.code}</div>
                          <div><strong>Created:</strong> {new Date(org.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2">
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
                      {!org.isActive ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full sm:w-auto justify-center sm:justify-start bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                          onClick={() => handleRevokeInvitation(org.id, org.name)}
                          disabled={isDeleting}
                        >
                          <SemanticBDIIcon semantic="settings" size={14} className="mr-2 sm:mr-1" />
                          <span className="sm:hidden">Revoke Invitation</span>
                          <span className="hidden sm:inline">Revoke</span>
                        </Button>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full sm:w-auto justify-center sm:justify-start bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                          onClick={() => handleDeleteOrganization(org.id, org.name)}
                          disabled={isDeleting}
                        >
                          <SemanticBDIIcon semantic="settings" size={14} className="mr-2 sm:mr-1" />
                          <span className="sm:hidden">Delete Organization</span>
                          <span className="hidden sm:inline">Delete</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                      <Input value={selectedOrg.name || ''} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Legal Business Name</Label>
                      <Input value={selectedOrg.legalName || ''} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>DUNS Number</Label>
                      <Input value={selectedOrg.dunsNumber || ''} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Tax ID / EIN</Label>
                      <Input value={selectedOrg.taxId || ''} disabled className="mt-1" />
                    </div>
                  </div>
                </div>

                {/* Organization Status */}
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-4">Organization Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">Status</div>
                          <div className="text-sm text-gray-500">Current organization state</div>
                        </div>
                        <Badge variant={selectedOrg.isActive ? 'default' : 'secondary'} 
                               className={selectedOrg.isActive ? 'bg-bdi-green-1 text-white' : ''}>
                          {selectedOrg.isActive ? 'ACTIVE' : 'PENDING'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">Organization Type</div>
                          <div className="text-sm text-gray-500">Business relationship</div>
                        </div>
                        <Badge variant="outline" className="bg-bdi-blue text-white">
                          {selectedOrg.type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">Created</div>
                          <div className="text-sm text-gray-500">Organization setup date</div>
                        </div>
                        <div className="text-sm font-medium">
                          {new Date(selectedOrg.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">Organization Code</div>
                          <div className="text-sm text-gray-500">Unique identifier</div>
                        </div>
                        <div className="text-sm font-medium font-mono">
                          {selectedOrg.code}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button variant="outline" className="h-20 flex flex-col gap-2 hover:border-bdi-green-1 hover:bg-bdi-green-1/10">
                      <SemanticBDIIcon semantic="users" size={20} />
                      <span className="text-sm">Manage Users</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col gap-2 hover:border-bdi-green-1 hover:bg-bdi-green-1/10">
                      <SemanticBDIIcon semantic="connect" size={20} />
                      <span className="text-sm">API Settings</span>
                    </Button>
                    <Button variant="outline" className="h-20 flex flex-col gap-2 hover:border-bdi-green-1 hover:bg-bdi-green-1/10">
                      <SemanticBDIIcon semantic="analytics" size={20} />
                      <span className="text-sm">View Analytics</span>
                    </Button>
                  </div>
                </div>

                {/* Danger Zone */}
                <Separator />
                <div className="border border-red-200 rounded-lg p-4 bg-red-50/50">
                  <h3 className="text-lg font-semibold mb-4 text-red-700 flex items-center">
                    <SemanticBDIIcon semantic="settings" size={20} className="mr-2" />
                    Danger Zone
                  </h3>
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                      <div>
                        <h4 className="font-medium text-red-700">
                          {selectedOrg.isActive ? 'Delete Organization' : 'Revoke Invitation'}
                        </h4>
                        <p className="text-sm text-red-600">
                          {selectedOrg.isActive 
                            ? 'Permanently delete this organization and all associated data. This cannot be undone.'
                            : 'Cancel the invitation and remove the pending organization. This cannot be undone.'
                          }
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700"
                        onClick={() => selectedOrg.isActive 
                          ? handleDeleteOrganization(selectedOrg.id, selectedOrg.name)
                          : handleRevokeInvitation(selectedOrg.id, selectedOrg.name)
                        }
                        disabled={isDeleting}
                      >
                        {isDeleting ? (
                          <>
                            <SemanticBDIIcon semantic="sync" size={14} className="mr-1 animate-spin" />
                            {selectedOrg.isActive ? 'Deleting...' : 'Revoking...'}
                          </>
                        ) : (
                          <>
                            <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                            {selectedOrg.isActive ? 'Delete Organization' : 'Revoke Invitation'}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Organization Invitation Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center">
                <SemanticBDIIcon semantic="notifications" size={24} className="mr-2" />
                Invite New Organization
              </CardTitle>
              <CardDescription>Send an invitation to a partner organization admin with customizable access capabilities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Basic Organization Info */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Organization Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="companyName">Company Name *</Label>
                      <Input 
                        id="companyName" 
                        placeholder="ACME Manufacturing Corp" 
                        value={inviteForm.companyName}
                        onChange={(e) => setInviteForm(prev => ({ ...prev, companyName: e.target.value }))}
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="organizationCode">Organization Code *</Label>
                      <Input 
                        id="organizationCode" 
                        placeholder="ACME" 
                        value={inviteForm.organizationCode}
                        onChange={(e) => setInviteForm(prev => ({ ...prev, organizationCode: e.target.value.toUpperCase() }))}
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="organizationType">Organization Type *</Label>
                      <select 
                        id="organizationType"
                        value={inviteForm.organizationType}
                        onChange={(e) => setInviteForm(prev => ({ ...prev, organizationType: e.target.value as any }))}
                        className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm"
                      >
                        <option value="contractor">Contractor</option>
                        <option value="shipping_logistics">Shipping & Logistics</option>
                        <option value="oem_partner">OEM Partner</option>
                        <option value="rd_partner">R&D Partner</option>
                        <option value="distributor">Distributor</option>
                        <option value="retail_partner">Retail Partner</option>
                        <option value="threpl_partner">3PL Partner</option>
                      </select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Admin Contact Info */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Administrator Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="adminName">Admin Full Name *</Label>
                      <Input 
                        id="adminName" 
                        placeholder="John Smith" 
                        value={inviteForm.adminName}
                        onChange={(e) => setInviteForm(prev => ({ ...prev, adminName: e.target.value }))}
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="adminEmail">Admin Email *</Label>
                      <Input 
                        id="adminEmail" 
                        type="email" 
                        placeholder="john.smith@company.com" 
                        value={inviteForm.adminEmail}
                        onChange={(e) => setInviteForm(prev => ({ ...prev, adminEmail: e.target.value }))}
                        className="mt-1" 
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Capabilities Selection */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Access Capabilities</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Select which features and capabilities this organization will have access to. You can modify these later.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {AVAILABLE_CAPABILITIES.map((capability) => (
                      <div 
                        key={capability.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          inviteForm.capabilities.includes(capability.id)
                            ? 'border-bdi-green-1 bg-bdi-green-1/5'
                            : 'border-gray-200 hover:border-bdi-green-1/50'
                        }`}
                        onClick={() => toggleCapability(capability.id)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                            inviteForm.capabilities.includes(capability.id)
                              ? 'border-bdi-green-1 bg-bdi-green-1'
                              : 'border-gray-300'
                          }`}>
                            {inviteForm.capabilities.includes(capability.id) && (
                              <SemanticBDIIcon semantic="settings" size={12} className="text-white brightness-0 invert" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{capability.name}</h4>
                            <p className="text-xs text-gray-500 mt-1">{capability.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Optional Description */}
                <div>
                  <Label htmlFor="description">Partnership Description (Optional)</Label>
                  <textarea
                    id="description"
                    placeholder="Brief description of the partnership and collaboration goals"
                    value={inviteForm.description}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, description: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1"
                    rows={3}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowInviteModal(false)}
                    disabled={isInviting}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="bg-bdi-green-1 hover:bg-bdi-green-2" 
                    onClick={handleInviteOrganization}
                    disabled={isInviting}
                  >
                    {isInviting ? (
                      <>
                        <SemanticBDIIcon semantic="sync" size={16} className="mr-2 brightness-0 invert animate-spin" />
                        Sending Invitation...
                      </>
                    ) : (
                      <>
                        <SemanticBDIIcon semantic="notifications" size={16} className="mr-2 brightness-0 invert" />
                        Send Invitation
                      </>
                    )}
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
