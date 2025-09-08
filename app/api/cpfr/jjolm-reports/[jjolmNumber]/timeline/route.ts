import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { users, jjolmTracking, jjolmHistory } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jjolmNumber: string }> }
) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { jjolmNumber } = await params;
    console.log(`📊 Fetching timeline for JJOLM: ${jjolmNumber}`);

    // Get the main JJOLM record
    const [jjolmRecord] = await db
      .select()
      .from(jjolmTracking)
      .where(eq(jjolmTracking.jjolmNumber, jjolmNumber))
      .limit(1);

    if (!jjolmRecord) {
      return NextResponse.json({ error: 'JJOLM record not found' }, { status: 404 });
    }

    // Get history records with user information
    const historyRecords = await db
      .select({
        id: jjolmHistory.id,
        jjolmNumber: jjolmHistory.jjolmNumber,
        fieldName: jjolmHistory.fieldName,
        oldValue: jjolmHistory.oldValue,
        newValue: jjolmHistory.newValue,
        changedAt: jjolmHistory.changedAt,
        sourceFileName: jjolmHistory.sourceFileName,
        changedBy: jjolmHistory.changedBy,
        userName: users.name,
        userEmail: users.email,
      })
      .from(jjolmHistory)
      .leftJoin(users, eq(jjolmHistory.changedBy, users.authId))
      .where(eq(jjolmHistory.jjolmNumber, jjolmNumber))
      .orderBy(desc(jjolmHistory.changedAt));

    // Build timeline events
    const timelineEvents = [];

    // Add creation event
    timelineEvents.push({
      id: `created-${jjolmRecord.id}`,
      type: 'created',
      title: 'JJOLM Record Created',
      description: `Shipment reference ${jjolmNumber} first recorded`,
      timestamp: jjolmRecord.firstSeen,
      data: {
        jjolmNumber,
        mode: jjolmRecord.mode,
        customerReferenceNumber: jjolmRecord.customerReferenceNumber,
        sourceFileName: jjolmRecord.sourceFileName,
      },
      user: null, // System event
      icon: 'plus',
      color: 'green'
    });

    // Add history events
    for (const history of historyRecords) {
      let eventTitle = 'Record Updated';
      let eventDescription = `${history.fieldName} changed`;
      let eventColor = 'blue';
      let eventIcon = 'sync';

      // Customize based on field type
      switch (history.fieldName) {
        case 'status':
          eventTitle = 'Status Changed';
          eventDescription = `Status: ${history.oldValue || 'None'} → ${history.newValue}`;
          eventColor = 'purple';
          eventIcon = 'shipping';
          break;
        case 'pickupDate':
          eventTitle = 'Pickup Date Updated';
          eventDescription = `Pickup: ${history.oldValue || 'Not set'} → ${history.newValue}`;
          eventColor = 'orange';
          eventIcon = 'calendar';
          break;
        case 'deliveryDate':
          eventTitle = 'Delivery Date Updated';
          eventDescription = `Delivery: ${history.oldValue || 'Not set'} → ${history.newValue}`;
          eventColor = 'green';
          eventIcon = 'calendar';
          break;
        case 'estimatedDeliveryDate':
          eventTitle = 'Estimated Delivery Updated';
          eventDescription = `Est. Delivery: ${history.oldValue || 'Not set'} → ${history.newValue}`;
          eventColor = 'yellow';
          eventIcon = 'calendar';
          break;
        case 'mode':
          eventTitle = 'Shipping Mode Changed';
          eventDescription = `Mode: ${history.oldValue || 'None'} → ${history.newValue}`;
          eventColor = 'blue';
          eventIcon = 'shipping';
          break;
        case 'carrier':
          eventTitle = 'Carrier Updated';
          eventDescription = `Carrier: ${history.oldValue || 'None'} → ${history.newValue}`;
          eventColor = 'indigo';
          eventIcon = 'shipping';
          break;
        default:
          eventDescription = `${history.fieldName}: ${history.oldValue || 'None'} → ${history.newValue}`;
      }

      timelineEvents.push({
        id: history.id,
        type: 'update',
        title: eventTitle,
        description: eventDescription,
        timestamp: history.changedAt,
        data: {
          fieldName: history.fieldName,
          oldValue: history.oldValue,
          newValue: history.newValue,
          sourceFileName: history.sourceFileName,
        },
        user: {
          name: history.userName,
          email: history.userEmail,
        },
        icon: eventIcon,
        color: eventColor
      });
    }

    // Sort by timestamp (newest first)
    timelineEvents.sort((a, b) => {
      const dateA = new Date(a.timestamp || 0).getTime();
      const dateB = new Date(b.timestamp || 0).getTime();
      return dateB - dateA;
    });

    // Build current status summary
    const currentStatus = {
      jjolmNumber: jjolmRecord.jjolmNumber,
      customerReferenceNumber: jjolmRecord.customerReferenceNumber,
      mode: jjolmRecord.mode,
      origin: jjolmRecord.origin,
      destination: jjolmRecord.destination,
      carrier: jjolmRecord.carrier,
      serviceType: jjolmRecord.serviceType,
      status: jjolmRecord.status,
      trackingNumber: jjolmRecord.trackingNumber,
      
      // Dates
      pickupDate: jjolmRecord.pickupDate,
      deliveryDate: jjolmRecord.deliveryDate,
      estimatedDeliveryDate: jjolmRecord.estimatedDeliveryDate,
      
      // Metadata
      firstSeen: jjolmRecord.firstSeen,
      lastUpdated: jjolmRecord.lastUpdated,
      updateCount: jjolmRecord.updateCount,
      sourceFileName: jjolmRecord.sourceFileName,
      
      // Additional data from Excel
      additionalData: jjolmRecord.additionalData || {},
    };

    return NextResponse.json({
      success: true,
      data: {
        currentStatus,
        timeline: timelineEvents,
        summary: {
          totalEvents: timelineEvents.length,
          totalUpdates: historyRecords.length,
          firstSeen: jjolmRecord.firstSeen,
          lastUpdated: jjolmRecord.lastUpdated,
        }
      }
    });

  } catch (error) {
    console.error('Error fetching JJOLM timeline:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
