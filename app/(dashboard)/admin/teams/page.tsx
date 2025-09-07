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

// Real teams will be fetched from API - no more mock data

export default function AdminTeamsPage() {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  const { data: teams, mutate: mutateTeams } = useSWR('/api/admin/teams', fetcher);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [filterType, setFilterType] = useState('all');

  // Only BDI Super Admins and BDI Admins can access BDI team management
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

  // Filter teams based on type
  const teamsArray = Array.isArray(teams) ? teams : [];
  const filteredTeams = filterType === 'all' 
    ? teamsArray 
    : teamsArray.filter((team: any) => team.type === filterType);

  return (
    <div className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <SemanticBDIIcon semantic="collaboration" size={32} />
            <div>
              <h1 className="text-3xl font-bold">Cross-Organizational Teams</h1>
              <p className="text-muted-foreground">Manage CPFR teams for alerts, collaboration, and data sharing across organizations</p>
            </div>
          </div>
          <Button className="bg-bdi-green-1 hover:bg-bdi-green-2" onClick={() => setShowCreateModal(true)}>
            <SemanticBDIIcon semantic="collaboration" size={16} className="mr-2 brightness-0 invert" />
            Create Team
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active Teams</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-1">
              {teamsArray.filter((team: any) => team.status === 'active').length}
            </div>
            <p className="text-xs text-muted-foreground">Currently operational</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-2">
              {teamsArray.reduce((total: number, team: any) => total + (team.members?.length || 0), 0)}
            </div>
            <p className="text-xs text-muted-foreground">Across all teams</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-blue">
              {new Set(teamsArray.flatMap((team: any) => (team.organizations || []).map((org: any) => org.code))).size}
            </div>
            <p className="text-xs text-muted-foreground">Participating companies</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Alert Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-bdi-green-1">4</div>
            <p className="text-xs text-muted-foreground">Notification categories</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Team Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Label>Filter by Type:</Label>
            <select 
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm"
            >
              <option value="all">All Types</option>
              <option value="cpfr_cycle">CPFR Cycles</option>
              <option value="supply_chain">Supply Chain</option>
              <option value="product_launch">Product Launch</option>
              <option value="project">Project Teams</option>
            </select>
            <Button variant="outline" size="sm">
              <SemanticBDIIcon semantic="search" size={14} className="mr-1" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Teams List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <SemanticBDIIcon semantic="collaboration" size={20} className="mr-2" />
            CPFR & Collaboration Teams ({filteredTeams.length})
          </CardTitle>
          <CardDescription>
            Cross-organizational teams for CPFR workflows, alerts, and data sharing
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredTeams.length === 0 ? (
            <div className="text-center py-12">
              <SemanticBDIIcon semantic="collaboration" size={48} className="mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Teams Yet</h3>
              <p className="text-muted-foreground mb-4">Create your first cross-organizational team to start collaboration</p>
              <Button onClick={() => setShowCreateModal(true)} className="bg-bdi-green-1 hover:bg-bdi-green-2">
                <SemanticBDIIcon semantic="collaboration" size={16} className="mr-2 brightness-0 invert" />
                Create First Team
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredTeams.map((team: any) => (
              <div key={team.id} className="border rounded-lg p-6 hover:bg-gray-50 transition-colors">
                {/* Team Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-16 bg-bdi-green-1/10 rounded-xl flex items-center justify-center">
                      <SemanticBDIIcon 
                        semantic={team.type === 'cpfr_cycle' ? 'forecasts' : 
                                 team.type === 'supply_chain' ? 'supply' : 
                                 'collaboration'} 
                        size={24} 
                        className="text-bdi-green-1" 
                      />
                    </div>
                    <div>
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-semibold">{team.name}</h3>
                        <Badge variant="default" className="bg-bdi-blue text-white">
                          {team.type.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <Badge variant={team.status === 'active' ? 'default' : 'secondary'} 
                               className={team.status === 'active' ? 'bg-bdi-green-1 text-white' : ''}>
                          {team.status.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{team.description}</p>
                      
                      {/* Participating Organizations */}
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm font-medium">Organizations:</span>
                        {(team.organizations || []).map((org: any, index: number) => (
                          <Badge key={index} variant="outline" className={
                            org.type === 'internal' ? 'border-bdi-green-1 text-bdi-green-1' :
                            org.type === 'oem_partner' ? 'border-bdi-blue text-bdi-blue' :
                            'border-gray-400 text-gray-600'
                          }>
                            {org.code}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setSelectedTeam(team)}>
                      <SemanticBDIIcon semantic="settings" size={14} className="mr-1" />
                      Manage
                    </Button>
                    <Button variant="outline" size="sm" className="bg-bdi-green-1/10 hover:bg-bdi-green-1/20">
                      <SemanticBDIIcon semantic="notifications" size={14} className="mr-1" />
                      Alerts
                    </Button>
                  </div>
                </div>

                {/* Team Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <SemanticBDIIcon semantic="users" size={16} className="mx-auto mb-1" />
                    <div className="text-lg font-semibold">{team.members.length}</div>
                    <div className="text-xs text-gray-500">Members</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <SemanticBDIIcon semantic="collaboration" size={16} className="mx-auto mb-1" />
                    <div className="text-lg font-semibold">{team.organizations.length}</div>
                    <div className="text-xs text-gray-500">Organizations</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <SemanticBDIIcon semantic="notifications" size={16} className="mx-auto mb-1" />
                    <div className="text-lg font-semibold">
                      {Object.values(team.alerts).filter(Boolean).length}
                    </div>
                    <div className="text-xs text-gray-500">Alert Types</div>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <SemanticBDIIcon semantic="analytics" size={16} className="mx-auto mb-1" />
                    <div className="text-lg font-semibold">{team.dataAccess.length}</div>
                    <div className="text-xs text-gray-500">Data Access</div>
                  </div>
                </div>

                {/* Team Members */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center">
                    <SemanticBDIIcon semantic="users" size={16} className="mr-2" />
                    Team Members
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(team.members || []).map((member: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-bdi-green-1/10 rounded-full flex items-center justify-center">
                            <SemanticBDIIcon semantic="profile" size={12} className="text-bdi-green-1" />
                          </div>
                          <div>
                            <div className="text-sm font-medium">{member.name}</div>
                            <div className="text-xs text-gray-500">{member.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Badge variant="outline" className="text-xs">
                            {member.org}
                          </Badge>
                          <Badge variant={member.role === 'lead' ? 'default' : 'secondary'} 
                                 className={member.role === 'lead' ? 'bg-bdi-green-1 text-white text-xs' : 'text-xs'}>
                            {member.role.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Detail Modal */}
      {selectedTeam && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <SemanticBDIIcon semantic="collaboration" size={24} className="mr-2" />
                  {selectedTeam.name}
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => setSelectedTeam(null)}>
                  ×
                </Button>
              </div>
              <CardDescription>Manage team members, alerts, and data access permissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Alert Configuration */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <SemanticBDIIcon semantic="notifications" size={20} className="mr-2" />
                    Alert Configuration
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries(selectedTeam.alerts).map(([alertType, enabled]) => (
                      <div key={alertType} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <div className="font-medium capitalize">{alertType.replace(/([A-Z])/g, ' $1').trim()}</div>
                          <div className="text-sm text-gray-500">
                            {alertType === 'forecastDeviations' && 'Alert when forecasts deviate significantly'}
                            {alertType === 'supplyShortages' && 'Alert when supply shortages are detected'}
                            {alertType === 'demandSpikes' && 'Alert when demand spikes occur'}
                            {alertType === 'cycleDeadlines' && 'Alert before CPFR cycle deadlines'}
                          </div>
                        </div>
                        <Badge variant={enabled ? 'default' : 'secondary'} 
                               className={enabled ? 'bg-bdi-green-1 text-white' : ''}>
                          {enabled ? 'ENABLED' : 'DISABLED'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Data Access Permissions */}
                <Separator />
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <SemanticBDIIcon semantic="analytics" size={20} className="mr-2" />
                    Data Access Permissions
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {selectedTeam.dataAccess.map((dataType: string, index: number) => (
                      <div key={index} className="p-3 border rounded-lg bg-bdi-green-1/5">
                        <div className="flex items-center space-x-2">
                          <SemanticBDIIcon 
                            semantic={dataType.includes('forecast') ? 'forecasts' : 
                                     dataType.includes('supply') ? 'supply' : 
                                     dataType.includes('inventory') ? 'analytics' : 'reports'} 
                            size={16} 
                            className="text-bdi-green-1" 
                          />
                          <span className="font-medium capitalize">{dataType.replace('_', ' ')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Team Members Management */}
                <Separator />
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">Team Members</h3>
                    <Button size="sm" className="bg-bdi-green-1 hover:bg-bdi-green-2">
                      <SemanticBDIIcon semantic="users" size={14} className="mr-1 brightness-0 invert" />
                      Add Member
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {selectedTeam.members.map((member: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-bdi-green-1/10 rounded-full flex items-center justify-center">
                            <SemanticBDIIcon semantic="profile" size={16} className="text-bdi-green-1" />
                          </div>
                          <div>
                            <div className="font-medium">{member.name}</div>
                            <div className="text-sm text-gray-500">{member.email} • {member.org}</div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={member.role === 'lead' ? 'default' : 'secondary'} 
                                 className={member.role === 'lead' ? 'bg-bdi-green-1 text-white' : ''}>
                            {member.role.toUpperCase()}
                          </Badge>
                          <Button variant="outline" size="sm">
                            <SemanticBDIIcon semantic="settings" size={12} className="mr-1" />
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-3xl">
            <CardHeader>
              <CardTitle className="flex items-center">
                <SemanticBDIIcon semantic="collaboration" size={24} className="mr-2" />
                Create Cross-Organizational Team
              </CardTitle>
              <CardDescription>Set up a new team for CPFR collaboration and alerts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="teamName">Team Name</Label>
                    <Input id="teamName" placeholder="Q2 2024 CPFR Cycle" className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="teamType">Team Type</Label>
                    <select className="mt-1 w-full h-9 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1 text-sm">
                      <option value="cpfr_cycle">CPFR Cycle</option>
                      <option value="supply_chain">Supply Chain</option>
                      <option value="product_launch">Product Launch</option>
                      <option value="project">Project Team</option>
                    </select>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="teamDescription">Description</Label>
                  <textarea
                    id="teamDescription"
                    placeholder="Describe the team's purpose and collaboration goals"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-bdi-green-1"
                    rows={3}
                  />
                </div>

                {/* Alert Configuration */}
                <div>
                  <Label className="text-base font-medium">Alert Configuration</Label>
                  <div className="mt-3 space-y-3">
                    {[
                      { key: 'forecastDeviations', label: 'Forecast Deviations', desc: 'Alert when forecasts deviate significantly' },
                      { key: 'supplyShortages', label: 'Supply Shortages', desc: 'Alert when supply shortages are detected' },
                      { key: 'demandSpikes', label: 'Demand Spikes', desc: 'Alert when demand spikes occur' },
                      { key: 'cycleDeadlines', label: 'Cycle Deadlines', desc: 'Alert before CPFR cycle deadlines' }
                    ].map((alert) => (
                      <label key={alert.key} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                        <div>
                          <div className="font-medium">{alert.label}</div>
                          <div className="text-sm text-gray-500">{alert.desc}</div>
                        </div>
                        <input type="checkbox" className="w-4 h-4 text-bdi-green-1" />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button className="bg-bdi-green-1 hover:bg-bdi-green-2">
                    Create Team
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
