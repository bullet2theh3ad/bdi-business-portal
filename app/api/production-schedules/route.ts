import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { productionSchedules, productionScheduleShipments, productSkus, shipments, purchaseOrders, users } from '@/lib/db/schema';
import { createServerClient } from '@supabase/ssr';
import { eq, desc, and, isNull, inArray } from 'drizzle-orm';
import { cookies } from 'next/headers';

// GET - List all production schedules
export async function GET(request: Request) {
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
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all production schedules with related data
    const schedules = await db
      .select({
        id: productionSchedules.id,
        referenceNumber: productionSchedules.referenceNumber,
        skuId: productionSchedules.skuId,
        purchaseOrderId: productionSchedules.purchaseOrderId,
        quantity: productionSchedules.quantity,
        materialArrivalDate: productionSchedules.materialArrivalDate,
        smtDate: productionSchedules.smtDate,
        dipDate: productionSchedules.dipDate,
        atpBeginDate: productionSchedules.atpBeginDate,
        atpEndDate: productionSchedules.atpEndDate,
        obaDate: productionSchedules.obaDate,
        exwDate: productionSchedules.exwDate,
        notes: productionSchedules.notes,
        status: productionSchedules.status,
        createdBy: productionSchedules.createdBy,
        createdAt: productionSchedules.createdAt,
        updatedAt: productionSchedules.updatedAt,
        // SKU data
        sku: productSkus,
      })
      .from(productionSchedules)
      .leftJoin(productSkus, eq(productionSchedules.skuId, productSkus.id))
      .where(isNull(productionSchedules.deletedAt))
      .orderBy(desc(productionSchedules.createdAt));

    // Fetch associated shipments for each production schedule
    const scheduleIds = schedules.map(s => s.id);
    let associatedShipments: any[] = [];
    
    if (scheduleIds.length > 0) {
      associatedShipments = await db
        .select({
          productionScheduleId: productionScheduleShipments.productionScheduleId,
          shipmentId: productionScheduleShipments.shipmentId,
        shipment: {
          id: shipments.id,
          bdiReference: shipments.bdiReference,
          shipperReference: shipments.shipperReference,
          status: shipments.status,
          estimatedShipDate: shipments.estimatedShipDate,
          requestedDeliveryDate: shipments.requestedDeliveryDate,
          priority: shipments.priority,
        },
      })
      .from(productionScheduleShipments)
      .leftJoin(shipments, eq(productionScheduleShipments.shipmentId, shipments.id))
        .where(inArray(productionScheduleShipments.productionScheduleId, scheduleIds));
    }

    // Group shipments by production schedule
    const shipmentsBySchedule = associatedShipments.reduce((acc, item) => {
      const scheduleId = item.productionScheduleId;
      if (!acc[scheduleId]) {
        acc[scheduleId] = [];
      }
      acc[scheduleId].push(item);
      return acc;
    }, {} as Record<string, any[]>);

    // Add shipment data to each schedule
    const schedulesWithShipments = schedules.map(schedule => ({
      ...schedule,
      shipments: shipmentsBySchedule[schedule.id] || [],
      totalShipmentQuantity: (shipmentsBySchedule[schedule.id] || [])
        .reduce((total: number, item: any) => total + (item.forecast?.quantity || 0), 0)
    }));

    return NextResponse.json(schedulesWithShipments);
  } catch (error) {
    console.error('Error fetching production schedules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch production schedules' },
      { status: 500 }
    );
  }
}

// POST - Create a new production schedule
export async function POST(request: Request) {
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
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      skuId,
      shipmentIds, // Changed from shipmentId to shipmentIds array
      purchaseOrderId,
      quantity,
      materialArrivalDate,
      smtDate,
      dipDate,
      atpBeginDate,
      atpEndDate,
      obaDate,
      exwDate,
      notes,
      status,
    } = body;

    // Validate required fields
    if (!skuId || quantity === undefined) {
      return NextResponse.json(
        { error: 'SKU and quantity are required' },
        { status: 400 }
      );
    }

    // Create the production schedule
    const [newSchedule] = await db
      .insert(productionSchedules)
      .values({
        skuId,
        purchaseOrderId: purchaseOrderId || null,
        quantity,
        materialArrivalDate: materialArrivalDate || null,
        smtDate: smtDate || null,
        dipDate: dipDate || null,
        atpBeginDate: atpBeginDate || null,
        atpEndDate: atpEndDate || null,
        obaDate: obaDate || null,
        exwDate: exwDate || null,
        notes: notes || null,
        status: status || 'draft',
        createdBy: user.id,
      })
      .returning();

    // Create shipment associations if provided
    if (shipmentIds && Array.isArray(shipmentIds) && shipmentIds.length > 0) {
      const shipmentAssociations = shipmentIds.map((shipmentId: string) => ({
        productionScheduleId: newSchedule.id,
        shipmentId,
      }));

      await db.insert(productionScheduleShipments).values(shipmentAssociations);
    }

    return NextResponse.json(newSchedule, { status: 201 });
  } catch (error) {
    console.error('Error creating production schedule:', error);
    return NextResponse.json(
      { error: 'Failed to create production schedule' },
      { status: 500 }
    );
  }
}

