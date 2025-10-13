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

    // Get days parameter
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '60');
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

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

    // Get all data
    const [invoicesData, customersData, vendorsData, expensesData] = await Promise.all([
      supabaseService
        .from('quickbooks_invoices')
        .select('total_amount, balance, invoice_date, payment_status, due_date')
        .gte('invoice_date', startDate.toISOString().split('T')[0]),
      supabaseService.from('quickbooks_customers').select('id, balance'),
      supabaseService.from('quickbooks_vendors').select('id, balance'),
      supabaseService
        .from('quickbooks_expenses')
        .select('total_amount, expense_date')
        .gte('expense_date', startDate.toISOString().split('T')[0]),
    ]);

    const invoices = invoicesData.data || [];
    const customers = customersData.data || [];
    const vendors = vendorsData.data || [];
    const expenses = expensesData.data || [];

    // Calculate metrics
    const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
    const totalAR = invoices.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);
    const totalAP = vendors.reduce((sum, v) => sum + Number(v.balance || 0), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.total_amount || 0), 0);
    
    const activeCustomers = customers.filter(c => Number(c.balance || 0) > 0).length;
    const activeVendors = vendors.filter(v => Number(v.balance || 0) > 0).length;
    
    const unpaidInvoices = invoices.filter(inv => 
      inv.payment_status !== 'Paid' && Number(inv.balance || 0) > 0
    ).length;
    
    const today = new Date().toISOString().split('T')[0];
    const overdueInvoices = invoices.filter(inv => 
      inv.due_date < today && Number(inv.balance || 0) > 0
    ).length;
    
    const avgInvoiceValue = invoices.length > 0 ? totalRevenue / invoices.length : 0;
    
    // Calculate monthly burn rate (expenses per month)
    const monthlyBurnRate = days >= 30 ? (totalExpenses / days) * 30 : totalExpenses;

    return NextResponse.json({
      totalRevenue,
      totalAR,
      totalAP,
      totalExpenses,
      activeCustomers,
      activeVendors,
      unpaidInvoices,
      overdueInvoices,
      avgInvoiceValue,
      monthlyBurnRate,
    });

  } catch (error) {
    console.error('Error in GET /api/quickbooks/reports/metrics:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

