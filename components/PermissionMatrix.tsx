'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SemanticBDIIcon } from '@/components/BDIIcon';

interface Organization {
  id: string;
  name: string;
  code: string;
}

interface Permission {
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
}

interface DirectionalConnection {
  id: string;
  sourceOrganizationId: string;
  targetOrganizationId: string;
  connectionType: 'messaging' | 'file_share' | 'full_collaboration';
  status: string;
  permissions: Permission;
  allowedDataCategories: ('public' | 'partner' | 'confidential' | 'internal')[];
  description?: string;
  tags: string[];
}

interface PermissionMatrixProps {
  organizations: Organization[];
  connections: DirectionalConnection[];
  onUpdatePermissions: (connectionId: string, permissions: Permission, dataCategories: string[]) => Promise<void>;
  onCreateConnection: (sourceId: string, targetId: string, connectionData: any) => Promise<void>;
}

const PERMISSION_CATEGORIES = {
  'Data Access': [
    { key: 'canViewPublicData', label: 'Public Data', icon: 'inventory' as const, color: 'bg-green-100 text-green-800' },
    { key: 'canViewPartnerData', label: 'Partner Data', icon: 'collaboration' as const, color: 'bg-blue-100 text-blue-800' },
    { key: 'canViewConfidentialData', label: 'Confidential', icon: 'security' as const, color: 'bg-yellow-100 text-yellow-800' },
    { key: 'canViewInternalData', label: 'Internal Data', icon: 'settings' as const, color: 'bg-red-100 text-red-800' },
  ],
  'User & Team Access': [
    { key: 'canViewUsers', label: 'View Users', icon: 'users' as const, color: 'bg-purple-100 text-purple-800' },
    { key: 'canViewTeams', label: 'View Teams', icon: 'collaboration' as const, color: 'bg-purple-100 text-purple-800' },
    { key: 'canCreateCrossOrgTeams', label: 'Cross-Org Teams', icon: 'connect' as const, color: 'bg-indigo-100 text-indigo-800' },
  ],
  'Communication & Files': [
    { key: 'canChat', label: 'Messaging', icon: 'chat' as const, color: 'bg-cyan-100 text-cyan-800' },
    { key: 'canViewFiles', label: 'View Files', icon: 'documents' as const, color: 'bg-gray-100 text-gray-800' },
    { key: 'canShareFiles', label: 'Share Files', icon: 'share' as const, color: 'bg-orange-100 text-orange-800' },
    { key: 'canDownloadFiles', label: 'Download Files', icon: 'download' as const, color: 'bg-teal-100 text-teal-800' },
    { key: 'canUploadFiles', label: 'Upload Files', icon: 'upload' as const, color: 'bg-pink-100 text-pink-800' },
  ],
};

const DATA_CATEGORIES = [
  { key: 'public', label: 'Public', color: 'bg-green-500', description: 'Company info, contact details' },
  { key: 'partner', label: 'Partner', color: 'bg-blue-500', description: 'Inventory levels, shipping schedules' },
  { key: 'confidential', label: 'Confidential', color: 'bg-yellow-500', description: 'Financial data, contracts' },
  { key: 'internal', label: 'Internal', color: 'bg-red-500', description: 'Strategic plans, employee data' },
];

const CONNECTION_TYPE_DEFAULTS = {
  messaging: {
    canViewPublicData: true,
    canViewPartnerData: false,
    canViewConfidentialData: false,
    canViewInternalData: false,
    canViewUsers: true,
    canViewTeams: false,
    canCreateCrossOrgTeams: false,
    canChat: true,
    canViewFiles: false,
    canShareFiles: false,
    canDownloadFiles: false,
    canUploadFiles: false,
  },
  file_share: {
    canViewPublicData: true,
    canViewPartnerData: true,
    canViewConfidentialData: false,
    canViewInternalData: false,
    canViewUsers: true,
    canViewTeams: true,
    canCreateCrossOrgTeams: false,
    canChat: true,
    canViewFiles: true,
    canShareFiles: true,
    canDownloadFiles: true,
    canUploadFiles: false,
  },
  full_collaboration: {
    canViewPublicData: true,
    canViewPartnerData: true,
    canViewConfidentialData: true,
    canViewInternalData: false,
    canViewUsers: true,
    canViewTeams: true,
    canCreateCrossOrgTeams: true,
    canChat: true,
    canViewFiles: true,
    canShareFiles: true,
    canDownloadFiles: true,
    canUploadFiles: true,
  },
};

