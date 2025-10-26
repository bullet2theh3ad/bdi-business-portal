'use client';

import useSWR from 'swr';
import { useCallback } from 'react';

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  channels: string[];
  priority: string;
  category: string | null;
  actionUrl: string | null;
  actionLabel: string | null;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  isRead: boolean;
  readAt: Date | null;
  deliveryStatus: Record<string, string>;
  whatsappMessageId: string | null;
  whatsappStatus: string | null;
  metadata: Record<string, any> | null;
  createdAt: Date;
  expiresAt: Date | null;
  deletedAt: Date | null;
}

interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  total: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function useNotifications(options?: {
  limit?: number;
  unreadOnly?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}) {
  const {
    limit = 50,
    unreadOnly = false,
    autoRefresh = true,
    refreshInterval = 30000, // 30 seconds
  } = options || {};

  const queryParams = new URLSearchParams({
    limit: limit.toString(),
    unreadOnly: unreadOnly.toString(),
  });

  const { data, error, mutate, isLoading } = useSWR<NotificationsResponse>(
    `/api/notifications?${queryParams}`,
    fetcher,
    {
      refreshInterval: autoRefresh ? refreshInterval : 0,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        const response = await fetch(`/api/notifications/${notificationId}`, {
          method: 'PATCH',
        });

        if (!response.ok) {
          throw new Error('Failed to mark notification as read');
        }

        // Optimistically update local state
        mutate();
      } catch (error) {
        console.error('Error marking notification as read:', error);
        throw error;
      }
    },
    [mutate]
  );

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to mark all notifications as read');
      }

      // Refresh data
      mutate();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  }, [mutate]);

  const deleteNotification = useCallback(
    async (notificationId: string) => {
      try {
        const response = await fetch(`/api/notifications/${notificationId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete notification');
        }

        // Refresh data
        mutate();
      } catch (error) {
        console.error('Error deleting notification:', error);
        throw error;
      }
    },
    [mutate]
  );

  return {
    notifications: data?.notifications || [],
    unreadCount: data?.unreadCount || 0,
    total: data?.total || 0,
    isLoading,
    error,
    refresh: mutate,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}

/**
 * Hook for just getting the unread count (lighter weight)
 */
export function useUnreadCount() {
  const { data, error, mutate } = useSWR<NotificationsResponse>(
    '/api/notifications?limit=1',
    fetcher,
    {
      refreshInterval: 15000, // Refresh every 15 seconds
      revalidateOnFocus: true,
    }
  );

  return {
    unreadCount: data?.unreadCount || 0,
    isLoading: !data && !error,
    error,
    refresh: mutate,
  };
}

