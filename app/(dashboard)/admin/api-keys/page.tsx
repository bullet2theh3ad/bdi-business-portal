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

// Available API permissions for external partners
const API_PERMISSIONS = [
  { id: 'production_files_read', name: 'Production Files - Read', description: 'View and list production files' },
  { id: 'production_files_download', name: 'Production Files - Download', description: 'Download production files' },
  { id: 'production_files_upload', name: 'Production Files - Upload', description: 'Upload production files from factory systems' },
  { id: 'forecasts_read', name: 'Sales Forecasts - Read', description: 'View sales forecasts and CPFR data' },
  { id: 'invoices_read', name: 'Invoices - Read', description: 'View invoice data' },
  { id: 'purchase_orders_read', name: 'Purchase Orders - Read', description: 'View purchase order data' },
  { id: 'shipments_read', name: 'Shipments - Read', description: 'View shipment tracking data' },
  { id: 'skus_read', name: 'Product SKUs - Read', description: 'View product SKU information' },
  { id: 'warehouses_read', name: 'Warehouses - Read', description: 'View warehouse information' },
  { id: 'advanced_reporting', name: 'Advanced Reporting', description: 'Full system access to all data (BDI-level)' },
] as const;

type ApiPermissionId = typeof API_PERMISSIONS[number]['id'];

// Available file types for API access control
const FILE_TYPES = [
  { id: 'PRODUCTION_FILE', name: 'Production Files', description: 'General production data files' },
  { id: 'ROYALTY_ZONE_1', name: 'Royalty Zone 1', description: 'Zone 1 royalty files' },
  { id: 'ROYALTY_ZONE_2', name: 'Royalty Zone 2', description: 'Zone 2 royalty files' },
  { id: 'ROYALTY_ZONE_3', name: 'Royalty Zone 3', description: 'Zone 3 royalty files' },
  { id: 'ROYALTY_ZONE_4', name: 'Royalty Zone 4', description: 'Zone 4 royalty files' },
  { id: 'ROYALTY_ZONE_5', name: 'Royalty Zone 5', description: 'Zone 5 royalty files' },
  { id: 'MAC_ADDRESS_LIST', name: 'MAC Address Lists', description: 'Device MAC address files' },
  { id: 'SERIAL_NUMBER_LIST', name: 'Serial Number Lists', description: 'Device serial number files' },
  { id: 'PRODUCTION_REPORT', name: 'Production Reports', description: 'Manufacturing summary reports' },
  { id: 'TEST_RESULTS', name: 'Test Results', description: 'QA test results and metrics' },
  { id: 'CALIBRATION_DATA', name: 'Calibration Data', description: 'Device calibration settings' },
  { id: 'FIRMWARE_VERSION', name: 'Firmware Versions', description: 'Firmware version information' },
  { id: 'QUALITY_CONTROL', name: 'Quality Control', description: 'QC inspection results' },
  { id: 'PACKAGING_LIST', name: 'Packaging Lists', description: 'Packaging and shipping details' },
  { id: 'GENERIC', name: 'Generic Files', description: 'General purpose files' },
] as const;

type FileTypeId = typeof FILE_TYPES[number]['id'];

interface ApiKeyForm {
  organizationId: string;
  keyName: string;
  permissions: ApiPermissionId[];
  allowedFileTypes: FileTypeId[];
  rateLimitPerHour: number;
  expiresInDays: number | null;
}

