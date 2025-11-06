import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { cashFlowBankAccounts } from '@/lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Build conditions array
    const conditions = [eq(cashFlowBankAccounts.organizationId, organizationId)];
    
    if (startDate) {
      conditions.push(gte(cashFlowBankAccounts.weekStart, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(cashFlowBankAccounts.weekStart, endDate));
    }

    const entries = await db
      .select()
      .from(cashFlowBankAccounts)
      .where(and(...conditions));

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching bank account entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bank account entries' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { weekStart, entryType, description, amount, notes, organizationId } = body;

    if (!weekStart || !entryType || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const [newEntry] = await db
      .insert(cashFlowBankAccounts)
      .values({
        weekStart,
        entryType,
        description: description || '',
        amount: amount || 0,
        notes,
        organizationId,
        createdBy: user.id,
      })
      .returning();

    return NextResponse.json(newEntry);
  } catch (error) {
    console.error('Error creating bank account entry:', error);
    return NextResponse.json(
      { error: 'Failed to create bank account entry' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, weekStart, entryType, description, amount, notes, organizationId } = body;

    if (!id || !weekStart || !entryType || !organizationId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const [updatedEntry] = await db
      .update(cashFlowBankAccounts)
      .set({
        weekStart,
        entryType,
        description: description || '',
        amount: amount || 0,
        notes,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(cashFlowBankAccounts.id, id),
          eq(cashFlowBankAccounts.organizationId, organizationId)
        )
      )
      .returning();

    if (!updatedEntry) {
      return NextResponse.json(
        { error: 'Bank account entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedEntry);
  } catch (error) {
    console.error('Error updating bank account entry:', error);
    return NextResponse.json(
      { error: 'Failed to update bank account entry' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    await db
      .delete(cashFlowBankAccounts)
      .where(eq(cashFlowBankAccounts.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting bank account entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete bank account entry' },
      { status: 500 }
    );
  }
}

