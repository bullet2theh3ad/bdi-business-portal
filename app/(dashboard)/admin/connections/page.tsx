'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import { PermissionMatrix } from '@/components/PermissionMatrix';
import { NetworkDiagram } from '@/components/NetworkDiagram';
import useSWR from 'swr';
import { User } from '@/lib/db/schema';

interface UserWithOrganization extends User {
  organization?: {
    id: string;
    name: string;
    code: string;
    type: string;
  } | null;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface DirectionalConnection {
  id: string;
  sourceOrganizationId: string;
  targetOrganizationId: string;
  sourceOrganizationName: string;
  targetOrganizationName: string;
  sourceOrganizationCode: string;
  targetOrganizationCode: string;
  connectionType: 'messaging' | 'file_share' | 'full_collaboration';
  status: string;
  permissions: {
    canViewPublicData: boolean;
    canViewPartnerData: boolean;
    canViewConfidentialData: boolean;
    canViewInternalData: boolean;
    canViewUsers: boolean;
    canViewTeams: boolean;
    canCreateCrossOrgTeams: boolean;
    canChat: boolean;
    canViewFiles: boolean;
    canShareFiles: boolean;
    canDownloadFiles: boolean;
    canUploadFiles: boolean;
  };
  allowedDataCategories: ('public' | 'partner' | 'confidential' | 'internal')[];
  description?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface BilateralConnection {
  id: string;
  organizationA: Organization;
  organizationB: Organization;
  connections: {
    aToB: DirectionalConnection | null;
    bToA: DirectionalConnection | null;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
}

export default function ConnectionsPage() {
  const { data: user } = useSWR<UserWithOrganization>('/api/user', fetcher);
  const { data: organizations } = useSWR('/api/admin/organizations?includeInternal=true', fetcher);
  const { data: connectionsData, mutate: mutateConnections } = useSWR('/api/admin/connections', fetcher);
  const [viewMode, setViewMode] = useState<'matrix' | 'network' | 'list'>('matrix');
  const [isLoading, setIsLoading] = useState(false);

  // Access control check
  if (!user || user.role !== 'super_admin' || user.organization?.code !== 'BDI') {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <SemanticBDIIcon semantic="security" className="w-12 h-12 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
              <p>Only BDI Super Admins can manage organization connections.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const directionalConnections: DirectionalConnection[] = connectionsData?.directionalConnections || [];
  const bilateralConnections: BilateralConnection[] = connectionsData?.connections || [];
  const orgs: Organization[] = Array.isArray(organizations) ? organizations : [];

  const handleUpdatePermissions = async (connectionId: string, permissions: any, dataCategories: string[]) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/connections/${connectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          permissions,
          allowedDataCategories: dataCategories,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update connection');
      }

      await mutateConnections();
    } catch (error) {
      console.error('Error updating permissions:', error);
      alert('Failed to update permissions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateConnection = async (sourceId: string, targetId: string, connectionData: any) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceOrganizationId: sourceId,
          targetOrganizationId: targetId,
          ...connectionData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create connection');
      }

      await mutateConnections();
    } catch (error) {
      console.error('Error creating connection:', error);
      alert(`Failed to create connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnectOrganizations = async (connectionId: string) => {
    if (!confirm('Are you sure you want to disconnect these organizations? This will remove all directional connections between them.')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/connections/${connectionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect organizations');
      }

      await mutateConnections();
    } catch (error) {
      console.error('Error disconnecting organizations:', error);
      alert('Failed to disconnect organizations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getConnectionSummary = (connection: BilateralConnection) => {
    const aToB = connection.connections.aToB;
    const bToA = connection.connections.bToA;
    
    if (aToB && bToA) {
      return `Bilateral (${aToB.connectionType} ↔ ${bToA.connectionType})`;
    } else if (aToB) {
      return `${connection.organizationA.code} → ${connection.organizationB.code} (${aToB.connectionType})`;
    } else if (bToA) {
      return `${connection.organizationB.code} → ${connection.organizationA.code} (${bToA.connectionType})`;
    }
    return 'No active connections';
  };

  return (
    <div className="p-4 md:p-8 max-w-full">
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Organization Connections</h1>
            <p className="text-sm md:text-base text-gray-600">
              Manage asymmetric data access permissions between organizations. 
              Control exactly what each organization can see and do with others' data.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              variant={viewMode === 'matrix' ? 'default' : 'outline'}
              onClick={() => setViewMode('matrix')}
              className={`text-sm ${viewMode === 'matrix' ? 'bg-bdi-green-1 hover:bg-bdi-green-2 text-white' : 'hover:bg-gray-50'}`}
            >
              {viewMode === 'matrix' ? (
                <svg className="w-4 h-4 mr-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z"/>
                </svg>
              ) : (
                <SemanticBDIIcon 
                  semantic="collaboration" 
                  className="w-4 h-4 mr-2 text-bdi-green-1" 
                />
              )}
              <span className="hidden sm:inline">Matrix</span>
              <span className="sm:hidden">Grid</span>
            </Button>
            <Button
              variant={viewMode === 'network' ? 'default' : 'outline'}
              onClick={() => setViewMode('network')}
              className={`text-sm ${viewMode === 'network' ? 'bg-bdi-green-1 hover:bg-bdi-green-2 text-white' : 'hover:bg-gray-50'}`}
            >
              {viewMode === 'network' ? (
                <svg className="w-4 h-4 mr-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="5" cy="5" r="3"/>
                  <circle cx="19" cy="5" r="3"/>
                  <circle cx="5" cy="19" r="3"/>
                  <circle cx="19" cy="19" r="3"/>
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M7.5 7.5L10.5 10.5M13.5 10.5L16.5 7.5M7.5 16.5L10.5 13.5M13.5 13.5L16.5 16.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
                </svg>
              ) : (
                <SemanticBDIIcon 
                  semantic="connect" 
                  className="w-4 h-4 mr-2 text-bdi-green-1" 
                />
              )}
              <span className="hidden sm:inline">Network</span>
              <span className="sm:hidden">Map</span>
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              onClick={() => setViewMode('list')}
              className={`text-sm ${viewMode === 'list' ? 'bg-bdi-green-1 hover:bg-bdi-green-2 text-white' : 'hover:bg-gray-50'}`}
            >
              {viewMode === 'list' ? (
                <svg className="w-4 h-4 mr-2 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2z"/>
                </svg>
              ) : (
                <SemanticBDIIcon 
                  semantic="inventory" 
                  className="w-4 h-4 mr-2 text-bdi-green-1" 
                />
              )}
              <span className="hidden sm:inline">List</span>
              <span className="sm:hidden">List</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <SemanticBDIIcon semantic="collaboration" className="w-8 h-8 text-bdi-green-1" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Organizations</p>
                  <p className="text-2xl font-bold">{orgs.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <SemanticBDIIcon semantic="connect" className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Bilateral Pairs</p>
                  <p className="text-2xl font-bold">{bilateralConnections.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <SemanticBDIIcon semantic="share" className="w-8 h-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Directional Links</p>
                  <p className="text-2xl font-bold">{directionalConnections.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <SemanticBDIIcon semantic="security" className="w-8 h-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active</p>
                  <p className="text-2xl font-bold">
                    {directionalConnections.filter(c => c.status === 'active').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Matrix View */}
      {viewMode === 'matrix' && (
        <PermissionMatrix
          organizations={orgs}
          connections={directionalConnections}
          onUpdatePermissions={handleUpdatePermissions}
          onCreateConnection={handleCreateConnection}
        />
      )}

      {/* Network View */}
      {viewMode === 'network' && (
        <NetworkDiagram
          organizations={orgs}
          connections={directionalConnections}
        />
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SemanticBDIIcon semantic="inventory" className="w-5 h-5 text-bdi-green-1" />
                Connection Summary
              </CardTitle>
              <CardDescription>
                Overview of all bilateral connections between organizations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {bilateralConnections.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <SemanticBDIIcon semantic="collaboration" className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No connections found</p>
                  <p className="text-sm">Use the Matrix View to create connections between organizations</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bilateralConnections.map((connection) => (
                    <div
                      key={connection.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{connection.organizationA.code}</Badge>
                          <SemanticBDIIcon semantic="connect" className="w-4 h-4 text-gray-400" />
                          <Badge variant="outline">{connection.organizationB.code}</Badge>
                        </div>
                        <div>
                          <p className="font-medium">
                            {connection.organizationA.name} ↔ {connection.organizationB.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {getConnectionSummary(connection)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          {connection.status}
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnectOrganizations(connection.id)}
                          disabled={isLoading}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <SemanticBDIIcon semantic="disconnect" className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Directional Connections Detail */}
          {directionalConnections.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SemanticBDIIcon semantic="share" className="w-5 h-5 text-bdi-green-1" />
                  Directional Access Details
                </CardTitle>
                <CardDescription>
                  Individual directional permissions showing exactly who can access what
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {directionalConnections.map((connection) => (
                    <div
                      key={connection.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{connection.sourceOrganizationCode}</Badge>
                          <SemanticBDIIcon semantic="arrow-right" className="w-4 h-4 text-gray-400" />
                          <Badge variant="outline">{connection.targetOrganizationCode}</Badge>
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {connection.sourceOrganizationName} can access {connection.targetOrganizationName}
                          </p>
                          <div className="flex gap-2 mt-1">
                            <Badge 
                              variant="secondary" 
                              className={`text-xs ${
                                connection.connectionType === 'messaging' ? 'bg-blue-100 text-blue-800' :
                                connection.connectionType === 'file_share' ? 'bg-orange-100 text-orange-800' :
                                'bg-green-100 text-green-800'
                              }`}
                            >
                              {connection.connectionType.replace('_', ' ')}
                            </Badge>
                            <div className="flex gap-1">
                              {connection.allowedDataCategories.map(cat => (
                                <div
                                  key={cat}
                                  className={`w-3 h-3 rounded-full ${
                                    cat === 'public' ? 'bg-green-500' :
                                    cat === 'partner' ? 'bg-blue-500' :
                                    cat === 'confidential' ? 'bg-yellow-500' :
                                    'bg-red-500'
                                  }`}
                                  title={cat}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(connection.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg">
            <div className="flex items-center gap-3">
              <SemanticBDIIcon semantic="loading" className="w-5 h-5 animate-spin text-bdi-green-1" />
              <span>Processing...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}