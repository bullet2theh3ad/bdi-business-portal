import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/auth/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check user role
    const { data: dbUser } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (!dbUser || !['super_admin', 'admin', 'operations'].includes(dbUser.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 }
      );
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const importBatchId = searchParams.get('importBatchId');

    // Use direct Supabase client
    const { createClient } = require('@supabase/supabase-js');
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Build query for sources - use range to bypass 1000 row limit
    let query = supabaseService
      .from('warehouse_wip_units')
      .select('source')
      .not('source', 'is', null);

    // Apply filter if provided
    if (importBatchId) {
      query = query.eq('import_batch_id', importBatchId);
    }

    // Use range() to fetch up to 50k rows (bypasses default 1000 limit)
    const { data: sources, error } = await query.range(0, 49999);

    if (error) {
      throw error;
    }

    console.log(`📊 Fetched ${sources?.length || 0} source rows`);

    // Get unique sources and sort
    const uniqueSources = [...new Set(sources?.map((s: any) => s.source) || [])].sort();

    console.log(`📊 Unique sources found: ${uniqueSources.length}`, uniqueSources);

    return NextResponse.json({ sources: uniqueSources });

  } catch (error: any) {
    console.error('❌ Sources API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

