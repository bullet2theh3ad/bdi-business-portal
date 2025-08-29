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
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// Mock data for demonstration - will be replaced with real API calls
const mockOrganizations = [
  {
    id: '1',
    name: 'Boundless Devices Inc',
    code: 'BDI',
    type: 'internal',
    memberCount: 1,
    apiKeyCount: 0,
    status: 'active'
  },
  {
    id: '2', 
    name: 'ACME Manufacturing',
    code: 'ACME',
    type: 'oem_partner',
    memberCount: 3,
    apiKeyCount: 2,
    status: 'active'
  },
  {
    id: '3',
    name: 'TechCorp Solutions',
    code: 'TECH',
    type: 'supplier',
    memberCount: 2,
    apiKeyCount: 1,
    status: 'pending'
  }
];

const mockApiKeys = [
  {
    id: '1',
    name: 'Production API Key',
    prefix: 'bdi_prod_',
    organization: 'ACME Manufacturing',
    permissions: ['read', 'write'],
    lastUsed: '2024-01-15',
    status: 'active'
  },
  {
    id: '2',
    name: 'Development Key',
    prefix: 'bdi_dev_',
    organization: 'TechCorp Solutions',
    permissions: ['read'],
    lastUsed: '2024-01-10',
    status: 'active'
  }
];

