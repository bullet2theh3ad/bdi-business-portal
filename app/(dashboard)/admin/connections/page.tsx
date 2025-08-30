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

interface ConnectionForm {
  organizationAId: string;
  organizationBId: string;
  connectionType: 'messaging' | 'file_share' | 'full_collaboration';
  description: string;
  permissions: {
    canChat: boolean;
    canViewFiles: boolean;
    canShareFiles: boolean;
    canViewUsers: boolean;
    canViewTeams: boolean;
    canCreateCrossOrgTeams: boolean;
  };
}

export default function ConnectionsPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const { data: organizations } = useSWR('/api/admin/organizations?includeInternal=true', fetcher);
  const { data: connections, mutate: mutateConnections } = useSWR('/api/admin/connections', fetcher);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showEditPermissions, setShowEditPermissions] = useState(false);
  const [editPermissionsForm, setEditPermissionsForm] = useState<any>(null);
  const [connectionForm, setConnectionForm] = useState<ConnectionForm>({
    organizationAId: '',
    organizationBId: '',
    connectionType: 'messaging',
    description: '',
    permissions: {
      canChat: true,
      canViewFiles: false,
      canShareFiles: false,
      canViewUsers: true,
      canViewTeams: true,
      canCreateCrossOrgTeams: false,
    }
  });

  const handleCreateConnection = async () => {
    if (!connectionForm.organizationAId || !connectionForm.organizationBId) {
      alert('Please select both organizations');
      return;
    }

    if (connectionForm.organizationAId === connectionForm.organizationBId) {
      alert('Cannot connect an organization to itself');
      return;
    }

    setIsCreating(true);
    try {
      console.log('Sending connection request:', connectionForm);
      
      const response = await fetch('/api/admin/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionForm)
      });

      const result = await response.json();
      console.log('API response:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create connection');
      }

      console.log('Connection created:', result);
      
      // Reset form and close modal
      setConnectionForm({
        organizationAId: '',
        organizationBId: '',
        connectionType: 'messaging',
        description: '',
        permissions: {
          canChat: true,
          canViewFiles: false,
          canShareFiles: false,
          canViewUsers: true,
          canViewTeams: true,
          canCreateCrossOrgTeams: false,
        }
      });
      setShowCreateModal(false);
      
      // Refresh connections list
      mutateConnections();
      
      alert('Organization connection created successfully!');
    } catch (error) {
      console.error('Error creating connection:', error);
      alert('Failed to create connection. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditPermissions = (connection: any) => {
    setEditPermissionsForm({
      connectionType: connection.connectionType,
      permissions: { ...connection.permissions },
      description: connection.description || ''
    });
    setShowEditPermissions(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedConnection || !editPermissionsForm) return;

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/admin/connections/${selectedConnection.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPermissionsForm)
      });

      const result = await response.json();
      console.log('Connection update response:', result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update connection');
      }

      setShowEditPermissions(false);
      setEditPermissionsForm(null);
      
      // Update the selected connection with new data
      const updatedConnections = await mutateConnections();
      if (updatedConnections) {
        const updatedConnection = updatedConnections.find((conn: any) => conn.id === selectedConnection.id);
        if (updatedConnection) {
          setSelectedConnection(updatedConnection);
        }
      }
      
      alert('Connection permissions updated successfully!');
    } catch (error) {
      console.error('Error updating connection:', error);
      alert('Failed to update connection. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSuspendConnection = async (connectionId: string, orgAName: string, orgBName: string) => {
    if (!confirm(`Are you sure you want to suspend the connection between "${orgAName}" and "${orgBName}"? This will temporarily disable all collaboration.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/connections/${connectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended' })
      });

      if (!response.ok) {
        throw new Error('Failed to suspend connection');
      }

      mutateConnections();
      alert(`Connection between "${orgAName}" and "${orgBName}" has been suspended.`);
    } catch (error) {
      console.error('Error suspending connection:', error);
      alert('Failed to suspend connection. Please try again.');
    }
  };

  const handleDisconnectOrganizations = async (connectionId: string, orgAName: string, orgBName: string) => {
    if (!confirm(`Are you sure you want to disconnect "${orgAName}" and "${orgBName}"? This will remove all collaboration permissions between them.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/connections/${connectionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect organizations');
      }

      setSelectedConnection(null); // Close modal
      mutateConnections();
      alert(`Organizations "${orgAName}" and "${orgBName}" have been disconnected.`);
    } catch (error) {
      console.error('Error disconnecting organizations:', error);
      alert('Failed to disconnect organizations. Please try again.');
    }
  };

  // Only BDI Super Admins can access this page
  if (!user || user.role !== 'super_admin' || user.organization?.code !== 'BDI') {
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
            <SemanticBDIIcon semantic="connect" size={32} />
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Organization Connections</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Manage collaboration permissions between partner organizations</p>
            </div>
          </div>
          <Button 
            className="bg-bdi-green-1 hover:bg-bdi-green-2 w-full sm:w-auto justify-center" 
            onClick={() => setShowCreateModal(true)}
          >
            <SemanticBDIIcon semantic="connect" size={16} className="mr-2 brightness-0 invert" />
            <span className="sm:hidden">Connect Organizations</span>
            <span className="hidden sm:inline">Connect Organizations</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-1">
              {Array.isArray(connections) ? connections.length : '...'}
            </div>
            <p className="text-xs text-muted-foreground">Active partnerships</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-2">
              {Array.isArray(connections) ? connections.filter((conn: any) => conn.status === 'active').length : '...'}
            </div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Connected Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-blue">
              {Array.isArray(organizations) ? organizations.length : '...'}
            </div>
            <p className="text-xs text-muted-foreground">Available partners</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Cross-Org Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-1">0</div>
            <p className="text-xs text-muted-foreground">Multi-org teams</p>
          </CardContent>
        </Card>
      </div>

      {/* Connections List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="connect" size={20} className="mr-2" />
            Organization Connections
          </CardTitle>
          <CardDescription>
            Manage collaboration and data sharing permissions between partner organizations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!connections ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <SemanticBDIIcon semantic="sync" size={32} className="mx-auto mb-4 text-muted-foreground animate-spin" />
                <p className="text-muted-foreground">Loading connections...</p>
              </div>
            </div>
          ) : !Array.isArray(connections) || connections.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <SemanticBDIIcon semantic="connect" size={48} className="mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No Connections Yet</h3>
                <p className="text-muted-foreground mb-4">Connect organizations to enable collaboration and data sharing</p>
                <Button 
                  className="bg-bdi-green-1 hover:bg-bdi-green-2" 
                  onClick={() => setShowCreateModal(true)}
                >
                  <SemanticBDIIcon semantic="connect" size={16} className="mr-2 brightness-0 invert" />
                  Connect Organizations
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {connections.map((connection: any) => (
                <div key={connection.id} className="border rounded-lg p-4 lg:p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col space-y-4">
                    {/* Connection Header */}
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 lg:w-16 lg:h-16 bg-bdi-green-1/10 rounded-xl flex items-center justify-center flex-shrink-0">
                        <SemanticBDIIcon 
                          semantic="connect" 
                          size={20} 
                          className="text-bdi-green-1" 
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="text-lg lg:text-xl font-semibold">
                            {connection.organizationAName} ↔ {connection.organizationBName}
                          </h3>
                          <Badge variant={connection.status === 'active' ? 'default' : 'secondary'} 
                                 className={connection.status === 'active' ? 'bg-bdi-green-1 text-white text-xs' : 'text-xs'}>
                            {connection.status?.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="bg-bdi-blue text-white text-xs">
                            {connection.connectionType?.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div><strong>Created:</strong> {new Date(connection.createdAt).toLocaleDateString()}</div>
                          {connection.description && <div><strong>Purpose:</strong> {connection.description}</div>}
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full sm:w-auto justify-center sm:justify-start"
                        onClick={() => setSelectedConnection(connection)}
                      >
                        <SemanticBDIIcon semantic="settings" size={14} className="mr-2 sm:mr-1" />
                        <span className="sm:hidden">Manage Connection</span>
                        <span className="hidden sm:inline">Manage</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full sm:w-auto justify-center sm:justify-start bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                        onClick={() => handleDisconnectOrganizations(connection.id, connection.organizationAName, connection.organizationBName)}
                      >
                        <SemanticBDIIcon semantic="settings" size={14} className="mr-2 sm:mr-1" />
                        <span className="sm:hidden">Disconnect</span>
                        <span className="hidden sm:inline">Disconnect</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Connection Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center">
                <SemanticBDIIcon semantic="connect" size={24} className="mr-2" />
                Connect Organizations
              </CardTitle>
              <CardDescription>Enable collaboration and data sharing between partner organizations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Organization Selection */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Select Organizations</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="orgA">First Organization</Label>
                      <select 
                        id="orgA"
                        value={connectionForm.organizationAId}
                        onChange={(e) => setConnectionForm(prev => ({ ...prev, organizationAId: e.target.value }))}
                        className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm"
                      >
                        <option value="">Select organization</option>
                        {Array.isArray(organizations) && organizations.map((org: any) => (
                          <option key={org.id} value={org.id}>
                            {org.name} ({org.code})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="orgB">Second Organization</Label>
                      <select 
                        id="orgB"
                        value={connectionForm.organizationBId}
                        onChange={(e) => setConnectionForm(prev => ({ ...prev, organizationBId: e.target.value }))}
                        className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm"
                      >
                        <option value="">Select organization</option>
                        {Array.isArray(organizations) && organizations.map((org: any) => (
                          <option key={org.id} value={org.id}>
                            {org.name} ({org.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Connection Type */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Connection Type</h3>
                  <select 
                    value={connectionForm.connectionType}
                    onChange={(e) => {
                      const newType = e.target.value as any;
                      let newPermissions = { ...connectionForm.permissions };
                      
                      // Set smart defaults based on connection type
                      if (newType === 'messaging') {
                        newPermissions = {
                          canChat: true,
                          canViewFiles: false,
                          canShareFiles: false,
                          canViewUsers: true,
                          canViewTeams: true,
                          canCreateCrossOrgTeams: false,
                        };
                      } else if (newType === 'file_share') {
                        newPermissions = {
                          canChat: true,
                          canViewFiles: true,
                          canShareFiles: true,
                          canViewUsers: true,
                          canViewTeams: true,
                          canCreateCrossOrgTeams: false,
                        };
                      } else if (newType === 'full_collaboration') {
                        newPermissions = {
                          canChat: true,
                          canViewFiles: true,
                          canShareFiles: true,
                          canViewUsers: true,
                          canViewTeams: true,
                          canCreateCrossOrgTeams: true,
                        };
                      }
                      
                      setConnectionForm(prev => ({ 
                        ...prev, 
                        connectionType: newType,
                        permissions: newPermissions
                      }));
                    }}
                    className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-xs"
                  >
                    <option value="messaging" className="text-xs">Messaging</option>
                    <option value="file_share" className="text-xs">File Share</option>
                    <option value="full_collaboration" className="text-xs">Full Collaboration</option>
                  </select>
                  <div className="mt-2 text-xs text-gray-500">
                    <div><strong>Messaging:</strong> Chat and messaging features only</div>
                    <div><strong>File Share:</strong> File access and document viewing/sharing</div>
                    <div><strong>Full Collaboration:</strong> Chat, file sharing, cross-org teams, complete access</div>
                  </div>
                </div>

                <Separator />

                {/* Permissions */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Collaboration Permissions</h3>
                  <div className="space-y-3">
                    {Object.entries({
                      canChat: 'Enable chat and messaging between organizations',
                      canViewFiles: 'Can view each other\'s uploaded documents',
                      canShareFiles: 'Can upload files to shared folders', 
                      canViewUsers: 'Can view each other\'s user lists',
                      canViewTeams: 'Can view each other\'s team structures',
                      canCreateCrossOrgTeams: 'Can create cross-organization teams'
                    }).map(([key, label]) => (
                      <div key={key} className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id={key}
                          checked={connectionForm.permissions[key as keyof typeof connectionForm.permissions]}
                          onChange={(e) => setConnectionForm(prev => ({
                            ...prev,
                            permissions: {
                              ...prev.permissions,
                              [key]: e.target.checked
                            }
                          }))}
                          className="h-4 w-4 text-bdi-green-1 focus:ring-bdi-green-1 border-gray-300 rounded"
                        />
                        <label htmlFor={key} className="text-sm font-medium text-gray-700">
                          {label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Description */}
                <div>
                  <Label htmlFor="description">Connection Description</Label>
                  <textarea
                    id="description"
                    placeholder="Describe the purpose and scope of this organizational connection"
                    value={connectionForm.description}
                    onChange={(e) => setConnectionForm(prev => ({ ...prev, description: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1"
                    rows={3}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCreateModal(false)}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="bg-bdi-green-1 hover:bg-bdi-green-2" 
                    onClick={handleCreateConnection}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <>
                        <SemanticBDIIcon semantic="sync" size={16} className="mr-2 brightness-0 invert animate-spin" />
                        Creating Connection...
                      </>
                    ) : (
                      <>
                        <SemanticBDIIcon semantic="connect" size={16} className="mr-2 brightness-0 invert" />
                        Create Connection
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Manage Connection Modal */}
      {selectedConnection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <SemanticBDIIcon semantic="connect" size={24} className="mr-2" />
                  {selectedConnection.organizationAName} ↔ {selectedConnection.organizationBName}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setSelectedConnection(null)}>
                  ×
                </Button>
              </div>
              <CardDescription>Manage collaboration permissions and settings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Connection Details */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Connection Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Connection Type</Label>
                      <Input value={selectedConnection.connectionType?.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || ''} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Input value={selectedConnection.status?.toUpperCase() || ''} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Created Date</Label>
                      <Input value={new Date(selectedConnection.createdAt).toLocaleDateString()} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Last Updated</Label>
                      <Input value={new Date(selectedConnection.updatedAt).toLocaleDateString()} disabled className="mt-1" />
                    </div>
                  </div>
                  {selectedConnection.description && (
                    <div className="mt-4">
                      <Label>Description</Label>
                      <textarea
                        value={selectedConnection.description}
                        disabled
                        className="mt-1 w-full px-3 py-2 border border-gray-300 bg-gray-100 rounded-md text-gray-700"
                        rows={2}
                      />
                    </div>
                  )}
                </div>

                {/* Current Permissions */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Current Permissions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedConnection.permissions && Object.entries({
                      canChat: 'Chat and messaging',
                      canViewFiles: 'View documents',
                      canShareFiles: 'Share files',
                      canViewUsers: 'View user lists',
                      canViewTeams: 'View team structures',
                      canCreateCrossOrgTeams: 'Create cross-org teams'
                    }).map(([key, label]) => (
                      <div key={key} className={`p-3 rounded-lg border ${
                        selectedConnection.permissions[key] 
                          ? 'border-bdi-green-1 bg-bdi-green-1/5' 
                          : 'border-gray-200 bg-gray-50'
                      }`}>
                        <div className="flex items-center space-x-2">
                          <div className={`w-4 h-4 rounded-full ${
                            selectedConnection.permissions[key] 
                              ? 'bg-bdi-green-1' 
                              : 'bg-gray-300'
                          }`} />
                          <span className={`text-sm font-medium ${
                            selectedConnection.permissions[key] 
                              ? 'text-bdi-green-1' 
                              : 'text-gray-500'
                          }`}>
                            {label}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Button 
                      variant="outline" 
                      className="h-16 flex flex-col gap-2 hover:border-bdi-green-1 hover:bg-bdi-green-1/10"
                      onClick={() => handleEditPermissions(selectedConnection)}
                    >
                      <SemanticBDIIcon semantic="settings" size={20} />
                      <span className="text-sm">Edit Permissions</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-16 flex flex-col gap-2 hover:border-bdi-blue hover:bg-bdi-blue/10"
                      onClick={() => alert('Activity log feature coming soon!')}
                    >
                      <SemanticBDIIcon semantic="analytics" size={20} />
                      <span className="text-sm">View Activity</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      className="h-16 flex flex-col gap-2 hover:border-orange-500 hover:bg-orange-50"
                      onClick={() => handleSuspendConnection(selectedConnection.id, selectedConnection.organizationAName, selectedConnection.organizationBName)}
                    >
                      <SemanticBDIIcon semantic="settings" size={20} />
                      <span className="text-sm">
                        {selectedConnection.status === 'suspended' ? 'Reactivate' : 'Suspend Connection'}
                      </span>
                    </Button>
                  </div>
                </div>

                {/* Danger Zone */}
                <div className="border border-red-200 rounded-lg p-4 bg-red-50/50">
                  <h3 className="text-lg font-semibold mb-4 text-red-700 flex items-center">
                    <SemanticBDIIcon semantic="settings" size={20} className="mr-2" />
                    Danger Zone
                  </h3>
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0">
                      <div>
                        <h4 className="font-medium text-red-700">Disconnect Organizations</h4>
                        <p className="text-sm text-red-600">
                          Permanently remove collaboration between these organizations. This cannot be undone.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700"
                        onClick={() => {
                          setSelectedConnection(null);
                          handleDisconnectOrganizations(selectedConnection.id, selectedConnection.organizationAName, selectedConnection.organizationBName);
                        }}
                      >
                        <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                        Disconnect Organizations
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {showEditPermissions && editPermissionsForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center">
                <SemanticBDIIcon semantic="settings" size={24} className="mr-2" />
                Edit Connection Permissions
              </CardTitle>
              <CardDescription>
                Modify collaboration permissions for {selectedConnection?.organizationAName} ↔ {selectedConnection?.organizationBName}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Connection Type */}
                <div>
                  <Label htmlFor="editConnectionType">Connection Type</Label>
                  <select 
                    id="editConnectionType"
                    value={editPermissionsForm.connectionType}
                    onChange={(e) => {
                      const newType = e.target.value;
                      let newPermissions = { ...editPermissionsForm.permissions };
                      
                      // Set smart defaults based on connection type
                      if (newType === 'messaging') {
                        newPermissions = {
                          canChat: true,
                          canViewFiles: false,
                          canShareFiles: false,
                          canViewUsers: true,
                          canViewTeams: true,
                          canCreateCrossOrgTeams: false,
                        };
                      } else if (newType === 'file_share') {
                        newPermissions = {
                          canChat: true,
                          canViewFiles: true,
                          canShareFiles: true,
                          canViewUsers: true,
                          canViewTeams: true,
                          canCreateCrossOrgTeams: false,
                        };
                      } else if (newType === 'full_collaboration') {
                        newPermissions = {
                          canChat: true,
                          canViewFiles: true,
                          canShareFiles: true,
                          canViewUsers: true,
                          canViewTeams: true,
                          canCreateCrossOrgTeams: true,
                        };
                      }
                      
                      setEditPermissionsForm(prev => ({ 
                        ...prev, 
                        connectionType: newType,
                        permissions: newPermissions
                      }));
                    }}
                    className="mt-1 w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-xs"
                  >
                    <option value="messaging" className="text-xs">Messaging</option>
                    <option value="file_share" className="text-xs">File Share</option>
                    <option value="full_collaboration" className="text-xs">Full Collaboration</option>
                  </select>
                </div>

                <Separator />

                {/* Permissions */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Collaboration Permissions</h3>
                  <div className="space-y-3">
                    {Object.entries({
                      canChat: 'Enable chat and messaging between organizations',
                      canViewFiles: 'Can view each other\'s uploaded documents',
                      canShareFiles: 'Can upload files to shared folders', 
                      canViewUsers: 'Can view each other\'s user lists',
                      canViewTeams: 'Can view each other\'s team structures',
                      canCreateCrossOrgTeams: 'Can create cross-organization teams'
                    }).map(([key, label]) => (
                      <div key={key} className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          id={`edit-${key}`}
                          checked={editPermissionsForm.permissions[key] || false}
                          onChange={(e) => setEditPermissionsForm(prev => ({
                            ...prev,
                            permissions: {
                              ...prev.permissions,
                              [key]: e.target.checked
                            }
                          }))}
                          className="h-4 w-4 text-bdi-green-1 focus:ring-bdi-green-1 border-gray-300 rounded"
                        />
                        <label htmlFor={`edit-${key}`} className="text-sm font-medium text-gray-700">
                          {label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Description */}
                <div>
                  <Label htmlFor="editDescription">Connection Description</Label>
                  <textarea
                    id="editDescription"
                    placeholder="Describe the purpose and scope of this organizational connection"
                    value={editPermissionsForm.description}
                    onChange={(e) => setEditPermissionsForm(prev => ({ ...prev, description: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1"
                    rows={3}
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowEditPermissions(false);
                      setEditPermissionsForm(null);
                    }}
                    disabled={isUpdating}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="bg-bdi-green-1 hover:bg-bdi-green-2" 
                    onClick={handleSavePermissions}
                    disabled={isUpdating}
                  >
                    {isUpdating ? (
                      <>
                        <SemanticBDIIcon semantic="sync" size={16} className="mr-2 brightness-0 invert animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <SemanticBDIIcon semantic="settings" size={16} className="mr-2 brightness-0 invert" />
                        Save Changes
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
