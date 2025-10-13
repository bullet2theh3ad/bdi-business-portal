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

    // Get all unpaid invoices
    const { data: invoices, error } = await supabaseService
      .from('quickbooks_invoices')
      .select('balance, due_date, payment_status')
      .neq('payment_status', 'Paid')
      .gt('balance', 0);

    if (error) throw error;

    const today = new Date();
    const buckets = {
      current: { label: 'Current (0-30 days)', amount: 0, count: 0 },
      days30: { label: '31-60 days', amount: 0, count: 0 },
      days60: { label: '61-90 days', amount: 0, count: 0 },
      days90: { label: 'Over 90 days', amount: 0, count: 0 },
    };

    // Calculate days overdue for each invoice
    (invoices || []).forEach((invoice) => {
      const balance = Number(invoice.balance || 0);
      if (balance <= 0) return;

      const dueDate = new Date(invoice.due_date);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysOverdue <= 30) {
        buckets.current.amount += balance;
        buckets.current.count++;
      } else if (daysOverdue <= 60) {
        buckets.days30.amount += balance;
        buckets.days30.count++;
      } else if (daysOverdue <= 90) {
        buckets.days60.amount += balance;
        buckets.days60.count++;
      } else {
        buckets.days90.amount += balance;
        buckets.days90.count++;
      }
    });

    // Calculate total and percentages
    const totalAR = Object.values(buckets).reduce((sum, bucket) => sum + bucket.amount, 0);
    
    const result = Object.values(buckets).map(bucket => ({
      label: bucket.label,
      amount: bucket.amount,
      count: bucket.count,
      percentage: totalAR > 0 ? (bucket.amount / totalAR) * 100 : 0,
    }));

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in GET /api/quickbooks/reports/ar-aging:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

