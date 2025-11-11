import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { canAccessQuickBooks } from '@/lib/feature-flags';

/**
 * GET /api/gl-management/weekly-revenue
 * Fetch all GL transactions categorized as Revenue and aggregate by week
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

    console.log(`💰 [Weekly Revenue] Fetching revenue data from ${startDate || 'all'} to ${endDate || 'all'}`);

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

    // Fetch overrides for revenue categorizations
    const { data: overrides, error: overridesError } = await supabaseService
      .from('gl_transaction_overrides')
      .select('*')
      .eq('override_category', 'revenue');

    if (overridesError) {
      console.error('❌ [Weekly Revenue] Error fetching overrides:', overridesError);
      return NextResponse.json({ error: 'Failed to fetch overrides' }, { status: 500 });
    }

    // Fetch ALL bank statements (we'll filter for revenue patterns below)
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
      console.error('❌ [Weekly Revenue] Error fetching bank statements:', bankError);
      // Continue processing even if bank statements fail
    }

    console.log(`💼 [Weekly Revenue] Found ${overrides?.length || 0} revenue overrides`);
    console.log(`💰 [Weekly Revenue] Found ${bankStatements?.length || 0} bank statements`);

    // Build override map
    const overrideMap = new Map();
    (overrides || []).forEach((override: any) => {
      const key = `${override.transaction_source}:${override.transaction_id}${override.line_item_index !== null ? `:${override.line_item_index}` : ''}`;
      overrideMap.set(key, override);
    });
    
    // Debug: Show first 5 override keys
    const sampleKeys = Array.from(overrideMap.keys()).slice(0, 5);
    console.log(`🔑 [Weekly Revenue] Sample override keys:`, sampleKeys);

    // Fetch QuickBooks transactions
    const { data: deposits } = await supabaseService.from('quickbooks_deposits').select('*');
    const { data: payments } = await supabaseService.from('quickbooks_payments').select('*');

    console.log(`📦 [Weekly Revenue] Found ${deposits?.length || 0} deposits, ${payments?.length || 0} payments`);

    interface WeeklyRevenueData {
      weekStart: string;
      weekEnd: string;
      totalAmount: number;
      transactionCount: number;
      breakdown: {
        d2c: number;
        b2b: number;
        b2b_factored: number;
      };
      transactions: Array<{
        date: string;
        description: string;
        amount: number;
        source: string;
        revenueType: string;
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
    const weeklyDataMap = new Map<string, WeeklyRevenueData>();

    // Helper to add transaction to weekly data
    let addToWeeklyCallCount = 0;
    let addToWeeklySkippedNoDate = 0;
    let addToWeeklySkippedAmount = 0;
    let addToWeeklySkippedBeforeStart = 0;
    let addToWeeklySkippedAfterEnd = 0;
    let addToWeeklySuccessCount = 0;

    const addToWeekly = (
      date: string,
      amount: number,
      description: string,
      source: string,
      revenueType: string
    ) => {
      addToWeeklyCallCount++;
      
      if (!date) {
        addToWeeklySkippedNoDate++;
        return;
      }
      
      if (amount <= 0) {
        addToWeeklySkippedAmount++;
        return;
      }

      // Apply date filter
      if (startDate && date < startDate) {
        addToWeeklySkippedBeforeStart++;
        if (addToWeeklySkippedBeforeStart <= 2) {
          console.log(`⏪ [Weekly Revenue] Skipped (before start): ${date} < ${startDate}`);
        }
        return;
      }
      if (endDate && date > endDate) {
        addToWeeklySkippedAfterEnd++;
        if (addToWeeklySkippedAfterEnd <= 2) {
          console.log(`⏩ [Weekly Revenue] Skipped (after end): ${date} > ${endDate}`);
        }
        return;
      }

      const weekStart = getWeekStart(new Date(date));
      const weekEnd = getWeekEnd(weekStart);

      if (!weeklyDataMap.has(weekStart)) {
        weeklyDataMap.set(weekStart, {
          weekStart,
          weekEnd,
          totalAmount: 0,
          transactionCount: 0,
          breakdown: {
            d2c: 0,
            b2b: 0,
            b2b_factored: 0,
          },
          transactions: [],
        });
      }

      const weekData = weeklyDataMap.get(weekStart)!;
      weekData.totalAmount += amount;
      weekData.transactionCount += 1;
      addToWeeklySuccessCount++;

      // Update breakdown based on revenue type
      if (revenueType === 'D2C Sales') {
        weekData.breakdown.d2c += amount;
      } else if (revenueType === 'B2B Sales') {
        weekData.breakdown.b2b += amount;
      } else if (revenueType === 'B2B Sales (factored)') {
        weekData.breakdown.b2b_factored += amount;
      }

      weekData.transactions.push({
        date,
        description: description.substring(0, 100),
        amount,
        source,
        revenueType,
      });
    };

    // Process QB Deposits
    let depositMatches = 0;
    (deposits || []).forEach((deposit: any) => {
      const overrideKey = `deposit:${deposit.qb_deposit_id}`;
      const override = overrideMap.get(overrideKey);

      if (override) {
        depositMatches++;
        const revenueType = override.override_account_type || 'B2B Sales';
        addToWeekly(
          deposit.txn_date,
          Math.abs(parseFloat(deposit.total_amt) || 0),
          deposit.private_note || 'Deposit',
          'QuickBooks Deposit',
          revenueType
        );
      }
    });
    console.log(`✅ [Weekly Revenue] Matched ${depositMatches} deposits with revenue overrides`);

    // Process QB Payments
    let paymentMatches = 0;
    let paymentsAdded = 0;
    (payments || []).forEach((payment: any, index: number) => {
      const overrideKey = `payment:${payment.qb_payment_id}`;
      const override = overrideMap.get(overrideKey);

      if (override) {
        paymentMatches++;
        const revenueType = override.override_account_type || 'B2B Sales';
        const amount = Math.abs(parseFloat(payment.total_amount) || 0);
        
        // Debug first 3 payments
        if (paymentMatches <= 3) {
          console.log(`💵 [Weekly Revenue] Payment ${paymentMatches}:`, {
            id: payment.qb_payment_id,
            date: payment.payment_date,
            amount,
            customer: payment.customer_name,
            revenueType
          });
        }
        
        addToWeekly(
          payment.payment_date,
          amount,
          payment.reference_number || `Payment from ${payment.customer_name}`,
          'QuickBooks Payment',
          revenueType
        );
        paymentsAdded++;
      }
    });
    console.log(`✅ [Weekly Revenue] Matched ${paymentMatches} payments with revenue overrides`);
    console.log(`📋 [Weekly Revenue] Added ${paymentsAdded} payments to weekly aggregation`);

    // Process Bank Statements (both manual categorizations and auto-detected revenue)
    (bankStatements || []).forEach((stmt: any) => {
      const amount = Math.abs(parseFloat(stmt.amount) || 0);
      if (amount <= 0) return;

      let revenueType = stmt.account_type || null;
      let isRevenue = false;

      // Check if manually categorized as revenue
      if (stmt.category === 'revenue') {
        isRevenue = true;
        revenueType = revenueType || 'B2B Sales';
      }

      // Only add if it's a revenue transaction
      if (isRevenue) {
        addToWeekly(
          stmt.transaction_date,
          amount,
          stmt.description || 'Bank deposit',
          'Bank Statement',
          revenueType || 'B2B Sales'
        );
      }
    });

    // Convert map to sorted array
    const weeklyData = Array.from(weeklyDataMap.values()).sort((a, b) => 
      a.weekStart.localeCompare(b.weekStart)
    );

    console.log(`\n🔍 [Weekly Revenue] addToWeekly Summary:`);
    console.log(`  Total calls: ${addToWeeklyCallCount}`);
    console.log(`  Skipped (no date): ${addToWeeklySkippedNoDate}`);
    console.log(`  Skipped (amount <= 0): ${addToWeeklySkippedAmount}`);
    console.log(`  Skipped (before start): ${addToWeeklySkippedBeforeStart}`);
    console.log(`  Skipped (after end): ${addToWeeklySkippedAfterEnd}`);
    console.log(`  Successfully added: ${addToWeeklySuccessCount}\n`);
    
    console.log(`📊 [Weekly Revenue] Aggregated into ${weeklyData.length} weeks`);
    weeklyData.forEach(week => {
      console.log(`  📅 Week ${week.weekStart}: $${week.totalAmount.toFixed(2)} (${week.transactionCount} transactions)`);
      console.log(`     💵 D2C: $${week.breakdown.d2c.toFixed(2)} | B2B: $${week.breakdown.b2b.toFixed(2)} | B2B (factored): $${week.breakdown.b2b_factored.toFixed(2)}`);
    });

    return NextResponse.json({ 
      success: true, 
      data: weeklyData,
      summary: {
        totalWeeks: weeklyData.length,
        totalAmount: weeklyData.reduce((sum, w) => sum + w.totalAmount, 0),
        totalTransactions: weeklyData.reduce((sum, w) => sum + w.transactionCount, 0),
        totalD2C: weeklyData.reduce((sum, w) => sum + w.breakdown.d2c, 0),
        totalB2B: weeklyData.reduce((sum, w) => sum + w.breakdown.b2b, 0),
        totalB2BFactored: weeklyData.reduce((sum, w) => sum + w.breakdown.b2b_factored, 0),
      }
    });

  } catch (error) {
    console.error('❌ [Weekly Revenue] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch weekly revenue data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

