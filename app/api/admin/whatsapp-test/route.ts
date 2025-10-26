import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { sendWhatsAppMessage } from '@/lib/services/whatsapp';

/**
 * POST /api/admin/whatsapp-test
 * Send a test WhatsApp message (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only super admins can test (costs money per message)
    // Additional restriction: Only scistulli@boundlessdevices.com
    if (user.role !== 'super_admin' || user.email !== 'scistulli@boundlessdevices.com') {
      return NextResponse.json(
        { error: 'Forbidden - Access restricted' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    // Send test message
    const result = await sendWhatsAppMessage({
      to: phone,
      body: `🎉 Test message from BDI Business Portal\n\nYour WhatsApp integration is working correctly!\n\nSent at: ${new Date().toLocaleString()}`,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, errorCode: result.errorCode },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      messageSid: result.messageSid,
      status: result.status,
    });
  } catch (error: any) {
    console.error('Error sending test WhatsApp message:', error);
    return NextResponse.json(
      { error: 'Failed to send test message' },
      { status: 500 }
    );
  }
}

