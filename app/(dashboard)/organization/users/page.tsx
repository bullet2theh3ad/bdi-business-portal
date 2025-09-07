'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import useSWR from 'swr';
import { User } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function OrganizationUsersPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const { data: orgUsers, mutate: mutateOrgUsers } = useSWR('/api/organization/users', fetcher);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'member',
    title: '',
    department: '',
  });

  const handleInviteUser = async () => {
    if (!inviteForm.name || !inviteForm.email) {
      alert('Please fill in all required fields');
      return;
    }

    setIsInviting(true);
    try {
      const response = await fetch('/api/organization/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inviteForm)
      });

      if (!response.ok) {
        throw new Error('Failed to send invitation');
      }

      const result = await response.json();
      // User invitation sent successfully
      
      // Reset form and close modal
      setInviteForm({
        name: '',
        email: '',
        role: 'member',
        title: '',
        department: '',
      });
      setShowInviteModal(false);
      
      // Refresh users list
      mutateOrgUsers();
      
      alert('User invitation sent successfully!');
    } catch (error) {
      console.error('Error sending invitation:', error);
      alert('Failed to send invitation. Please try again.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${userName}" (${userEmail})? This will remove them from your organization and cannot be undone.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/organization/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete user');
      }

      const result = await response.json();
      // User deleted successfully
      
      // Close modal and refresh users list
      setSelectedUser(null);
      mutateOrgUsers();
      
      alert(`User "${userName}" has been permanently deleted.`);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRevokeInvitation = async (userId: string, userName: string, userEmail: string) => {
    if (!confirm(`Are you sure you want to revoke the invitation for "${userName}" (${userEmail})?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/organization/users/${userId}/revoke`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to revoke invitation');
      }

      const result = await response.json();
      console.log('Invitation revoked:', result);
      
      // Close modal and refresh users list
      setSelectedUser(null);
      mutateOrgUsers();
      
      alert(`Invitation for "${userName}" has been revoked.`);
    } catch (error) {
      console.error('Error revoking invitation:', error);
      alert('Failed to revoke invitation. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Only organization admins can access this page
  if (!user || user.role !== 'admin' || (user as any).organization?.code === 'BDI') {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="settings" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Access denied. Organization Admin required.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <SemanticBDIIcon semantic="users" size={32} />
            <div>
              <h1 className="text-3xl font-bold">{(user as any).organization?.name} Users</h1>
              <p className="text-muted-foreground">Manage your organization's team members and access</p>
            </div>
          </div>
          <Button className="bg-bdi-green-1 hover:bg-bdi-green-2" onClick={() => setShowInviteModal(true)}>
            <SemanticBDIIcon semantic="users" size={16} className="mr-2 brightness-0 invert" />
            Invite User
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-1">
              {orgUsers?.totalUsers || orgUsers?.users?.length || (Array.isArray(orgUsers) ? orgUsers.length : '...')}
            </div>
            <p className="text-xs text-muted-foreground">Organization members</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-2">
              {orgUsers?.activeUsers || (Array.isArray(orgUsers) ? orgUsers.filter((u: any) => u.isActive).length : '...')}
            </div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Pending Invitations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-blue">
              {orgUsers?.totalPendingInvitations || (Array.isArray(orgUsers) ? orgUsers.filter((u: any) => !u.isActive).length : '...')}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting signup</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-1">
              {orgUsers?.adminUsers || (Array.isArray(orgUsers) ? orgUsers.filter((u: any) => u.role === 'admin').length : '...')}
            </div>
            <p className="text-xs text-muted-foreground">Organization admins</p>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="users" size={20} className="mr-2" />
            Organization Members
          </CardTitle>
          <CardDescription>
            Manage users and access for {(user as any).organization?.name}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!orgUsers ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <SemanticBDIIcon semantic="sync" size={32} className="mx-auto mb-4 text-muted-foreground animate-spin" />
                <p className="text-muted-foreground">Loading users...</p>
              </div>
            </div>
          ) : (!orgUsers?.users && !Array.isArray(orgUsers)) || (orgUsers?.users?.length === 0 && (!Array.isArray(orgUsers) || orgUsers.length === 0)) ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <SemanticBDIIcon semantic="users" size={48} className="mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Users Yet</h3>
                <p className="text-muted-foreground mb-4">Get started by inviting your first team member</p>
                <Button 
                  className="bg-bdi-green-1 hover:bg-bdi-green-2" 
                  onClick={() => setShowInviteModal(true)}
                >
                  <SemanticBDIIcon semantic="users" size={16} className="mr-2 brightness-0 invert" />
                  Invite User
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {(orgUsers?.users || orgUsers || []).map((orgUser: any) => (
                <div key={orgUser.id} className="border rounded-lg p-4 lg:p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col space-y-4">
                    {/* User Header */}
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 lg:w-16 lg:h-16 bg-bdi-green-1/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <SemanticBDIIcon 
                          semantic="profile" 
                          size={20} 
                          className="text-bdi-green-1" 
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="text-lg lg:text-xl font-semibold">{orgUser.name}</h3>
                          <Badge variant={orgUser.role === 'admin' ? 'default' : 'secondary'} 
                                 className={orgUser.role === 'admin' ? 'bg-bdi-green-1 text-white text-xs' : 'text-xs'}>
                            {orgUser.role?.toUpperCase()}
                          </Badge>
                          <Badge variant={orgUser.isActive ? 'default' : 'secondary'} 
                                 className={orgUser.isActive ? 'bg-bdi-green-2 text-white text-xs' : 'text-xs'}>
                            {orgUser.isActive ? 'ACTIVE' : 'PENDING'}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div><strong>Email:</strong> {orgUser.email}</div>
                          {orgUser.title && <div><strong>Title:</strong> {orgUser.title}</div>}
                          {orgUser.department && <div><strong>Department:</strong> {orgUser.department}</div>}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full sm:w-auto justify-center sm:justify-start"
                        onClick={() => setSelectedUser(orgUser)}
                      >
                        <SemanticBDIIcon semantic="settings" size={14} className="mr-2 sm:mr-1" />
                        <span className="sm:hidden">Manage User</span>
                        <span className="hidden sm:inline">Manage</span>
                      </Button>
                      {!orgUser.isActive ? (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full sm:w-auto justify-center sm:justify-start bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                          onClick={() => handleRevokeInvitation(orgUser.id, orgUser.name, orgUser.email)}
                          disabled={isDeleting}
                        >
                          <SemanticBDIIcon semantic="settings" size={14} className="mr-2 sm:mr-1" />
                          <span className="sm:hidden">Revoke Invitation</span>
                          <span className="hidden sm:inline">Revoke</span>
                        </Button>
                      ) : orgUser.email !== user?.email && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full sm:w-auto justify-center sm:justify-start bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                          onClick={() => handleDeleteUser(orgUser.id, orgUser.name, orgUser.email)}
                          disabled={isDeleting}
                        >
                          <SemanticBDIIcon semantic="settings" size={14} className="mr-2 sm:mr-1" />
                          <span className="sm:hidden">Delete User</span>
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

      {/* Pending Invitations Section */}
      {orgUsers?.pendingInvitations && orgUsers.pendingInvitations.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/30">
          <CardHeader>
            <CardTitle className="flex items-center text-orange-800">
              <SemanticBDIIcon semantic="notifications" size={20} className="mr-2" />
              Pending Organization Invitations
              <Badge variant="outline" className="ml-2 text-orange-600 border-orange-300">
                {orgUsers.pendingInvitations.length}
              </Badge>
            </CardTitle>
            <CardDescription className="text-orange-700">
              Users who have been invited but haven't signed up yet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {orgUsers.pendingInvitations.map((invitation: any) => (
                <div key={invitation.id} className="border border-orange-200 rounded-lg p-4 bg-white hover:bg-orange-50">
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
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div>📧 {invitation.invitedEmail}</div>
                        <div>📅 Invited {new Date(invitation.createdAt).toLocaleDateString()}</div>
                        {invitation.expiresAt && (
                          <div>⏰ Expires {new Date(invitation.expiresAt).toLocaleDateString()}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-blue-600 border-blue-300 hover:bg-blue-50"
                        onClick={() => {
                          navigator.clipboard.writeText(invitation.invitedEmail);
                          alert('Email copied to clipboard');
                        }}
                      >
                        <SemanticBDIIcon semantic="notifications" size={14} className="mr-1" />
                        Copy Email
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* User Invitation Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center">
                <SemanticBDIIcon semantic="users" size={24} className="mr-2" />
                Invite User to {(user as any).organization?.name}
              </CardTitle>
              <CardDescription>Send an invitation to join your organization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="userName">Full Name *</Label>
                    <Input 
                      id="userName" 
                      placeholder="John Smith" 
                      value={inviteForm.name}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, name: e.target.value }))}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="userEmail">Email *</Label>
                    <Input 
                      id="userEmail" 
                      type="email" 
                      placeholder="john.smith@company.com" 
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                      className="mt-1" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="userRole">Role</Label>
                    <select 
                      id="userRole"
                      value={inviteForm.role}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
                      className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="userTitle">Title</Label>
                    <Input 
                      id="userTitle" 
                      placeholder="Sales Manager" 
                      value={inviteForm.title}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, title: e.target.value }))}
                      className="mt-1" 
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="userDepartment">Department</Label>
                  <Input 
                    id="userDepartment" 
                    placeholder="Sales" 
                    value={inviteForm.department}
                    onChange={(e) => setInviteForm(prev => ({ ...prev, department: e.target.value }))}
                    className="mt-1" 
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
                    onClick={handleInviteUser}
                    disabled={isInviting}
                  >
                    {isInviting ? (
                      <>
                        <SemanticBDIIcon semantic="sync" size={16} className="mr-2 brightness-0 invert animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <SemanticBDIIcon semantic="users" size={16} className="mr-2 brightness-0 invert" />
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

      {/* User Management Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <SemanticBDIIcon semantic="profile" size={24} className="mr-2" />
                  {selectedUser.name}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>
                  ×
                </Button>
              </div>
              <CardDescription>Manage user access and information</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* User Details */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">User Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Full Name</Label>
                      <Input value={selectedUser.name || ''} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Email Address</Label>
                      <Input value={selectedUser.email || ''} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <Input value={selectedUser.role?.toUpperCase() || ''} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Input value={selectedUser.isActive ? 'ACTIVE' : 'PENDING'} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Title</Label>
                      <Input value={selectedUser.title || ''} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Department</Label>
                      <Input value={selectedUser.department || ''} disabled className="mt-1" />
                    </div>
                  </div>
                </div>

                {/* User Status */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">User Status</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">Account Status</div>
                          <div className="text-sm text-gray-500">Current user state</div>
                        </div>
                        <Badge variant={selectedUser.isActive ? 'default' : 'secondary'} 
                               className={selectedUser.isActive ? 'bg-bdi-green-1 text-white' : ''}>
                          {selectedUser.isActive ? 'ACTIVE' : 'PENDING'}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">Organization Role</div>
                          <div className="text-sm text-gray-500">Access level</div>
                        </div>
                        <Badge variant={selectedUser.role === 'admin' ? 'default' : 'secondary'} 
                               className={selectedUser.role === 'admin' ? 'bg-bdi-blue text-white' : ''}>
                          {selectedUser.role?.toUpperCase()}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">Joined</div>
                          <div className="text-sm text-gray-500">Member since</div>
                        </div>
                        <div className="text-sm font-medium">
                          {new Date(selectedUser.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">Last Login</div>
                          <div className="text-sm text-gray-500">Recent activity</div>
                        </div>
                        <div className="text-sm font-medium">
                          {selectedUser.lastLoginAt ? new Date(selectedUser.lastLoginAt).toLocaleDateString() : 'Never'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Danger Zone - Only show if not the current user */}
                {selectedUser.email !== user?.email && (
                  <>
                    <div className="border border-red-200 rounded-lg p-4 bg-red-50/50">
                      <h3 className="text-lg font-semibold mb-4 text-red-700 flex items-center">
                        <SemanticBDIIcon semantic="settings" size={20} className="mr-2" />
                        Danger Zone
                      </h3>
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                          <div>
                            <h4 className="font-medium text-red-700">
                              {selectedUser.isActive ? 'Remove User' : 'Revoke Invitation'}
                            </h4>
                            <p className="text-sm text-red-600">
                              {selectedUser.isActive 
                                ? 'Permanently remove this user from your organization. This cannot be undone.'
                                : 'Cancel the invitation and remove the pending user. This cannot be undone.'
                              }
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700"
                            onClick={() => selectedUser.isActive 
                              ? handleDeleteUser(selectedUser.id, selectedUser.name, selectedUser.email)
                              : handleRevokeInvitation(selectedUser.id, selectedUser.name, selectedUser.email)
                            }
                            disabled={isDeleting}
                          >
                            {isDeleting ? (
                              <>
                                <SemanticBDIIcon semantic="sync" size={14} className="mr-1 animate-spin" />
                                {selectedUser.isActive ? 'Removing...' : 'Revoking...'}
                              </>
                            ) : (
                              <>
                                <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                                {selectedUser.isActive ? 'Remove User' : 'Revoke Invitation'}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
