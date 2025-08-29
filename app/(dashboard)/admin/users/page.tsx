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

// Mock data for BDI internal users
const mockBDIUsers = [
  {
    id: '1',
    authId: '18a29c7a-3778-4ea9-a36b-eefabb93d1a3',
    name: 'Steven Cistulli',
    email: 'scistulli@boundlessdevices.com',
    role: 'super_admin',
    title: 'CEO',
    department: 'Executive',
    phone: '7703632420',
    lastLogin: '2024-01-15 14:30',
    status: 'active',
    joinedAt: '2023-01-01',
    apiAccess: true
  },
  {
    id: '2',
    authId: 'uuid-2',
    name: 'Dariush Zand',
    email: 'dzand@boundlessdevices.com',
    role: 'admin',
    title: 'CTO',
    department: 'Engineering',
    phone: '4155165975',
    lastLogin: '2024-01-14 16:45',
    status: 'active',
    joinedAt: '2023-01-15',
    apiAccess: true
  },
  {
    id: '3',
    authId: 'uuid-3',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@boundlessdevices.com',
    role: 'member',
    title: 'Supply Chain Manager',
    department: 'Operations',
    phone: '5551234567',
    lastLogin: '2024-01-12 09:15',
    status: 'active',
    joinedAt: '2023-03-01',
    apiAccess: false
  },
  {
    id: '4',
    authId: 'uuid-4',
    name: 'Mike Thompson',
    email: 'mike.thompson@boundlessdevices.com',
    role: 'developer',
    title: 'Senior Developer',
    department: 'Engineering',
    phone: '5559876543',
    lastLogin: '2024-01-13 11:20',
    status: 'active',
    joinedAt: '2023-06-15',
    apiAccess: true
  }
];

