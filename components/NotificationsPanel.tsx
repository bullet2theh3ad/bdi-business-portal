'use client';

import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Bell,
  Check,
  CheckCheck,
  X,
  Package,
  Truck,
  AlertCircle,
  MessageSquare,
  Settings,
  ShoppingCart,
  BarChart3,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';

// Map notification types to icons
const notificationIcons = {
  system: Settings,
  order: ShoppingCart,
  shipment: Truck,
  rma: Package,
  cpfr: BarChart3,
  user: Bell,
  alert: AlertCircle,
  message: MessageSquare,
};

// Map priority to colors
const priorityColors = {
  low: 'text-gray-500',
  normal: 'text-blue-500',
  high: 'text-orange-500',
  urgent: 'text-red-500',
};

export function NotificationsPanel() {
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } =
    useNotifications({
      limit: 50,
      unreadOnly: showUnreadOnly,
      autoRefresh: true,
    });

  const handleMarkAsRead = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await markAsRead(id);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteNotification(id);
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  return (
    <div className="flex flex-col h-[500px]">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              className="text-xs"
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Filter toggle */}
        <div className="flex items-center space-x-2">
          <Button
            variant={!showUnreadOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowUnreadOnly(false)}
            className="flex-1 text-xs"
          >
            All
          </Button>
          <Button
            variant={showUnreadOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowUnreadOnly(true)}
            className="flex-1 text-xs"
          >
            Unread ({unreadCount})
          </Button>
        </div>
      </div>

      {/* Notifications List */}
      <ScrollArea className="flex-1">
        {isLoading && (
          <div className="p-8 text-center text-muted-foreground">
            Loading notifications...
          </div>
        )}

        {!isLoading && notifications.length === 0 && (
          <div className="p-8 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              {showUnreadOnly ? 'No unread notifications' : 'No notifications yet'}
            </p>
          </div>
        )}

        {!isLoading && notifications.length > 0 && (
          <div className="divide-y">
            {notifications.map((notification) => {
              const Icon = notificationIcons[notification.type as keyof typeof notificationIcons] || Bell;
              const priorityColor = priorityColors[notification.priority as keyof typeof priorityColors] || 'text-gray-500';

              const content = (
                <div
                  className={cn(
                    'p-4 hover:bg-gray-50 transition-colors cursor-pointer relative',
                    !notification.isRead && 'bg-blue-50/50'
                  )}
                >
                  {/* Unread indicator dot */}
                  {!notification.isRead && (
                    <div className="absolute left-2 top-6 w-2 h-2 bg-blue-500 rounded-full" />
                  )}

                  <div className="flex gap-3">
                    {/* Icon */}
                    <div className={cn('flex-shrink-0 mt-1', priorityColor)}>
                      <Icon className="h-5 w-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={cn(
                          'text-sm font-medium',
                          !notification.isRead && 'font-semibold'
                        )}>
                          {notification.title}
                        </h4>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!notification.isRead && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => handleMarkAsRead(notification.id, e)}
                              title="Mark as read"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => handleDelete(notification.id, e)}
                            title="Delete"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {notification.message}
                      </p>

                      {/* Timestamp */}
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </p>

                      {/* Action button */}
                      {notification.actionUrl && notification.actionLabel && (
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 h-auto text-xs mt-2"
                          asChild
                        >
                          <Link href={notification.actionUrl}>
                            {notification.actionLabel} →
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );

              // If there's an action URL, wrap in a link
              if (notification.actionUrl && !notification.isRead) {
                return (
                  <Link
                    key={notification.id}
                    href={notification.actionUrl}
                    onClick={() => markAsRead(notification.id)}
                  >
                    {content}
                  </Link>
                );
              }

              return <div key={notification.id}>{content}</div>;
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {notifications.length > 0 && (
        <>
          <Separator />
          <div className="p-3 text-center">
            <Button variant="link" size="sm" asChild>
              <Link href="/notifications">View all notifications</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

