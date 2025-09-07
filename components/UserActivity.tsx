'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SemanticBDIIcon } from '@/components/BDIIcon';

interface UserActivity {
  id: string;
  type: string;
  userId: string | null;
  userName: string;
  userEmail: string;
  userRole: string;
  organizationCode: string;
  organizationName: string;
  activityTime: string;
  description: string;
  createdAt: string;
}

interface UserActivityProps {
  userRole: string;
}

export default function UserActivity({ userRole }: UserActivityProps) {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [days, setDays] = useState(7);

  useEffect(() => {
    // Only fetch data for Super Admin
    if (userRole !== 'super_admin') {
      setIsLoading(false);
      return;
    }

    const fetchActivity = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/admin/user-activity?days=${days}&limit=50`);
        if (response.ok) {
          const data = await response.json();
          setActivities(data.activities || []);
        }
      } catch (error) {
        console.error('Error fetching user activity:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivity();
  }, [days, userRole]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'user_login': return 'users';
      case 'user_created': return 'plus';
      case 'org_invitation_sent': return 'notifications';
      case 'user_updated': return 'settings';
      default: return 'info';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'user_login': return 'bg-green-100 text-green-700 border-green-200';
      case 'user_created': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'org_invitation_sent': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'user_updated': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return date.toLocaleDateString();
  };

  // Only show for Super Admin
  if (userRole !== 'super_admin') {
    return null;
  }

  return (
    <Card className="border border-red-200 bg-red-50/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center text-red-800">
              <SemanticBDIIcon semantic="security" size={20} className="mr-2" />
              All User Activity (Super Admin)
            </CardTitle>
            <CardDescription>
              Comprehensive oversight of all user activity across all organizations
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              {[
                { key: 3, label: '3d' },
                { key: 7, label: '7d' },
                { key: 30, label: '30d' }
              ].map((period) => (
                <Button
                  key={period.key}
                  variant={days === period.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDays(period.key)}
                  className="text-xs"
                >
                  {period.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600"></div>
            <span className="ml-2 text-sm text-gray-600">Loading activity...</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <SemanticBDIIcon semantic="info" size={32} className="mx-auto mb-2 opacity-50" />
            <p>No user activity in the last {days} days</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className={`p-3 rounded-lg border ${getActivityColor(activity.type)}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <SemanticBDIIcon semantic={getActivityIcon(activity.type)} size={16} />
                    <div>
                      <div className="font-medium text-sm">
                        {activity.userName} ({activity.organizationCode})
                      </div>
                      <div className="text-xs text-gray-600">
                        {activity.userEmail} • {activity.userRole}
                      </div>
                      <div className="text-xs font-medium mt-1">
                        {activity.description}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      {formatTimeAgo(activity.activityTime)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(activity.activityTime).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {activities.length > 0 && (
          <div className="mt-4 pt-3 border-t border-red-200">
            <div className="flex items-center justify-between text-sm text-red-600">
              <span>Showing last {activities.length} activities</span>
              <span>Last {days} days</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
