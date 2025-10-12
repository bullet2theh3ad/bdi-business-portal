import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseService = createClient(supabaseUrl, supabaseServiceKey);

/**
 * GET /api/warehouse/wip/imports
 * List all import batches
 */
export async function GET(request: NextRequest) {
  try {
    // Auth check
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get imports ordered by most recent
    const { data: imports, error } = await supabaseService
      .from('warehouse_wip_imports')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching imports:', error);
      return NextResponse.json(
        { error: 'Failed to fetch imports' },
        { status: 500 }
      );
    }

    return NextResponse.json({ imports: imports || [] });

  } catch (error) {
    console.error('Error in GET /api/warehouse/wip/imports:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

