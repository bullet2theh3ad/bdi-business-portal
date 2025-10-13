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
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Use service role for data access
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

    // Get all customers
    const { data: customers, error: customersError } = await supabaseService
      .from('quickbooks_customers')
      .select('id, qb_customer_id, display_name, primary_email, balance')
      .order('display_name');

    if (customersError) throw customersError;

    // Get all invoices to calculate stats per customer
    const { data: invoices, error: invoicesError } = await supabaseService
      .from('quickbooks_invoices')
      .select('qb_customer_id, total_amount, balance, payment_status, due_date');

    if (invoicesError) throw invoicesError;

    const today = new Date().toISOString().split('T')[0];

    // Aggregate invoice data per customer
    const customerStats = (customers || []).map((customer) => {
      const customerInvoices = (invoices || []).filter(
        (inv) => inv.qb_customer_id === customer.qb_customer_id
      );

      const totalInvoices = customerInvoices.length;
      const paidInvoices = customerInvoices.filter((inv) => inv.payment_status === 'Paid').length;
      const overdueAmount = customerInvoices
        .filter((inv) => inv.due_date < today && Number(inv.balance || 0) > 0)
        .reduce((sum, inv) => sum + Number(inv.balance || 0), 0);

      return {
        id: customer.id,
        displayName: customer.display_name,
        email: customer.primary_email,
        balance: Number(customer.balance || 0),
        totalInvoices,
        paidInvoices,
        overdueAmount,
      };
    });

    return NextResponse.json(customerStats);

  } catch (error) {
    console.error('Error in GET /api/quickbooks/reports/customers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

