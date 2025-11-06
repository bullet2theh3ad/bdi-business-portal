import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { cashFlowFundingRequests, users } from '@/lib/db/schema';
import { and, eq, gte, lte } from 'drizzle-orm';

// GET all funding requests
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

    const conditions = [eq(cashFlowFundingRequests.organizationId, organizationId)];
    
    if (startDate) {
      conditions.push(gte(cashFlowFundingRequests.weekStart, startDate));
    }
    
    if (endDate) {
      conditions.push(lte(cashFlowFundingRequests.weekStart, endDate));
    }

    const fundingRequests = await db
      .select()
      .from(cashFlowFundingRequests)
      .where(and(...conditions))
      .orderBy(cashFlowFundingRequests.weekStart);

    return NextResponse.json(fundingRequests);
  } catch (error) {
    console.error('Error fetching funding requests:', error);
    return NextResponse.json({ error: 'Failed to fetch funding requests' }, { status: 500 });
  }
}

// POST - Create new funding request
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
    const { weekStart, fundingType, description, amount, organizationId, isCalculated, calculationNote } = body;

    if (!weekStart || !fundingType || !amount || !organizationId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newFundingRequest = await db.insert(cashFlowFundingRequests).values({
      weekStart,
      fundingType,
      description,
      amount: amount.toString(),
      organizationId,
      createdBy: user.id,
      isCalculated: isCalculated || false,
      calculationNote,
    }).returning();

    return NextResponse.json(newFundingRequest[0], { status: 201 });
  } catch (error: any) {
    console.error('Error creating funding request:', error);
    return NextResponse.json(
      { error: 'Failed to create funding request', details: error?.message },
      { status: 500 }
    );
  }
}

// PUT - Update funding request
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
    const { id, weekStart, fundingType, description, amount, isCalculated, calculationNote } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const updated = await db
      .update(cashFlowFundingRequests)
      .set({
        weekStart,
        fundingType,
        description,
        amount: amount?.toString(),
        isCalculated,
        calculationNote,
        updatedAt: new Date(),
      })
      .where(eq(cashFlowFundingRequests.id, id))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Funding request not found' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error: any) {
    console.error('Error updating funding request:', error);
    return NextResponse.json(
      { error: 'Failed to update funding request', details: error?.message },
      { status: 500 }
    );
  }
}

// DELETE - Delete funding request
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

    await db.delete(cashFlowFundingRequests).where(eq(cashFlowFundingRequests.id, id));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting funding request:', error);
    return NextResponse.json(
      { error: 'Failed to delete funding request', details: error?.message },
      { status: 500 }
    );
  }
}
