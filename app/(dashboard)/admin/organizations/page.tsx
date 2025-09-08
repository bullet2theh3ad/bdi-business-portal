'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { Separator } from '@/components/ui/separator';
import useSWR, { mutate } from 'swr';
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [selectedOrgForCpfr, setSelectedOrgForCpfr] = useState<any>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingContacts, setIsSavingContacts] = useState(false);
  
  // Enhanced organization management state
  const [isEditingOrg, setIsEditingOrg] = useState(false);
  const [orgEditForm, setOrgEditForm] = useState({
    code: '',
    name: '',
    legalName: ''
  });
  const [orgUserInvites, setOrgUserInvites] = useState<Array<{
    name: string;
    email: string;
    role: 'admin' | 'member';
  }>>([{ name: '', email: '', role: 'member' }]);
  
  // User management state
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [selectedOrgUsers, setSelectedOrgUsers] = useState<any>(null);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [userEditForm, setUserEditForm] = useState({
    name: '',
    email: '',
    title: '',
    department: '',
    phone: '',
    role: 'member'
  });
  
  // API Settings state
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [selectedOrgApiKeys, setSelectedOrgApiKeys] = useState<any>(null);
  const [isLoadingApiKeys, setIsLoadingApiKeys] = useState(false);
  const [inviteForm, setInviteForm] = useState<OrganizationInvitation>({
    companyName: '',
    organizationCode: '',
    organizationType: 'contractor',
    adminName: '',
    adminEmail: '',
    capabilities: ['document_management'], // Default capability
    description: ''
  });
  const [addForm, setAddForm] = useState<OrganizationInvitation>({
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

  const toggleCapability = (capabilityId: CapabilityId, formType: 'invite' | 'add' = 'invite') => {
    if (formType === 'invite') {
      setInviteForm(prev => ({
        ...prev,
        capabilities: prev.capabilities.includes(capabilityId)
          ? prev.capabilities.filter(id => id !== capabilityId)
          : [...prev.capabilities, capabilityId]
      }));
    } else {
      setAddForm(prev => ({
        ...prev,
        capabilities: prev.capabilities.includes(capabilityId)
          ? prev.capabilities.filter(id => id !== capabilityId)
          : [...prev.capabilities, capabilityId]
      }));
    }
  };

  const handleAddOrganization = async () => {
    if (!addForm.companyName || !addForm.adminEmail || !addForm.adminName) {
      alert('Please fill in all required fields');
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch('/api/admin/organizations/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm)
      });

      if (!response.ok) {
        throw new Error('Failed to create organization');
      }

      const result = await response.json();
      console.log('Organization created:', result);
      
      // Reset form and close modal
      setAddForm({
        companyName: '',
        organizationCode: '',
        organizationType: 'contractor',
        adminName: '',
        adminEmail: '',
        capabilities: ['document_management'],
        description: ''
      });
      setShowAddModal(false);
      
      // Refresh organizations list
      mutateOrganizations();
      
      // Enhanced success message with email status and credentials
      const emailStatusMessage = result.email?.sent 
        ? `✅ Welcome email sent to: ${result.email.recipient}`
        : result.email?.error 
        ? `❌ Email failed: ${result.email.error}`
        : `⚠️ Email status unknown`;

      alert(`🎉 Organization "${addForm.companyName}" created successfully!

📧 ${emailStatusMessage}

🔑 Login Credentials (for your reference):
   Email: ${result.loginInfo.email}
   Temporary Password: ${result.loginInfo.tempPassword}
   
🌐 Login URL: ${result.loginInfo.loginUrl}

${result.email?.sent 
  ? '✅ Admin can login immediately!' 
  : '⚠️ Please share the credentials manually with the admin.'}`);

      // Also log detailed info to console for debugging
      console.log('📧 Email Status:', result.email);
      console.log('🔑 Login Info:', result.loginInfo);
    } catch (error) {
      console.error('Error creating organization:', error);
      alert('Failed to create organization. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleManageUsers = async (org: any) => {
    setIsLoadingUsers(true);
    setShowUserManagement(true);
    
    try {
      const response = await fetch(`/api/admin/organizations/${org.id}/users`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch organization users');
      }
      
      const userData = await response.json();
      setSelectedOrgUsers(userData);
      // Organization users loaded successfully
    } catch (error) {
      console.error('Error loading organization users:', error);
      alert('Failed to load organization users. Please try again.');
      setShowUserManagement(false);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setUserEditForm({
      name: user.name || '',
      email: user.email || '',
      title: user.title || '',
      department: user.department || '',
      phone: user.phone || '',
      role: user.membershipRole || 'member'
    });
  };

  const handleSaveUserEdit = async () => {
    if (!editingUser || !selectedOrgUsers) return;

    try {
      const response = await fetch(`/api/admin/organizations/${selectedOrgUsers.organization.id}/users`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          name: userEditForm.name,
          email: userEditForm.email,
          title: userEditForm.title,
          department: userEditForm.department,
          phone: userEditForm.phone,
          role: userEditForm.role,
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const result = await response.json();
      alert(`User ${result.user.name} updated successfully!`);
      
      // Refresh user list and close edit form
      handleManageUsers(selectedOrgUsers.organization);
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user:', error);
      alert(`Failed to update user: ${error}`);
    }
  };

  const handleToggleUserStatus = async (user: any, action: 'activate' | 'deactivate') => {
    if (!selectedOrgUsers) return;

    const confirmMessage = action === 'activate' 
      ? `Are you sure you want to activate ${user.name}? They will be able to access the portal.`
      : `Are you sure you want to deactivate ${user.name}? They will lose access to the portal.`;

    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch(`/api/admin/organizations/${selectedOrgUsers.organization.id}/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const result = await response.json();
      alert(`User ${result.user.name} ${action}d successfully!`);
      
      // Refresh user list
      handleManageUsers(selectedOrgUsers.organization);
    } catch (error) {
      console.error(`Error ${action}ing user:`, error);
      alert(`Failed to ${action} user: ${error}`);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (!selectedOrgUsers) return;

    const confirmMessage = `Are you sure you want to permanently delete ${user.name} (${user.email})? This will remove them from ${selectedOrgUsers.organization.name} and cannot be undone.`;

    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch(`/api/admin/organizations/${selectedOrgUsers.organization.id}/users/${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const result = await response.json();
      alert(`User ${result.deletedUser.name} removed from ${result.organization.name} successfully!`);
      
      // Refresh user list
      handleManageUsers(selectedOrgUsers.organization);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(`Failed to delete user: ${error}`);
    }
  };

  const handleApiSettings = async (org: any) => {
    setIsLoadingApiKeys(true);
    setShowApiSettings(true);
    
    try {
      // Fetch API keys for this specific organization
      const response = await fetch('/api/admin/api-keys');
      
      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }
      
      const allApiKeys = await response.json();
      
      // Filter to only this organization's API keys
      const orgApiKeys = allApiKeys.filter((key: any) => key.organizationId === org.id);
      
      setSelectedOrgApiKeys({
        organization: org,
        apiKeys: orgApiKeys,
        totalKeys: orgApiKeys.length,
        activeKeys: orgApiKeys.filter((key: any) => key.isActive).length,
      });
      
      console.log(`Loaded ${orgApiKeys.length} API keys for ${org.code}`);
    } catch (error) {
      console.error('Error loading API keys:', error);
      alert('Failed to load API keys. Please try again.');
      setShowApiSettings(false);
    } finally {
      setIsLoadingApiKeys(false);
    }
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

  // Only BDI Super Admins can access organization management
  if (!user || user.role !== 'super_admin' || (user as any).organization?.code !== 'BDI') {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="settings" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Access denied. BDI Super Admin required.</p>
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
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              className="bg-bdi-green-1 hover:bg-bdi-green-2 w-full sm:w-auto justify-center" 
              onClick={() => setShowAddModal(true)}
            >
              <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
              <span className="sm:hidden">Add Organization</span>
              <span className="hidden sm:inline">Add Organization</span>
            </Button>
            <Button 
              variant="outline"
              className="w-full sm:w-auto justify-center border-bdi-green-1 text-bdi-green-1 hover:bg-bdi-green-1 hover:text-white" 
              onClick={() => setShowInviteModal(true)}
            >
              <SemanticBDIIcon semantic="notifications" size={16} className="mr-2" />
              <span className="sm:hidden">Invite Organization</span>
              <span className="hidden sm:inline">Invite Organization</span>
            </Button>
          </div>
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
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    className="bg-bdi-green-1 hover:bg-bdi-green-2" 
                    onClick={() => setShowAddModal(true)}
                  >
                    <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
                    Add Organization
                  </Button>
                  <Button 
                    variant="outline"
                    className="border-bdi-green-1 text-bdi-green-1 hover:bg-bdi-green-1 hover:text-white" 
                    onClick={() => setShowInviteModal(true)}
                  >
                    <SemanticBDIIcon semantic="notifications" size={16} className="mr-2" />
                    Invite Organization
                  </Button>
                </div>
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
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full sm:w-auto justify-center sm:justify-start bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                        onClick={() => setSelectedOrgForCpfr(org)}
                      >
                        <SemanticBDIIcon semantic="collaboration" size={14} className="mr-2 sm:mr-1" />
                        <span className="sm:hidden">CPFR Contacts</span>
                        <span className="hidden sm:inline">CPFR</span>
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
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Organization Details</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (isEditingOrg) {
                          // Save changes
                          try {
                            const response = await fetch('/api/admin/organizations', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                organizationId: selectedOrg.id,
                                oldCode: selectedOrg.code,
                                newCode: orgEditForm.code,
                                name: orgEditForm.name,
                                legalName: orgEditForm.legalName
                              })
                            });

                            if (response.ok) {
                              const updatedOrg = await response.json();
                              // Update the selected organization in state
                              setSelectedOrg(updatedOrg);
                              // Refresh the organizations list
                              mutate('/api/admin/organizations');
                              setIsEditingOrg(false);
                              alert(`Organization updated successfully! ${selectedOrg.code !== orgEditForm.code ? `Code changed from ${selectedOrg.code} to ${orgEditForm.code}` : ''}`);
                            } else {
                              const error = await response.json();
                              alert(`Error updating organization: ${error.message}`);
                            }
                          } catch (error) {
                            console.error('Error updating organization:', error);
                            alert('Failed to update organization. Please try again.');
                          }
                        } else {
                          // Enter edit mode
                          setOrgEditForm({
                            code: selectedOrg.code || '',
                            name: selectedOrg.name || '',
                            legalName: selectedOrg.legalName || ''
                          });
                          setIsEditingOrg(true);
                        }
                      }}
                      className={isEditingOrg ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                    >
                      <SemanticBDIIcon semantic={isEditingOrg ? "check" : "settings"} size={14} className="mr-1" />
                      {isEditingOrg ? 'Save Changes' : 'Edit Organization'}
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Organization Code *</Label>
                      <Input 
                        value={isEditingOrg ? orgEditForm.code : selectedOrg.code || ''} 
                        onChange={(e) => setOrgEditForm(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                        disabled={!isEditingOrg}
                        className={`mt-1 ${isEditingOrg ? 'border-orange-300 bg-orange-50' : ''}`}
                        placeholder="e.g., MTN, TC1, OLM"
                        maxLength={10}
                      />
                      {isEditingOrg && (
                        <div className="text-xs text-orange-600 mt-1">
                          ⚠️ Changing this will update all references across the system
                        </div>
                      )}
                    </div>
                    <div>
                      <Label>Company Name *</Label>
                      <Input 
                        value={isEditingOrg ? orgEditForm.name : selectedOrg.name || ''} 
                        onChange={(e) => setOrgEditForm(prev => ({ ...prev, name: e.target.value }))}
                        disabled={!isEditingOrg}
                        className={`mt-1 ${isEditingOrg ? 'border-orange-300 bg-orange-50' : ''}`}
                        placeholder="e.g., Mountain Networks"
                      />
                    </div>
                    <div>
                      <Label>Legal Business Name</Label>
                      <Input 
                        value={isEditingOrg ? orgEditForm.legalName : selectedOrg.legalName || ''} 
                        onChange={(e) => setOrgEditForm(prev => ({ ...prev, legalName: e.target.value }))}
                        disabled={!isEditingOrg}
                        className={`mt-1 ${isEditingOrg ? 'border-orange-300 bg-orange-50' : ''}`}
                        placeholder="Full legal entity name"
                      />
                    </div>
                    <div>
                      <Label>DUNS Number</Label>
                      <Input value={selectedOrg.dunsNumber || ''} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Tax ID / EIN</Label>
                      <Input value={selectedOrg.taxId || ''} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Organization Type</Label>
                      <Input value={selectedOrg.type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || ''} disabled className="mt-1" />
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

                {/* User Invitation Management */}
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-4">Invite Users to {selectedOrg.name}</h3>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2 mb-3">
                      <SemanticBDIIcon semantic="notifications" size={16} className="text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">
                        Send invitations on behalf of {selectedOrg.code}
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      {orgUserInvites.map((invite, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-white rounded border">
                          <div>
                            <Label className="text-xs">Full Name *</Label>
                            <Input
                              value={invite.name}
                              onChange={(e) => {
                                const updated = [...orgUserInvites];
                                updated[index].name = e.target.value;
                                setOrgUserInvites(updated);
                              }}
                              placeholder="John Smith"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Email Address *</Label>
                            <Input
                              type="email"
                              value={invite.email}
                              onChange={(e) => {
                                const updated = [...orgUserInvites];
                                updated[index].email = e.target.value;
                                setOrgUserInvites(updated);
                              }}
                              placeholder="john@company.com"
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Role</Label>
                            <select
                              value={invite.role}
                              onChange={(e) => {
                                const updated = [...orgUserInvites];
                                updated[index].role = e.target.value as 'admin' | 'member';
                                setOrgUserInvites(updated);
                              }}
                              className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
                            >
                              <option value="member">Member</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                          <div className="flex items-end">
                            {orgUserInvites.length > 1 && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setOrgUserInvites(orgUserInvites.filter((_, i) => i !== index));
                                }}
                                className="text-red-600 border-red-300 hover:bg-red-50"
                              >
                                Remove
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                      
                      <div className="flex justify-between">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setOrgUserInvites([...orgUserInvites, { name: '', email: '', role: 'member' }]);
                          }}
                          className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        >
                          <SemanticBDIIcon semantic="plus" size={14} className="mr-1" />
                          Add Another User
                        </Button>
                        
                        <Button
                          onClick={async () => {
                            // Processing user invitations
                            const validInvites = orgUserInvites.filter(inv => inv.name && inv.email);
                            // Filtered valid invitations
                            
                            if (validInvites.length === 0) {
                              alert(`Please add at least one valid invitation (name and email required). Current invites: ${JSON.stringify(orgUserInvites)}`);
                              return;
                            }

                            // Bulk invitations removed - use individual user invitations instead
                            alert('Bulk invitations have been simplified. Please use the "Manage Users" feature for individual user invitations.');
                          }}
                          disabled={!orgUserInvites.some(inv => inv.name && inv.email)}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <SemanticBDIIcon semantic="notifications" size={14} className="mr-1" />
                          Send Invitations ({orgUserInvites.filter(inv => inv.name && inv.email).length})
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col gap-2 hover:border-bdi-green-1 hover:bg-bdi-green-1/10"
                      onClick={() => handleManageUsers(selectedOrg)}
                    >
                      <SemanticBDIIcon semantic="users" size={20} />
                      <span className="text-sm">Manage Users</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-20 flex flex-col gap-2 hover:border-bdi-green-1 hover:bg-bdi-green-1/10"
                      onClick={() => handleApiSettings(selectedOrg)}
                    >
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

      {/* Add Organization Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center">
                <SemanticBDIIcon semantic="plus" size={24} className="mr-2" />
                Add New Organization
              </CardTitle>
              <CardDescription>Create a new organization with immediate access - no invitation required</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Basic Organization Info */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Organization Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="addCompanyName">Company Name *</Label>
                      <Input 
                        id="addCompanyName" 
                        placeholder="ACME Manufacturing Corp" 
                        value={addForm.companyName}
                        onChange={(e) => setAddForm(prev => ({ ...prev, companyName: e.target.value }))}
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="addOrganizationCode">Organization Code *</Label>
                      <Input 
                        id="addOrganizationCode" 
                        placeholder="ACME" 
                        value={addForm.organizationCode}
                        onChange={(e) => setAddForm(prev => ({ ...prev, organizationCode: e.target.value.toUpperCase() }))}
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="addOrganizationType">Organization Type *</Label>
                      <select 
                        id="addOrganizationType"
                        value={addForm.organizationType}
                        onChange={(e) => setAddForm(prev => ({ ...prev, organizationType: e.target.value as any }))}
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
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-4">
                    <div className="flex items-center space-x-2">
                      <SemanticBDIIcon semantic="check" size={16} className="text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">
                        Organization and admin user will be created immediately with full access
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="addAdminName">Admin Full Name *</Label>
                      <Input 
                        id="addAdminName" 
                        placeholder="John Smith" 
                        value={addForm.adminName}
                        onChange={(e) => setAddForm(prev => ({ ...prev, adminName: e.target.value }))}
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="addAdminEmail">Admin Email *</Label>
                      <Input 
                        id="addAdminEmail" 
                        type="email" 
                        placeholder="john.smith@company.com" 
                        value={addForm.adminEmail}
                        onChange={(e) => setAddForm(prev => ({ ...prev, adminEmail: e.target.value }))}
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
                          addForm.capabilities.includes(capability.id)
                            ? 'border-bdi-green-1 bg-bdi-green-1/5'
                            : 'border-gray-200 hover:border-bdi-green-1/50'
                        }`}
                        onClick={() => toggleCapability(capability.id, 'add')}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                            addForm.capabilities.includes(capability.id)
                              ? 'border-bdi-green-1 bg-bdi-green-1'
                              : 'border-gray-300'
                          }`}>
                            {addForm.capabilities.includes(capability.id) && (
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
                  <Label htmlFor="addDescription">Partnership Description (Optional)</Label>
                  <textarea
                    id="addDescription"
                    placeholder="Brief description of the partnership and collaboration goals"
                    value={addForm.description}
                    onChange={(e) => setAddForm(prev => ({ ...prev, description: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1"
                    rows={3}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowAddModal(false)}
                    disabled={isAdding}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="bg-bdi-green-1 hover:bg-bdi-green-2" 
                    onClick={handleAddOrganization}
                    disabled={isAdding}
                  >
                    {isAdding ? (
                      <>
                        <SemanticBDIIcon semantic="sync" size={16} className="mr-2 brightness-0 invert animate-spin" />
                        Creating Organization...
                      </>
                    ) : (
                      <>
                        <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
                        Create Organization
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CPFR Contacts Management Modal */}
      {selectedOrgForCpfr && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <SemanticBDIIcon semantic="collaboration" size={24} className="mr-3 text-blue-600" />
                  <div>
                    <h2 className="text-xl font-semibold">CPFR Contacts Management</h2>
                    <p className="text-gray-600">{selectedOrgForCpfr.name} ({selectedOrgForCpfr.code})</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedOrgForCpfr(null)}
                  className="text-gray-400 hover:text-gray-600 p-2"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-8">
              {/* Primary Contacts Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-blue-800">Primary CPFR Contacts</h3>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      const newContact = { name: '', email: '', role: '', active: true };
                      const currentContacts = selectedOrgForCpfr.cpfrContacts?.primary_contacts || [];
                      const updatedOrg = {
                        ...selectedOrgForCpfr,
                        cpfrContacts: {
                          ...selectedOrgForCpfr.cpfrContacts,
                          primary_contacts: [...currentContacts, newContact]
                        }
                      };
                      setSelectedOrgForCpfr(updatedOrg);
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    + Add Contact
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {(selectedOrgForCpfr.cpfrContacts?.primary_contacts || []).map((contact: any, index: number) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 border rounded-lg bg-gray-50">
                      <div>
                        <Label className="text-xs">Name *</Label>
                        <Input
                          value={contact.name}
                          onChange={(e) => {
                            const updated = [...(selectedOrgForCpfr.cpfrContacts?.primary_contacts || [])];
                            updated[index] = { ...updated[index], name: e.target.value };
                            setSelectedOrgForCpfr({
                              ...selectedOrgForCpfr,
                              cpfrContacts: {
                                ...selectedOrgForCpfr.cpfrContacts,
                                primary_contacts: updated
                              }
                            });
                          }}
                          placeholder="John Doe"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Email *</Label>
                        <Input
                          type="email"
                          value={contact.email}
                          onChange={(e) => {
                            const updated = [...(selectedOrgForCpfr.cpfrContacts?.primary_contacts || [])];
                            updated[index] = { ...updated[index], email: e.target.value };
                            setSelectedOrgForCpfr({
                              ...selectedOrgForCpfr,
                              cpfrContacts: {
                                ...selectedOrgForCpfr.cpfrContacts,
                                primary_contacts: updated
                              }
                            });
                          }}
                          placeholder="john@tc1.com"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Role</Label>
                        <Input
                          value={contact.role}
                          onChange={(e) => {
                            const updated = [...(selectedOrgForCpfr.cpfrContacts?.primary_contacts || [])];
                            updated[index] = { ...updated[index], role: e.target.value };
                            setSelectedOrgForCpfr({
                              ...selectedOrgForCpfr,
                              cpfrContacts: {
                                ...selectedOrgForCpfr.cpfrContacts,
                                primary_contacts: updated
                              }
                            });
                          }}
                          placeholder="Factory Manager"
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const updated = (selectedOrgForCpfr.cpfrContacts?.primary_contacts || []).filter((_: any, i: number) => i !== index);
                            setSelectedOrgForCpfr({
                              ...selectedOrgForCpfr,
                              cpfrContacts: {
                                ...selectedOrgForCpfr.cpfrContacts,
                                primary_contacts: updated
                              }
                            });
                          }}
                          className="w-full bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {(!selectedOrgForCpfr.cpfrContacts?.primary_contacts || selectedOrgForCpfr.cpfrContacts.primary_contacts.length === 0) && (
                    <div className="text-center p-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                      <SemanticBDIIcon semantic="collaboration" size={32} className="mx-auto mb-2 text-gray-400" />
                      <p>No primary CPFR contacts configured</p>
                      <p className="text-xs">Add contacts to receive immediate CPFR notifications</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Escalation Contacts Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-orange-800">Escalation Contacts (24hr)</h3>
                  <Button 
                    size="sm" 
                    onClick={() => {
                      const newContact = { name: '', email: '', role: '', active: true };
                      const currentContacts = selectedOrgForCpfr.cpfrContacts?.escalation_contacts || [];
                      const updatedOrg = {
                        ...selectedOrgForCpfr,
                        cpfrContacts: {
                          ...selectedOrgForCpfr.cpfrContacts,
                          escalation_contacts: [...currentContacts, newContact]
                        }
                      };
                      setSelectedOrgForCpfr(updatedOrg);
                    }}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    + Add Escalation
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {(selectedOrgForCpfr.cpfrContacts?.escalation_contacts || []).map((contact: any, index: number) => (
                    <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 border rounded-lg bg-orange-50">
                      <div>
                        <Label className="text-xs">Name *</Label>
                        <Input
                          value={contact.name}
                          onChange={(e) => {
                            const updated = [...(selectedOrgForCpfr.cpfrContacts?.escalation_contacts || [])];
                            updated[index] = { ...updated[index], name: e.target.value };
                            setSelectedOrgForCpfr({
                              ...selectedOrgForCpfr,
                              cpfrContacts: {
                                ...selectedOrgForCpfr.cpfrContacts,
                                escalation_contacts: updated
                              }
                            });
                          }}
                          placeholder="Jane Smith"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Email *</Label>
                        <Input
                          type="email"
                          value={contact.email}
                          onChange={(e) => {
                            const updated = [...(selectedOrgForCpfr.cpfrContacts?.escalation_contacts || [])];
                            updated[index] = { ...updated[index], email: e.target.value };
                            setSelectedOrgForCpfr({
                              ...selectedOrgForCpfr,
                              cpfrContacts: {
                                ...selectedOrgForCpfr.cpfrContacts,
                                escalation_contacts: updated
                              }
                            });
                          }}
                          placeholder="jane@tc1.com"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Role</Label>
                        <Input
                          value={contact.role}
                          onChange={(e) => {
                            const updated = [...(selectedOrgForCpfr.cpfrContacts?.escalation_contacts || [])];
                            updated[index] = { ...updated[index], role: e.target.value };
                            setSelectedOrgForCpfr({
                              ...selectedOrgForCpfr,
                              cpfrContacts: {
                                ...selectedOrgForCpfr.cpfrContacts,
                                escalation_contacts: updated
                              }
                            });
                          }}
                          placeholder="Operations Director"
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const updated = (selectedOrgForCpfr.cpfrContacts?.escalation_contacts || []).filter((_: any, i: number) => i !== index);
                            setSelectedOrgForCpfr({
                              ...selectedOrgForCpfr,
                              cpfrContacts: {
                                ...selectedOrgForCpfr.cpfrContacts,
                                escalation_contacts: updated
                              }
                            });
                          }}
                          className="w-full bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {(!selectedOrgForCpfr.cpfrContacts?.escalation_contacts || selectedOrgForCpfr.cpfrContacts.escalation_contacts.length === 0) && (
                    <div className="text-center p-8 text-gray-500 border-2 border-dashed border-orange-300 rounded-lg">
                      <SemanticBDIIcon semantic="notifications" size={32} className="mx-auto mb-2 text-orange-400" />
                      <p>No escalation contacts configured</p>
                      <p className="text-xs">Add contacts for 24-hour escalation notifications</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Notification Preferences */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-purple-800">Notification Preferences</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-purple-50">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="immediateNotifications"
                        checked={selectedOrgForCpfr.cpfrContacts?.notification_preferences?.immediate_notifications || false}
                        onChange={(e) => {
                          setSelectedOrgForCpfr({
                            ...selectedOrgForCpfr,
                            cpfrContacts: {
                              ...selectedOrgForCpfr.cpfrContacts,
                              notification_preferences: {
                                ...selectedOrgForCpfr.cpfrContacts?.notification_preferences,
                                immediate_notifications: e.target.checked
                              }
                            }
                          });
                        }}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <Label htmlFor="immediateNotifications" className="text-sm">Immediate Notifications</Label>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="includeTechnicalTeam"
                        checked={selectedOrgForCpfr.cpfrContacts?.notification_preferences?.include_technical_team || false}
                        onChange={(e) => {
                          setSelectedOrgForCpfr({
                            ...selectedOrgForCpfr,
                            cpfrContacts: {
                              ...selectedOrgForCpfr.cpfrContacts,
                              notification_preferences: {
                                ...selectedOrgForCpfr.cpfrContacts?.notification_preferences,
                                include_technical_team: e.target.checked
                              }
                            }
                          });
                        }}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <Label htmlFor="includeTechnicalTeam" className="text-sm">Include Technical Team</Label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs">Escalation Hours</Label>
                      <Input
                        type="number"
                        min="1"
                        max="168"
                        value={selectedOrgForCpfr.cpfrContacts?.notification_preferences?.escalation_hours || 24}
                        onChange={(e) => {
                          setSelectedOrgForCpfr({
                            ...selectedOrgForCpfr,
                            cpfrContacts: {
                              ...selectedOrgForCpfr.cpfrContacts,
                              notification_preferences: {
                                ...selectedOrgForCpfr.cpfrContacts?.notification_preferences,
                                escalation_hours: parseInt(e.target.value) || 24
                              }
                            }
                          });
                        }}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-600 mt-1">Hours before escalation (default: 24)</p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="businessHoursOnly"
                        checked={selectedOrgForCpfr.cpfrContacts?.notification_preferences?.business_hours_only || false}
                        onChange={(e) => {
                          setSelectedOrgForCpfr({
                            ...selectedOrgForCpfr,
                            cpfrContacts: {
                              ...selectedOrgForCpfr.cpfrContacts,
                              notification_preferences: {
                                ...selectedOrgForCpfr.cpfrContacts?.notification_preferences,
                                business_hours_only: e.target.checked
                              }
                            }
                          });
                        }}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <Label htmlFor="businessHoursOnly" className="text-sm">Business Hours Only</Label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Save/Cancel Actions */}
              <div className="flex justify-end space-x-3 pt-6 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setSelectedOrgForCpfr(null)}
                  disabled={isSavingContacts}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={async () => {
                    setIsSavingContacts(true);
                    try {
                      const response = await fetch(`/api/admin/organizations/${selectedOrgForCpfr.id}/cpfr-contacts`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          cpfrContacts: selectedOrgForCpfr.cpfrContacts
                        })
                      });

                      if (response.ok) {
                        mutateOrganizations();
                        setSelectedOrgForCpfr(null);
                        alert('CPFR contacts updated successfully!');
                      } else {
                        alert('Failed to update CPFR contacts');
                      }
                    } catch (error) {
                      alert('Error updating CPFR contacts');
                    } finally {
                      setIsSavingContacts(false);
                    }
                  }}
                  disabled={isSavingContacts}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSavingContacts ? (
                    <>
                      <SemanticBDIIcon semantic="sync" size={16} className="mr-2 brightness-0 invert animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <SemanticBDIIcon semantic="collaboration" size={16} className="mr-2 brightness-0 invert" />
                      Save CPFR Contacts
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* User Management Modal */}
      {showUserManagement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <SemanticBDIIcon semantic="users" size={24} className="mr-2" />
                  User Management
                  {selectedOrgUsers && (
                    <span className="ml-2 text-lg font-normal text-gray-600">
                      - {selectedOrgUsers.organization?.name} ({selectedOrgUsers.organization?.code})
                    </span>
                  )}
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setShowUserManagement(false);
                    setSelectedOrgUsers(null);
                  }}
                >
                  ×
                </Button>
              </div>
              <CardDescription>
                Manage users, roles, and access for this organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingUsers ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <SemanticBDIIcon semantic="sync" size={32} className="mx-auto mb-4 text-muted-foreground animate-spin" />
                    <p className="text-muted-foreground">Loading organization users...</p>
                  </div>
                </div>
              ) : selectedOrgUsers ? (
                <div className="space-y-6">
                  {/* Organization Summary */}
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-blue-600">{selectedOrgUsers.totalUsers}</div>
                        <div className="text-sm text-blue-800">Total Users</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{selectedOrgUsers.activeUsers}</div>
                        <div className="text-sm text-green-800">Active Users</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-purple-600">{selectedOrgUsers.adminUsers}</div>
                        <div className="text-sm text-purple-800">Admin Users</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-orange-600">
                          {(selectedOrgUsers.totalPendingInvitations || 0) + (selectedOrgUsers.totalUsers - selectedOrgUsers.activeUsers)}
                        </div>
                        <div className="text-sm text-orange-800">
                          Pending ({selectedOrgUsers.totalPendingInvitations || 0} invites + {selectedOrgUsers.totalUsers - selectedOrgUsers.activeUsers} users)
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Current Users List */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Current Users</h3>
                    {selectedOrgUsers.users && selectedOrgUsers.users.length > 0 ? (
                      <div className="space-y-3">
                        {selectedOrgUsers.users.map((user: any) => (
                          <div key={user.id} className="border rounded-lg p-4 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <SemanticBDIIcon semantic="profile" size={16} className="text-gray-500" />
                                  <span className="font-medium">{user.name}</span>
                                  <Badge variant={user.membershipRole === 'admin' ? 'default' : 'secondary'}
                                         className={user.membershipRole === 'admin' ? 'bg-bdi-green-1 text-white' : ''}>
                                    {user.membershipRole?.toUpperCase()}
                                  </Badge>
                                  <Badge variant={user.isActive ? 'default' : 'secondary'}
                                         className={user.isActive ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'}>
                                    {user.isActive ? 'ACTIVE' : 'PENDING'}
                                  </Badge>
                                </div>
                                <div className="text-sm text-gray-500 space-y-1">
                                  <div>📧 {user.email}</div>
                                  {user.title && <div>💼 {user.title}</div>}
                                  {user.department && <div>🏢 {user.department}</div>}
                                  {user.phone && <div>📞 {user.phone}</div>}
                                  <div>📅 Joined {new Date(user.createdAt).toLocaleDateString()}</div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                  onClick={() => handleEditUser(user)}
                                >
                                  <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                                  Edit
                                </Button>
                                {!user.isActive ? (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-green-600 border-green-300 hover:bg-green-50"
                                    onClick={() => handleToggleUserStatus(user, 'activate')}
                                  >
                                    <SemanticBDIIcon semantic="check" size={14} className="mr-1" />
                                    Activate
                                  </Button>
                                ) : (
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-orange-600 border-orange-300 hover:bg-orange-50"
                                    onClick={() => handleToggleUserStatus(user, 'deactivate')}
                                  >
                                    <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                                    Deactivate
                                  </Button>
                                )}
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-red-600 border-red-300 hover:bg-red-50"
                                  onClick={() => handleDeleteUser(user)}
                                >
                                  <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                        <SemanticBDIIcon semantic="users" size={32} className="mx-auto mb-2 text-gray-400" />
                        <p>No users found in this organization</p>
                        <p className="text-xs">Add users using the invitation section below</p>
                      </div>
                    )}
                  </div>

                  {/* Pending Organization Invitations Section */}
                  {selectedOrgUsers?.pendingInvitations && selectedOrgUsers.pendingInvitations.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="text-lg font-semibold mb-4 flex items-center">
                          <SemanticBDIIcon semantic="notifications" size={20} className="mr-2 text-orange-500" />
                          Pending Organization Invitations
                          <Badge variant="outline" className="ml-2 text-orange-600 border-orange-300">
                            {selectedOrgUsers.pendingInvitations.length}
                          </Badge>
                        </h3>
                        <div className="space-y-3">
                          {selectedOrgUsers.pendingInvitations.map((invitation: any) => (
                            <div key={invitation.id} className="border rounded-lg p-4 bg-orange-50 hover:bg-orange-100">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <SemanticBDIIcon semantic="notifications" size={16} className="text-orange-500" />
                                    <span className="font-medium">{invitation.invitedName}</span>
                                    <Badge variant="outline" className="text-orange-600 border-orange-300">
                                      {invitation.invitedRole?.toUpperCase()}
                                    </Badge>
                                    <Badge variant="outline" className="text-blue-600 border-blue-300">
                                      {invitation.status?.toUpperCase()}
                                    </Badge>
                                    {invitation.senderDomain && (
                                      <Badge variant="outline" className={
                                        invitation.senderDomain === 'bdibusinessportal.com' 
                                          ? 'text-green-600 border-green-300 bg-green-50' 
                                          : 'text-red-600 border-red-300 bg-red-50'
                                      }>
                                        {invitation.senderDomain === 'bdibusinessportal.com' ? '✓ Good Domain' : '⚠ Bad Domain'}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-gray-600 space-y-1">
                                    <div>📧 {invitation.invitedEmail}</div>
                                    <div>📅 Invited {new Date(invitation.createdAt).toLocaleDateString()}</div>
                                    {invitation.expiresAt && (
                                      <div>⏰ Expires {new Date(invitation.expiresAt).toLocaleDateString()}</div>
                                    )}
                                    {invitation.emailDeliveryStatus && (
                                      <div>📤 Email Status: {invitation.emailDeliveryStatus}</div>
                                    )}
                                    {invitation.sentByUserType && (
                                      <div>👤 Sent by: {invitation.sentByUserType.replace('_', ' ')}</div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                    onClick={() => {
                                      // Copy invitation link or show details
                                      navigator.clipboard.writeText(`Invitation ID: ${invitation.invitationToken}`);
                                      alert('Invitation token copied to clipboard');
                                    }}
                                  >
                                    <SemanticBDIIcon semantic="info" size={14} className="mr-1" />
                                    Details
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="text-red-600 border-red-300 hover:bg-red-50"
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to revoke the invitation for ${invitation.invitedEmail}?`)) {
                                        // TODO: Implement revoke invitation
                                        alert('Revoke invitation functionality to be implemented');
                                      }
                                    }}
                                  >
                                    <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                                    Revoke
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Add New Users Section */}
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Add New Users</h3>
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="flex items-center space-x-2 mb-3">
                        <SemanticBDIIcon semantic="plus" size={16} className="text-green-600" />
                        <span className="text-sm font-medium text-green-800">
                          Add users to {selectedOrgUsers?.organization?.name}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        {orgUserInvites.map((invite, index) => (
                          <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 bg-white rounded border">
                            <div>
                              <Label className="text-xs">Full Name *</Label>
                              <Input
                                value={invite.name}
                                onChange={(e) => {
                                  const updated = [...orgUserInvites];
                                  updated[index].name = e.target.value;
                                  setOrgUserInvites(updated);
                                }}
                                placeholder="John Smith"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Email Address *</Label>
                              <Input
                                type="email"
                                value={invite.email}
                                onChange={(e) => {
                                  const updated = [...orgUserInvites];
                                  updated[index].email = e.target.value;
                                  setOrgUserInvites(updated);
                                }}
                                placeholder="john@company.com"
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Role</Label>
                              <select
                                value={invite.role}
                                onChange={(e) => {
                                  const updated = [...orgUserInvites];
                                  updated[index].role = e.target.value as 'admin' | 'member';
                                  setOrgUserInvites(updated);
                                }}
                                className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
                              >
                                <option value="member">Member</option>
                                <option value="admin">Admin</option>
                              </select>
                            </div>
                            <div className="flex items-end">
                              {orgUserInvites.length > 1 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setOrgUserInvites(orgUserInvites.filter((_, i) => i !== index));
                                  }}
                                  className="text-red-600 border-red-300 hover:bg-red-50"
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                        
                        <div className="flex justify-between">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setOrgUserInvites([...orgUserInvites, { name: '', email: '', role: 'member' }]);
                            }}
                            className="text-green-600 border-green-300 hover:bg-green-50"
                          >
                            <SemanticBDIIcon semantic="plus" size={14} className="mr-1" />
                            Add Another User
                          </Button>
                          
                          <Button
                            onClick={async () => {
                              const validInvites = orgUserInvites.filter(inv => inv.name && inv.email);
                              
                              if (validInvites.length === 0) {
                                alert('Please add at least one valid user (name and email required)');
                                return;
                              }

                              try {
                                // Add users to the specific organization
                                for (const invite of validInvites) {
                                  const response = await fetch(`/api/admin/organizations/${selectedOrgUsers.organization.id}/users`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      name: invite.name,
                                      email: invite.email,
                                      role: invite.role,
                                    })
                                  });

                                  if (!response.ok) {
                                    const error = await response.json();
                                    
                                    // Handle user already exists scenario
                                    if (error.error === 'user_exists' && error.existingUser) {
                                      const existingUser = error.existingUser;
                                      const userInfo = `${existingUser.name} (${existingUser.email})`;
                                      const orgInfo = existingUser.organization ? ` in ${existingUser.organization.name}` : '';
                                      const statusInfo = existingUser.isActive ? 'Active User' : 'Pending Invitation';
                                      
                                      const shouldDelete = confirm(
                                        `Email ${invite.email} is already in use by:\n\n` +
                                        `👤 User: ${userInfo}\n` +
                                        `🏢 Organization: ${orgInfo || 'None'}\n` +
                                        `📊 Status: ${statusInfo}\n\n` +
                                        `⚠️  Do you want to PERMANENTLY DELETE this existing user and send a new invitation?\n\n` +
                                        `This action cannot be undone!`
                                      );
                                      
                                      if (shouldDelete) {
                                        console.log('🗑️ FRONTEND DELETE - Starting delete process');
                                        
                                        // Delete the existing user using the simple delete endpoint
                                        const deleteResponse = await fetch('/api/admin/delete-user', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({ email: existingUser.email })
                                        });
                                        
                                        console.log('🗑️ FRONTEND DELETE - Delete response status:', deleteResponse.status);
                                        console.log('🗑️ FRONTEND DELETE - Delete response ok:', deleteResponse.ok);
                                        
                                        if (deleteResponse.ok) {
                                          const deleteResult = await deleteResponse.json();
                                          console.log('🗑️ FRONTEND DELETE - Delete successful:', deleteResult);
                                        
                                          console.log('🔄 FRONTEND RETRY - Starting invitation retry');
                                          
                                          // Now retry the invitation
                                          const retryResponse = await fetch(`/api/admin/organizations/${selectedOrgUsers.organization.id}/users`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              name: invite.name,
                                              email: invite.email,
                                              role: invite.role,
                                            })
                                          });
                                          
                                          console.log('🔄 FRONTEND RETRY - Retry response status:', retryResponse.status);
                                          console.log('🔄 FRONTEND RETRY - Retry response ok:', retryResponse.ok);
                                          
                                          if (!retryResponse.ok) {
                                            const retryError = await retryResponse.json();
                                            console.log('🔄 FRONTEND RETRY - Retry failed:', retryError);
                                            throw new Error(`Failed to add ${invite.email} after deletion: ${retryError.error || 'Unknown error'}`);
                                          }
                                          
                                          const retryResult = await retryResponse.json();
                                          console.log('🔄 FRONTEND RETRY - ✅ Retry successful:', retryResult);
                                          console.log(`✅ Successfully deleted existing user and created new invitation`);
                                        } else {
                                          const deleteError = await deleteResponse.json();
                                          throw new Error(`Failed to delete existing user ${invite.email}: ${deleteError.error || 'Unknown error'}`);
                                        }
                                      } else {
                                        throw new Error(`Invitation cancelled - ${invite.email} already exists`);
                                      }
                                    } else {
                                      // Other error types
                                      throw new Error(`Failed to add ${invite.email}: ${error.error || error.message || 'Unknown error'}`);
                                    }
                                  }
                                }

                                alert(`Successfully added ${validInvites.length} users to ${selectedOrgUsers.organization.name}!`);
                                
                                // Refresh the user list
                                handleManageUsers(selectedOrgUsers.organization);
                                
                                // Clear the invitation form
                                setOrgUserInvites([{ name: '', email: '', role: 'member' }]);
                              } catch (error) {
                                console.error('Error adding users:', error);
                                alert(`Error adding users: ${error}`);
                              }
                            }}
                            disabled={!orgUserInvites.some(inv => inv.name && inv.email)}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <SemanticBDIIcon semantic="plus" size={14} className="mr-1" />
                            Add Users ({orgUserInvites.filter(inv => inv.name && inv.email).length})
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <SemanticBDIIcon semantic="users" size={48} className="mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Failed to load organization users</p>
                    <Button 
                      variant="outline" 
                      className="mt-4" 
                      onClick={() => {
                        setShowUserManagement(false);
                        setSelectedOrgUsers(null);
                      }}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <SemanticBDIIcon semantic="settings" size={24} className="mr-2" />
                  Edit User - {editingUser.name}
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setEditingUser(null)}
                >
                  ×
                </Button>
              </div>
              <CardDescription>
                Update user details and permissions for {selectedOrgUsers?.organization?.name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Personal Information */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="editName">Full Name *</Label>
                      <Input 
                        id="editName"
                        value={userEditForm.name}
                        onChange={(e) => setUserEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="editEmail">Email Address *</Label>
                      <Input 
                        id="editEmail"
                        type="email"
                        value={userEditForm.email}
                        onChange={(e) => setUserEditForm(prev => ({ ...prev, email: e.target.value }))}
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="editTitle">Job Title</Label>
                      <Input 
                        id="editTitle"
                        value={userEditForm.title}
                        onChange={(e) => setUserEditForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="e.g., Manager, Engineer"
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="editDepartment">Department</Label>
                      <Input 
                        id="editDepartment"
                        value={userEditForm.department}
                        onChange={(e) => setUserEditForm(prev => ({ ...prev, department: e.target.value }))}
                        placeholder="e.g., Engineering, Sales"
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="editPhone">Phone Number</Label>
                      <Input 
                        id="editPhone"
                        value={userEditForm.phone}
                        onChange={(e) => setUserEditForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="e.g., +1 (555) 123-4567"
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="editRole">Organization Role *</Label>
                      <select 
                        id="editRole"
                        value={userEditForm.role}
                        onChange={(e) => setUserEditForm(prev => ({ ...prev, role: e.target.value }))}
                        className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* User Status */}
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-4">User Status</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Current Status</div>
                        <div className="text-sm text-gray-500">User access to the portal</div>
                      </div>
                      <Badge variant={editingUser.isActive ? 'default' : 'secondary'}
                             className={editingUser.isActive ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'}>
                        {editingUser.isActive ? 'ACTIVE' : 'PENDING'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setEditingUser(null)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700" 
                    onClick={handleSaveUserEdit}
                  >
                    <SemanticBDIIcon semantic="check" size={16} className="mr-2 brightness-0 invert" />
                    Save Changes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* API Settings Modal */}
      {showApiSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <SemanticBDIIcon semantic="connect" size={24} className="mr-2" />
                  API Settings
                  {selectedOrgApiKeys && (
                    <span className="ml-2 text-lg font-normal text-gray-600">
                      - {selectedOrgApiKeys.organization?.name} ({selectedOrgApiKeys.organization?.code})
                    </span>
                  )}
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setShowApiSettings(false);
                    setSelectedOrgApiKeys(null);
                  }}
                >
                  ×
                </Button>
              </div>
              <CardDescription>
                Manage API keys and programmatic access for this organization
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingApiKeys ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <SemanticBDIIcon semantic="sync" size={32} className="mx-auto mb-4 text-muted-foreground animate-spin" />
                    <p className="text-muted-foreground">Loading API keys...</p>
                  </div>
                </div>
              ) : selectedOrgApiKeys ? (
                <div className="space-y-6">
                  {/* API Keys Summary */}
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-purple-600">{selectedOrgApiKeys.totalKeys}</div>
                        <div className="text-sm text-purple-800">Total API Keys</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{selectedOrgApiKeys.activeKeys}</div>
                        <div className="text-sm text-green-800">Active Keys</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-orange-600">
                          {selectedOrgApiKeys.totalKeys - selectedOrgApiKeys.activeKeys}
                        </div>
                        <div className="text-sm text-orange-800">Inactive Keys</div>
                      </div>
                    </div>
                  </div>

                  {/* Current API Keys List */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">API Keys for {selectedOrgApiKeys.organization?.name}</h3>
                      <Button 
                        className="bg-purple-600 hover:bg-purple-700"
                        onClick={() => {
                          // Redirect to global API Keys page with organization pre-selected
                          window.location.href = `/admin/api-keys?org=${selectedOrgApiKeys.organization?.id}`;
                        }}
                      >
                        <SemanticBDIIcon semantic="plus" size={14} className="mr-1 brightness-0 invert" />
                        Generate New Key
                      </Button>
                    </div>
                    
                    {selectedOrgApiKeys.apiKeys && selectedOrgApiKeys.apiKeys.length > 0 ? (
                      <div className="space-y-3">
                        {selectedOrgApiKeys.apiKeys.map((apiKey: any) => (
                          <div key={apiKey.id} className="border rounded-lg p-4 hover:bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <SemanticBDIIcon semantic="connect" size={16} className="text-purple-600" />
                                  <span className="font-medium">{apiKey.keyName}</span>
                                  <Badge variant={apiKey.isActive ? 'default' : 'secondary'}
                                         className={apiKey.isActive ? 'bg-green-600 text-white' : 'bg-orange-500 text-white'}>
                                    {apiKey.isActive ? 'ACTIVE' : 'INACTIVE'}
                                  </Badge>
                                  {apiKey.expiresAt && (
                                    <Badge variant="outline" className="text-xs">
                                      Expires {new Date(apiKey.expiresAt).toLocaleDateString()}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500 space-y-1">
                                  <div>🔑 <code className="bg-gray-100 px-2 py-1 rounded text-xs">{apiKey.keyPrefix}</code></div>
                                  <div>⚡ {apiKey.rateLimitPerHour}/hour rate limit</div>
                                  <div>📅 Created {new Date(apiKey.createdAt).toLocaleDateString()}</div>
                                  <div>🕒 Last used: {apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).toLocaleDateString() : 'Never'}</div>
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {Object.entries(apiKey.permissions || {})
                                      .filter(([perm, enabled]) => enabled)
                                      .map(([perm, enabled]) => (
                                        <Badge key={perm} variant="outline" className="text-xs">
                                          {perm.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                        </Badge>
                                      ))
                                    }
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="text-blue-600 border-blue-300 hover:bg-blue-50">
                                  <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                                  Edit
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className={apiKey.isActive 
                                    ? "text-orange-600 border-orange-300 hover:bg-orange-50"
                                    : "text-green-600 border-green-300 hover:bg-green-50"
                                  }
                                >
                                  <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                                  {apiKey.isActive ? 'Deactivate' : 'Activate'}
                                </Button>
                                <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-50">
                                  <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                        <SemanticBDIIcon semantic="connect" size={32} className="mx-auto mb-2 text-gray-400" />
                        <p>No API keys found for this organization</p>
                        <p className="text-xs mb-4">Generate API keys to enable programmatic access</p>
                        <Button 
                          className="bg-purple-600 hover:bg-purple-700"
                          onClick={() => {
                            // Redirect to global API Keys page with organization pre-selected
                            window.location.href = `/admin/api-keys?org=${selectedOrgApiKeys.organization?.id}`;
                          }}
                        >
                          <SemanticBDIIcon semantic="plus" size={14} className="mr-1 brightness-0 invert" />
                          Generate First API Key
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Button 
                        variant="outline" 
                        className="h-16 flex flex-col gap-2 hover:border-purple-600 hover:bg-purple-50 text-purple-600"
                        onClick={() => {
                          window.location.href = `/admin/api-keys?org=${selectedOrgApiKeys.organization?.id}`;
                        }}
                      >
                        <SemanticBDIIcon semantic="plus" size={20} />
                        <span className="text-sm">Generate New Key</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-16 flex flex-col gap-2 hover:border-blue-600 hover:bg-blue-50 text-blue-600"
                        onClick={() => {
                          window.location.href = `/admin/api-keys/documentation`;
                        }}
                      >
                        <SemanticBDIIcon semantic="reports" size={20} />
                        <span className="text-sm">View Documentation</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="h-16 flex flex-col gap-2 hover:border-green-600 hover:bg-green-50 text-green-600"
                        onClick={() => {
                          window.location.href = `/admin/api-keys`;
                        }}
                      >
                        <SemanticBDIIcon semantic="analytics" size={20} />
                        <span className="text-sm">Global API Keys</span>
                      </Button>
                    </div>
                  </div>

                  {/* API Usage Instructions */}
                  <Separator />
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-800 mb-2">🚀 Integration Ready</h4>
                    <p className="text-sm text-blue-700 mb-3">
                      {selectedOrgApiKeys.organization?.name} can now integrate with BDI systems programmatically
                    </p>
                    <div className="text-xs text-blue-600 space-y-1">
                      <div><strong>Base URL:</strong> <code>https://www.bdibusinessportal.com/api/v1</code></div>
                      <div><strong>Authentication:</strong> <code>Authorization: Bearer API_KEY</code></div>
                      <div><strong>Documentation:</strong> <a href="/admin/api-keys/documentation" className="underline">Complete API Reference</a></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <SemanticBDIIcon semantic="connect" size={48} className="mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Failed to load API settings</p>
                    <Button 
                      variant="outline" 
                      className="mt-4" 
                      onClick={() => {
                        setShowApiSettings(false);
                        setSelectedOrgApiKeys(null);
                      }}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
