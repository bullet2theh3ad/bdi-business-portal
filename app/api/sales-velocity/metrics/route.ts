/**
 * Sales Velocity Metrics API
 * 
 * Retrieves calculated sales velocity metrics from the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookies) => {
            cookies.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is super_admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('auth_id', user.id)
      .single();

    if (userError || userData?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden - Super Admin only' }, { status: 403 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'latest'; // 'latest', 'stockout', 'top_movers'
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = supabase.from('sales_velocity_latest').select('*');

    // Apply view filter
    if (view === 'stockout') {
      query = supabase
        .from('sales_velocity_stockout_alerts')
        .select('*')
        .limit(limit);
    } else if (view === 'top_movers') {
      query = supabase
        .from('sales_velocity_top_movers')
        .select('*')
        .limit(20);
    } else {
      // Latest view
      query = query.limit(limit);
    }

    const { data: metrics, error } = await query;

    if (error) {
      console.error('Error fetching velocity metrics:', error);
      return NextResponse.json(
        { error: 'Failed to fetch velocity metrics' },
        { status: 500 }
      );
    }

    // Get calculation info
    const { data: calculation } = await supabase
      .from('sales_velocity_calculations')
      .select('*')
      .eq('status', 'completed')
      .order('calculation_date', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      view,
      metrics: metrics || [],
      calculation: calculation || null,
      count: metrics?.length || 0,
    });

  } catch (error: any) {
    console.error('❌ Error fetching sales velocity metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales velocity metrics', details: error.message },
      { status: 500 }
    );
  }
}

