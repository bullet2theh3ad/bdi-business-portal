import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { cashFlowMustPays, users } from '@/lib/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';

// GET all must pays (with optional date range filter)
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

    let query = db
      .select()
      .from(cashFlowMustPays)
      .where(eq(cashFlowMustPays.organizationId, organizationId));

    // Apply date filters if provided
    const conditions = [eq(cashFlowMustPays.organizationId, organizationId)];
    
    if (startDate) {
      conditions.push(gte(cashFlowMustPays.weekStart, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(cashFlowMustPays.weekStart, endDate));
    }

    const mustPays = await db
      .select()
      .from(cashFlowMustPays)
      .where(and(...conditions))
      .orderBy(cashFlowMustPays.weekStart);

    return NextResponse.json(mustPays);
  } catch (error) {
    console.error('Error fetching must pays:', error);
    return NextResponse.json({ error: 'Failed to fetch must pays' }, { status: 500 });
  }
}

// POST - Create new must pay item
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
    const { weekStart, category, description, amount, organizationId, sourceType, sourceReference } = body;

    if (!weekStart || !category || !amount || !organizationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get user data
    const [userData] = await db
      .select()
      .from(users)
      .where(eq(users.authId, user.id))
      .limit(1);

    const newMustPay = await db.insert(cashFlowMustPays).values({
      weekStart,
      category,
      description,
      amount: amount.toString(),
      organizationId,
      createdBy: user.id,
      sourceType: sourceType || 'manual',
      sourceReference,
    }).returning();

    return NextResponse.json(newMustPay[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating must pay:', error);
    return NextResponse.json(
      { error: 'Failed to create must pay', details: error?.message },
      { status: 500 }
    );
  }
}

// PUT - Update must pay item
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
    const { id, weekStart, category, description, amount, sourceType, sourceReference } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const updated = await db
      .update(cashFlowMustPays)
      .set({
        weekStart,
        category,
        description,
        amount: amount?.toString(),
        sourceType,
        sourceReference,
        updatedAt: new Date(),
      })
      .where(eq(cashFlowMustPays.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Must pay not found' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error: any) {
    console.error('Error updating must pay:', error);
    return NextResponse.json(
      { error: 'Failed to update must pay', details: error?.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete must pay item
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

    await db.delete(cashFlowMustPays).where(eq(cashFlowMustPays.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting must pay:', error);
    return NextResponse.json(
      { error: 'Failed to delete must pay', details: error?.message },
      { status: 500 }
    );
  }
}

