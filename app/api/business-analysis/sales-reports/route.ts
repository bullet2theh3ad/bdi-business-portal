import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { salesReports, users } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * GET /api/business-analysis/sales-reports
 * Fetch all active sales reports
 */
export async function GET(request: NextRequest) {
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

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has access (only specific emails)
    const authorizedEmails = ['scistulli@boundlessdevices.com', 'dzand@boundlessdevices.com'];
    if (!authorizedEmails.includes(dbUser.email)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch all active reports
    const reports = await db
      .select()
      .from(salesReports)
      .where(eq(salesReports.isActive, true))
      .orderBy(salesReports.displayOrder, salesReports.createdAt);

    return NextResponse.json({ reports });

  } catch (error: any) {
    console.error('Error fetching sales reports:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/business-analysis/sales-reports
 * Create a new sales report
 */
export async function POST(request: NextRequest) {
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

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user from database
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.authId, authUser.id))
      .limit(1);

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user has access
    const authorizedEmails = ['scistulli@boundlessdevices.com', 'dzand@boundlessdevices.com'];
    if (!authorizedEmails.includes(dbUser.email)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const { name, url, description, icon, color } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: 'Name and URL are required' },
        { status: 400 }
      );
    }

    // Get max display order
    const maxOrderResult = await db
      .select({ maxOrder: salesReports.displayOrder })
      .from(salesReports)
      .orderBy(desc(salesReports.displayOrder))
      .limit(1);

    const nextOrder = (maxOrderResult[0]?.maxOrder || 0) + 1;

    // Insert new report
    const [newReport] = await db
      .insert(salesReports)
      .values({
        name,
        url,
        description: description || null,
        icon: icon || '📊',
        color: color || 'blue',
        displayOrder: nextOrder,
        isActive: true,
        createdBy: dbUser.id,
      })
      .returning();

    return NextResponse.json({ report: newReport }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating sales report:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

