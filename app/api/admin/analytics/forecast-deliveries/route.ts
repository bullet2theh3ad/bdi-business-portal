import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/drizzle'
import { sql } from 'drizzle-orm'

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

    // Check user role (admin required)
    const [userData] = await db
      .execute(sql`SELECT role FROM users WHERE auth_id = ${authUser.id}`)
      .then(result => (result as any))

    if (!userData || !['super_admin', 'admin'].includes(userData.role)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get forecast delivery data - simplified query to debug the issue
    console.log('🔍 Debug: Starting forecast deliveries query...');
    
    const forecastDeliveriesResult = await db.execute(sql`
      SELECT 
        delivery_week,
        COUNT(*) as forecast_count,
        SUM(quantity) as total_units,
        json_agg(
          json_build_object(
            'id', id,
            'skuName', 'Unknown SKU',
            'quantity', quantity,
            'organization', 'BDI',
            'status', status,
            'confidence', confidence
          )
        ) as forecasts
      FROM sales_forecasts
      WHERE delivery_week IS NOT NULL
      GROUP BY delivery_week
      ORDER BY delivery_week
    `)

    const forecastDeliveries = (forecastDeliveriesResult as any).map((row: any) => ({
      deliveryWeek: row.delivery_week,
      deliveryDate: row.delivery_week, // Use delivery week as date for now
      forecasts: row.forecasts || [],
      totalUnits: Number(row.total_units || 0)
    }))

    console.log('📊 Forecast Deliveries API Debug:', {
      totalRows: forecastDeliveriesResult.length,
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
