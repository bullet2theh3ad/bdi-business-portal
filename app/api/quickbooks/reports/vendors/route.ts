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

    // Get all vendors
    const { data: vendors, error: vendorsError } = await supabaseService
      .from('quickbooks_vendors')
      .select('id, qb_vendor_id, display_name, primary_email, balance')
      .order('display_name');

    if (vendorsError) throw vendorsError;

    // Get all expenses to calculate spending per vendor
    const { data: expenses, error: expensesError } = await supabaseService
      .from('quickbooks_expenses')
      .select('qb_vendor_id, total_amount');

    if (expensesError) throw expensesError;

    // Get all bills to calculate spending per vendor
    const { data: bills, error: billsError } = await supabaseService
      .from('quickbooks_bills')
      .select('qb_vendor_id, total_amount');

    if (billsError) throw billsError;

    // Aggregate expense and bill data per vendor
    const vendorStats = (vendors || []).map((vendor) => {
      const vendorExpenses = (expenses || []).filter(
        (exp) => exp.qb_vendor_id === vendor.qb_vendor_id
      );
      const vendorBills = (bills || []).filter(
        (bill) => bill.qb_vendor_id === vendor.qb_vendor_id
      );

      const expenseTotal = vendorExpenses.reduce(
        (sum, exp) => sum + Number(exp.total_amount || 0),
        0
      );
      const billTotal = vendorBills.reduce(
        (sum, bill) => sum + Number(bill.total_amount || 0),
        0
      );
      const totalSpent = expenseTotal + billTotal;
      const expenseCount = vendorExpenses.length + vendorBills.length;

      return {
        id: vendor.id,
        displayName: vendor.display_name,
        email: vendor.primary_email,
        balance: Number(vendor.balance || 0),
        totalSpent,
        expenseCount,
      };
    });

    // Sort by balance (descending) to show vendors with highest AP first
    vendorStats.sort((a, b) => b.balance - a.balance);

    return NextResponse.json(vendorStats);

  } catch (error) {
    console.error('Error in GET /api/quickbooks/reports/vendors:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

