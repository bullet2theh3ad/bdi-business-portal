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

    // Get invoice data by organization for the last 12 months
    const invoicesByOrgResult = await db.execute(sql`
      WITH months AS (
        SELECT 
          generate_series(
            date_trunc('month', CURRENT_DATE - INTERVAL '11 months'),
            date_trunc('month', CURRENT_DATE),
            '1 month'::interval
          ) AS month
      )
      SELECT 
        to_char(m.month, 'Mon YYYY') as month,
        COALESCE(
          (
            SELECT json_object_agg(
              customer_name,
              json_build_object(
                'value', total_value,
                'count', invoice_count
              )
            )
            FROM (
              SELECT 
                customer_name,
                COUNT(*)::int as invoice_count,
                SUM(total_value)::numeric as total_value
              FROM invoices
              WHERE date_trunc('month', created_at) = m.month
                AND customer_name IS NOT NULL
              GROUP BY customer_name
            ) org_data
          ),
          '{}'::json
        ) as organizations,
        COALESCE(
          (
            SELECT SUM(total_value)::numeric
            FROM invoices
            WHERE date_trunc('month', created_at) = m.month
          ),
          0
        ) as total
      FROM months m
      ORDER BY m.month
    `)

    const invoicesByOrg = (invoicesByOrgResult as any).map((row: any) => ({
      month: row.month,
      organizations: row.organizations || {},
      total: Number(row.total || 0)
    }))

    return NextResponse.json(invoicesByOrg)

  } catch (error) {
    console.error('Error in invoices by org API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
