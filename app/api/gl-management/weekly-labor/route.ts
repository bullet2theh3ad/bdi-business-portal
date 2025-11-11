import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessQuickBooks } from '@/lib/feature-flags';

/**
 * GET /api/gl-management/weekly-labor
 * Fetch all GL transactions categorized as Labor and aggregate by week
 * 
 * Query params:
 * - startDate: Filter transactions from this date (ISO format)
 * - endDate: Filter transactions to this date (ISO format)
 */
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check feature flag access
    if (!canAccessQuickBooks(user.email)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    console.log(`📅 [Weekly Labor] Fetching labor data from ${startDate || 'all'} to ${endDate || 'all'}`);

    // Create service client for database queries
    const { createClient } = require('@supabase/supabase-js');
    const supabaseService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Fetch overrides for labor categorizations
    const { data: overrides, error: overridesError } = await supabaseService
      .from('gl_transaction_overrides')
      .select('*')
      .eq('override_category', 'labor');

    if (overridesError) {
      console.error('❌ [Weekly Labor] Error fetching overrides:', overridesError);
      return NextResponse.json({ error: 'Failed to fetch overrides' }, { status: 500 });
    }

    // Fetch ALL bank statements (we'll filter for labor patterns below)
    let bankQuery = supabaseService
      .from('bank_statements')
      .select('*');

    // Apply date filters if provided
    if (startDate) {
      bankQuery = bankQuery.gte('transaction_date', startDate);
    }
    if (endDate) {
      bankQuery = bankQuery.lte('transaction_date', endDate);
    }

    const { data: bankStatements, error: bankError } = await bankQuery;

    if (bankError) {
      console.error('❌ [Weekly Labor] Error fetching bank statements:', bankError);
      // Continue processing even if bank statements fail
    }

    console.log(`💼 [Weekly Labor] Found ${overrides?.length || 0} labor overrides`);
    console.log(`💰 [Weekly Labor] Found ${bankStatements?.length || 0} labor bank statements`);

    // Build override map
    const overrideMap = new Map();
    (overrides || []).forEach((override: any) => {
      const key = `${override.transaction_source}:${override.transaction_id}${override.line_item_index !== null ? `:${override.line_item_index}` : ''}`;
      overrideMap.set(key, override);
    });

    // Fetch QuickBooks transactions
    const { data: expenses } = await supabaseService.from('quickbooks_expenses').select('*');
    const { data: bills } = await supabaseService.from('quickbooks_bills').select('*');
    const { data: payments } = await supabaseService.from('quickbooks_payments').select('*');

    interface WeeklyLaborData {
      weekStart: string;
      weekEnd: string;
      totalAmount: number;
      transactionCount: number;
      breakdown: {
        payroll: number;
        payrollTaxes: number;
        benefits: number;
        payrollCharges: number;
      };
      transactions: Array<{
        date: string;
        description: string;
        amount: number;
        source: string;
        accountType: string;
      }>;
    }

    // Helper to get week start (Monday) from a date
    // MUST match Cash Flow Runway's getMondayOfWeek() logic exactly!
    const getWeekStart = (date: Date): string => {
      const d = new Date(date);
      const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const diff = (day + 6) % 7; // Days to subtract to get to Monday
      d.setDate(d.getDate() - diff);
      d.setHours(0, 0, 0, 0);
      return d.toISOString().split('T')[0];
    };

    // Helper to get week end (Sunday)
    const getWeekEnd = (weekStart: string): string => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + 6);
      return d.toISOString().split('T')[0];
    };

    // Map to store weekly aggregated data
    const weeklyDataMap = new Map<string, WeeklyLaborData>();

    // Helper to add transaction to weekly data
    const addToWeekly = (
      date: string,
      amount: number,
      description: string,
      source: string,
      accountType: string
    ) => {
      if (!date || amount <= 0) return;

      // Apply date filter
      if (startDate && date < startDate) return;
      if (endDate && date > endDate) return;

      const weekStart = getWeekStart(new Date(date));
      const weekEnd = getWeekEnd(weekStart);

      if (!weeklyDataMap.has(weekStart)) {
        weeklyDataMap.set(weekStart, {
          weekStart,
          weekEnd,
          totalAmount: 0,
          transactionCount: 0,
          breakdown: {
            payroll: 0,
            payrollTaxes: 0,
            benefits: 0,
            payrollCharges: 0,
          },
          transactions: [],
        });
      }

      const weekData = weeklyDataMap.get(weekStart)!;
      weekData.totalAmount += amount;
      weekData.transactionCount += 1;

      // Update breakdown based on account type
      if (accountType === 'Payroll') {
        weekData.breakdown.payroll += amount;
      } else if (accountType === 'Payroll Taxes') {
        weekData.breakdown.payrollTaxes += amount;
      } else if (accountType === 'Benefits') {
        weekData.breakdown.benefits += amount;
      } else if (accountType === 'Payroll Charges') {
        weekData.breakdown.payrollCharges += amount;
      }

      weekData.transactions.push({
        date,
        description: description.substring(0, 100),
        amount,
        source,
        accountType,
      });
    };

    // Process QB Expenses
    (expenses || []).forEach((expense: any) => {
      const overrideKey = `expense:${expense.qb_expense_id}`;
      const override = overrideMap.get(overrideKey);

      if (override) {
        const accountType = override.override_account_type || 'Payroll';
        addToWeekly(
          expense.txn_date,
          Math.abs(parseFloat(expense.total_amt) || 0),
          expense.private_note || 'Labor expense',
          'QuickBooks Expense',
          accountType
        );
      } else if (expense.line_items) {
        // Check line items
        const lineItems = typeof expense.line_items === 'string' 
          ? JSON.parse(expense.line_items) 
          : expense.line_items;
        
        (lineItems || []).forEach((line: any, index: number) => {
          const lineOverrideKey = `expense:${expense.qb_expense_id}:${line.LineNum || line.Id || index}`;
          const lineOverride = overrideMap.get(lineOverrideKey);

          if (lineOverride) {
            const accountType = lineOverride.override_account_type || 'Payroll';
            addToWeekly(
              expense.txn_date,
              Math.abs(parseFloat(line.Amount) || 0),
              line.Description || expense.private_note || 'Labor expense',
              'QuickBooks Expense',
              accountType
            );
          }
        });
      }
    });

    // Process QB Bills
    (bills || []).forEach((bill: any) => {
      const overrideKey = `bill:${bill.qb_bill_id}`;
      const override = overrideMap.get(overrideKey);

      if (override) {
        const accountType = override.override_account_type || 'Payroll';
        addToWeekly(
          bill.txn_date,
          Math.abs(parseFloat(bill.total_amt) || 0),
          bill.private_note || `Bill from ${bill.vendor_name}`,
          'QuickBooks Bill',
          accountType
        );
      } else if (bill.line_items) {
        // Check line items
        const lineItems = typeof bill.line_items === 'string' 
          ? JSON.parse(bill.line_items) 
          : bill.line_items;
        
        (lineItems || []).forEach((line: any, index: number) => {
          const lineOverrideKey = `bill:${bill.qb_bill_id}:${line.LineNum || line.Id || index}`;
          const lineOverride = overrideMap.get(lineOverrideKey);

          if (lineOverride) {
            const accountType = lineOverride.override_account_type || 'Payroll';
            addToWeekly(
              bill.txn_date,
              Math.abs(parseFloat(line.Amount) || 0),
              line.Description || bill.private_note || `Bill from ${bill.vendor_name}`,
              'QuickBooks Bill',
              accountType
            );
          }
        });
      }
    });

    // Process Bank Statements (both manual categorizations and auto-detected labor)
    (bankStatements || []).forEach((stmt: any) => {
      const amount = Math.abs(parseFloat(stmt.amount) || 0);
      if (amount <= 0) return;

      const description = (stmt.description || '').toUpperCase();
      let accountType = stmt.account_type || null;
      let isLabor = false;

      // Check if manually categorized as labor
      if (stmt.category === 'labor') {
        isLabor = true;
        accountType = accountType || 'Payroll';
      } else {
        // Auto-detect labor patterns
        if (description.includes('334843 BOUNDLESS')) {
          isLabor = true;
          accountType = 'Payroll';
        } else if (description.includes('PAYLOCITY') && (description.includes('TAX') || description.includes('CORPOR') || description.includes('COPOR'))) {
          isLabor = true;
          accountType = 'Payroll Taxes';
        } else if (description.includes('EMPOWER') || description.includes('WEX HEALTH') || 
                   description.includes('COLONIAL LIFE') || description.includes('UNITED HEALTHCAR')) {
          isLabor = true;
          accountType = 'Benefits';
        }
      }

      // Only add if it's a labor transaction
      if (isLabor) {
        addToWeekly(
          stmt.transaction_date,
          amount,
          stmt.description || 'Bank transaction',
          'Bank Statement',
          accountType || 'Payroll'
        );
      }
    });

    // Convert map to sorted array
    const weeklyData = Array.from(weeklyDataMap.values()).sort((a, b) => 
      a.weekStart.localeCompare(b.weekStart)
    );

    console.log(`📊 [Weekly Labor] Aggregated into ${weeklyData.length} weeks`);
    weeklyData.forEach(week => {
      console.log(`  📅 Week ${week.weekStart}: $${week.totalAmount.toFixed(2)} (${week.transactionCount} transactions)`);
    });

    return NextResponse.json({ 
      success: true, 
      data: weeklyData,
      summary: {
        totalWeeks: weeklyData.length,
        totalAmount: weeklyData.reduce((sum, w) => sum + w.totalAmount, 0),
        totalTransactions: weeklyData.reduce((sum, w) => sum + w.transactionCount, 0),
      }
    });

  } catch (error) {
    console.error('❌ [Weekly Labor] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weekly labor data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

