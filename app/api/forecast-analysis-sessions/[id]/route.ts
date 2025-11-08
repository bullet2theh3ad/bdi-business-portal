import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { db } from '@/lib/db/drizzle';
import { forecastAnalysisSessions, forecastAnalysisSelections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

// GET - Fetch a single session with its selections
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
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

    // Fetch session
    const [session] = await db
      .select()
      .from(forecastAnalysisSessions)
      .where(
        and(
          eq(forecastAnalysisSessions.id, sessionId),
          eq(forecastAnalysisSessions.userId, user.id)
        )
      );

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Fetch selections
    const selections = await db
      .select()
      .from(forecastAnalysisSelections)
      .where(eq(forecastAnalysisSelections.sessionId, sessionId));

    // Update last accessed time
    await db
      .update(forecastAnalysisSessions)
      .set({ lastAccessedAt: new Date() })
      .where(eq(forecastAnalysisSessions.id, sessionId));

    return NextResponse.json({ session, selections });
  } catch (error) {
    console.error('Error fetching forecast analysis session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

