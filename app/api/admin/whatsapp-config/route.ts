import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { whatsappConfig } from '@/lib/db/schema';
import { eq, isNull } from 'drizzle-orm';

/**
 * GET /api/admin/whatsapp-config
 * Get WhatsApp configuration (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only super admins can access (sensitive credentials & system-wide)
    // Additional restriction: Only scistulli@boundlessdevices.com
    if (user.role !== 'super_admin' || user.email !== 'scistulli@boundlessdevices.com') {
      return NextResponse.json(
        { error: 'Forbidden - Access restricted' },
        { status: 403 }
      );
    }

    // Get global config (organizationId is null)
    const config = await db.query.whatsappConfig.findFirst({
      where: isNull(whatsappConfig.organizationId),
    });

    return NextResponse.json({ config: config || null });
  } catch (error: any) {
    console.error('Error fetching WhatsApp config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/whatsapp-config
 * Save WhatsApp configuration (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only super admins can save config (sensitive credentials & system-wide)
    // Additional restriction: Only scistulli@boundlessdevices.com
    if (user.role !== 'super_admin' || user.email !== 'scistulli@boundlessdevices.com') {
      return NextResponse.json(
        { error: 'Forbidden - Access restricted' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      twilioAccountSid,
      twilioAuthToken,
      twilioWhatsappNumber,
      isEnabled,
      dailyMessageLimit,
    } = body;

    // Validate required fields
    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsappNumber) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if config exists
    const existingConfig = await db.query.whatsappConfig.findFirst({
      where: isNull(whatsappConfig.organizationId),
    });

    let result;

    if (existingConfig) {
      // Update existing config
      [result] = await db
        .update(whatsappConfig)
        .set({
          twilioAccountSid,
          twilioAuthToken,
          twilioWhatsappNumber,
          isEnabled,
          dailyMessageLimit,
          updatedAt: new Date(),
        })
        .where(eq(whatsappConfig.id, existingConfig.id))
        .returning();
    } else {
      // Create new config
      [result] = await db
        .insert(whatsappConfig)
        .values({
          organizationId: null, // Global config
          twilioAccountSid,
          twilioAuthToken,
          twilioWhatsappNumber,
          isEnabled,
          dailyMessageLimit,
          createdBy: user.authId,
        })
        .returning();
    }

    return NextResponse.json({ config: result });
  } catch (error: any) {
    console.error('Error saving WhatsApp config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

