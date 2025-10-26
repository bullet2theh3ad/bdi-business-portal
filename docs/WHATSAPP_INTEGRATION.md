# WhatsApp Integration Guide

## Overview

The BDI Business Portal now includes a complete WhatsApp notification system powered by Twilio. This allows you to send notifications to users via WhatsApp in addition to in-app and email notifications.

## Features

✅ **Multi-Channel Notifications** - Send notifications via Portal, Email, and WhatsApp
✅ **Notification Bell** - Visual indicator in header with unread count badge
✅ **Notification Center** - Dropdown panel to view and manage notifications
✅ **WhatsApp Integration** - Twilio-powered WhatsApp messaging
✅ **Admin Configuration** - Easy setup interface for Twilio credentials
✅ **Real-time Updates** - Notifications refresh automatically every 30 seconds
✅ **Delivery Tracking** - Track delivery status across all channels
✅ **Ready for Integration** - Framework is complete, just add your Twilio credentials

## Architecture

### Database Tables

- `notifications` - Stores all notifications with multi-channel support
- `whatsapp_config` - Stores Twilio configuration and settings

### Components

- `NotificationBell` - Bell icon with unread count badge (in header)
- `NotificationsPanel` - Dropdown panel with notification list
- `hooks/useNotifications.ts` - React hook for managing notification state

### Services

- `lib/services/notifications.ts` - Core notification service
- `lib/services/whatsapp.ts` - Twilio WhatsApp integration

### API Routes

- `GET /api/notifications` - Fetch user's notifications
- `POST /api/notifications` - Create new notification (admin only)
- `PATCH /api/notifications/[id]` - Mark notification as read
- `DELETE /api/notifications/[id]` - Delete notification
- `POST /api/notifications/mark-all-read` - Mark all as read
- `GET /api/admin/whatsapp-config` - Get WhatsApp configuration
- `POST /api/admin/whatsapp-config` - Save WhatsApp configuration
- `POST /api/admin/whatsapp-test` - Send test WhatsApp message

## Setup Instructions

### Step 1: Install Dependencies

```bash
pnpm add twilio
pnpm add date-fns  # For date formatting
```

### Step 2: Create Database Tables

Run the migration script:

```bash
psql -U your_username -d your_database -f migrations/create-notifications-tables.sql
```

Or use your preferred database migration tool with the SQL from `migrations/create-notifications-tables.sql`.

### Step 3: Set Up Twilio

1. Create a Twilio account at https://www.twilio.com/try-twilio
2. Go to the Twilio Console Dashboard
3. Copy your **Account SID** and **Auth Token**
4. Set up WhatsApp:
   - For testing: Use Twilio Sandbox (immediate, no approval needed)
   - For production: Register your WhatsApp Business Profile (requires Meta approval)

### Step 4: Configure in Admin Panel

1. Log in as a **BDI Super Admin** user (only super admins can access this)
2. Navigate to **Admin > WhatsApp Settings** in the sidebar
3. Enter your credentials:
   - Twilio Account SID
   - Twilio Auth Token
   - WhatsApp Number (e.g., `+14155238886` for sandbox)
4. Enable WhatsApp integration
5. Click "Save Configuration"
6. Test the integration with the "Send Test Message" button

### Step 5: Using the Twilio Sandbox (Testing)

For testing without waiting for Meta approval:

1. In Twilio Console, go to **Messaging > Try it out > Send a WhatsApp message**
2. Note your sandbox keyword (e.g., "join abc-def")
3. On your phone, send "join abc-def" to +1 (415) 523-8886 via WhatsApp
4. You'll receive a confirmation message
5. Now you can receive test messages!

## Usage

### Sending Notifications

Use the notification service to send notifications:

```typescript
import { createNotification } from '@/lib/services/notifications';

// Send a notification via portal, email, and WhatsApp
await createNotification({
  userId: user.authId, // User's auth UUID
  type: 'order',
  title: 'Order Shipped',
  message: 'Your order #12345 has been shipped and is on the way!',
  channels: ['portal', 'email', 'whatsapp'], // Which channels to use
  priority: 'high',
  actionUrl: '/orders/12345',
  actionLabel: 'View Order',
  relatedEntityType: 'purchase_order',
  relatedEntityId: orderId,
});
```

### Notification Types

- `system` - System messages
- `order` - Order updates
- `shipment` - Shipment updates
- `rma` - RMA updates
- `cpfr` - CPFR/forecast updates
- `user` - User-related notifications
- `alert` - Urgent alerts
- `message` - Direct messages

### Priority Levels

- `low` - Low priority (gray)
- `normal` - Normal priority (blue)
- `high` - High priority (orange)
- `urgent` - Urgent (red)

## User Experience

### Notification Bell

- Located in the header, next to the user profile icon
- Shows a red badge with unread count
- Badge shows "99+" for counts over 99
- Click to open the notifications panel

### Notifications Panel

