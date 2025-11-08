import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { forecastAnalysisSessions, forecastAnalysisSelections } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';

// GET - Fetch all sessions for the current user
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesArray) => {
            cookiesArray.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch sessions
    const sessions = await db
      .select()
      .from(forecastAnalysisSessions)
      .where(
        and(
          eq(forecastAnalysisSessions.userId, user.id),
          eq(forecastAnalysisSessions.isActive, true)
        )
      )
      .orderBy(desc(forecastAnalysisSessions.lastAccessedAt));

    return NextResponse.json({ sessions, count: sessions.length });
  } catch (error) {
    console.error('Error fetching forecast analysis sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// POST - Create a new session with selections
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesArray) => {
            cookiesArray.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      sessionName,
      description,
      startDate,
      endDate,
      selectedSku,
      searchQuery,
      filters,
      selections, // Array of { forecastId, skuScenarioId, manualAsp }
    } = body;

    // Validate required fields
    if (!sessionName) {
      return NextResponse.json(
        { error: 'Session name is required' },
        { status: 400 }
      );
    }

    // Get user's organization
    const { data: profile } = await supabase
      .from('users')
      .select('organizationId')
      .eq('authId', user.id)
      .single();

    // Create session
    const [session] = await db
      .insert(forecastAnalysisSessions)
      .values({
        sessionName,
        description: description || null,
        userId: user.id,
        organizationId: profile?.organizationId || null,
        startDate: startDate || null,
        endDate: endDate || null,
        selectedSku: selectedSku || 'all',
        searchQuery: searchQuery || null,
        filters: filters || {},
      })
      .returning();

    // Create selections if provided
    if (selections && selections.length > 0) {
      const selectionValues = selections.map((sel: any) => ({
        sessionId: session.id,
        forecastId: sel.forecastId,
        skuScenarioId: sel.skuScenarioId || null,
        manualAsp: sel.manualAsp || null,
        notes: sel.notes || null,
      }));

      await db.insert(forecastAnalysisSelections).values(selectionValues);
    }

    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    console.error('Error creating forecast analysis session:', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

// PUT - Update an existing session
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesArray) => {
            cookiesArray.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      sessionName,
      description,
      startDate,
      endDate,
      selectedSku,
      searchQuery,
      filters,
      selections, // Array of { forecastId, skuScenarioId, manualAsp }
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Update session
    const [session] = await db
      .update(forecastAnalysisSessions)
      .set({
        sessionName: sessionName || undefined,
        description: description || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        selectedSku: selectedSku || undefined,
        searchQuery: searchQuery || undefined,
        filters: filters || undefined,
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      })
      .where(
        and(
          eq(forecastAnalysisSessions.id, id),
          eq(forecastAnalysisSessions.userId, user.id)
        )
      )
      .returning();

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Update selections if provided
    if (selections && selections.length > 0) {
      // Delete existing selections
      await db
        .delete(forecastAnalysisSelections)
        .where(eq(forecastAnalysisSelections.sessionId, id));

      // Insert new selections
      const selectionValues = selections.map((sel: any) => ({
        sessionId: id,
        forecastId: sel.forecastId,
        skuScenarioId: sel.skuScenarioId || null,
        manualAsp: sel.manualAsp || null,
        notes: sel.notes || null,
      }));

      await db.insert(forecastAnalysisSelections).values(selectionValues);
    }

    return NextResponse.json({ session });
  } catch (error) {
    console.error('Error updating forecast analysis session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

// DELETE - Soft delete a session
export async function DELETE(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesArray) => {
            cookiesArray.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Soft delete
    await db
      .update(forecastAnalysisSessions)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(forecastAnalysisSessions.id, id),
          eq(forecastAnalysisSessions.userId, user.id)
        )
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting forecast analysis session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}

