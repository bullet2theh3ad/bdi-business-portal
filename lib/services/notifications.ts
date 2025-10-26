/**
 * Notifications Service
 * 
 * Handles creating and sending notifications across multiple channels:
 * - Portal (in-app)
 * - Email
 * - WhatsApp
 * - SMS (future)
 */

import { db } from '@/lib/db/drizzle';
import { notifications, users, type NewNotification } from '@/lib/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { sendWhatsAppMessage, isWhatsAppEnabled } from './whatsapp';
import { sendEmail } from '@/lib/email/resend';

export interface CreateNotificationParams {
  userId: string; // Auth UUID of the user
  type: 'system' | 'order' | 'shipment' | 'rma' | 'cpfr' | 'user' | 'alert' | 'message';
  title: string;
  message: string;
  channels?: ('portal' | 'email' | 'whatsapp' | 'sms')[];
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  category?: string;
  actionUrl?: string;
  actionLabel?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
  metadata?: Record<string, any>;
  expiresAt?: Date;
}

export interface NotificationWithUser {
  notification: typeof notifications.$inferSelect;
  user?: typeof users.$inferSelect;
}

/**
 * Create and send a notification to a user
 * Handles multi-channel delivery (portal, email, WhatsApp)
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<typeof notifications.$inferSelect | null> {
  try {
    const {
      userId,
      type,
      title,
      message,
      channels = ['portal'], // Default to portal only
      priority = 'normal',
      category,
      actionUrl,
      actionLabel,
      relatedEntityType,
      relatedEntityId,
      metadata,
      expiresAt,
    } = params;

    // Get user details for contact info
    const user = await db.query.users.findFirst({
      where: eq(users.authId, userId),
    });

    if (!user) {
      console.error(`User not found: ${userId}`);
      return null;
    }

    // Initialize delivery status
    const deliveryStatus: Record<string, string> = {};

    // Create notification in database (portal notification)
    const [notification] = await db
      .insert(notifications)
      .values({
        userId,
        type,
        title,
        message,
        channels: JSON.stringify(channels),
        priority,
        category,
        actionUrl,
        actionLabel,
        relatedEntityType,
        relatedEntityId,
        metadata: metadata ? JSON.stringify(metadata) : null,
        expiresAt,
        deliveryStatus: JSON.stringify({ portal: 'delivered' }),
      })
      .returning();

    deliveryStatus.portal = 'delivered';

    // Send via other channels if requested
    const notificationId = notification.id;

    // Email channel
    if (channels.includes('email') && user.email) {
      try {
        await sendEmail({
          to: user.email,
          subject: title,
          html: `
            <h2>${title}</h2>
            <p>${message}</p>
            ${actionUrl ? `<p><a href="${actionUrl}" style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">${actionLabel || 'View Details'}</a></p>` : ''}
            <hr>
            <p style="color: #666; font-size: 12px;">This is an automated message from BDI Business Portal.</p>
          `,
          text: `${title}\n\n${message}\n\n${actionUrl ? `${actionLabel || 'View Details'}: ${actionUrl}` : ''}`,
        });
        deliveryStatus.email = 'sent';
      } catch (error) {
        console.error('Failed to send email notification:', error);
        deliveryStatus.email = 'failed';
      }
    }

    // WhatsApp channel
    if (channels.includes('whatsapp') && user.phone) {
      const whatsappEnabled = await isWhatsAppEnabled();
      
      if (whatsappEnabled) {
        try {
          const whatsappResult = await sendWhatsAppMessage({
            to: user.phone,
            body: `*${title}*\n\n${message}${actionUrl ? `\n\nView: ${actionUrl}` : ''}`,
          });

          if (whatsappResult.success) {
            deliveryStatus.whatsapp = 'sent';
            // Update notification with WhatsApp details
            await db
              .update(notifications)
              .set({
                whatsappMessageId: whatsappResult.messageSid,
                whatsappStatus: whatsappResult.status,
              })
              .where(eq(notifications.id, notificationId));
          } else {
            deliveryStatus.whatsapp = 'failed';
            // Store error details
            await db
              .update(notifications)
              .set({
                whatsappStatus: 'failed',
                whatsappErrorCode: whatsappResult.errorCode,
                whatsappErrorMessage: whatsappResult.error,
              })
              .where(eq(notifications.id, notificationId));
          }
        } catch (error) {
          console.error('Failed to send WhatsApp notification:', error);
          deliveryStatus.whatsapp = 'failed';
        }
      } else {
        deliveryStatus.whatsapp = 'disabled';
      }
    }

    // Update final delivery status
    await db
      .update(notifications)
      .set({
        deliveryStatus: JSON.stringify(deliveryStatus),
      })
      .where(eq(notifications.id, notificationId));

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
}

/**
 * Get notifications for a user
 */
export async function getUserNotifications(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
    type?: string;
  }
) {
  const { limit = 50, offset = 0, unreadOnly = false, type } = options || {};

  const conditions = [
    eq(notifications.userId, userId),
    isNull(notifications.deletedAt),
  ];

  if (unreadOnly) {
    conditions.push(eq(notifications.isRead, false));
  }

  if (type) {
    conditions.push(eq(notifications.type, type));
  }

  return await db.query.notifications.findMany({
    where: and(...conditions),
    orderBy: [desc(notifications.createdAt)],
    limit,
    offset,
  });
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: string, userId: string) {
  return await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      )
    )
    .returning();
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  return await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      )
    );
}

/**
 * Delete a notification (soft delete)
 */
export async function deleteNotification(notificationId: string, userId: string) {
  return await db
    .update(notifications)
    .set({
      deletedAt: new Date(),
    })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, userId)
      )
    );
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db.query.notifications.findMany({
    where: and(
      eq(notifications.userId, userId),
      eq(notifications.isRead, false),
      isNull(notifications.deletedAt)
    ),
  });

  return result.length;
}

/**
 * Bulk send notifications to multiple users
 */
export async function sendBulkNotification(
  userIds: string[],
  params: Omit<CreateNotificationParams, 'userId'>
) {
  const results = await Promise.allSettled(
    userIds.map((userId) =>
      createNotification({
        ...params,
        userId,
      })
    )
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  return {
    total: userIds.length,
    successful,
    failed,
  };
}