export default function AdminUsersPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [filterRole, setFilterRole] = useState('all');

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

  const filteredUsers = filterRole === 'all' 
    ? mockBDIUsers 
    : mockBDIUsers.filter(u => u.role === filterRole);

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total BDI Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-1">{mockBDIUsers.length}</div>
            <p className="text-xs text-muted-foreground">Internal employees</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-2">
              {mockBDIUsers.filter(u => u.status === 'active').length}
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
              {mockBDIUsers.filter(u => u.role === 'developer' || u.apiAccess).length}
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
              {mockBDIUsers.filter(u => u.role === 'super_admin' || u.role === 'admin').length}
            </div>
            <p className="text-xs text-muted-foreground">Admin privileges</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filter Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Label>Role:</Label>
            <select 
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="developer">Developer</option>
              <option value="member">Member</option>
            </select>
            <Button variant="outline" size="sm">
              <SemanticBDIIcon semantic="search" size={14} className="mr-1" />
              Search
            </Button>
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
            {filteredUsers.map((bdiUser) => (
              <div key={bdiUser.id} className="border rounded-lg p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-16 bg-bdi-green-1/10 rounded-xl flex items-center justify-center">
                      <SemanticBDIIcon semantic="profile" size={24} className="text-bdi-green-1" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-semibold">{bdiUser.name}</h3>
                        <Badge variant={bdiUser.role === 'super_admin' ? 'default' : 'secondary'} 
                               className={bdiUser.role === 'super_admin' ? 'bg-bdi-green-1 text-white' : 
                                          bdiUser.role === 'developer' ? 'bg-bdi-blue text-white' : ''}>
                          {bdiUser.role.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <Badge variant={bdiUser.status === 'active' ? 'default' : 'secondary'} 
                               className={bdiUser.status === 'active' ? 'bg-bdi-green-2 text-white' : ''}>
                          {bdiUser.status.toUpperCase()}
                        </Badge>
                        {bdiUser.apiAccess && (
                          <Badge variant="outline" className="border-bdi-blue text-bdi-blue">
                            API ACCESS
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 space-y-1">
                        <div><strong>Email:</strong> {bdiUser.email}</div>
                        <div><strong>Title:</strong> {bdiUser.title} • <strong>Department:</strong> {bdiUser.department}</div>
                        <div><strong>Phone:</strong> {bdiUser.phone}</div>
                        <div><strong>Last Login:</strong> {bdiUser.lastLogin} • <strong>Joined:</strong> {new Date(bdiUser.joinedAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedUser(bdiUser)}>
                      <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                      Manage
                    </Button>
                    {bdiUser.role === 'developer' && (
                      <Button variant="outline" size="sm" className="bg-bdi-blue/10 hover:bg-bdi-blue/20">
                        <SemanticBDIIcon semantic="connect" size={14} className="mr-1" />
                        API Keys
                      </Button>
                    )}
                    {bdiUser.authId !== user.authId && (
                      <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        Deactivate
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
                  {selectedUser.name}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setSelectedUser(null)}>
                  ×
                </Button>
              </div>
              <CardDescription>Manage BDI user permissions and access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* User Details */}
                <div>
                  <h3 className="text-lg font-semibold mb-4">User Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Full Name</Label>
                      <Input value={selectedUser.name} className="mt-1" />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input value={selectedUser.email} disabled className="mt-1" />
                    </div>
                    <div>
                      <Label>Role</Label>
                      <select className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm">
                        <option value="super_admin">Super Admin</option>
                        <option value="admin">Admin</option>
                        <option value="developer">Developer</option>
                        <option value="member">Member</option>
                      </select>
                    </div>
                    <div>
                      <Label>Department</Label>
                      <select className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm">
                        <option value="Executive">Executive</option>
                        <option value="Engineering">Engineering</option>
                        <option value="Operations">Operations</option>
                        <option value="Sales">Sales</option>
                        <option value="Finance">Finance</option>
                        <option value="Marketing">Marketing</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Permissions */}
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-4">Permissions & Access</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">CPFR Portal Access</div>
                        <div className="text-sm text-gray-500">Access to forecasting and supply signals</div>
                      </div>
                      <Badge variant="default" className="bg-bdi-green-1 text-white">GRANTED</Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">API Access</div>
                        <div className="text-sm text-gray-500">Programmatic access to BDI APIs</div>
                      </div>
                      <Badge variant={selectedUser.apiAccess ? 'default' : 'secondary'} 
                             className={selectedUser.apiAccess ? 'bg-bdi-blue text-white' : ''}>
                        {selectedUser.apiAccess ? 'GRANTED' : 'DENIED'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">Admin Panel Access</div>
                        <div className="text-sm text-gray-500">Access to organization and user management</div>
                      </div>
                      <Badge variant={['super_admin', 'admin'].includes(selectedUser.role) ? 'default' : 'secondary'} 
                             className={['super_admin', 'admin'].includes(selectedUser.role) ? 'bg-bdi-green-1 text-white' : ''}>
                        {['super_admin', 'admin'].includes(selectedUser.role) ? 'GRANTED' : 'DENIED'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* API Keys (for developers) */}
                {selectedUser.role === 'developer' && (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold">API Keys</h3>
                        <Button size="sm" className="bg-bdi-blue hover:bg-bdi-blue/90 text-white">
                          <SemanticBDIIcon semantic="connect" size={14} className="mr-1 brightness-0 invert" />
                          Generate Key
                        </Button>
                      </div>
                      <div className="text-center py-6 text-gray-500">
                        <SemanticBDIIcon semantic="connect" size={32} className="mx-auto mb-2" />
                        <p>No API keys generated yet</p>
                        <p className="text-sm">Generate keys for programmatic access</p>
                      </div>
                    </div>
                  </>
                )}

                {/* Action Buttons */}
                <Separator />
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setSelectedUser(null)}>
                    Cancel
                  </Button>
                  <Button className="bg-bdi-green-1 hover:bg-bdi-green-2">
                    Save Changes
                  </Button>
                  {selectedUser.authId !== user.authId && (
                    <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      Deactivate User
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">User Filters & Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Label>Filter by Role:</Label>
              <select 
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm"
              >
                <option value="all">All Roles</option>
                <option value="super_admin">Super Admin</option>
                <option value="admin">Admin</option>
                <option value="developer">Developer</option>
                <option value="member">Member</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <Input placeholder="Search users..." className="w-64" />
              <Button variant="outline" size="sm">
                <SemanticBDIIcon semantic="search" size={14} className="mr-1" />
                Search
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
            {filteredUsers.map((bdiUser) => (
              <div key={bdiUser.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-bdi-green-1/10 rounded-lg flex items-center justify-center">
                    <SemanticBDIIcon semantic="profile" size={20} className="text-bdi-green-1" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-medium">{bdiUser.name}</h3>
                      <Badge variant={bdiUser.role === 'super_admin' ? 'default' : 'secondary'} 
                             className={bdiUser.role === 'super_admin' ? 'bg-bdi-green-1 text-white text-xs' : 
                                        bdiUser.role === 'developer' ? 'bg-bdi-blue text-white text-xs' : 'text-xs'}>
                        {bdiUser.role.replace('_', ' ').toUpperCase()}
                      </Badge>
                      <Badge variant={bdiUser.status === 'active' ? 'default' : 'secondary'} 
                             className={bdiUser.status === 'active' ? 'bg-bdi-green-2 text-white text-xs' : 'text-xs'}>
                        {bdiUser.status.toUpperCase()}
                      </Badge>
                      {bdiUser.apiAccess && (
                        <Badge variant="outline" className="border-bdi-blue text-bdi-blue text-xs">
                          API
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {bdiUser.email} • {bdiUser.title} • {bdiUser.department} • Last login: {bdiUser.lastLogin}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedUser(bdiUser)}>
                    <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                    Manage
                  </Button>
                  {bdiUser.role === 'developer' && (
                    <Button variant="outline" size="sm" className="bg-bdi-blue/10 hover:bg-bdi-blue/20">
                      <SemanticBDIIcon semantic="connect" size={14} className="mr-1" />
                      API Keys
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
                    <Label htmlFor="userName">Full Name</Label>
                    <Input id="userName" placeholder="John Doe" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="userEmail">Email</Label>
                    <Input id="userEmail" type="email" placeholder="john.doe@boundlessdevices.com" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="userRole">Role</Label>
                    <select className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm">
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="developer">Developer</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="userDepartment">Department</Label>
                    <select className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm">
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
                  <Label htmlFor="userTitle">Job Title</Label>
                  <Input id="userTitle" placeholder="Software Engineer" className="mt-1" />
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
