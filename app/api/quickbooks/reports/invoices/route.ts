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

    // Get all invoices
    const { data: invoices, error } = await supabaseService
      .from('quickbooks_invoices')
      .select('id, qb_doc_number, customer_name, invoice_date, due_date, total_amount, balance, status, payment_status')
      .gte('invoice_date', startDate.toISOString().split('T')[0])
      .order('invoice_date', { ascending: false });

    if (error) throw error;

    const today = new Date();
    
    // Calculate days overdue for each invoice
    const invoicesWithOverdue = (invoices || []).map((invoice) => {
      const dueDate = new Date(invoice.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        id: invoice.id,
        docNumber: invoice.qb_doc_number,
        customerName: invoice.customer_name,
        date: invoice.invoice_date,
        dueDate: invoice.due_date,
        amount: Number(invoice.total_amount || 0),
        balance: Number(invoice.balance || 0),
        status: invoice.status,
        paymentStatus: invoice.payment_status,
        daysOverdue: daysOverdue > 0 ? daysOverdue : 0,
      };
    });

    return NextResponse.json(invoicesWithOverdue);

  } catch (error) {
    console.error('Error in GET /api/quickbooks/reports/invoices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

