'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Plus, Settings, UserCog } from 'lucide-react';
import useSWR from 'swr';
import { GroupMemberManagement } from './GroupMemberManagement';
import { CreateGroupForm, EditGroupForm } from './GroupForm';
import { useState } from 'react';

interface TeamGroup {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  createdAt: string;
  createdBy: number;
  creatorName: string | null;
  creatorEmail: string;
  memberCount: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ViewMode = 'list' | 'create' | 'edit' | 'manage-members';

export function TeamGroups() {
  const { data: groups, error, isLoading, mutate } = useSWR<TeamGroup[]>('/api/team/groups', fetcher);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedGroup, setSelectedGroup] = useState<TeamGroup | null>(null);

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedGroup(null);
    mutate(); // Refresh groups data
  };

  // Handle different view modes
  if (viewMode === 'create') {
    return <CreateGroupForm onBack={handleBackToList} onCreated={handleBackToList} />;
  }

  if (viewMode === 'edit' && selectedGroup) {
    return <EditGroupForm group={selectedGroup} onBack={handleBackToList} onUpdated={handleBackToList} />;
  }

  if (viewMode === 'manage-members' && selectedGroup) {
    return <GroupMemberManagement group={selectedGroup} onBack={handleBackToList} />;
  }

  if (error) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-red-500" />
            Error Loading Groups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Failed to load team groups. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Groups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!groups || groups.length === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Groups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No groups created yet</p>
            <p className="text-sm text-gray-400">Groups help organize your team members by role, department, or function.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Groups ({groups.length})
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setViewMode('create')}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Group
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              style={{ borderLeftColor: group.color || '#6B7280', borderLeftWidth: '4px' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">{group.name}</h3>
                  {group.description && (
                    <p className="text-sm text-gray-600 mb-2">{group.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedGroup(group);
                      setViewMode('manage-members');
                    }}
                    className="h-8 w-8 p-0"
                    title="Manage members"
                  >
                    <UserCog className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedGroup(group);
                      setViewMode('edit');
                    }}
                    className="h-8 w-8 p-0"
                    title="Edit group"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    style={{ 
                      borderColor: group.color || '#6B7280',
                      color: group.color || '#6B7280'
                    }}
                  >
                    <Users className="h-3 w-3 mr-1" />
                    {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
                  </Badge>
                </div>
                <div className="text-xs text-gray-500">
                  Created {formatDate(group.createdAt)}
                </div>
              </div>
              
              {group.creatorName && (
                <div className="mt-2 text-xs text-gray-500">
                  by {group.creatorName}
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900 mb-1">About Team Groups</h4>
              <p className="text-sm text-blue-700">
                Groups help you organize team members by role, department, or function. 
                You can assign permissions, create reports, and manage your team more effectively using groups.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
