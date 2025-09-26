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

    // Get date range from query params
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0]
    const endDate = searchParams.get('endDate') || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Default to 1 year ahead

    // Get forecast delivery data - show ALL delivery weeks with forecasts (no date filtering for now)
    const forecastDeliveriesResult = await db.execute(sql`
      SELECT 
        sf.delivery_week,
        -- Convert delivery week to approximate date for chart display
        CASE 
          WHEN sf.delivery_week ~ '^\d{4}-W\d{2}$' THEN
            (SUBSTRING(sf.delivery_week, 1, 4)::int || '-01-01')::date + 
            (SUBSTRING(sf.delivery_week, 7, 2)::int - 1) * INTERVAL '7 days'
          ELSE CURRENT_DATE
        END as delivery_date,
        COALESCE(
          json_agg(
            json_build_object(
              'id', sf.id,
              'skuName', ps.name,
              'quantity', sf.quantity,
              'organization', COALESCE(o.code, 'BDI'),
              'status', sf.status,
              'confidence', sf.confidence
            )
          ),
          '[]'::json
        ) as forecasts,
        COALESCE(SUM(sf.quantity), 0)::int as total_units
      FROM sales_forecasts sf
      LEFT JOIN product_skus ps ON sf.sku_id = ps.id
      LEFT JOIN users u ON sf.created_by = u.auth_id
      LEFT JOIN organization_members om ON u.auth_id = om.user_auth_id
      LEFT JOIN organizations o ON om.organization_uuid = o.id
      WHERE sf.delivery_week IS NOT NULL
        AND sf.delivery_week ~ '^\d{4}-W\d{2}$'
      GROUP BY sf.delivery_week
      ORDER BY sf.delivery_week
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
