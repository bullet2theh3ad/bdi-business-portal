import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { cashFlowBankBalances, users } from '@/lib/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';

// GET all bank balances
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

    const conditions = [eq(cashFlowBankBalances.organizationId, organizationId)];
    
    if (startDate) {
      conditions.push(gte(cashFlowBankBalances.weekStart, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(cashFlowBankBalances.weekStart, endDate));
    }

    const bankBalances = await db
      .select()
      .from(cashFlowBankBalances)
      .where(and(...conditions))
      .orderBy(cashFlowBankBalances.weekStart);

    return NextResponse.json(bankBalances);
  } catch (error) {
    console.error('Error fetching bank balances:', error);
    return NextResponse.json({ error: 'Failed to fetch bank balances' }, { status: 500 });
  }
}

// POST - Create new bank balance entry
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
    const { weekStart, beginningBalance, outstandingChecks, notes, organizationId } = body;

    if (!weekStart || beginningBalance === undefined || !organizationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newBankBalance = await db.insert(cashFlowBankBalances).values({
      weekStart,
      beginningBalance: beginningBalance.toString(),
      outstandingChecks: (outstandingChecks || 0).toString(),
      notes,
      organizationId,
      createdBy: user.id,
    }).returning();

    return NextResponse.json(newBankBalance[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating bank balance:', error);
    return NextResponse.json(
      { error: 'Failed to create bank balance', details: error?.message },
      { status: 500 }
    );
  }
}

// PUT - Update bank balance entry
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
    const { id, weekStart, beginningBalance, outstandingChecks, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const updated = await db
      .update(cashFlowBankBalances)
      .set({
        weekStart,
        beginningBalance: beginningBalance?.toString(),
        outstandingChecks: outstandingChecks?.toString(),
        notes,
        updatedAt: new Date(),
      })
      .where(eq(cashFlowBankBalances.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Bank balance not found' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error: any) {
    console.error('Error updating bank balance:', error);
    return NextResponse.json(
      { error: 'Failed to update bank balance', details: error?.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete bank balance entry
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

    await db.delete(cashFlowBankBalances).where(eq(cashFlowBankBalances.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting bank balance:', error);
    return NextResponse.json(
      { error: 'Failed to delete bank balance', details: error?.message },
      { status: 500 }
    );
  }
}
