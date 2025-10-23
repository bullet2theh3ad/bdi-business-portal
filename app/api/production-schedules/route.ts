import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { productionSchedules, productionScheduleShipments, productSkus, shipments, shipmentLineItems, forecasts, purchaseOrders, users } from '@/lib/db/schema';
import { createServerClient } from '@supabase/ssr';
import { eq, desc, and, isNull, inArray, sum, sql } from 'drizzle-orm';
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
    // Get quantity from forecast (shipment_line_items table is empty)
    const scheduleIds = schedules.map(s => s.id);
    let associatedShipments: any[] = [];
    
    if (scheduleIds.length > 0) {
      console.log('🔍 Fetching shipments for schedules:', scheduleIds);
      
      try {
        // First, get shipment associations
        const shipmentAssociations = await db
          .select({
            productionScheduleId: productionScheduleShipments.productionScheduleId,
            shipmentId: productionScheduleShipments.shipmentId,
          })
          .from(productionScheduleShipments)
          .where(inArray(productionScheduleShipments.productionScheduleId, scheduleIds));
        
        const shipmentIds = shipmentAssociations.map(sa => sa.shipmentId);
        
        if (shipmentIds.length > 0) {
          // Get shipment details with quantity from the linked forecast
          const shipmentsWithQuantities = await db.execute(sql`
            SELECT 
              s.id as shipment_id,
              s.shipment_number,
              s.shipper_reference,
              s.status,
              s.priority,
              sf.quantity as forecast_quantity
            FROM shipments s
            LEFT JOIN sales_forecasts sf ON s.forecast_id::uuid = sf.id
            WHERE s.id IN (${sql.join(shipmentIds.map(id => sql`${id}`), sql`, `)})
          `);
          
          console.log('📊 Shipments with quantities:', shipmentsWithQuantities);
          
          // Combine the associations with shipment details
          // db.execute() returns rows directly, not wrapped in .rows
          const rows = Array.isArray(shipmentsWithQuantities) ? shipmentsWithQuantities : [];
          associatedShipments = shipmentAssociations.map(assoc => {
            const shipmentDetails = rows.find((s: any) => s.shipment_id === assoc.shipmentId);
            return {
              productionScheduleId: assoc.productionScheduleId,
              shipmentId: assoc.shipmentId,
              shipmentNumber: shipmentDetails?.shipment_number,
              shipmentShipperReference: shipmentDetails?.shipper_reference,
              shipmentStatus: shipmentDetails?.status,
              shipmentPriority: shipmentDetails?.priority,
              forecastQuantity: shipmentDetails?.forecast_quantity || 0,
            };
          });
        }
        
        console.log('✅ Successfully fetched', associatedShipments.length, 'shipment associations');
      } catch (error) {
        console.error('❌ Error fetching shipments:', error);
        throw error;
      }
    }

    // Group shipments by production schedule and restructure the data
    const shipmentsBySchedule = associatedShipments.reduce((acc, item) => {
      const scheduleId = item.productionScheduleId;
      if (!acc[scheduleId]) {
        acc[scheduleId] = [];
      }
      // Restructure the flat data into a shipment object
      acc[scheduleId].push({
        shipmentId: item.shipmentId,
        shipment: {
          shipmentNumber: item.shipmentNumber,
          shipperReference: item.shipmentShipperReference,
          status: item.shipmentStatus,
          priority: item.shipmentPriority,
          requestedQuantity: item.forecastQuantity || 0,
        }
      });
      return acc;
    }, {} as Record<string, any[]>);

    // Add shipment data to each schedule
    const schedulesWithShipments = schedules.map(schedule => ({
      ...schedule,
      shipments: shipmentsBySchedule[schedule.id] || [],
      totalShipmentQuantity: (shipmentsBySchedule[schedule.id] || [])
        .reduce((total: number, item: any) => total + (item.shipment?.requestedQuantity || 0), 0)
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