export default function ApiKeysPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const { data: organizations } = useSWR('/api/admin/organizations', fetcher);
  const { data: apiKeys, mutate: mutateApiKeys } = useSWR('/api/admin/api-keys', fetcher);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createdApiKey, setCreatedApiKey] = useState<any>(null);
  const [editingApiKey, setEditingApiKey] = useState<any>(null);
  const [apiKeyForm, setApiKeyForm] = useState<ApiKeyForm>({
    organizationId: '',
    keyName: '',
    permissions: ['production_files_read'],
    allowedFileTypes: ['PRODUCTION_FILE', 'ROYALTY_ZONE_4'],
    rateLimitPerHour: 1000,
    expiresInDays: 365,
  });

  const handleCreateApiKey = async () => {
    if (!apiKeyForm.organizationId || !apiKeyForm.keyName || apiKeyForm.permissions.length === 0) {
      alert('Please fill in all required fields and select at least one permission');
      return;
    }

    setIsCreating(true);
    try {
      const response = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: apiKeyForm.organizationId,
          keyName: apiKeyForm.keyName,
          permissions: apiKeyForm.permissions.reduce((acc, perm) => {
            acc[perm] = true;
            return acc;
          }, {} as any),
          allowedFileTypes: apiKeyForm.allowedFileTypes,
          rateLimitPerHour: apiKeyForm.rateLimitPerHour,
          expiresInDays: apiKeyForm.expiresInDays,
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create API key');
      }

      const result = await response.json();
      console.log('API key created:', result);
      
      // Show the created API key
      setCreatedApiKey(result);
      
      // Reset form and close modal
      setApiKeyForm({
        organizationId: '',
        keyName: '',
        permissions: ['production_files_read'],
        allowedFileTypes: ['PRODUCTION_FILE', 'ROYALTY_ZONE_4'],
        rateLimitPerHour: 1000,
        expiresInDays: 365,
      });
      setShowCreateModal(false);
      
      // Refresh API keys list
      mutateApiKeys();
      
    } catch (error) {
      console.error('Error creating API key:', error);
      alert('Failed to create API key. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const togglePermission = (permissionId: ApiPermissionId) => {
    setApiKeyForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(id => id !== permissionId)
        : [...prev.permissions, permissionId]
    }));
  };

  const toggleFileType = (fileTypeId: FileTypeId) => {
    setApiKeyForm(prev => ({
      ...prev,
      allowedFileTypes: prev.allowedFileTypes.includes(fileTypeId)
        ? prev.allowedFileTypes.filter(id => id !== fileTypeId)
        : [...prev.allowedFileTypes, fileTypeId]
    }));
  };

  const handleEditApiKey = (apiKey: any) => {
    setEditingApiKey(apiKey);
  };

  const handleDeleteApiKey = async (apiKey: any) => {
    const confirmMessage = `Are you sure you want to permanently delete the API key "${apiKey.keyName}" for ${apiKey.organizationName}? This action cannot be undone and will immediately revoke API access.`;
    
    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch(`/api/admin/api-keys/${apiKey.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const result = await response.json();
      alert(`API key "${apiKey.keyName}" deleted successfully!`);
      
      // Refresh API keys list
      mutateApiKeys();
    } catch (error) {
      console.error('Error deleting API key:', error);
      alert(`Failed to delete API key: ${error}`);
    }
  };

  const handleCopyApiKey = (apiKey: any) => {
    // For existing keys, we can only show the prefix since the full key isn't stored
    const textToCopy = `API Key: ${apiKey.keyPrefix}
Organization: ${apiKey.organizationName} (${apiKey.organizationCode})
Rate Limit: ${apiKey.rateLimitPerHour}/hour
Base URL: https://www.bdibusinessportal.com/api/v1
Authentication: Authorization: Bearer ${apiKey.keyPrefix}...

Note: This is only the key prefix. The full key was provided when originally generated.
For security reasons, the full key cannot be retrieved again.
If you need the full key, please request a new API key generation.`;

    navigator.clipboard.writeText(textToCopy);
    alert('API key information copied to clipboard!');
  };

  // Only BDI Super Admins can access API key management
  if (!user || user.role !== 'super_admin' || (user as any).organization?.code !== 'BDI') {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="connect" size={48} className="mx-auto mb-4 text-muted-foreground" />
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
              <h1 className="text-2xl sm:text-3xl font-bold">API Keys</h1>
              <p className="text-muted-foreground text-sm sm:text-base">Manage external partner API access to BDI systems</p>
            </div>
          </div>
          <Button 
            className="bg-bdi-green-1 hover:bg-bdi-green-2 w-full sm:w-auto justify-center" 
            onClick={() => setShowCreateModal(true)}
          >
            <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
            <span className="sm:hidden">Generate API Key</span>
            <span className="hidden sm:inline">Generate API Key</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total API Keys</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-1">
              {Array.isArray(apiKeys) ? apiKeys.length : '...'}
            </div>
            <p className="text-xs text-muted-foreground">Generated keys</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Array.isArray(apiKeys) ? apiKeys.filter((key: any) => key.isActive).length : '...'}
            </div>
            <p className="text-xs text-muted-foreground">Currently active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Partner Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-blue">
              {Array.isArray(apiKeys) ? new Set(apiKeys.map((key: any) => key.organizationCode)).size : '...'}
            </div>
            <p className="text-xs text-muted-foreground">With API access</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">This Month Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {Array.isArray(apiKeys) ? apiKeys.filter((key: any) => key.lastUsedAt).length : '...'}
            </div>
            <p className="text-xs text-muted-foreground">Keys used recently</p>
          </CardContent>
        </Card>
      </div>

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="connect" size={20} className="mr-2" />
            External Partner API Keys
          </CardTitle>
          <CardDescription>
            API keys for external partners to access BDI systems programmatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!apiKeys ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <SemanticBDIIcon semantic="sync" size={32} className="mx-auto mb-4 text-muted-foreground animate-spin" />
                <p className="text-muted-foreground">Loading API keys...</p>
              </div>
            </div>
          ) : !Array.isArray(apiKeys) || apiKeys.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <SemanticBDIIcon semantic="connect" size={48} className="mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No API Keys Yet</h3>
                <p className="text-muted-foreground mb-4">Generate your first API key for external partner access</p>
                <Button 
                  className="bg-bdi-green-1 hover:bg-bdi-green-2" 
                  onClick={() => setShowCreateModal(true)}
                >
                  <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
                  Generate API Key
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key: any) => (
                <div key={key.id} className="border rounded-lg p-4 lg:p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex flex-col space-y-4">
                    {/* API Key Header */}
                    <div className="flex items-start space-x-4">
                      <div className="w-12 h-12 lg:w-16 lg:h-16 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                        <SemanticBDIIcon 
                          semantic="connect" 
                          size={20} 
                          className="text-purple-600" 
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="text-lg lg:text-xl font-semibold">{key.keyName}</h3>
                          <Badge variant={key.isActive ? 'default' : 'secondary'} 
                                 className={key.isActive ? 'bg-green-600 text-white text-xs' : 'text-xs'}>
                            {key.isActive ? 'ACTIVE' : 'INACTIVE'}
                          </Badge>
                          {key.expiresAt && (
                            <Badge variant="outline" className="text-xs">
                              Expires {new Date(key.expiresAt).toLocaleDateString()}
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <div><strong>Organization:</strong> {key.organizationName} ({key.organizationCode})</div>
                          <div><strong>Key:</strong> <code className="bg-gray-100 px-2 py-1 rounded text-xs">{key.keyPrefix}</code></div>
                          <div><strong>Rate Limit:</strong> {key.rateLimitPerHour}/hour</div>
                          <div><strong>Last Used:</strong> {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Permissions */}
                    <div>
                      <h4 className="font-medium text-sm mb-2">Permissions:</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(key.permissions || {})
                          .filter(([perm, enabled]) => enabled)
                          .map(([perm, enabled]) => (
                            <Badge key={perm} variant="outline" className="text-xs">
                              {API_PERMISSIONS.find(p => p.id === perm)?.name || perm}
                            </Badge>
                          ))
                        }
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full sm:w-auto justify-center sm:justify-start bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200"
                        onClick={() => handleEditApiKey(key)}
                      >
                        <SemanticBDIIcon semantic="settings" size={14} className="mr-2 sm:mr-1" />
                        <span className="sm:hidden">Edit & Copy</span>
                        <span className="hidden sm:inline">Edit</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full sm:w-auto justify-center sm:justify-start bg-green-50 hover:bg-green-100 text-green-600 border-green-200"
                        onClick={() => handleCopyApiKey(key)}
                      >
                        <SemanticBDIIcon semantic="reports" size={14} className="mr-2 sm:mr-1" />
                        <span className="sm:hidden">Copy Details</span>
                        <span className="hidden sm:inline">Copy</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full sm:w-auto justify-center sm:justify-start bg-red-50 hover:bg-red-100 text-red-600 border-red-200"
                        onClick={() => handleDeleteApiKey(key)}
                      >
                        <SemanticBDIIcon semantic="settings" size={14} className="mr-2 sm:mr-1" />
                        <span className="sm:hidden">Delete Key</span>
                        <span className="hidden sm:inline">Delete</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create API Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center">
                <SemanticBDIIcon semantic="plus" size={24} className="mr-2" />
                Generate New API Key
              </CardTitle>
              <CardDescription>Create API access for external partner organizations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Basic Configuration */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">Basic Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="organization">Partner Organization *</Label>
                      <select 
                        id="organization"
                        value={apiKeyForm.organizationId}
                        onChange={(e) => setApiKeyForm(prev => ({ ...prev, organizationId: e.target.value }))}
                        className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm"
                      >
                        <option value="">Select Organization</option>
                        {Array.isArray(organizations) && organizations
                          .filter((org: any) => org.code !== 'BDI' && org.isActive)
                          .map((org: any) => (
                            <option key={org.id} value={org.id}>
                              {org.name} ({org.code})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="keyName">API Key Name *</Label>
                      <Input 
                        id="keyName"
                        placeholder="e.g., GPN Production Access, MTN Data Integration"
                        value={apiKeyForm.keyName}
                        onChange={(e) => setApiKeyForm(prev => ({ ...prev, keyName: e.target.value }))}
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="rateLimit">Rate Limit (requests/hour)</Label>
                      <Input 
                        id="rateLimit"
                        type="number"
                        min="100"
                        max="10000"
                        value={apiKeyForm.rateLimitPerHour}
                        onChange={(e) => setApiKeyForm(prev => ({ ...prev, rateLimitPerHour: parseInt(e.target.value) || 1000 }))}
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="expiration">Expires In (days)</Label>
                      <select 
                        id="expiration"
                        value={apiKeyForm.expiresInDays || ''}
                        onChange={(e) => setApiKeyForm(prev => ({ ...prev, expiresInDays: e.target.value ? parseInt(e.target.value) : null }))}
                        className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm"
                      >
                        <option value="">Never expires</option>
                        <option value="30">30 days</option>
                        <option value="90">90 days</option>
                        <option value="180">6 months</option>
                        <option value="365">1 year</option>
                      </select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* API Permissions */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">API Permissions</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Select which APIs and data this organization can access. You can modify these later.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {API_PERMISSIONS.map((permission) => (
                      <div 
                        key={permission.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          apiKeyForm.permissions.includes(permission.id)
                            ? 'border-bdi-green-1 bg-bdi-green-1/5'
                            : 'border-gray-200 hover:border-bdi-green-1/50'
                        }`}
                        onClick={() => togglePermission(permission.id)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                            apiKeyForm.permissions.includes(permission.id)
                              ? 'border-bdi-green-1 bg-bdi-green-1'
                              : 'border-gray-300'
                          }`}>
                            {apiKeyForm.permissions.includes(permission.id) && (
                              <SemanticBDIIcon semantic="check" size={12} className="text-white brightness-0 invert" />
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{permission.name}</h4>
                            <p className="text-xs text-gray-500 mt-1">{permission.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* File Type Permissions */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">📁 File Type Access</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Select which file types this API key can access. PRODUCTION_FILE includes device data (MAC addresses, serial numbers, etc.).
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {FILE_TYPES.map((fileType) => (
                      <div 
                        key={fileType.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          apiKeyForm.allowedFileTypes.includes(fileType.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => toggleFileType(fileType.id)}
                      >
                        <div className="flex items-start space-x-2">
                          <div className={`w-4 h-4 rounded border-2 flex-shrink-0 mt-0.5 ${
                            apiKeyForm.allowedFileTypes.includes(fileType.id)
                              ? 'bg-blue-500 border-blue-500'
                              : 'border-gray-300'
                          }`}>
                            {apiKeyForm.allowedFileTypes.includes(fileType.id) && (
                              <SemanticBDIIcon semantic="check" size={12} className="text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{fileType.name}</div>
                            <div className="text-xs text-gray-500 mt-1">{fileType.description}</div>
                            <div className="text-xs text-gray-400 mt-1 font-mono">{fileType.id}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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
                    onClick={handleCreateApiKey}
                    disabled={isCreating}
                  >
                    {isCreating ? (
                      <>
                        <SemanticBDIIcon semantic="sync" size={16} className="mr-2 brightness-0 invert animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <SemanticBDIIcon semantic="plus" size={16} className="mr-2 brightness-0 invert" />
                        Generate API Key
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit API Key Modal */}
      {editingApiKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle className="flex items-center">
                <SemanticBDIIcon semantic="settings" size={24} className="mr-2" />
                Edit API Key - {editingApiKey.keyName}
              </CardTitle>
              <CardDescription>View and copy API key details for {editingApiKey.organizationName}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* API Key Information */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-3">🔑 API Key Details</h4>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-blue-700">Organization</Label>
                        <div className="font-mono text-sm">{editingApiKey.organizationName} ({editingApiKey.organizationCode})</div>
                      </div>
                      <div>
                        <Label className="text-xs text-blue-700">Key Name</Label>
                        <div className="font-mono text-sm">{editingApiKey.keyName}</div>
                      </div>
                      <div>
                        <Label className="text-xs text-blue-700">Key Prefix</Label>
                        <div className="bg-white border rounded p-2 font-mono text-sm">
                          {editingApiKey.keyPrefix}...
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-blue-700">Rate Limit</Label>
                        <div className="text-sm">{editingApiKey.rateLimitPerHour} requests/hour</div>
                      </div>
                      <div>
                        <Label className="text-xs text-blue-700">Status</Label>
                        <Badge variant={editingApiKey.isActive ? 'default' : 'secondary'}
                               className={editingApiKey.isActive ? 'bg-green-600 text-white' : 'bg-gray-500 text-white'}>
                          {editingApiKey.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                      </div>
                      <div>
                        <Label className="text-xs text-blue-700">Last Used</Label>
                        <div className="text-sm">{editingApiKey.lastUsedAt ? new Date(editingApiKey.lastUsedAt).toLocaleDateString() : 'Never'}</div>
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs text-blue-700">Permissions</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {Object.entries(editingApiKey.permissions || {})
                          .filter(([perm, enabled]) => enabled)
                          .map(([perm, enabled]) => (
                            <Badge key={perm} variant="outline" className="text-xs">
                              {API_PERMISSIONS.find(p => p.id === perm)?.name || perm}
                            </Badge>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* Integration Information */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 mb-3">🚀 Integration Information</h4>
                  <div className="space-y-2 text-sm text-green-700">
                    <div><strong>Base URL:</strong> <code>https://www.bdibusinessportal.com/api/v1</code></div>
                    <div><strong>Authentication:</strong> <code>Authorization: Bearer {editingApiKey.keyPrefix}...</code></div>
                    <div><strong>Documentation:</strong> <a href="/admin/api-keys/documentation" className="text-blue-600 hover:underline">Complete API Reference</a></div>
                  </div>
                </div>

                {/* Security Notice */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <h4 className="font-medium text-orange-800 mb-2">🔒 Security Notice</h4>
                  <p className="text-sm text-orange-700">
                    For security reasons, the full API key cannot be retrieved after creation. 
                    Only the prefix is stored and displayed. If the partner needs the full key again, 
                    you must generate a new API key and delete the old one.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setEditingApiKey(null)}
                  >
                    Close
                  </Button>
                  <Button 
                    className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleCopyApiKey(editingApiKey)}
                  >
                    <SemanticBDIIcon semantic="reports" size={16} className="mr-2 brightness-0 invert" />
                    Copy Integration Details
                  </Button>
                  <Button 
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => {
                      handleDeleteApiKey(editingApiKey);
                      setEditingApiKey(null);
                    }}
                  >
                    <SemanticBDIIcon semantic="settings" size={16} className="mr-2 brightness-0 invert" />
                    Delete Key
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* API Key Created Success Modal */}
      {createdApiKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center text-green-600">
                <SemanticBDIIcon semantic="check" size={24} className="mr-2" />
                API Key Generated Successfully
              </CardTitle>
              <CardDescription>Save this API key securely - it will not be shown again</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* API Key Display */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 mb-3">🔑 Your New API Key</h4>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-green-700">Organization</Label>
                      <div className="font-mono text-sm">{createdApiKey.organization?.name} ({createdApiKey.organization?.code})</div>
                    </div>
                    <div>
                      <Label className="text-xs text-green-700">API Key</Label>
                      <div className="bg-white border rounded p-3 font-mono text-sm break-all">
                        {createdApiKey.apiKey?.fullKey}
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-green-700">Rate Limit</Label>
                      <div className="text-sm">{createdApiKey.apiKey?.rateLimitPerHour} requests/hour</div>
                    </div>
                  </div>
                </div>

                {/* Quick Documentation */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-800 mb-3">📚 Quick Start</h4>
                  <div className="text-sm text-blue-700 space-y-2">
                    <div><strong>Base URL:</strong> <code>https://your-domain.com/api</code></div>
                    <div><strong>Authentication:</strong> <code>Authorization: Bearer {createdApiKey.apiKey?.keyPrefix}...</code></div>
                    <div><strong>Example:</strong> <code>GET /api/v1/production-files</code></div>
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button 
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(createdApiKey.apiKey?.fullKey || '');
                      alert('API key copied to clipboard!');
                    }}
                  >
                    <SemanticBDIIcon semantic="reports" size={16} className="mr-2" />
                    Copy Key
                  </Button>
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => setCreatedApiKey(null)}
                  >
                    <SemanticBDIIcon semantic="check" size={16} className="mr-2 brightness-0 invert" />
                    Done
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
