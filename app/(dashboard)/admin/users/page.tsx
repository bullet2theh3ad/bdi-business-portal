'use client';

import { useState, useEffect } from 'react';
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

export default function AdminUsersPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const { data: bdiUsers, mutate: mutateBdiUsers } = useSWR('/api/admin/users', fetcher);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [filterRole, setFilterRole] = useState('all');
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    role: 'member',
    title: '',
    department: 'Operations'
  });
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: '',
    title: '',
    department: ''
  });

  const handleCreateUser = async () => {
    console.log('🔍 FRONTEND DEBUG - Starting handleCreateUser');
    console.log('🔍 FRONTEND DEBUG - createForm:', createForm);
    
    if (!createForm.name || !createForm.email || !createForm.title) {
      console.log('🔍 FRONTEND DEBUG - Missing required fields');
      alert('Please fill in all required fields');
      return;
    }

    setIsCreating(true);
    try {
      console.log('🔍 FRONTEND DEBUG - Making API request to /api/organization/users/invite');
      console.log('🔍 FRONTEND DEBUG - Request body:', JSON.stringify(createForm));
      
      const response = await fetch('/api/organization/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      console.log('🔍 FRONTEND DEBUG - Response status:', response.status);
      console.log('🔍 FRONTEND DEBUG - Response ok:', response.ok);
      
      const result = await response.json();
      console.log('🔍 FRONTEND DEBUG - Response result:', result);

      if (result.success) {
        console.log('🔍 FRONTEND DEBUG - Success - closing modal');
        setShowCreateModal(false);
        setCreateForm({ name: '', email: '', role: 'member', title: '', department: 'Operations' });
        mutateBdiUsers();
        alert('User invitation sent successfully!');
      } else {
        console.log('🔍 FRONTEND DEBUG - API returned error:', result.error);
        alert(`Error: ${result.error || 'Unknown error from API'}`);
      }
    } catch (error) {
      console.error('🔍 FRONTEND DEBUG - CATCH BLOCK - Error creating user:', error);
      console.error('🔍 FRONTEND DEBUG - Error type:', typeof error);
      console.error('🔍 FRONTEND DEBUG - Error message:', error instanceof Error ? error.message : 'Not an Error object');
      alert(`Failed to create user invitation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      console.log('🔍 FRONTEND DEBUG - Setting isCreating to false');
      setIsCreating(false);
    }
  };

  const handleSaveUser = async () => {
    if (!selectedUser || !editForm.name || !editForm.role) {
      alert('Please fill in all required fields');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.authId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          role: editForm.role,
          title: editForm.title,
          department: editForm.department,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSelectedUser(null);
        mutateBdiUsers();
        alert('User updated successfully!');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeactivateUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to deactivate ${userName}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        mutateBdiUsers();
        setSelectedUser(null);
        alert('User deactivated successfully');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deactivating user:', error);
      alert('Failed to deactivate user');
    }
  };

  const handleRevokeInvitation = async (userId: string, userName: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to revoke the invitation for ${userName} (${userEmail})?`)) {
      return;
    }

    try {
      const response = await fetch('/api/admin/revoke-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitationId: userId }),
      });

      const result = await response.json();

      if (result.success) {
        mutateBdiUsers(); // Refresh user list
        setSelectedUser(null);
        alert('Invitation revoked successfully');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error revoking invitation:', error);
      alert('Failed to revoke invitation');
    }
  };

  const handleReactivateUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to reactivate ${userName}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });

      const result = await response.json();

      if (result.success) {
        mutateBdiUsers();
        setSelectedUser(null);
        alert('User reactivated successfully');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error reactivating user:', error);
      alert('Failed to reactivate user');
    }
  };

  const handleDeleteUser = async (userId: string, userName: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to PERMANENTLY DELETE ${userName} (${userEmail})? This cannot be undone and will allow re-invitation.`)) {
      return;
    }

    try {
      // Deleting user - logging removed for security

      const response = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail: userEmail }),
      });

      const result = await response.json();

      if (result.success) {
        mutateBdiUsers(); // Refresh user list
        setSelectedUser(null);
        alert('User permanently deleted - you can now re-invite this email');
      } else {
        alert(`Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  // Only BDI Super Admins and BDI Admins can access BDI user management
  if (!user || !['super_admin', 'admin'].includes(user.role) || (user as any).organization?.code !== 'BDI') {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="settings" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Access denied. BDI Admin privileges required.</p>
          </div>
        </div>
      </div>
    );
  }

  const filteredUsers = Array.isArray(bdiUsers) && filterRole === 'all' 
    ? bdiUsers 
    : Array.isArray(bdiUsers) ? bdiUsers.filter((u: any) => u.role === filterRole) : [];

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <SemanticBDIIcon semantic="users" size={32} />
            <div>
              <h1 className="text-3xl font-bold">BDI Users</h1>
              <p className="text-muted-foreground">Manage internal BDI employees and their system access</p>
            </div>
          </div>
          <Button className="bg-bdi-green-1 hover:bg-bdi-green-2" onClick={() => setShowCreateModal(true)}>
            <SemanticBDIIcon semantic="users" size={16} className="mr-2 brightness-0 invert" />
            Add BDI User
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total BDI Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-1">{bdiUsers?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Internal employees</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-2">
              {Array.isArray(bdiUsers) ? bdiUsers.filter((u: any) => u.isActive).length : 0}
            </div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Developer Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-blue">
              {Array.isArray(bdiUsers) ? bdiUsers.filter((u: any) => u.role === 'developer').length : 0}
            </div>
            <p className="text-xs text-muted-foreground">With API access</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-1">
              {Array.isArray(bdiUsers) ? bdiUsers.filter((u: any) => u.role === 'super_admin' || u.role === 'admin').length : 0}
            </div>
            <p className="text-xs text-muted-foreground">Admin privileges</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">User Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <Label className="text-sm font-medium">Filter by Role:</Label>
              <select 
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm w-full sm:w-auto"
              >
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="developer">Developer</option>
                <option value="member">Member</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <Input placeholder="Search users..." className="flex-1 sm:w-64" />
              <Button variant="outline" size="sm" className="flex-shrink-0">
                <SemanticBDIIcon semantic="search" size={14} className="mr-1" />
                <span className="hidden sm:inline">Search</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="users" size={20} className="mr-2" />
            BDI Internal Users ({filteredUsers.length})
          </CardTitle>
          <CardDescription>
            Boundless Devices Inc employees with system access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {!bdiUsers ? (
              <div className="text-center py-8">
                <SemanticBDIIcon semantic="users" size={48} className="mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading BDI users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8">
                <SemanticBDIIcon semantic="users" size={48} className="mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No users found</p>
                <p className="text-sm text-gray-500">Try adjusting your filters or create a new user</p>
              </div>
            ) : (
              filteredUsers.map((bdiUser: any) => (
                <div key={bdiUser.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  {/* Mobile-first layout */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                    {/* User Info Section */}
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 bg-bdi-green-1/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <SemanticBDIIcon semantic="profile" size={20} className="text-bdi-green-1" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {/* Name and Badges */}
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-medium text-lg">{bdiUser.name || 'Unknown'}</h3>
                          <Badge variant={bdiUser.role === 'super_admin' ? 'default' : 'secondary'} 
                                 className={bdiUser.role === 'super_admin' ? 'bg-bdi-green-1 text-white text-xs' : 
                                            bdiUser.role === 'developer' ? 'bg-bdi-blue text-white text-xs' : 
                                            bdiUser.role === 'admin' ? 'bg-bdi-green-2 text-white text-xs' : 'text-xs'}>
                            {(bdiUser.role || 'member').replace('_', ' ').toUpperCase()}
                          </Badge>
                          <Badge variant={bdiUser.isActive ? 'default' : 'secondary'} 
                                 className={bdiUser.isActive ? 'bg-bdi-green-2 text-white text-xs' : 'text-xs'}>
                            {bdiUser.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </Badge>
                          {bdiUser.role === 'developer' && (
                            <Badge variant="outline" className="border-bdi-blue text-bdi-blue text-xs">
                              API ACCESS
                            </Badge>
                          )}
                        </div>
                        
                        {/* User Details */}
                        <div className="text-sm text-gray-500 space-y-1">
                          <div className="font-medium">{bdiUser.email}</div>
                          <div>{bdiUser.title || 'No title'} • {bdiUser.department || 'No department'}</div>
                          <div>Created: {new Date(bdiUser.createdAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons - Mobile Optimized */}
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-2 w-full sm:w-auto">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full sm:w-auto justify-center sm:justify-start"
                        onClick={() => {
                          setEditForm({
                            name: bdiUser.name || '',
                            email: bdiUser.email || '',
                            role: bdiUser.role || 'member',
                            title: bdiUser.title || '',
                            department: bdiUser.department || 'Operations'
                          });
                          setSelectedUser(bdiUser);
                        }}
                      >
                        <SemanticBDIIcon semantic="settings" size={14} className="mr-2 sm:mr-1" />
                        <span className="sm:hidden">Manage User</span>
                        <span className="hidden sm:inline">Manage</span>
                      </Button>
                      
                      {bdiUser.role === 'developer' && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full sm:w-auto justify-center sm:justify-start bg-bdi-blue/10 hover:bg-bdi-blue/20"
                        >
                          <SemanticBDIIcon semantic="connect" size={14} className="mr-2 sm:mr-1" />
                          <span className="sm:hidden">API Keys</span>
                          <span className="hidden sm:inline">API</span>
                        </Button>
                      )}
                      
                                          {bdiUser.authId !== user?.authId && (
                      bdiUser.passwordHash === 'invitation_pending' ? (
                        // Pending invitation - show Revoke
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full sm:w-auto justify-center sm:justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleRevokeInvitation(bdiUser.id, bdiUser.name, bdiUser.email)}
                        >
                          <span className="sm:hidden">Revoke Invitation</span>
                          <span className="hidden sm:inline">Revoke</span>
                        </Button>
                      ) : (
                        // Accepted user - show Delete
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full sm:w-auto justify-center sm:justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteUser(bdiUser.id, bdiUser.name, bdiUser.email)}
                        >
                          <span className="sm:hidden">Delete User</span>
                          <span className="hidden sm:inline">Delete</span>
                        </Button>
                      )
                    )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* User Detail Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <SemanticBDIIcon semantic="profile" size={24} className="mr-2" />
                  Edit User: {selectedUser.name}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>
                  ×
                </Button>
              </div>
              <CardDescription>Manage BDI user information and permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* User Details */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">User Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Full Name</Label>
                      <Input 
                        value={editForm.name} 
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input value={editForm.email} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <select 
                        value={editForm.role}
                        onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                        className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm"
                      >
                        <option value="super_admin">Super Admin</option>
                        <option value="admin">Admin</option>
                        <option value="developer">Developer</option>
                        <option value="member">Member</option>
                      </select>
                    </div>
                    <div>
                      <Label>Department</Label>
                      <select 
                        value={editForm.department}
                        onChange={(e) => setEditForm(prev => ({ ...prev, department: e.target.value }))}
                        className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm"
                      >
                        <option value="Executive">Executive</option>
                        <option value="Engineering">Engineering</option>
                        <option value="Operations">Operations</option>
                        <option value="Sales">Sales</option>
                        <option value="Finance">Finance</option>
                        <option value="Marketing">Marketing</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <Label>Job Title</Label>
                      <Input 
                        value={editForm.title} 
                        onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                        className="mt-1" 
                        placeholder="Job Title"
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <Separator />
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setSelectedUser(null)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSaveUser}
                    className="bg-bdi-green-1 hover:bg-bdi-green-2" 
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </Button>
                  {selectedUser.authId !== user.authId && (
                    <Button 
                      variant="outline" 
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDeactivateUser(selectedUser.authId, selectedUser.name)}
                    >
                      Deactivate User
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center">
                <SemanticBDIIcon semantic="users" size={24} className="mr-2" />
                Add New BDI User
              </CardTitle>
              <CardDescription>Create a new internal BDI employee account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="userName">Full Name *</Label>
                    <Input 
                      id="userName" 
                      placeholder="John Doe" 
                      className="mt-1"
                      value={createForm.name}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="userEmail">Email *</Label>
                    <Input 
                      id="userEmail" 
                      type="email" 
                      placeholder="john.doe@boundlessdevices.com" 
                      className="mt-1"
                      value={createForm.email}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="userRole">Role</Label>
                    <select 
                      className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm"
                      value={createForm.role}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, role: e.target.value }))}
                    >
                      <option value="member">Member</option>
                      {user.role === 'super_admin' && <option value="admin">Admin</option>}
                      <option value="developer">Developer</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="userDepartment">Department</Label>
                    <select 
                      className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm"
                      value={createForm.department}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, department: e.target.value }))}
                    >
                      <option value="Engineering">Engineering</option>
                      <option value="Operations">Operations</option>
                      <option value="Sales">Sales</option>
                      <option value="Finance">Finance</option>
                      <option value="Marketing">Marketing</option>
                      <option value="Executive">Executive</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="userTitle">Job Title *</Label>
                  <Input 
                    id="userTitle" 
                    placeholder="Software Engineer" 
                    className="mt-1"
                    value={createForm.title}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={isCreating}>
                    Cancel
                  </Button>
                  <Button 
                    className="bg-bdi-green-1 hover:bg-bdi-green-2" 
                    onClick={handleCreateUser}
                    disabled={isCreating}
                  >
                    {isCreating ? 'Sending...' : 'Create & Send Invitation'}
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