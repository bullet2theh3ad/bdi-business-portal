import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // Server Component - can be ignored
            }
          },
        },
      }
    )

    // Get authenticated user
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
    if (authError || !authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create service client for database access (like main analytics API)
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check user role using Supabase (same method as main analytics)
    const { data: userData, error: userError } = await serviceSupabase
      .from('users')
      .select('role')
      .eq('auth_id', authUser.id)
      .single()

    if (userError || !userData || !['super_admin', 'admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get date range from query params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    console.log('🔍 Debug: Forecast deliveries with date range:', { startDate, endDate });
    
    // Get forecast delivery data using Supabase (same method that works in main analytics)
    const { data: forecastsData, error: forecastsError } = await serviceSupabase
      .from('sales_forecasts')
      .select(`
        delivery_week,
        quantity,
        status,
        confidence,
        id,
        product_skus(name)
      `)
      .not('delivery_week', 'is', null)

    if (forecastsError) {
      console.error('Error fetching forecasts:', forecastsError);
      return NextResponse.json({ error: 'Failed to fetch forecasts' }, { status: 500 })
    }

    console.log('📊 Raw forecasts from Supabase:', { 
      totalForecasts: forecastsData?.length || 0,
      sampleData: forecastsData?.slice(0, 3) || []
    });

    // Filter forecasts by date range if provided
    let filteredForecasts = forecastsData || [];
    
    if (startDate && endDate) {
      const startDateObj = new Date(startDate);
      const endDateObj = new Date(endDate);
      
      filteredForecasts = (forecastsData || []).filter((forecast: any) => {
        if (!forecast.delivery_week || !forecast.delivery_week.match(/^\d{4}-W\d{2}$/)) {
          return false;
        }
        
        // Convert delivery week to approximate date (YYYY-WNN to date)
        const [year, weekStr] = forecast.delivery_week.split('-W');
        const weekNum = parseInt(weekStr);
        const yearNum = parseInt(year);
        
        // Approximate date: January 1st + (week - 1) * 7 days
        const deliveryDate = new Date(yearNum, 0, 1 + (weekNum - 1) * 7);
        
        return deliveryDate >= startDateObj && deliveryDate <= endDateObj;
      });
      
      console.log('📊 Date filtering applied:', {
        originalCount: forecastsData?.length || 0,
        filteredCount: filteredForecasts.length,
        dateRange: { startDate, endDate }
      });
    }

    // Group by delivery week
    const groupedForecasts = filteredForecasts.reduce((acc: any, forecast: any) => {
      const week = forecast.delivery_week;
      if (!acc[week]) {
        acc[week] = {
          deliveryWeek: week,
          deliveryDate: week, // Use week as date for now
          forecasts: [],
          totalUnits: 0
        };
      }
      
      acc[week].forecasts.push({
        id: forecast.id,
        skuName: forecast.product_skus?.name || 'Unknown SKU',
        quantity: forecast.quantity,
        organization: 'BDI',
        status: forecast.status,
        confidence: forecast.confidence
      });
      acc[week].totalUnits += forecast.quantity;
      
      return acc;
    }, {});

    const forecastDeliveries = Object.values(groupedForecasts).sort((a: any, b: any) => 
      a.deliveryWeek.localeCompare(b.deliveryWeek)
    );

    console.log('📊 Forecast Deliveries API Debug:', {
      totalRows: forecastDeliveries.length,
      sampleData: forecastDeliveries.slice(0, 3),
      totalForecasts: forecastDeliveries.reduce((sum: number, item: any) => sum + item.forecasts.length, 0),
      totalUnits: forecastDeliveries.reduce((sum: number, item: any) => sum + item.totalUnits, 0)
    });

    return NextResponse.json(forecastDeliveries)

  } catch (error) {
    console.error('Error in forecast deliveries API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