- Dropdown panel (400px wide, 500px tall)
- Filter: All / Unread
- Mark as read / Mark all as read
- Delete individual notifications
- Click notification to navigate to related item
- Auto-refreshes every 30 seconds
- Shows delivery status (Portal, Email, WhatsApp)

## Integration Examples

### Example 1: Order Status Change

```typescript
// In your order update handler
await createNotification({
  userId: order.userId,
  type: 'order',
  title: 'Order Status Updated',
  message: `Your order #${order.orderNumber} status changed to ${newStatus}`,
  channels: ['portal', 'whatsapp'],
  priority: 'normal',
  actionUrl: `/orders/${order.id}`,
  actionLabel: 'View Order',
  relatedEntityType: 'purchase_order',
  relatedEntityId: order.id,
});
```

### Example 2: Urgent Alert

```typescript
await createNotification({
  userId: user.authId,
  type: 'alert',
  title: '🚨 Urgent: Shipment Delayed',
  message: 'Shipment #SH-2024-001 has been delayed by 3 days due to weather.',
  channels: ['portal', 'email', 'whatsapp'],
  priority: 'urgent',
  actionUrl: '/cpfr/shipments/SH-2024-001',
  actionLabel: 'View Shipment',
  relatedEntityType: 'shipment',
  relatedEntityId: shipmentId,
});
```

### Example 3: Bulk Notifications

```typescript
import { sendBulkNotification } from '@/lib/services/notifications';

// Notify all users in an organization
const users = await getUsersByOrganization(orgId);
const userIds = users.map((u) => u.authId);

await sendBulkNotification(userIds, {
  type: 'system',
  title: 'System Maintenance Scheduled',
  message: 'The system will be under maintenance on Saturday from 2-4 AM UTC.',
  channels: ['portal', 'email'],
  priority: 'normal',
});
```

## Phone Number Format

WhatsApp requires phone numbers in **E.164 format**:

- Format: `+[country code][number]`
- Example: `+12345678900`
- No spaces, dashes, or parentheses

The system includes helper functions:

```typescript
import { formatPhoneNumber, isValidPhoneNumber } from '@/lib/services/whatsapp';

const phone = formatPhoneNumber('(234) 567-8900'); // Returns: +12345678900
const isValid = isValidPhoneNumber('+12345678900'); // Returns: true
```

## Security Considerations

### Current Implementation

- Twilio credentials stored in database (plain text)
- **Super Admin only** access to configuration (BDI users only)
- API routes protected by authentication and role-based access control
- Cost protection: only super admins can send test messages

### Production Recommendations

1. **Encrypt Credentials**: Encrypt Twilio credentials in the database
2. **Use Environment Variables**: Store in env vars instead of DB for better security
3. **Implement Rate Limiting**: Prevent abuse of notification sending
4. **Add Webhook Verification**: Verify Twilio webhook signatures
5. **Monitor Usage**: Track WhatsApp message usage to avoid unexpected costs

### Suggested Encryption

```typescript
// Example using crypto
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 bytes
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
```

## Costs

### Twilio Pricing (as of 2024)

- **WhatsApp Messages**: ~$0.005 - $0.03 per message (varies by country)
- **SMS (alternative)**: ~$0.01 - $0.10 per message
- **Free Tier**: Twilio provides trial credits for testing

### Cost Management

- Daily message limits (configurable in admin panel)
- Default limit: 1,000 messages/day
- Monitor usage in Twilio Console
- Set up billing alerts in Twilio

## Troubleshooting

### WhatsApp Test Message Fails

**Problem**: "Failed to send test message"

**Solutions**:
1. Verify Twilio credentials are correct
2. For sandbox: Make sure you've joined the sandbox (send "join keyword" to Twilio number)
3. Check phone number format (must be E.164)
4. Verify Twilio account is active and funded
5. Check Twilio Console for error details

### Notifications Not Showing

**Problem**: Notification bell doesn't show count

**Solutions**:
1. Check browser console for errors
2. Verify API route `/api/notifications` returns data
3. Check user authentication
4. Clear browser cache and reload

### Database Errors

**Problem**: "notifications table does not exist"

**Solution**: Run the migration script to create tables

## Future Enhancements

Potential improvements to consider:

1. **WhatsApp Templates**: Support for pre-approved message templates
2. **Rich Media**: Support for images, documents, and videos
3. **Two-Way Messaging**: Handle incoming WhatsApp messages
4. **Read Receipts**: Track when users read WhatsApp messages
5. **User Preferences**: Let users choose notification channels
6. **Notification Categories**: Subscribe/unsubscribe from categories
7. **Push Notifications**: Browser push notifications
8. **SMS Fallback**: Fall back to SMS if WhatsApp fails
9. **Analytics Dashboard**: Track notification delivery and engagement
10. **A/B Testing**: Test different notification messages

## Support

For issues or questions:

- Twilio Documentation: https://www.twilio.com/docs/whatsapp
- Twilio Support: https://support.twilio.com
- BDI Portal: Contact your system administrator

## License

This integration is part of the BDI Business Portal and follows the same license terms.

