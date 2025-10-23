import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { productionSchedules, productionScheduleShipments } from '@/lib/db/schema';
import { createServerClient } from '@supabase/ssr';
import { eq, and, isNull } from 'drizzle-orm';
import { cookies } from 'next/headers';

// GET - Get a single production schedule
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const [schedule] = await db
      .select()
      .from(productionSchedules)
      .where(
        and(
          eq(productionSchedules.id, id),
          isNull(productionSchedules.deletedAt)
        )
      );

    if (!schedule) {
      return NextResponse.json(
        { error: 'Production schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(schedule);
  } catch (error) {
    console.error('Error fetching production schedule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch production schedule' },
      { status: 500 }
    );
  }
}

// PUT - Update a production schedule
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const [updatedSchedule] = await db
      .update(productionSchedules)
      .set({
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
        status,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productionSchedules.id, id),
          isNull(productionSchedules.deletedAt)
        )
      )
      .returning();

    // Update shipment associations
    // First, delete existing associations
    await db
      .delete(productionScheduleShipments)
      .where(eq(productionScheduleShipments.productionScheduleId, id));

    // Then, create new associations if provided
    if (shipmentIds && Array.isArray(shipmentIds) && shipmentIds.length > 0) {
      const shipmentAssociations = shipmentIds.map((shipmentId: string) => ({
        productionScheduleId: id,
        shipmentId,
      }));

      await db.insert(productionScheduleShipments).values(shipmentAssociations);
    }

    if (!updatedSchedule) {
      return NextResponse.json(
        { error: 'Production schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedSchedule);
  } catch (error) {
    console.error('Error updating production schedule:', error);
    return NextResponse.json(
      { error: 'Failed to update production schedule' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete a production schedule
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const [deletedSchedule] = await db
      .update(productionSchedules)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productionSchedules.id, id),
          isNull(productionSchedules.deletedAt)
        )
      )
      .returning();

    if (!deletedSchedule) {
      return NextResponse.json(
        { error: 'Production schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Production schedule deleted successfully' });
  } catch (error) {
    console.error('Error deleting production schedule:', error);
    return NextResponse.json(
      { error: 'Failed to delete production schedule' },
      { status: 500 }
    );
  }
}

