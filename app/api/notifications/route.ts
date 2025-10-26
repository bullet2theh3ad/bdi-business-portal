import { NextRequest, NextResponse } from 'next/server';
import { getUserNotifications, createNotification, getUnreadCount } from '@/lib/services/notifications';
import { getUser } from '@/lib/db/queries';

/**
 * GET /api/notifications
 * Get notifications for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const type = searchParams.get('type') || undefined;

    const notificationsList = await getUserNotifications(user.authId, {
      limit,
      offset,
      unreadOnly,
      type,
    });

    const unreadCount = await getUnreadCount(user.authId);

    return NextResponse.json({
      notifications: notificationsList,
      unreadCount,
      total: notificationsList.length,
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications
 * Create a new notification (admin/system use)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Only admins can create notifications via API
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      userId,
      type,
      title,
      message,
      channels,
      priority,
      category,
      actionUrl,
      actionLabel,
      relatedEntityType,
      relatedEntityId,
      metadata,
    } = body;

    if (!userId || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, title, message' },
        { status: 400 }
      );
    }

    const notification = await createNotification({
      userId,
      type: type || 'system',
      title,
      message,
      channels: channels || ['portal'],
      priority: priority || 'normal',
      category,
      actionUrl,
      actionLabel,
      relatedEntityType,
      relatedEntityId,
      metadata,
    });

    if (!notification) {
      return NextResponse.json(
        { error: 'Failed to create notification' },
        { status: 500 }
      );
    }

    return NextResponse.json(notification, { status: 201 });
  } catch (error: any) {
    console.error('Error creating notification:', error);
    return NextResponse.json(
      { error: 'Failed to create notification' },
      { status: 500 }
    );
  }
}

