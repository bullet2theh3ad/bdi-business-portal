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

    // Get all expenses
    const { data: expenses, error } = await supabaseService
      .from('quickbooks_expenses')
      .select('id, vendor_name, expense_date, total_amount, payment_type, category')
      .gte('expense_date', startDate.toISOString().split('T')[0])
      .order('expense_date', { ascending: false });

    if (error) throw error;

    const expensesFormatted = (expenses || []).map((expense) => ({
      id: expense.id,
      vendorName: expense.vendor_name,
      date: expense.expense_date,
      amount: Number(expense.total_amount || 0),
      paymentType: expense.payment_type,
      category: expense.category || 'Uncategorized',
    }));

    return NextResponse.json(expensesFormatted);

  } catch (error) {
    console.error('Error in GET /api/quickbooks/reports/expenses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

