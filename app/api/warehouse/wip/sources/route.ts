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
    let importBatchId = searchParams.get('importBatchId');

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
    
    // If no importBatchId specified, use the most recent completed import
    if (!importBatchId) {
      const { data: latestImport } = await supabaseService
        .from('warehouse_wip_imports')
        .select('id')
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();
      
      if (latestImport) {
        importBatchId = latestImport.id;
        console.log(`📦 WIP Sources: Using most recent import batch: ${importBatchId}`);
      }
    }

    // Use database function to get distinct sources efficiently
    // This returns only unique sources (5 rows) instead of all 12k+ unit rows
    const { data: sources, error } = await supabaseService.rpc(
      'get_warehouse_wip_distinct_sources',
      { batch_id: importBatchId || null }
    );

    if (error) {
      console.error('❌ RPC error:', error);
      throw error;
    }

    console.log(`📊 Distinct sources from DB: ${sources?.length || 0}`, sources);

    // Extract source values (RPC returns array of objects with 'source' property)
    const sourceList = sources?.map((s: any) => s.source) || [];

    return NextResponse.json({ sources: sourceList });

  } catch (error: any) {
    console.error('❌ Sources API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

