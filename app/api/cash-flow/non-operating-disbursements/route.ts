import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { cashFlowNonOperatingDisbursements, users } from '@/lib/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';

// GET all non-operating disbursements
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
          set: () => {},
          remove: () => {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const conditions = [eq(cashFlowNonOperatingDisbursements.organizationId, organizationId)];
    
    if (startDate) {
      conditions.push(gte(cashFlowNonOperatingDisbursements.weekStart, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(cashFlowNonOperatingDisbursements.weekStart, endDate));
    }

    const disbursements = await db
      .select()
      .from(cashFlowNonOperatingDisbursements)
      .where(and(...conditions))
      .orderBy(cashFlowNonOperatingDisbursements.weekStart);

    return NextResponse.json(disbursements);
  } catch (error) {
    console.error('Error fetching non-operating disbursements:', error);
    return NextResponse.json({ error: 'Failed to fetch disbursements' }, { status: 500 });
  }
}

// POST - Create new non-operating disbursement
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
          set: () => {},
          remove: () => {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { weekStart, disbursementType, description, amount, organizationId, sourceReference } = body;

    if (!weekStart || !disbursementType || !amount || !organizationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newDisbursement = await db.insert(cashFlowNonOperatingDisbursements).values({
      weekStart,
      disbursementType,
      description,
      amount: amount.toString(),
      organizationId,
      createdBy: user.id,
      sourceReference,
    }).returning();

    return NextResponse.json(newDisbursement[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating non-operating disbursement:', error);
    return NextResponse.json(
      { error: 'Failed to create disbursement', details: error?.message },
      { status: 500 }
    );
  }
}

// PUT - Update non-operating disbursement
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
          set: () => {},
          remove: () => {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, weekStart, disbursementType, description, amount, sourceReference } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const updated = await db
      .update(cashFlowNonOperatingDisbursements)
      .set({
        weekStart,
        disbursementType,
        description,
        amount: amount?.toString(),
        sourceReference,
        updatedAt: new Date(),
      })
      .where(eq(cashFlowNonOperatingDisbursements.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Disbursement not found' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error: any) {
    console.error('Error updating non-operating disbursement:', error);
    return NextResponse.json(
      { error: 'Failed to update disbursement', details: error?.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete non-operating disbursement
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get: (name: string) => cookieStore.get(name)?.value,
          set: () => {},
          remove: () => {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    await db.delete(cashFlowNonOperatingDisbursements).where(eq(cashFlowNonOperatingDisbursements.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting non-operating disbursement:', error);
    return NextResponse.json(
      { error: 'Failed to delete disbursement', details: error?.message },
      { status: 500 }
    );
  }
}
