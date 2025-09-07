'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, X, AlertCircle } from 'lucide-react';
import { SemanticBDIIcon } from '@/components/BDIIcon';
import useSWR from 'swr';
// Revoke invitation action
async function revokeInvitation(prevState: any, formData: FormData) {
  try {
    const invitationId = formData.get('invitationId') as string;
    
    console.log('Revoking invitation ID:', invitationId); // Debug log
    
    const response = await fetch('/api/admin/revoke-invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId }),
    });

    const result = await response.json();
    console.log('Revoke result:', result); // Debug log

    if (result.success) {
      // Force refresh of pending invitations
      window.location.reload();
      return { success: result.message };
    } else {
      return { error: result.error };
    }
  } catch (error) {
    console.error('Error revoking invitation:', error);
    return { error: 'Failed to revoke invitation' };
  }
}
import { useActionState } from 'react';

interface Invitation {
  id: string;
  type?: 'organization_invitation' | 'organization_created' | 'user_invitation';
  email: string;
  role: string;
  status: string;
  invitedAt: string;
  invitedBy: string;
  inviterName: string | null;
  inviterEmail: string;
  name?: string;
  title?: string;
  department?: string;
  expiresAt?: string;
  organizationName?: string;
  organizationCode?: string;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  
  // Handle 403 errors specifically for non-owner users
  if (res.status === 403) {
    const error = new Error('Forbidden') as Error & { status: number };
    error.status = 403;
    throw error;
  }
  
  if (!res.ok) {
    const error = new Error('Failed to fetch') as Error & { status: number };
    error.status = res.status;
    throw error;
  }
  
  return res.json();
};

function RevokeInvitationButton({ invitationId, email, mutate }: { invitationId: string; email: string; mutate: () => void }) {
  const [state, action, isPending] = useActionState(revokeInvitation, { error: '' });

  return (
    <form action={action} className="inline">
      <input type="hidden" name="invitationId" value={invitationId} />
      <Button
        type="submit"
        variant="outline"
        size="sm"
        disabled={isPending}
        className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs sm:text-sm px-2 sm:px-3"
        title={`Revoke invitation for ${email}`}
      >
        {isPending ? (
          <div className="h-3 w-3 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <X className="h-3 w-3 sm:h-4 sm:w-4" />
        )}
        <span className="ml-1 sm:ml-2">{isPending ? 'Revoking...' : 'Revoke'}</span>
      </Button>
      {state?.error && (
        <p className="text-sm text-red-500 mt-1">{state.error}</p>
      )}
      {'success' in state && state?.success && (
        <>
          <p className="text-sm text-green-500 mt-1">{state.success}</p>
          {mutate()} {/* Refresh the list after successful revoke */}
        </>
      )}
    </form>
  );
}

export function PendingInvitations() {
  const { data: user } = useSWR('/api/user', fetcher);
  // Only call admin API for super_admin/admin roles
  const { data: invitations, error, mutate } = useSWR<Invitation[]>(
    user && ['super_admin', 'admin'].includes(user.role) ? '/api/admin/pending-invitations' : null,
    fetcher
  );

  // Only show for Super Admin and Admin users
  if (!user || !['super_admin', 'admin'].includes(user.role)) {
    return null;
  }

  // Handle 403 error (non-owner users) - don't show anything
  if (error?.status === 403 || error?.message === 'Forbidden' || (error && error.message?.includes('403'))) {
    return null; // Don't render anything for non-owners
  }

  if (error) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Error Loading Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">Failed to load pending invitations. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  if (!invitations) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SemanticBDIIcon semantic="notifications" size={20} />
            Pending Invitations
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

  // Separate different types of activities
  const allActivities = Array.isArray(invitations) ? invitations : [];
  const pendingInvitations = allActivities.filter(inv => inv.status === 'pending');
  const recentOrganizations = allActivities.filter(inv => inv.type === 'organization_created');
  const totalActivities = allActivities.length;

  if (totalActivities === 0) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SemanticBDIIcon semantic="notifications" size={20} />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 flex items-center gap-2">
            <SemanticBDIIcon semantic="notifications" size={16} />
            No recent organization activity
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysAgo = (dateString: string) => {
    const diffTime = Date.now() - new Date(dateString).getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SemanticBDIIcon semantic="notifications" size={20} />
          Recent Activity ({totalActivities})
        </CardTitle>
        <CardDescription>
          Pending invitations ({pendingInvitations.length}) • Recent organizations ({recentOrganizations.length})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {allActivities.map((invitation) => (
            <div 
              key={invitation.id} 
              className="p-3 sm:p-4 border rounded-lg bg-gray-50 space-y-3"
            >
              {/* Mobile-First Layout: Name, Badges, Details, Button */}
              <div className="space-y-3">
                {/* Name and Icon */}
                <div className="flex items-center gap-2">
                  <SemanticBDIIcon 
                    semantic={invitation.type === 'organization_created' ? 'collaboration' : 'profile'} 
                    size={16} 
                    className="text-gray-500 flex-shrink-0" 
                  />
                  <span className="font-medium text-sm sm:text-base">
                    {invitation.name || invitation.email}
                    {invitation.organizationName && (
                      <span className="text-gray-500 ml-1">({invitation.organizationName})</span>
                    )}
                  </span>
                </div>

                {/* Badges Row */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant={invitation.role === 'super_admin' ? 'default' : 'secondary'}
                         className={`text-xs ${invitation.role === 'super_admin' ? 'bg-bdi-green-1 text-white' : 
                                   invitation.role === 'admin' ? 'bg-bdi-green-2 text-white' :
                                   invitation.role === 'developer' ? 'bg-bdi-blue text-white' : ''}`}>
                    {invitation.role.replace('_', ' ').toUpperCase()}
                  </Badge>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      invitation.status === 'active' 
                        ? 'text-green-600 border-green-600 bg-green-50' 
                        : 'text-bdi-green-1 border-bdi-green-1'
                    }`}
                  >
                    {invitation.status === 'active' ? (
                      <>
                        <SemanticBDIIcon semantic="check" size={10} className="mr-1" />
                        Active
                      </>
                    ) : (
                      <>
                        <Clock className="h-2 w-2 mr-1" />
                        Pending
                      </>
                    )}
                  </Badge>
                  {invitation.type === 'organization_created' && (
                    <Badge variant="outline" className="text-xs text-blue-600 border-blue-600 bg-blue-50">
                      <SemanticBDIIcon semantic="plus" size={10} className="mr-1" />
                      Created
                    </Badge>
                  )}
                </div>

                {/* Details and Action */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="text-xs sm:text-sm text-gray-500 space-y-1">
                    <div className="break-all">{invitation.email}</div>
                    {invitation.title && invitation.department && (
                      <div>{invitation.title} • {invitation.department}</div>
                    )}
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                      <span>Invited {getDaysAgo(invitation.invitedAt)}</span>
                      <span>•</span>
                      <span>{formatDate(invitation.invitedAt)}</span>
                      {invitation.expiresAt && (
                        <>
                          <span>•</span>
                          <span>Expires {formatDate(invitation.expiresAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-start sm:justify-end">
                    <RevokeInvitationButton 
                      invitationId={invitation.id} 
                      email={invitation.email}
                      mutate={mutate}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {pendingInvitations.length > 0 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Pending invitations will expire automatically after 7 days. 
              You can revoke an invitation at any time to free up a rider slot.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
