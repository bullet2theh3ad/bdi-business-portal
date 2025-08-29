'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, X, ArrowLeft } from 'lucide-react';
import useSWR from 'swr';
import { addUserToGroupAction, removeUserFromGroupAction } from '@/app/(login)/actions';
import { useActionState } from 'react';

interface GroupMember {
  id: number;
  userId: number;
  assignedAt: string;
  assignedBy: number;
  userName: string | null;
  userEmail: string;
  userRole: string | null;
}

interface AvailableMember {
  userId: number;
  userName: string | null;
  userEmail: string;
  role: string | null;
}

interface TeamGroup {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  memberCount: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function AddMemberForm({ groupId, onMemberAdded }: { groupId: number; onMemberAdded: () => void }) {
  const { data: availableMembers } = useSWR<AvailableMember[]>(`/api/team/groups/${groupId}/available-members`, fetcher);
  const [state, action, isPending] = useActionState(addUserToGroupAction, { error: '' });

  if (!availableMembers || availableMembers.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-gray-500 text-sm">All team members are already in this group.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">Add Members to Group</h4>
      <div className="space-y-3">
        {availableMembers.map((member) => (
          <div key={member.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div>
                <p className="font-medium">{member.userName || 'No Name'}</p>
                <p className="text-sm text-gray-500">{member.userEmail}</p>
              </div>
              {member.role && (
                <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                  {member.role}
                </Badge>
              )}
            </div>
            <form action={action} className="inline">
              <input type="hidden" name="groupId" value={groupId} />
              <input type="hidden" name="userId" value={member.userId} />
              <Button 
                type="submit" 
                size="sm" 
                disabled={isPending}
                onClick={() => {
                  // Trigger refresh after successful addition
                  setTimeout(() => onMemberAdded(), 1000);
                }}
              >
                {isPending ? 'Adding...' : <><UserPlus className="h-4 w-4 mr-1" /> Add</>}
              </Button>
            </form>
          </div>
        ))}
      </div>
      {state?.error && (
        <p className="text-sm text-red-500">{state.error}</p>
      )}
      {'success' in state && state?.success && (
        <p className="text-sm text-green-500">{state.success}</p>
      )}
    </div>
  );
}

function RemoveMemberButton({ groupId, userId, userName, onMemberRemoved }: { 
  groupId: number; 
  userId: number; 
  userName: string;
  onMemberRemoved: () => void;
}) {
  const [state, action, isPending] = useActionState(removeUserFromGroupAction, { error: '' });

  return (
    <form action={action} className="inline">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="userId" value={userId} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={isPending}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
        title={`Remove ${userName} from group`}
        onClick={() => {
          // Trigger refresh after successful removal
          setTimeout(() => onMemberRemoved(), 1000);
        }}
      >
        {isPending ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <X className="h-4 w-4" />
        )}
        {isPending ? 'Removing...' : 'Remove'}
      </Button>
      {state?.error && (
        <p className="text-sm text-red-500 mt-1">{state.error}</p>
      )}
      {'success' in state && state?.success && (
        <p className="text-sm text-green-500 mt-1">{state.success}</p>
      )}
    </form>
  );
}

export function GroupMemberManagement({ 
  group, 
  onBack 
}: { 
  group: TeamGroup; 
  onBack: () => void;
}) {
  const { data: members, error, mutate } = useSWR<GroupMember[]>(`/api/team/groups/${group.id}/members`, fetcher);

  const handleMemberChange = () => {
    mutate(); // Refresh the member list
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (error) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            Error Loading Group Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Failed to load group members. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  if (!members) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Users className="h-5 w-5" />
            Managing: {group.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
            <div className="h-16 w-full bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Users className="h-5 w-5" />
          Managing: {group.name}
        </CardTitle>
        <div className="flex items-center gap-2 mt-2">
          <div 
            className="w-4 h-4 rounded"
            style={{ backgroundColor: group.color || '#6B7280' }}
          />
          <span className="text-sm text-gray-600">{group.description}</span>
          <Badge variant="outline">{members.length} members</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Members */}
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Current Members</h4>
          {members.length === 0 ? (
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-gray-500 text-sm">No members in this group yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium">{member.userName || 'No Name'}</p>
                      <p className="text-sm text-gray-500">{member.userEmail}</p>
                      <p className="text-xs text-gray-400">Added {formatDate(member.assignedAt)}</p>
                    </div>
                    {member.userRole && (
                      <Badge variant={member.userRole === 'owner' ? 'default' : 'secondary'}>
                        {member.userRole}
                      </Badge>
                    )}
                  </div>
                  <RemoveMemberButton
                    groupId={group.id}
                    userId={member.userId}
                    userName={member.userName || member.userEmail}
                    onMemberRemoved={handleMemberChange}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Members */}
        <div className="border-t pt-6">
          <AddMemberForm groupId={group.id} onMemberAdded={handleMemberChange} />
        </div>
      </CardContent>
    </Card>
  );
}
