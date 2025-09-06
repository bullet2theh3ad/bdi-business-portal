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

    // Get forecast delivery data for the next 16 weeks using actual data structure
    const forecastDeliveriesResult = await db.execute(sql`
      WITH weeks AS (
        SELECT 
          to_char(
            date_trunc('week', CURRENT_DATE) + (n || ' weeks')::interval,
            'YYYY-"W"WW'
          ) as delivery_week,
          date_trunc('week', CURRENT_DATE) + (n || ' weeks')::interval as delivery_date
        FROM generate_series(0, 15) n
      )
      SELECT 
        w.delivery_week,
        w.delivery_date::text,
        COALESCE(
          json_agg(
            json_build_object(
              'id', sf.id,
              'skuName', ps.name,
              'quantity', sf.quantity,
              'organization', 'BDI',
              'status', sf.status,
              'confidence', sf.confidence
            )
          ) FILTER (WHERE sf.id IS NOT NULL),
          '[]'::json
        ) as forecasts,
        COALESCE(SUM(sf.quantity), 0)::int as total_units
      FROM weeks w
      LEFT JOIN sales_forecasts sf ON w.delivery_week = sf.delivery_week
      LEFT JOIN product_skus ps ON sf.sku_id = ps.id
      GROUP BY w.delivery_week, w.delivery_date
      ORDER BY w.delivery_date
    `)

    const forecastDeliveries = (forecastDeliveriesResult as any).map((row: any) => ({
      deliveryWeek: row.delivery_week,
      deliveryDate: row.delivery_date,
      forecasts: row.forecasts || [],
      totalUnits: Number(row.total_units || 0)
    }))

    return NextResponse.json(forecastDeliveries)

  } catch (error) {
    console.error('Error in forecast deliveries API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