export function PermissionMatrix({ organizations, connections, onUpdatePermissions, onCreateConnection }: PermissionMatrixProps) {
  const [selectedCell, setSelectedCell] = useState<{ source: string; target: string } | null>(null);
  const [editingPermissions, setEditingPermissions] = useState<Permission | null>(null);
  const [editingDataCategories, setEditingDataCategories] = useState<string[]>([]);
  const [isCreatingConnection, setIsCreatingConnection] = useState(false);
  const [newConnectionType, setNewConnectionType] = useState<'messaging' | 'file_share' | 'full_collaboration'>('messaging');

  // Create a map of connections for quick lookup
  const connectionMap = new Map<string, DirectionalConnection>();
  connections.forEach(conn => {
    const key = `${conn.sourceOrganizationId}→${conn.targetOrganizationId}`;
    connectionMap.set(key, conn);
  });

  const getConnection = (sourceId: string, targetId: string): DirectionalConnection | null => {
    return connectionMap.get(`${sourceId}→${targetId}`) || null;
  };

  const getConnectionStatus = (sourceId: string, targetId: string) => {
    const connection = getConnection(sourceId, targetId);
    if (!connection) return 'none';
    return connection.status;
  };

  const getConnectionType = (sourceId: string, targetId: string) => {
    const connection = getConnection(sourceId, targetId);
    return connection?.connectionType || null;
  };

  const handleCellClick = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return; // Can't connect to self
    
    const connection = getConnection(sourceId, targetId);
    
    if (connection) {
      // Edit existing connection
      setSelectedCell({ source: sourceId, target: targetId });
      setEditingPermissions(connection.permissions);
      setEditingDataCategories(connection.allowedDataCategories);
      setIsCreatingConnection(false);
    } else {
      // Create new connection
      setSelectedCell({ source: sourceId, target: targetId });
      setEditingPermissions(CONNECTION_TYPE_DEFAULTS[newConnectionType]);
      setEditingDataCategories(['public']);
      setIsCreatingConnection(true);
    }
  };

  const handleSavePermissions = async () => {
    if (!selectedCell || !editingPermissions) return;

    const connection = getConnection(selectedCell.source, selectedCell.target);
    
    if (isCreatingConnection) {
      // Create new connection
      await onCreateConnection(selectedCell.source, selectedCell.target, {
        connectionType: newConnectionType,
        permissions: editingPermissions,
        allowedDataCategories: editingDataCategories,
        description: `${newConnectionType.replace('_', ' ')} connection`,
        tags: [newConnectionType.replace('_', '-')],
      });
    } else if (connection) {
      // Update existing connection
      await onUpdatePermissions(connection.id, editingPermissions, editingDataCategories);
    }

    setSelectedCell(null);
    setEditingPermissions(null);
    setEditingDataCategories([]);
    setIsCreatingConnection(false);
  };

  const handlePermissionToggle = (permissionKey: keyof Permission) => {
    if (!editingPermissions) return;
    
    setEditingPermissions(prev => ({
      ...prev!,
      [permissionKey]: !prev![permissionKey],
    }));
  };

  const handleDataCategoryToggle = (category: string) => {
    setEditingDataCategories(prev => {
      if (prev.includes(category)) {
        return prev.filter(c => c !== category);
      } else {
        return [...prev, category];
      }
    });
  };

  const handleConnectionTypeChange = (type: 'messaging' | 'file_share' | 'full_collaboration') => {
    setNewConnectionType(type);
    if (isCreatingConnection) {
      setEditingPermissions(CONNECTION_TYPE_DEFAULTS[type]);
      // Update data categories based on connection type
      if (type === 'messaging') {
        setEditingDataCategories(['public']);
      } else if (type === 'file_share') {
        setEditingDataCategories(['public', 'partner']);
      } else {
        setEditingDataCategories(['public', 'partner', 'confidential']);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Matrix Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SemanticBDIIcon semantic="collaboration" className="w-5 h-5 text-bdi-green-1" />
            Organization Permission Matrix
          </CardTitle>
          <p className="text-sm text-gray-600">
            Click any cell to set permissions for how one organization can access another's data.
            Rows = Source (who is accessing), Columns = Target (what is being accessed).
          </p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
            <table className="min-w-full border-collapse" style={{ minWidth: `${Math.max(600, organizations.length * 96 + 96)}px` }}>
              <thead>
                <tr>
                  <th className="w-24 min-w-24"></th>
                  {organizations.map(org => (
                    <th key={org.id} className="w-24 min-w-24 p-3 text-center border border-gray-200 bg-gray-50">
                      <div className="font-bold text-sm text-gray-900">{org.code}</div>
                      <div className="text-xs text-gray-600 truncate max-w-20" title={org.name}>
                        {org.name.length > 12 ? org.name.substring(0, 10) + '...' : org.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {organizations.map(sourceOrg => (
                  <tr key={sourceOrg.id}>
                    <td className="w-24 min-w-24 p-3 border border-gray-200 bg-gray-50 font-medium">
                      <div className="text-sm font-bold text-gray-900">{sourceOrg.code}</div>
                      <div className="text-xs text-gray-600 truncate max-w-20" title={sourceOrg.name}>
                        {sourceOrg.name.length > 12 ? sourceOrg.name.substring(0, 10) + '...' : sourceOrg.name}
                      </div>
                    </td>
                    {organizations.map(targetOrg => {
                      const connection = getConnection(sourceOrg.id, targetOrg.id);
                      const isSelf = sourceOrg.id === targetOrg.id;
                      const status = getConnectionStatus(sourceOrg.id, targetOrg.id);
                      const type = getConnectionType(sourceOrg.id, targetOrg.id);
                      
                      return (
                        <td
                          key={targetOrg.id}
                          className={`w-24 h-20 min-w-24 p-2 border border-gray-200 text-center cursor-pointer transition-colors ${
                            isSelf
                              ? 'bg-gray-100 cursor-not-allowed'
                              : status === 'active'
                              ? 'bg-green-50 hover:bg-green-100'
                              : 'bg-white hover:bg-blue-50'
                          }`}
                          onClick={() => !isSelf && handleCellClick(sourceOrg.id, targetOrg.id)}
                        >
                          {isSelf ? (
                            <div className="flex items-center justify-center h-full">
                              <div className="text-gray-500 text-xs font-medium">SELF</div>
                            </div>
                          ) : connection ? (
                            <div className="flex flex-col items-center justify-center h-full space-y-1">
                              <Badge 
                                variant="secondary" 
                                className={`text-xs px-1 py-0.5 ${
                                  type === 'messaging' ? 'bg-blue-100 text-blue-800' :
                                  type === 'file_share' ? 'bg-orange-100 text-orange-800' :
                                  'bg-green-100 text-green-800'
                                }`}
                              >
                                {type === 'messaging' ? 'MSG' : type === 'file_share' ? 'FILE' : 'FULL'}
                              </Badge>
                              <div className="flex flex-wrap gap-0.5 justify-center">
                                {connection.allowedDataCategories.map(cat => (
                                  <div
                                    key={cat}
                                    className={`w-2 h-2 rounded-full ${
                                      DATA_CATEGORIES.find(dc => dc.key === cat)?.color || 'bg-gray-300'
                                    }`}
                                    title={cat}
                                  />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <SemanticBDIIcon semantic="plus" className="w-4 h-4 text-gray-400 hover:text-bdi-green-1 transition-colors" />
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs">
            <div className="space-y-1">
              <div className="font-medium">Data Categories:</div>
              <div className="flex gap-2">
                {DATA_CATEGORIES.map(cat => (
                  <div key={cat.key} className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded-full ${cat.color}`}></div>
                    <span>{cat.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permission Detail Modal */}
      {selectedCell && editingPermissions && (
        <Card className="border-2 border-bdi-green-1">
          <CardHeader className="pb-4">
            <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-2">
                <SemanticBDIIcon semantic="settings" className="w-5 h-5 text-bdi-green-1" />
                <span className="text-lg">{isCreatingConnection ? 'Create Connection' : 'Edit Permissions'}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedCell(null)}
                className="self-end sm:self-auto"
              >
                Cancel
              </Button>
            </CardTitle>
            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
              <span className="font-medium">
                {organizations.find(o => o.id === selectedCell.source)?.code}
              </span>
              {' → '}
              <span className="font-medium">
                {organizations.find(o => o.id === selectedCell.target)?.code}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 max-h-96 overflow-y-auto">
            {/* Connection Type (for new connections) */}
            {isCreatingConnection && (
              <div>
                <label className="block text-sm font-medium mb-2">Connection Type</label>
                <div className="flex gap-2">
                  {(['messaging', 'file_share', 'full_collaboration'] as const).map(type => (
                    <Button
                      key={type}
                      variant={newConnectionType === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleConnectionTypeChange(type)}
                      className={newConnectionType === type ? "bg-bdi-green-1 hover:bg-bdi-green-2" : ""}
                    >
                      {type.replace('_', ' ')}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Data Categories */}
            <div>
              <label className="block text-sm font-medium mb-3 text-gray-900">Allowed Data Categories</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {DATA_CATEGORIES.map(category => (
                  <label key={category.key} className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 hover:border-bdi-green-1 transition-colors">
                    <input
                      type="checkbox"
                      checked={editingDataCategories.includes(category.key)}
                      onChange={() => handleDataCategoryToggle(category.key)}
                      className="mt-0.5 rounded text-bdi-green-1 focus:ring-bdi-green-1"
                    />
                    <div className={`w-4 h-4 rounded-full mt-0.5 ${category.color}`}></div>
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">{category.label}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{category.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Granular Permissions */}
            <div className="space-y-5">
              {Object.entries(PERMISSION_CATEGORIES).map(([categoryName, permissions]) => (
                <div key={categoryName}>
                  <h4 className="font-medium text-sm mb-3 text-gray-900 border-b pb-1">{categoryName}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {permissions.map(permission => (
                      <label key={permission.key} className="flex items-center gap-3 p-2 border rounded-lg cursor-pointer hover:bg-gray-50 hover:border-bdi-green-1 transition-colors">
                        <input
                          type="checkbox"
                          checked={editingPermissions[permission.key as keyof Permission]}
                          onChange={() => handlePermissionToggle(permission.key as keyof Permission)}
                          className="rounded text-bdi-green-1 focus:ring-bdi-green-1"
                        />
                        <SemanticBDIIcon semantic={permission.icon} className="w-4 h-4 text-bdi-green-1" />
                        <span className="text-sm text-gray-700">{permission.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSelectedCell(null)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSavePermissions}
                className="bg-bdi-green-1 hover:bg-bdi-green-2"
              >
                {isCreatingConnection ? 'Create Connection' : 'Save Changes'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
