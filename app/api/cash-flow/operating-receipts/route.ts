import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { cashFlowOperatingReceipts } from '@/lib/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';

// GET all operating receipts (with optional date range filter)
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

    // Build conditions array
    const conditions = [eq(cashFlowOperatingReceipts.organizationId, organizationId)];
    
    if (startDate) {
      conditions.push(gte(cashFlowOperatingReceipts.weekStart, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(cashFlowOperatingReceipts.weekStart, endDate));
    }

    const receipts = await db
      .select()
      .from(cashFlowOperatingReceipts)
      .where(and(...conditions));

    return NextResponse.json(receipts);
  } catch (error) {
    console.error('Error fetching operating receipts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch operating receipts' },
      { status: 500 }
    );
  }
}

// POST - create new operating receipt
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
    const { weekStart, receiptType, description, amount, sourceReference, organizationId } = body;

    if (!weekStart || !receiptType || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const [newReceipt] = await db
      .insert(cashFlowOperatingReceipts)
      .values({
        weekStart,
        receiptType,
        description: description || '',
        amount: amount || 0,
        sourceReference,
        organizationId,
        createdBy: user.id,
      })
      .returning();

    return NextResponse.json(newReceipt);
  } catch (error) {
    console.error('Error creating operating receipt:', error);
    return NextResponse.json(
      { error: 'Failed to create operating receipt' },
      { status: 500 }
    );
  }
}

// PUT - update operating receipt
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
    const { id, weekStart, receiptType, description, amount, sourceReference, organizationId } = body;

    if (!id || !weekStart || !receiptType || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const [updatedReceipt] = await db
      .update(cashFlowOperatingReceipts)
      .set({
        weekStart,
        receiptType,
        description: description || '',
        amount: amount || 0,
        sourceReference,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(cashFlowOperatingReceipts.id, id),
          eq(cashFlowOperatingReceipts.organizationId, organizationId)
        )
      )
      .returning();

    if (!updatedReceipt) {
      return NextResponse.json(
        { error: 'Operating receipt not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedReceipt);
  } catch (error) {
    console.error('Error updating operating receipt:', error);
    return NextResponse.json(
      { error: 'Failed to update operating receipt' },
      { status: 500 }
    );
  }
}

// DELETE - delete operating receipt
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

    await db
      .delete(cashFlowOperatingReceipts)
      .where(eq(cashFlowOperatingReceipts.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting operating receipt:', error);
    return NextResponse.json(
      { error: 'Failed to delete operating receipt' },
      { status: 500 }
    );
  }
}

