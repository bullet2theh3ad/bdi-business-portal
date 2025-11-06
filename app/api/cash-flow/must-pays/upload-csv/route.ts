import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { cashFlowMustPays } from '@/lib/db/schema';

// POST - Upload CSV for must pays
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
    const { items, organizationId } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Validate and prepare items
    const validItems = items
      .filter((item: any) => {
        return (
          item.weekStart &&
          item.category &&
          item.amount &&
          !isNaN(parseFloat(item.amount))
        );
      })
      .map((item: any) => ({
        weekStart: item.weekStart,
        category: item.category.toLowerCase().replace(/[^a-z]/g, '_'), // Normalize category
        description: item.description || '',
        amount: parseFloat(item.amount).toFixed(2),
        organizationId,
        createdBy: user.id,
        sourceType: 'csv',
        sourceReference: item.sourceReference || '',
      }));

    if (validItems.length === 0) {
      return NextResponse.json({ error: 'No valid items to import' }, { status: 400 });
    }

    // Bulk insert
    const inserted = await db.insert(cashFlowMustPays).values(validItems).returning();

    return NextResponse.json({
      success: true,
      imported: inserted.length,
      skipped: items.length - inserted.length,
      items: inserted,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error uploading must pays CSV:', error);
    return NextResponse.json(
      { error: 'Failed to upload CSV', details: error?.message },
      { status: 500 }
    );
  }
}

