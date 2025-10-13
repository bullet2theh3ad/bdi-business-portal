import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessQuickBooks } from '@/lib/feature-flags';

export async function GET(request: NextRequest) {
  try {
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

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check feature flag access
    if (!canAccessQuickBooks(user.email)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Use service role client to bypass RLS (we've already checked authorization)
    const supabaseService = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
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

    // Get counts from each QuickBooks table
    const [customersCount, invoicesCount, vendorsCount, expensesCount, itemsCount, paymentsCount, billsCount, salesReceiptsCount, creditMemosCount, posCount] = await Promise.all([
      supabaseService.from('quickbooks_customers').select('id', { count: 'exact', head: true }),
      supabaseService.from('quickbooks_invoices').select('id', { count: 'exact', head: true }),
      supabaseService.from('quickbooks_vendors').select('id', { count: 'exact', head: true }),
      supabaseService.from('quickbooks_expenses').select('id', { count: 'exact', head: true }),
      supabaseService.from('quickbooks_items').select('id', { count: 'exact', head: true }),
      supabaseService.from('quickbooks_payments').select('id', { count: 'exact', head: true }),
      supabaseService.from('quickbooks_bills').select('id', { count: 'exact', head: true }),
      supabaseService.from('quickbooks_sales_receipts').select('id', { count: 'exact', head: true }),
      supabaseService.from('quickbooks_credit_memos').select('id', { count: 'exact', head: true }),
      supabaseService.from('quickbooks_purchase_orders_qb').select('id', { count: 'exact', head: true }),
    ]);

    return NextResponse.json({
      stats: {
        customers: customersCount.count || 0,
        invoices: invoicesCount.count || 0,
        vendors: vendorsCount.count || 0,
        expenses: expensesCount.count || 0,
        items: itemsCount.count || 0,
        payments: paymentsCount.count || 0,
        bills: billsCount.count || 0,
        salesReceipts: salesReceiptsCount.count || 0,
        creditMemos: creditMemosCount.count || 0,
        purchaseOrders: posCount.count || 0,
      },
      message: 'Stats retrieved successfully'
    });

  } catch (error) {
    console.error('Error in GET /api/quickbooks/stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

