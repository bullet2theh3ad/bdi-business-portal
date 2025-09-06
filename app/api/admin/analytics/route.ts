import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/drizzle'
import { 
  invoices, 
  purchaseOrders, 
  productSkus, 
  organizations,
  shipments,
  invoiceLineItems,
  purchaseOrderLineItems
} from '@/lib/db/schema'
import { eq, sql, and, gte, desc } from 'drizzle-orm'

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
      .select({ role: sql`role` })
      .from(sql`users`)
      .where(sql`auth_id = ${authUser.id}`)
      .limit(1)

    if (!userData || !['super_admin', 'admin'].includes(userData.role as string)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'month'
    const metric = searchParams.get('metric') || 'count'

    // Calculate date range based on period
    const now = new Date()
    let startDate: Date
    let dateFormat: string
    let intervals: number

    switch (period) {
      case 'day':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days
        dateFormat = 'YYYY-MM-DD'
        intervals = 30
        break
      case 'week':
        startDate = new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000) // 12 weeks
        dateFormat = 'YYYY-"W"WW'
        intervals = 12
        break
      case 'year':
        startDate = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000) // 5 years
        dateFormat = 'YYYY'
        intervals = 5
        break
      default: // month
        startDate = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000) // 12 months
        dateFormat = 'YYYY-MM'
        intervals = 12
        break
    }

    // Fetch summary data using direct SQL for sales_forecasts table
    const [
      invoiceStats,
      poStats,
      forecastStats,
      skuStats,
      orgStats,
      shipmentStats
    ] = await Promise.all([
      // Invoice statistics
      db
        .select({
          count: sql<number>`COUNT(*)::int`,
          totalValue: sql<number>`COALESCE(SUM(${invoices.totalValue}), 0)::numeric`,
          avgValue: sql<number>`COALESCE(AVG(${invoices.totalValue}), 0)::numeric`,
          units: sql<number>`COALESCE(SUM(${invoiceLineItems.quantity}), 0)::int`
        })
        .from(invoices)
        .leftJoin(invoiceLineItems, eq(invoices.id, invoiceLineItems.invoiceId))
        .then(result => result[0]),

      // Purchase Order statistics
      db
        .select({
          count: sql<number>`COUNT(*)::int`,
          totalValue: sql<number>`COALESCE(SUM(${purchaseOrders.totalValue}), 0)::numeric`,
          avgValue: sql<number>`COALESCE(AVG(${purchaseOrders.totalValue}), 0)::numeric`,
          units: sql<number>`COALESCE(SUM(${purchaseOrderLineItems.quantity}), 0)::int`
        })
        .from(purchaseOrders)
        .leftJoin(purchaseOrderLineItems, eq(purchaseOrders.id, purchaseOrderLineItems.purchaseOrderId))
        .then(result => result[0]),

      // Forecast statistics (using raw SQL for sales_forecasts table)
      db.execute(sql`
        SELECT 
          COUNT(*)::int as count,
          COALESCE(SUM(quantity), 0)::int as total_units,
          COALESCE(AVG(quantity), 0)::numeric as avg_units,
          COUNT(DISTINCT sku_id)::int as sku_count
        FROM sales_forecasts
      `).then(result => {
        const rows = result as any;
        return rows.length > 0 ? rows[0] : { count: 0, total_units: 0, avg_units: 0, sku_count: 0 };
      }),

      // SKU statistics
      db
        .select({
          totalCount: sql<number>`COUNT(*)::int`,
          activeCount: sql<number>`COUNT(*) FILTER (WHERE ${productSkus.isActive} = true)::int`
        })
        .from(productSkus)
        .then(result => result[0]),

      // Organization statistics
      db
        .select({
          totalCount: sql<number>`COUNT(*)::int`,
          activeCount: sql<number>`COUNT(*) FILTER (WHERE ${organizations.isActive} = true)::int`
        })
        .from(organizations)
        .then(result => result[0]),

      // Shipment statistics (using raw SQL)
      db.execute(sql`
        SELECT 
          COUNT(s.*)::int as count,
          COALESCE(SUM(sf.quantity), 0)::int as total_units
        FROM shipments s
        LEFT JOIN sales_forecasts sf ON s.forecast_id = sf.id
      `).then(result => (result as any)[0] || { count: 0, total_units: 0 })
    ])

    // Fetch simplified time series data (last 30 days for now)
    const timeSeriesResult = await db.execute(sql`
      WITH RECURSIVE date_series AS (
        SELECT CURRENT_DATE - INTERVAL '29 days' AS date
        UNION ALL
        SELECT date + INTERVAL '1 day'
        FROM date_series
        WHERE date < CURRENT_DATE
      )
      SELECT 
        date_series.date::text as date,
        COALESCE(i.count, 0) as invoices,
        COALESCE(po.count, 0) as purchase_orders,
        COALESCE(f.count, 0) as forecasts,
        COALESCE(i.value, 0) as invoice_value,
        COALESCE(po.value, 0) as po_value,
        COALESCE(i.units + po.units + f.units, 0) as units
      FROM date_series
      LEFT JOIN (
        SELECT 
          DATE(created_at) as date,
          COUNT(*)::int as count,
          COALESCE(SUM(total_value), 0)::numeric as value,
          0 as units
        FROM invoices
        WHERE created_at >= CURRENT_DATE - INTERVAL '29 days'
        GROUP BY DATE(created_at)
      ) i ON date_series.date = i.date
      LEFT JOIN (
        SELECT 
          DATE(created_at) as date,
          COUNT(*)::int as count,
          COALESCE(SUM(total_value), 0)::numeric as value,
          0 as units
        FROM purchase_orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '29 days'
        GROUP BY DATE(created_at)
      ) po ON date_series.date = po.date
      LEFT JOIN (
        SELECT 
          DATE(created_at) as date,
          COUNT(*)::int as count,
          COALESCE(SUM(quantity), 0)::int as units
        FROM forecasts
        WHERE created_at >= CURRENT_DATE - INTERVAL '29 days'
        GROUP BY DATE(created_at)
      ) f ON date_series.date = f.date
      ORDER BY date_series.date
    `)

    // Format response
    const response = {
      summary: {
        invoices: {
          count: Number(invoiceStats?.count || 0),
          totalValue: Number(invoiceStats?.totalValue || 0),
          avgValue: Number(invoiceStats?.avgValue || 0),
          units: Number(invoiceStats?.units || 0)
        },
        purchaseOrders: {
          count: Number(poStats?.count || 0),
          totalValue: Number(poStats?.totalValue || 0),
          avgValue: Number(poStats?.avgValue || 0),
          units: Number(poStats?.units || 0)
        },
        forecasts: {
          count: Number(forecastStats?.count || 0),
          totalUnits: Number(forecastStats?.total_units || 0),
          avgUnits: Number(forecastStats?.avg_units || 0),
          skuCount: Number(forecastStats?.sku_count || 0)
        },
        skus: {
          totalCount: Number(skuStats?.totalCount || 0),
          activeCount: Number(skuStats?.activeCount || 0)
        },
        organizations: {
          totalCount: Number(orgStats?.totalCount || 0),
          activeCount: Number(orgStats?.activeCount || 0)
        },
        shipments: {
          count: Number(shipmentStats?.count || 0),
          totalUnits: Number(shipmentStats?.total_units || 0)
        }
      },
      timeSeries: (timeSeriesResult as any).map((row: any) => ({
        date: row.date,
        invoices: Number(row.invoices || 0),
        purchaseOrders: Number(row.purchase_orders || 0),
        forecasts: Number(row.forecasts || 0),
        invoiceValue: Number(row.invoice_value || 0),
        poValue: Number(row.po_value || 0),
        units: Number(row.units || 0)
      }))
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error in analytics API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
