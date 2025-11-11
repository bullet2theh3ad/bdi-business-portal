import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessQuickBooks } from '@/lib/feature-flags';

/**
 * GET /api/gl-management/weekly-nre
 * Fetch all GL transactions categorized as NRE and aggregate by week
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

    console.log(`🔬 [Weekly NRE] Fetching NRE data from ${startDate || 'all'} to ${endDate || 'all'}`);

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

    // Fetch NRE overrides (bills and expenses categorized as NRE)
    let overridesQuery = supabaseService
      .from('gl_transaction_overrides')
      .select('*')
      .eq('override_category', 'nre');

    const { data: nreOverrides, error: overridesError } = await overridesQuery;

    if (overridesError) {
      console.error('Error fetching NRE overrides:', overridesError);
      return NextResponse.json({ error: 'Failed to fetch NRE overrides' }, { status: 500 });
    }

    console.log(`💼 [Weekly NRE] Found ${nreOverrides?.length || 0} NRE overrides`);

    // Build override map for quick lookup
    const overrideMap = new Map();
    (nreOverrides || []).forEach((override: any) => {
      overrideMap.set(override.transaction_key, override);
    });
    
    // Debug: Show sample override keys
    const sampleKeys = Array.from(overrideMap.keys()).slice(0, 5);
    console.log(`🔑 [Weekly NRE] Sample override keys:`, sampleKeys);

    // Fetch QuickBooks Bills
    let billsQuery = supabaseService
      .from('quickbooks_bills')
      .select('*');

    if (startDate) billsQuery = billsQuery.gte('bill_date', startDate);
    if (endDate) billsQuery = billsQuery.lte('bill_date', endDate);

    const { data: bills, error: billsError } = await billsQuery;
    if (billsError) {
      console.error('Error fetching bills:', billsError);
      return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
    }
    console.log(`📄 [Weekly NRE] Found ${bills?.length || 0} bills`);

    // Fetch QuickBooks Expenses
    let expensesQuery = supabaseService
      .from('quickbooks_expenses')
      .select('*');

    if (startDate) expensesQuery = expensesQuery.gte('expense_date', startDate);
    if (endDate) expensesQuery = expensesQuery.lte('expense_date', endDate);

    const { data: expenses, error: expensesError } = await expensesQuery;
    if (expensesError) {
      console.error('Error fetching expenses:', expensesError);
      return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
    }
    console.log(`💳 [Weekly NRE] Found ${expenses?.length || 0} expenses`);

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

    // Map to store weekly data
    const weeklyDataMap = new Map<string, {
      weekStart: string;
      weekEnd: string;
      totalAmount: number;
      transactionCount: number;
      breakdown: {
        devOps: number;
        firmwareDevelopment: number;
        certifications: number;
        design: number;
        other: number;
      };
      transactions: Array<{
        date: string;
        amount: number;
        vendor: string;
        source: string;
        accountType: string;
      }>;
    }>();

    const addToWeekly = (
      date: string,
      amount: number,
      vendor: string,
      source: string,
      accountType: string
    ) => {
      if (!date || amount === 0) return;

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
            devOps: 0,
            firmwareDevelopment: 0,
            certifications: 0,
            design: 0,
            other: 0,
          },
          transactions: [],
        });
      }

      const weekData = weeklyDataMap.get(weekStart)!;
      weekData.totalAmount += amount;
      weekData.transactionCount++;

      // Categorize by account type
      const lowerAccountType = (accountType || '').toLowerCase();
      if (lowerAccountType.includes('devops')) {
        weekData.breakdown.devOps += amount;
      } else if (lowerAccountType.includes('firmware')) {
        weekData.breakdown.firmwareDevelopment += amount;
      } else if (lowerAccountType.includes('certification')) {
        weekData.breakdown.certifications += amount;
      } else if (lowerAccountType.includes('design')) {
        weekData.breakdown.design += amount;
      } else {
        weekData.breakdown.other += amount;
      }

      weekData.transactions.push({
        date,
        amount,
        vendor,
        source,
        accountType: accountType || 'Unspecified',
      });
    };

    // Process Bills
    let billsProcessed = 0;
    let billsWithNRE = 0;
    (bills || []).forEach((bill: any) => {
      const lineItems = typeof bill.line_items === 'string' ? JSON.parse(bill.line_items) : (bill.line_items || []);
      billsProcessed++;
      
      lineItems.forEach((line: any, index: number) => {
        const lineNum = line.LineNum || line.Id || (index + 1);
        const overrideKey = `bill:${bill.qb_bill_id}:${lineNum}`;
        const parentOverrideKey = `bill:${bill.qb_bill_id}:`;
        const rawIdKey = bill.qb_bill_id; // Try just the QB ID
        const override = overrideMap.get(overrideKey) || overrideMap.get(parentOverrideKey) || overrideMap.get(rawIdKey);

        if (override) {
          billsWithNRE++;
          addToWeekly(
            bill.bill_date,
            Math.abs(parseFloat(line.Amount) || 0),
            bill.vendor_name || 'Unknown Vendor',
            'QuickBooks Bill',
            override.override_account_type || 'Unspecified'
          );
        }
      });
    });
    console.log(`✅ [Weekly NRE] Processed ${billsProcessed} bills, ${billsWithNRE} had NRE overrides`);

    // Process Expenses
    let expensesProcessed = 0;
    let expensesWithNRE = 0;
    (expenses || []).forEach((expense: any) => {
      const lineItems = typeof expense.line_items === 'string' ? JSON.parse(expense.line_items) : (expense.line_items || []);
      expensesProcessed++;
      
      lineItems.forEach((line: any, index: number) => {
        const lineNum = line.LineNum || line.Id || (index + 1);
        const overrideKey = `expense:${expense.qb_expense_id}:${lineNum}`;
        const parentOverrideKey = `expense:${expense.qb_expense_id}:`;
        const rawIdKey = expense.qb_expense_id; // Try just the QB ID
        const override = overrideMap.get(overrideKey) || overrideMap.get(parentOverrideKey) || overrideMap.get(rawIdKey);

        if (override) {
          expensesWithNRE++;
          addToWeekly(
            expense.expense_date,
            Math.abs(parseFloat(line.Amount) || 0),
            expense.payee_name || 'Unknown Payee',
            'QuickBooks Expense',
            override.override_account_type || 'Unspecified'
          );
        }
      });
    });
    console.log(`✅ [Weekly NRE] Processed ${expensesProcessed} expenses, ${expensesWithNRE} had NRE overrides`);

    // Convert map to sorted array
    const weeklyData = Array.from(weeklyDataMap.values()).sort((a, b) => 
      a.weekStart.localeCompare(b.weekStart)
    );

    console.log(`📊 [Weekly NRE] Aggregated into ${weeklyData.length} weeks`);
    weeklyData.forEach(week => {
      console.log(`  📅 Week ${week.weekStart}: $${week.totalAmount.toFixed(2)} (${week.transactionCount} transactions)`);
      console.log(`     🔬 DevOps: $${week.breakdown.devOps.toFixed(2)} | Firmware: $${week.breakdown.firmwareDevelopment.toFixed(2)} | Certifications: $${week.breakdown.certifications.toFixed(2)} | Design: $${week.breakdown.design.toFixed(2)}`);
    });

    const summary = {
      totalAmount: weeklyData.reduce((sum, week) => sum + week.totalAmount, 0),
      totalTransactions: weeklyData.reduce((sum, week) => sum + week.transactionCount, 0),
      totalWeeks: weeklyData.length,
    };

    return NextResponse.json({
      weeklyData,
      summary,
    });
  } catch (error) {
    console.error('❌ Error fetching weekly NRE:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weekly NRE data' },
      { status: 500 }
    );
  }
}