export default function SettingsPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const [activeTab, setActiveTab] = useState('overview');

  if (!user) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <SemanticBDIIcon semantic="settings" size={48} className="mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center space-x-4">
          <SemanticBDIIcon semantic="settings" size={32} />
          <div>
            <h1 className="text-3xl font-bold">Account Settings</h1>
            <p className="text-muted-foreground">Manage organizations, API keys, and system administration</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="mb-8">
        <nav className="flex space-x-8" aria-label="Settings sections">
          {[
            { id: 'overview', name: 'Overview', icon: 'dashboard' },
            { id: 'organizations', name: 'Organizations', icon: 'collaboration' },
            { id: 'api-keys', name: 'API Keys', icon: 'connect' },
            { id: 'integrations', name: 'Integrations', icon: 'sync' },
            { id: 'security', name: 'Security', icon: 'settings' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-bdi-green-1 text-white'
                  : 'text-gray-500 hover:text-bdi-green-1 hover:bg-bdi-green-1/10'
              }`}
            >
              <SemanticBDIIcon 
                semantic={tab.icon as any} 
                size={16} 
                className={`mr-2 ${activeTab === tab.id ? 'brightness-0 invert' : ''}`} 
              />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* System Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <SemanticBDIIcon semantic="dashboard" size={20} className="mr-2" />
                System Overview
              </CardTitle>
              <CardDescription>Quick overview of your BDI Business Portal administration</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="text-center p-4 bg-bdi-green-1/5 rounded-lg">
                  <SemanticBDIIcon semantic="collaboration" size={24} className="mx-auto mb-2" />
                  <div className="text-2xl font-bold text-bdi-green-1">{mockOrganizations.length}</div>
                  <div className="text-sm text-gray-600">Organizations</div>
                </div>
                <div className="text-center p-4 bg-bdi-green-2/5 rounded-lg">
                  <SemanticBDIIcon semantic="users" size={24} className="mx-auto mb-2" />
                  <div className="text-2xl font-bold text-bdi-green-1">
                    {mockOrganizations.reduce((total, org) => total + org.memberCount, 0)}
                  </div>
                  <div className="text-sm text-gray-600">Total Users</div>
                </div>
                <div className="text-center p-4 bg-bdi-blue/5 rounded-lg">
                  <SemanticBDIIcon semantic="connect" size={24} className="mx-auto mb-2" />
                  <div className="text-2xl font-bold text-bdi-blue">{mockApiKeys.length}</div>
                  <div className="text-sm text-gray-600">Active API Keys</div>
                </div>
                <div className="text-center p-4 bg-bdi-green-1/5 rounded-lg">
                  <SemanticBDIIcon semantic="sync" size={24} className="mx-auto mb-2" />
                  <div className="text-2xl font-bold text-bdi-green-1">0</div>
                  <div className="text-sm text-gray-600">Integrations</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <SemanticBDIIcon semantic="settings" size={20} className="mr-2" />
                Quick Actions
              </CardTitle>
              <CardDescription>Common administrative tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col gap-2 hover:border-bdi-green-1 hover:bg-bdi-green-1/5"
                  onClick={() => setActiveTab('organizations')}
                >
                  <SemanticBDIIcon semantic="collaboration" size={24} />
                  <span className="text-sm">Manage Organizations</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col gap-2 hover:border-bdi-green-1 hover:bg-bdi-green-1/5"
                  onClick={() => setActiveTab('api-keys')}
                >
                  <SemanticBDIIcon semantic="connect" size={24} />
                  <span className="text-sm">API Keys</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="h-20 flex flex-col gap-2 hover:border-bdi-green-1 hover:bg-bdi-green-1/5"
                  disabled
                >
                  <SemanticBDIIcon semantic="notifications" size={24} />
                  <span className="text-sm">Send Invitations</span>
                  <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'organizations' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Organizations</h2>
              <p className="text-muted-foreground">Manage companies and their access to the BDI Business Portal</p>
            </div>
            <Button className="bg-bdi-green-1 hover:bg-bdi-green-2">
              <SemanticBDIIcon semantic="collaboration" size={16} className="mr-2 brightness-0 invert" />
              Create Organization
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>All Organizations</CardTitle>
              <CardDescription>Companies with access to CPFR and supply chain data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockOrganizations.map((org) => (
                  <div key={org.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-bdi-green-1/10 rounded-lg flex items-center justify-center">
                        <SemanticBDIIcon semantic="collaboration" size={20} className="text-bdi-green-1" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">{org.name}</h3>
                          <Badge variant={org.type === 'internal' ? 'default' : 'secondary'} className="text-xs">
                            {org.type.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <Badge variant={org.status === 'active' ? 'default' : 'secondary'} className="text-xs bg-bdi-green-1">
                            {org.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500">
                          Code: {org.code} • {org.memberCount} members • {org.apiKeyCount} API keys
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                        Manage
                      </Button>
                      <Button variant="outline" size="sm">
                        <SemanticBDIIcon semantic="notifications" size={14} className="mr-1" />
                        Invite Users
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'api-keys' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">API Key Management</h2>
              <p className="text-muted-foreground">Monitor and manage API access for Developer users across all organizations</p>
            </div>
            <Button className="bg-bdi-blue hover:bg-bdi-blue/90 text-white">
              <SemanticBDIIcon semantic="connect" size={16} className="mr-2 brightness-0 invert" />
              Generate New Key
            </Button>
          </div>

          {/* API Key Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total API Keys</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-bdi-blue">{mockApiKeys.length}</div>
                <p className="text-xs text-muted-foreground">Across all organizations</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Active Keys</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-bdi-green-1">{mockApiKeys.filter(k => k.status === 'active').length}</div>
                <p className="text-xs text-muted-foreground">Currently in use</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-bdi-green-2">2.4M</div>
                <p className="text-xs text-muted-foreground">API requests</p>
              </CardContent>
            </Card>
          </div>

          {/* API Keys List */}
          <Card>
            <CardHeader>
              <CardTitle>All API Keys</CardTitle>
              <CardDescription>Monitor API key usage and manage access permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockApiKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-bdi-blue/10 rounded-lg flex items-center justify-center">
                        <SemanticBDIIcon semantic="connect" size={16} className="text-bdi-blue" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium">{key.name}</h3>
                          <Badge variant="secondary" className="text-xs font-mono">
                            {key.prefix}***
                          </Badge>
                          <Badge variant="default" className="text-xs bg-bdi-green-1">
                            {key.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500">
                          {key.organization} • Permissions: {key.permissions.join(', ')} • Last used: {key.lastUsed}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm">
                        <SemanticBDIIcon semantic="analytics" size={14} className="mr-1" />
                        Usage
                      </Button>
                      <Button variant="outline" size="sm">
                        <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                        Manage
                      </Button>
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        Revoke
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Integration Settings</h2>
              <p className="text-muted-foreground">Configure B2B data exchange methods and protocols</p>
            </div>
            <Button className="bg-bdi-green-1 hover:bg-bdi-green-2">
              <SemanticBDIIcon semantic="sync" size={16} className="mr-2 brightness-0 invert" />
              Add Integration
            </Button>
          </div>

          {/* Integration Types */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <SemanticBDIIcon semantic="connect" size={20} className="mr-2" />
                  API Integrations
                </CardTitle>
                <CardDescription>REST API endpoints for real-time data exchange</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">CPFR Data API</span>
                    <Badge variant="secondary">Not Configured</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Inventory API</span>
                    <Badge variant="secondary">Not Configured</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Forecasting API</span>
                    <Badge variant="secondary">Not Configured</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <SemanticBDIIcon semantic="sync" size={20} className="mr-2" />
                  EDI Integrations
                </CardTitle>
                <CardDescription>Electronic Data Interchange for traditional B2B</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">EDI X12 (850/855)</span>
                    <Badge variant="secondary">Not Configured</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">EDIFACT (ORDERS)</span>
                    <Badge variant="secondary">Not Configured</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">FTP/SFTP Transfer</span>
                    <Badge variant="secondary">Not Configured</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Security Settings</h2>
            <p className="text-muted-foreground">Manage authentication, permissions, and security policies</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <SemanticBDIIcon semantic="settings" size={20} className="mr-2" />
                  Access Control
                </CardTitle>
                <CardDescription>Manage user roles and permissions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">Super Admin Access</div>
                      <div className="text-sm text-gray-500">Full system administration</div>
                    </div>
                    <Badge variant="default" className="bg-bdi-green-1">Active</Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">Two-Factor Authentication</div>
                      <div className="text-sm text-gray-500">Enhanced security for admin accounts</div>
                    </div>
                    <Badge variant="secondary">Not Configured</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">Session Management</div>
                      <div className="text-sm text-gray-500">Control session timeouts and policies</div>
                    </div>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <SemanticBDIIcon semantic="analytics" size={20} className="mr-2" />
                  Audit & Monitoring
                </CardTitle>
                <CardDescription>Track system usage and security events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">Activity Logging</div>
                      <div className="text-sm text-gray-500">Track user actions and API calls</div>
                    </div>
                    <Badge variant="default" className="bg-bdi-green-1">Enabled</Badge>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">Failed Login Monitoring</div>
                      <div className="text-sm text-gray-500">Alert on suspicious login attempts</div>
                    </div>
                    <Badge variant="secondary">Not Configured</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">Data Access Logs</div>
                      <div className="text-sm text-gray-500">Monitor CPFR data access patterns</div>
                    </div>
                    <Button variant="outline" size="sm">
                      <SemanticBDIIcon semantic="reports" size={14} className="mr-1" />
                      View Logs
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Placeholder for other tabs */}
      {!['overview', 'organizations', 'api-keys', 'integrations', 'security'].includes(activeTab) && (
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>This section is under development</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <SemanticBDIIcon semantic="settings" size={48} className="mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">This feature will be available soon.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
